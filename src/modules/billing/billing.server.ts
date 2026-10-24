import { features } from '@/config/features'
import { database } from '@/server/database.server'
import Stripe from 'stripe'
import { env } from 'cloudflare:workers'
import { HttpError, boundedText } from '@/server/http.server'
import { hasProAccess, isTestKey } from './policy'
import { localizePath, type Locale } from '@/i18n/core'
import { plans } from '@/config/site'

interface SubscriptionRow {
  id: string
  user_id: string
  customer_id: string
  status: string
  price_id: string
  current_period_end: number
  cancel_at_period_end: number
  revision: number
  sync_id: string
  updated_at: number
}

export function billingStatus() {
  const enabled = features.billing && env.BILLING_ENABLED === 'true'
  const configured =
    isTestKey(env.STRIPE_SECRET_KEY) && !!env.STRIPE_WEBHOOK_SECRET && !!env.STRIPE_PRICE_ID
  return { enabled, configured, mode: 'test' as const, ready: enabled && configured }
}
function stripeClient() {
  if (!billingStatus().configured) throw new HttpError(503, 'Stripe 测试支付尚未配置')
  return new Stripe(env.STRIPE_SECRET_KEY!, {
    httpClient: Stripe.createFetchHttpClient(),
    maxNetworkRetries: 2,
    timeout: 10_000,
  })
}
export async function getBilling(userId: string) {
  if (!features.billing)
    return {
      provider: { enabled: false, configured: false, mode: 'test' as const, ready: false },
      plan: 'free' as const,
      projectLimit: plans.free.projectLimit,
      subscription: null,
    }
  const rows = await database()
    .prepare('SELECT * FROM subscription WHERE user_id = ? ORDER BY updated_at DESC')
    .bind(userId)
    .all<SubscriptionRow>()
  const pro = rows.results.find((row) => hasProAccess(row, env.STRIPE_PRICE_ID))
  const latest = pro ?? rows.results[0]
  return {
    provider: billingStatus(),
    plan: pro ? ('pro' as const) : ('free' as const),
    projectLimit: pro ? plans.pro.projectLimit : plans.free.projectLimit,
    subscription: latest
      ? {
          status: latest.status,
          currentPeriodEnd: latest.current_period_end,
          cancelAtPeriodEnd: !!latest.cancel_at_period_end,
        }
      : null,
  }
}
export async function checkout(userId: string, email: string, locale: Locale = 'en') {
  if (!billingStatus().ready) throw new HttpError(503, 'Stripe 测试支付尚未配置或结账已关闭')
  const stripe = stripeClient()
  if ((await getBilling(userId)).plan === 'pro')
    throw new HttpError(409, '已有有效订阅，请通过账单门户管理')
  const existing = await database()
    .prepare(
      'SELECT customer_id FROM subscription WHERE user_id = ? ORDER BY updated_at DESC LIMIT 1',
    )
    .bind(userId)
    .first<{ customer_id: string }>()
  const result = await stripe.checkout.sessions.create(
    {
      mode: 'subscription',
      ...(existing ? { customer: existing.customer_id } : { customer_email: email }),
      client_reference_id: userId,
      metadata: { userId },
      subscription_data: { metadata: { userId } },
      line_items: [{ price: env.STRIPE_PRICE_ID!, quantity: 1 }],
      success_url: `${env.APP_ORIGIN}${localizePath('/app/billing', locale)}?checkout={CHECKOUT_SESSION_ID}`,
      cancel_url: `${env.APP_ORIGIN}${localizePath('/app/billing', locale)}?canceled=1`,
    },
    {
      idempotencyKey: `checkout:${userId}:${env.STRIPE_PRICE_ID}:${Math.floor(Date.now() / 300_000)}`,
    },
  )
  if (!result.url) throw new HttpError(502, '支付服务没有返回结账地址')
  await database()
    .prepare(
      'INSERT INTO checkout (id, user_id, status, created_at) VALUES (?, ?, ?, ?) ON CONFLICT(id) DO NOTHING',
    )
    .bind(result.id, userId, 'open', Date.now())
    .run()
  return { url: result.url }
}
export async function portal(userId: string, locale: Locale = 'en') {
  const stripe = stripeClient()
  const sub = await database()
    .prepare(
      'SELECT customer_id FROM subscription WHERE user_id = ? ORDER BY updated_at DESC LIMIT 1',
    )
    .bind(userId)
    .first<{ customer_id: string }>()
  if (!sub) throw new HttpError(404, '还没有可管理的订阅')
  const result = await stripe.billingPortal.sessions.create({
    customer: sub.customer_id,
    return_url: `${env.APP_ORIGIN}${localizePath('/app/billing', locale)}`,
  })
  return { url: result.url }
}

// A fresh provider read plus a D1 compare-and-swap prevents an older webhook response
// from overwriting a newer reconciliation. No provider calls run inside a DB transaction.
async function reconcile(
  stripe: Stripe,
  subscriptionId: string,
  event: Stripe.Event,
  checkoutId?: string,
) {
  for (let attempt = 0; attempt < 4; attempt++) {
    if (
      await database().prepare('SELECT id FROM billing_event WHERE id = ?').bind(event.id).first()
    )
      return
    const previous = await database()
      .prepare('SELECT revision, user_id FROM subscription WHERE id = ?')
      .bind(subscriptionId)
      .first<{ revision: number; user_id: string }>()
    const sub = await stripe.subscriptions.retrieve(subscriptionId)
    const userId = sub.metadata.userId
    if (
      !userId ||
      !(await database().prepare('SELECT id FROM user WHERE id = ?').bind(userId).first())
    )
      throw new HttpError(422, '订阅缺少有效的用户关联')
    if (previous && previous.user_id !== userId) throw new HttpError(422, '订阅用户关联发生变化')
    const item = sub.items.data.find((entry) => entry.price.id === env.STRIPE_PRICE_ID)
    const syncId = crypto.randomUUID()
    const customer = typeof sub.customer === 'string' ? sub.customer : sub.customer.id
    const results = await database().batch([
      database()
        .prepare(
          `INSERT INTO subscription (id, user_id, customer_id, status, price_id, current_period_end, cancel_at_period_end, revision, sync_id, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, 1, ?, ?)
        ON CONFLICT(id) DO UPDATE SET status=excluded.status, price_id=excluded.price_id,
        current_period_end=excluded.current_period_end, cancel_at_period_end=excluded.cancel_at_period_end,
        revision=subscription.revision+1, sync_id=excluded.sync_id, updated_at=excluded.updated_at
        WHERE subscription.revision = ? AND subscription.user_id = excluded.user_id`,
        )
        .bind(
          sub.id,
          userId,
          customer,
          sub.status,
          item?.price.id ?? '',
          item?.current_period_end ?? 0,
          sub.cancel_at_period_end ? 1 : 0,
          syncId,
          Date.now(),
          previous?.revision ?? 0,
        ),
      database()
        .prepare(
          `INSERT INTO billing_event (id, type, processed_at)
        SELECT ?, ?, ? WHERE EXISTS (SELECT 1 FROM subscription WHERE id = ? AND sync_id = ?)
        ON CONFLICT(id) DO NOTHING`,
        )
        .bind(event.id, event.type, Date.now(), sub.id, syncId),
      database()
        .prepare(
          `UPDATE checkout SET status='complete' WHERE id = ? AND user_id = ?
        AND EXISTS (SELECT 1 FROM subscription WHERE id = ? AND sync_id = ?)`,
        )
        .bind(checkoutId ?? '', userId, sub.id, syncId),
    ])
    if (results[0]?.meta.changes) return
  }
  throw new HttpError(503, '订阅状态正在同步，请重试事件')
}
export async function webhook(request: Request) {
  const stripe = stripeClient()
  const signature = request.headers.get('stripe-signature')
  if (!signature) throw new HttpError(400, '缺少支付事件签名')
  let event: Stripe.Event
  try {
    event = await stripe.webhooks.constructEventAsync(
      await boundedText(request, 262_144),
      signature,
      env.STRIPE_WEBHOOK_SECRET!,
      undefined,
      Stripe.createSubtleCryptoProvider(),
    )
  } catch {
    throw new HttpError(400, '支付事件签名无效')
  }
  if (event.livemode) throw new HttpError(400, '当前仅接受 Stripe 测试事件')
  if (event.type === 'checkout.session.completed') {
    const session = event.data.object
    const subscriptionId =
      typeof session.subscription === 'string' ? session.subscription : session.subscription?.id
    if (!subscriptionId || session.mode !== 'subscription') return { received: true }
    await reconcile(stripe, subscriptionId, event, session.id)
  } else if (
    event.type === 'customer.subscription.created' ||
    event.type === 'customer.subscription.updated' ||
    event.type === 'customer.subscription.deleted'
  ) {
    await reconcile(stripe, event.data.object.id, event)
  }
  return { received: true }
}
