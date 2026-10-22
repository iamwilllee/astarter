import { env } from 'cloudflare:workers'
import { authMail, type AuthMailKind } from './template'
import { requestLocale } from '@/i18n/core'
import { isLocalRequest } from '@/server/http.server'

function emailBinding(): SendEmail | undefined {
  const value: unknown = Reflect.get(env, 'EMAIL')
  if (!value || typeof value !== 'object' || !('send' in value) || typeof value.send !== 'function')
    return undefined
  return value as SendEmail
}

export function isMailConfigured(request: Request) {
  return (
    (env.MAIL_MODE === 'local' && isLocalRequest(request)) ||
    (env.MAIL_MODE === 'cloudflare' && !!emailBinding())
  )
}

export async function sendAuthMail(
  request: Request,
  recipient: string,
  kind: AuthMailKind,
  url: string,
) {
  const { subject, text, html } = authMail(kind, url, requestLocale(request))
  if (new URL(url).origin !== new URL(env.APP_ORIGIN).origin)
    throw new Error('Mail link origin mismatch')
  if (env.MAIL_MODE === 'local' && isLocalRequest(request)) {
    await env.DB.prepare(
      'INSERT INTO dev_mail (id, recipient, subject, url, created_at) VALUES (?, ?, ?, ?, ?)',
    )
      .bind(crypto.randomUUID(), recipient, subject, url, Date.now())
      .run()
    // Local-only tokens expire with their auth record; keep the test inbox short-lived too.
    await env.DB.prepare('DELETE FROM dev_mail WHERE created_at < ?')
      .bind(Date.now() - 86_400_000)
      .run()
    return
  }
  if (env.MAIL_MODE === 'cloudflare') {
    const email = emailBinding()
    if (!email) throw new Error('Cloudflare email binding is not configured')
    const from = env.MAIL_FROM
    const message = {
      to: recipient,
      from,
      subject,
      text,
      html,
    }
    await email.send(message)
    return
  }
  throw new Error('Transactional email is not configured')
}
