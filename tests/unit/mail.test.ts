import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { env } from 'cloudflare:workers'
import { z } from 'zod'
import { isMailConfigured, sendAuthMail } from '../../src/modules/mail/mail.server'
import { mailSender, sendProviderMail } from '../../src/modules/mail/providers.server'

// Keep adapter tests independent of whether this product selected transactional mail.
vi.mock('@/config/features', async () => ({
  features: (await import('../../src/config/feature-policy.mjs')).featurePreset('web-app'),
}))

const origin = 'https://app.product.example'
const recipient = 'recipient@example.test'
const link = origin + '/api/auth/verify-email?token=fixture-only'
const request = new Request(origin + '/api/auth/sign-up/email')
const message = {
  from: 'Product <accounts@mail.product.example>',
  to: recipient,
  subject: 'Fixture',
  text: link,
  html: `<a href="${link}">Verify</a>`,
}

beforeEach(() => {
  for (const key of Object.keys(env)) Reflect.deleteProperty(env, key)
  Object.assign(env, { ENVIRONMENT: 'production', APP_ORIGIN: origin, MAIL_FROM: message.from })
})
afterEach(() => {
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
})

describe('explicit mail provider configuration', () => {
  it('accepts plain addresses or display names, rejecting header injection and placeholders', () => {
    expect(mailSender(message.from)).toEqual({
      name: 'Product',
      email: 'accounts@mail.product.example',
    })
    expect(mailSender('accounts@mail.product.example')).toEqual({
      email: 'accounts@mail.product.example',
    })
    for (const value of [
      undefined,
      '',
      'invalid',
      'a@example.com',
      'a@example.invalid',
      'Name <a@product.example> trailing',
      'Name\r\nBcc:other@product.example <a@product.example>',
    ])
      expect(mailSender(value)).toBeNull()
  })
  it('requires the selected provider key and never uses another provider implicitly', async () => {
    const fetcher = vi.fn()
    vi.stubGlobal('fetch', fetcher)
    Object.assign(env, { MAIL_MODE: 'brevo', RESEND_API_KEY: 'fixture-unused' })
    expect(isMailConfigured(request)).toBe(false)
    await expect(sendAuthMail(request, recipient, 'verify', link)).rejects.toThrow('not configured')
    expect(fetcher).not.toHaveBeenCalled()
    Object.assign(env, { BREVO_API_KEY: 'fixture-selected' })
    expect(isMailConfigured(request)).toBe(true)
    Object.assign(env, { MAIL_FROM: 'Aster <no-reply@example.invalid>' })
    expect(isMailConfigured(request)).toBe(false)
  })
  it('keeps local test mail on the matching loopback origin and never calls a provider', async () => {
    const run = vi.fn(() => Promise.resolve({}))
    const bind = vi.fn(() => ({ run }))
    const prepare = vi.fn(() => ({ bind }))
    const fetcher = vi.fn()
    vi.stubGlobal('fetch', fetcher)
    Object.assign(env, {
      ENVIRONMENT: 'local',
      APP_ORIGIN: 'http://127.0.0.1:3100',
      MAIL_MODE: 'local',
      DB: { prepare },
    })
    const local = new Request('http://127.0.0.1:3100/api/auth/sign-up/email')
    expect(isMailConfigured(local)).toBe(true)
    expect(
      isMailConfigured(new Request('https://public.product.example/api/auth/sign-up/email')),
    ).toBe(false)
    await sendAuthMail(
      local,
      recipient,
      'verify',
      'http://127.0.0.1:3100/api/auth/verify-email?token=fixture',
    )
    expect(run).toHaveBeenCalledTimes(2)
    expect(fetcher).not.toHaveBeenCalled()
  })
  it('retains CF binding delivery and refuses an absent binding', async () => {
    Object.assign(env, { MAIL_MODE: 'cloudflare' })
    expect(isMailConfigured(request)).toBe(false)
    const send = vi
      .fn<(message: { to: string; from: string; text: string }) => Promise<void>>()
      .mockResolvedValue(undefined)
    Object.assign(env, { EMAIL: { send } })
    expect(isMailConfigured(request)).toBe(true)
    await sendAuthMail(request, recipient, 'verify', link)
    expect(send.mock.calls[0]?.[0].to).toBe(recipient)
    expect(send.mock.calls[0]?.[0].from).toBe(message.from)
    expect(send.mock.calls[0]?.[0].text).toContain(link)
  })
})

describe.each(['brevo', 'resend'] as const)('%s adapter (mock only, no real email)', (provider) => {
  it('sends the localized template to the fixed API with only its own secret', async () => {
    const response = new Response('provider response is discarded', {
      status: provider === 'brevo' ? 201 : 200,
    })
    const cancel = vi.spyOn(response.body!, 'cancel')
    const fetcher = vi
      .fn<(url: string, init: RequestInit) => Promise<Response>>()
      .mockResolvedValue(response)
    vi.stubGlobal('fetch', fetcher)
    Object.assign(env, {
      MAIL_MODE: provider,
      BREVO_API_KEY: 'fixture-brevo',
      RESEND_API_KEY: 'fixture-resend',
    })
    const chinese = new Request(request, { headers: { 'x-starter-locale': 'zh' } })
    await sendAuthMail(chinese, recipient, 'reset', link)
    const [url, init] = fetcher.mock.calls[0]!
    expect(url).toBe(
      provider === 'brevo'
        ? 'https://api.brevo.com/v3/smtp/email'
        : 'https://api.resend.com/emails',
    )
    const headers = new Headers(init?.headers)
    expect(headers.get(provider === 'brevo' ? 'api-key' : 'Authorization')).toBe(
      provider === 'brevo' ? 'fixture-brevo' : 'Bearer fixture-resend',
    )
    expect(headers.has(provider === 'brevo' ? 'Authorization' : 'api-key')).toBe(false)
    if (typeof init.body !== 'string') throw new Error('Expected a JSON request body')
    const body = z.record(z.string(), z.unknown()).parse(JSON.parse(init.body))
    expect(body.subject).toContain('重置')
    expect(provider === 'brevo' ? body.textContent : body.text).toContain(link)
    expect(provider === 'brevo' ? body.htmlContent : body.html).toContain('lang="zh"')
    expect(body.to).toEqual(provider === 'brevo' ? [{ email: recipient }] : [recipient])
    expect(provider === 'brevo' ? body.sender : body.from).toEqual(
      provider === 'brevo' ? mailSender(message.from) : message.from,
    )
    expect(init?.redirect).toBe('error')
    expect(init?.signal).toBeInstanceOf(AbortSignal)
    expect(cancel).toHaveBeenCalledOnce()
    expect(fetcher).toHaveBeenCalledOnce()
  })
  it.each([302, 400, 401, 429, 500])(
    'rejects HTTP %s without exposing response content, retries or fallback',
    async (status) => {
      const fetcher = vi.fn(() =>
        Promise.resolve(
          new Response('fixture secret and verification token must not escape', { status }),
        ),
      )
      vi.stubGlobal('fetch', fetcher)
      await expect(sendProviderMail(provider, 'fixture-key', message)).rejects.toThrow(
        /^Transactional email provider did not confirm acceptance$/,
      )
      expect(fetcher).toHaveBeenCalledOnce()
    },
  )
  it('bounds requests to ten seconds and sanitizes network/abort errors', async () => {
    const timeout = vi.spyOn(AbortSignal, 'timeout').mockReturnValue(AbortSignal.abort())
    const fetcher = vi.fn((_url: unknown, init: RequestInit) => {
      expect(init.signal?.aborted).toBe(true)
      return Promise.reject(new Error('fixture-key and recipient data in network error'))
    })
    vi.stubGlobal('fetch', fetcher)
    await expect(sendProviderMail(provider, 'fixture-key', message)).rejects.toThrow(
      /^Transactional email provider did not confirm acceptance$/,
    )
    expect(timeout).toHaveBeenCalledWith(10_000)
    expect(fetcher).toHaveBeenCalledOnce()
  })
  it('rejects foreign callback origins before making any request', async () => {
    const fetcher = vi.fn()
    vi.stubGlobal('fetch', fetcher)
    Object.assign(env, {
      MAIL_MODE: provider,
      BREVO_API_KEY: 'fixture-brevo',
      RESEND_API_KEY: 'fixture-resend',
    })
    await expect(
      sendAuthMail(request, recipient, 'verify', 'https://foreign.example/verify'),
    ).rejects.toThrow('origin mismatch')
    expect(fetcher).not.toHaveBeenCalled()
  })
})
