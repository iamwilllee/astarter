import { describe, expect, it } from 'vitest'
import { env } from 'cloudflare:workers'
import {
  assertOrigin,
  boundedText,
  bufferRequestBody,
  isLocalRequest,
} from '../../src/server/http.server'

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
  it('consumes the input stream and preserves exact bytes, headers, method and URL for downstream handlers', async () => {
    const bytes = new Uint8Array([0, 0xff, 0xe4, 0xb8, 0xad, 10])
    const request = new Request('https://app.example/api/billing/webhook?fixture=1', {
      method: 'POST',
      headers: {
        'content-type': 'application/octet-stream',
        'stripe-signature': 'fixture-signature',
      },
      body: bytes,
    })
    const buffered = await bufferRequestBody(request)
    expect(request.bodyUsed).toBe(true)
    expect(buffered.url).toBe(request.url)
    expect(buffered.method).toBe('POST')
    expect([...buffered.headers]).toEqual([...request.headers])
    expect(new Uint8Array(await buffered.arrayBuffer())).toEqual(bytes)
  })
  it('rejects oversized ingress before a downstream handler can run and cancels the source', async () => {
    let canceled = false
    const source = new ReadableStream({
      start(controller) {
        controller.enqueue(new Uint8Array(8))
      },
      cancel() {
        canceled = true
      },
    })
    const init: RequestInit & { duplex: 'half' } = {
      method: 'POST',
      body: source,
      duplex: 'half',
    }
    const request = new Request('https://app.example/api/projects', init)
    await expect(bufferRequestBody(request, 7)).rejects.toMatchObject({ status: 413 })
    expect(canceled).toBe(true)
  })
  it('does not replace bodyless requests or share concurrent request payloads', async () => {
    const empty = new Request('https://app.example/api/health')
    expect(await bufferRequestBody(empty)).toBe(empty)
    const values = ['first 中', 'second 文']
    const responses = await Promise.all(
      values.map(async (value) => {
        const buffered = await bufferRequestBody(
          new Request('https://app.example/api/projects', {
            method: 'POST',
            body: value,
          }),
        )
        return buffered.text()
      }),
    )
    expect(responses).toEqual(values)
  })
})
