import { env } from 'cloudflare:workers'
export const mutationLimit = { windowMs: 60_000, max: 30 } as const
export async function allowPrivateMutation(userId: string, now = Date.now()) {
  const bucket = Math.floor(now / mutationLimit.windowMs)
  const resetAt = (bucket + 1) * mutationLimit.windowMs
  const result = await env.DB.batch([
    env.DB.prepare(
      `INSERT INTO api_rate_limit (id,hits,reset_at) VALUES (?,1,?)
      ON CONFLICT(id) DO UPDATE SET hits=api_rate_limit.hits+1 WHERE api_rate_limit.hits < ?`,
    ).bind(`${userId}:${bucket}`, resetAt, mutationLimit.max),
    env.DB.prepare('DELETE FROM api_rate_limit WHERE reset_at < ?').bind(now - 3_600_000),
  ])
  return !!result[0]?.meta.changes
}
