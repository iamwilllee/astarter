import { describe, expect, it } from 'vitest'
import { env } from 'cloudflare:workers'
import { assertOrigin, boundedText, isLocalRequest } from '../../src/server/http.server'

describe('request boundaries', () => {
  it('exposes the development inbox only on a matching loopback origin in local mode', () => {
    Object.assign(env, { ENVIRONMENT: 'local', APP_ORIGIN: 'http://127.0.0.1:3100' })
    expect(isLocalRequest(new Request('http://127.0.0.1:3100/dev/inbox'))).toBe(true)
    expect(isLocalRequest(new Request('https://public.example/dev/inbox'))).toBe(false)
    expect(isLocalRequest(new Request('http://localhost:3100/dev/inbox'))).toBe(false)
    Object.assign(env, { ENVIRONMENT: 'production' })
    expect(isLocalRequest(new Request('http://127.0.0.1:3100/dev/inbox'))).toBe(false)
  })
  it('rejects missing and foreign mutation origins', () => {
    Object.assign(env, { APP_ORIGIN: 'https://app.example' })
    expect(() => assertOrigin(new Request('https://app.example/api/projects'))).toThrow('来源')
    expect(() =>
      assertOrigin(
        new Request('https://app.example/api/projects', {
          headers: { origin: 'https://other.example' },
        }),
      ),
    ).toThrow('来源')
    expect(() =>
      assertOrigin(
        new Request('https://app.example/api/projects', {
          headers: { origin: 'https://app.example' },
        }),
      ),
    ).not.toThrow()
  })
  it('bounds streamed bodies by bytes even without a content-length header', async () => {
    const request = new Request('http://localhost', { method: 'POST', body: '中文' })
    await expect(boundedText(request, 5)).rejects.toThrow('过大')
  })
})
