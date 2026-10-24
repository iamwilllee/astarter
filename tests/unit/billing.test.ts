import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { Miniflare } from 'miniflare'
import { readFile } from 'node:fs/promises'
import Stripe from 'stripe'
import { env } from 'cloudflare:workers'
import { webhook, getBilling } from '../../src/modules/billing/billing.server'
import { handleApi } from '../../src/server/api.server'

// Exercise billing itself even when a generated product has opted out of that module.
vi.mock('@/config/features', async () => ({
  features: (await import('../../src/config/feature-policy.mjs')).featurePreset('billing-test'),
}))

const secret = 'whsec_local_fixture_only'
const nativeFetch = globalThis.fetch
let runtime: Miniflare
let db: Awaited<ReturnType<Miniflare['getD1Database']>>
let current = 'active'
let providerReads = 0
let releaseFirst: (() => void) | undefined
let holdFirst = false
const fixture = (status: string) => ({
  id: 'sub_fixture',
  object: 'subscription',
  customer: 'cus_fixture',
  status,
  metadata: { userId: 'user_fixture' },
  cancel_at_period_end: false,
  items: {
    object: 'list',
    data: [
      {
        id: 'si_fixture',
        price: { id: 'price_fixture' },
        current_period_end: Math.floor(Date.now() / 1000) + 3600,
      },
    ],
  },
})

beforeAll(async () => {
  runtime = new Miniflare({
    workers: [
      {
        config: {
          name: 'billing-test',
          compatibilityDate: '2026-10-19',
          manifest: {
            mainModule: 'index.js',
            modules: {
              'index.js': {
                type: 'esm',
                contents: 'export default { fetch() { return new Response("ok") } }',
              },
            },
          },
          env: { DB: { type: 'd1', id: 'billing-test' } },
        },
      },
    ],
  })
  db = await runtime.getD1Database('DB')
  const sql = await readFile(
    new URL('../../migrations/0000_tan_tarot.sql', import.meta.url),
    'utf8',
  )
  for (const statement of sql.split('--> statement-breakpoint'))
    if (statement.trim()) await db.prepare(statement).run()
  Object.assign(env, {
    DB: db,
    BILLING_ENABLED: 'true',
    STRIPE_SECRET_KEY: 'sk_test_fixture123',
    STRIPE_WEBHOOK_SECRET: secret,
    STRIPE_PRICE_ID: 'price_fixture',
    APP_ORIGIN: 'http://127.0.0.1:3100',
  })
})
beforeEach(async () => {
  await db.batch(
    [
      'DELETE FROM billing_event',
      'DELETE FROM checkout',
      'DELETE FROM subscription',
      'DELETE FROM user',
    ].map((sql) => db.prepare(sql)),
  )
  await db
    .prepare(
      'INSERT INTO user (id,name,email,email_verified,created_at,updated_at) VALUES (?,?,?,?,?,?)',
    )
    .bind('user_fixture', 'Fixture', 'billing@example.test', 1, Date.now(), Date.now())
    .run()
  await db
    .prepare('INSERT INTO checkout (id,user_id,status,created_at) VALUES (?,?,?,?)')
    .bind('cs_fixture', 'user_fixture', 'open', Date.now())
    .run()
  current = 'active'
  providerReads = 0
  holdFirst = false
  releaseFirst = undefined
  Object.assign(env, { BILLING_ENABLED: 'true' })
  vi.stubGlobal('fetch', async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = input instanceof Request ? input.url : String(input)
    if (url.startsWith('https://api.stripe.com/')) {
      providerReads++
      const snapshot = fixture(current)
      if (holdFirst && providerReads === 1)
        await new Promise<void>((resolve) => {
          releaseFirst = resolve
        })
      return Response.json(snapshot)
    }
    return nativeFetch(input, init)
  })
})
afterAll(async () => {
  vi.unstubAllGlobals()
  await runtime?.dispose()
})

function eventRequest(id: string, type = 'customer.subscription.updated', live = false) {
  const payload = JSON.stringify({
    id,
    object: 'event',
    type,
    livemode: live,
    created: Math.floor(Date.now() / 1000),
    data: {
      object:
        type === 'checkout.session.completed'
          ? { id: 'cs_fixture', mode: 'subscription', subscription: 'sub_fixture' }
          : { id: 'sub_fixture' },
    },
  })
  return new Request('http://127.0.0.1:3100/api/billing/webhook', {
    method: 'POST',
    headers: { 'stripe-signature': Stripe.webhooks.generateTestHeaderString({ payload, secret }) },
    body: payload,
  })
}

describe('signed Stripe events against real local D1', () => {
  it('preserves a signed UTF-8 webhook through the API ingress without requiring a browser origin', async () => {
    const payload = JSON.stringify({
      id: 'evt_ingress',
      type: 'unhandled.fixture',
      livemode: false,
      data: { object: { note: '字节保持一致 🌱' } },
    })
    const response = await handleApi(
      new Request('http://127.0.0.1:3100/api/billing/webhook', {
        method: 'POST',
        body: payload,
        headers: {
          'stripe-signature': Stripe.webhooks.generateTestHeaderString({ payload, secret }),
        },
      }),
    )
    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({ received: true })
    expect(providerReads).toBe(0)
  })
  it('continues reconciling subscriptions when new checkout is disabled', async () => {
    Object.assign(env, { BILLING_ENABLED: 'false' })
    await webhook(eventRequest('evt_checkout_disabled'))
    expect((await getBilling('user_fixture')).plan).toBe('pro')
  })
  it('grants matching active access once and scopes completion to the checkout owner', async () => {
    await webhook(eventRequest('evt_completed', 'checkout.session.completed'))
    await webhook(eventRequest('evt_completed', 'checkout.session.completed'))
    expect((await getBilling('user_fixture')).plan).toBe('pro')
    expect((await getBilling('another_user')).plan).toBe('free')
    expect(
      await db.prepare('SELECT status FROM checkout WHERE id=?').bind('cs_fixture').first('status'),
    ).toBe('complete')
    expect(await db.prepare('SELECT COUNT(*) AS count FROM billing_event').first('count')).toBe(1)
    expect(providerReads).toBe(1)
  })
  it('rejects forged and live events before a provider request or database write', async () => {
    const bad = eventRequest('evt_forged')
    bad.headers.set('stripe-signature', 'invalid')
    await expect(webhook(bad)).rejects.toThrow('签名无效')
    await expect(webhook(eventRequest('evt_live', undefined, true))).rejects.toThrow('测试事件')
    expect(providerReads).toBe(0)
    expect(await db.prepare('SELECT COUNT(*) AS count FROM billing_event').first('count')).toBe(0)
  })
  it('retrieves current provider state, so an old event cannot restore canceled access', async () => {
    await webhook(eventRequest('evt_active'))
    current = 'canceled'
    await webhook(eventRequest('evt_cancel', 'customer.subscription.deleted'))
    await webhook(eventRequest('evt_old_active'))
    expect((await getBilling('user_fixture')).plan).toBe('free')
  })
  it('retries a conflicting reconciliation instead of overwriting the newer state', async () => {
    await webhook(eventRequest('evt_initial'))
    providerReads = 0
    holdFirst = true
    const first = webhook(eventRequest('evt_stale'))
    await vi.waitFor(() => expect(releaseFirst).toBeTypeOf('function'))
    current = 'canceled'
    await webhook(eventRequest('evt_newer'))
    releaseFirst!()
    await first
    expect((await getBilling('user_fixture')).plan).toBe('free')
    expect(providerReads).toBe(3)
    expect(await db.prepare('SELECT COUNT(*) AS count FROM billing_event').first('count')).toBe(3)
  })
})
