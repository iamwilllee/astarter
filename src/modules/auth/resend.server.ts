import { database } from '@/server/database.server'
export async function reserveVerificationResend(email: string) {
  const digest = await crypto.subtle.digest(
    'SHA-256',
    new TextEncoder().encode(email.trim().toLowerCase()),
  )
  const key = Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join(
    '',
  )
  const id = crypto.randomUUID()
  const now = Date.now()
  const result = await database()
    .prepare(
      `INSERT INTO verification_resend (recipient_hash,request_id,next_at) VALUES (?,?,?)
    ON CONFLICT(recipient_hash) DO UPDATE SET request_id=excluded.request_id,next_at=excluded.next_at WHERE verification_resend.next_at <= ?`,
    )
    .bind(key, id, now + 60_000, now)
    .run()
  if (!result.meta.changes) return null
  await database()
    .prepare('DELETE FROM verification_resend WHERE next_at < ?')
    .bind(now - 86_400_000)
    .run()
  return async () => {
    await database()
      .prepare('DELETE FROM verification_resend WHERE recipient_hash=? AND request_id=?')
      .bind(key, id)
      .run()
  }
}
