import { beforeAll, afterAll, it, expect } from 'vitest'
import { env } from 'cloudflare:workers'
import { testDatabase } from '../helpers/database'
import { allowPrivateMutation, mutationLimit } from '../../src/server/rate-limit.server'
import { reserveVerificationResend } from '../../src/modules/auth/resend.server'
let runtime: Awaited<ReturnType<typeof testDatabase>>
beforeAll(async () => {
  runtime = await testDatabase()
  Object.assign(env, { DB: runtime.db })
})
afterAll(async () => runtime?.dispose())
it('enforces atomic per-account mutation limits under concurrent requests and recovers next window', async () => {
  const now = 1_800_000_010_000
  const allowed = await Promise.all(
    Array.from({ length: mutationLimit.max + 3 }, () => allowPrivateMutation('user-a', now)),
  )
  expect(allowed.filter(Boolean)).toHaveLength(mutationLimit.max)
  expect(await allowPrivateMutation('user-b', now)).toBe(true)
  expect(await allowPrivateMutation('user-a', now + 60_000)).toBe(true)
})
it('allows only one concurrent resend and releases failed reservations without clearing a newer request', async () => {
  const [first, second] = await Promise.all([
    reserveVerificationResend('retry@example.test'),
    reserveVerificationResend('RETRY@example.test'),
  ])
  expect([first, second].filter(Boolean)).toHaveLength(1)
  const release = first ?? second
  await release!()
  const next = await reserveVerificationResend('retry@example.test')
  expect(next).toBeTypeOf('function')
  await release!()
  expect(await reserveVerificationResend('retry@example.test')).toBeNull()
  await next!()
})
