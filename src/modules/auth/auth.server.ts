import { betterAuth } from 'better-auth/minimal'
import { drizzleAdapter } from '@better-auth/drizzle-adapter'
import { drizzle } from 'drizzle-orm/d1'
import { env, waitUntil } from 'cloudflare:workers'
import { googleAuthStatus } from './config.server'
import { site } from '@/config/site'
import * as schema from '@/db/schema'
import { sendAuthMail } from '@/modules/mail/mail.server'
import { HttpError, isLocalRequest } from '@/server/http.server'

export function createAuth(request: Request) {
  if (!env.BETTER_AUTH_SECRET || env.BETTER_AUTH_SECRET.length < 32)
    throw new Error('BETTER_AUTH_SECRET must contain at least 32 characters')
  return betterAuth({
    appName: site.name,
    secret: env.BETTER_AUTH_SECRET,
    baseURL: env.APP_ORIGIN,
    trustedOrigins: [env.APP_ORIGIN],
    socialProviders: googleAuthStatus().ready
      ? { google: { clientId: env.GOOGLE_CLIENT_ID!, clientSecret: env.GOOGLE_CLIENT_SECRET! } }
      : {},
    database: drizzleAdapter(drizzle(env.DB, { schema }), {
      provider: 'sqlite',
      schema,
      transaction: false,
    }),
    emailAndPassword: {
      enabled: true,
      minPasswordLength: 12,
      maxPasswordLength: 128,
      requireEmailVerification: true,
      revokeSessionsOnPasswordReset: true,
      sendResetPassword: async ({ user, url }) => {
        await sendAuthMail(request, user.email, 'reset', url)
      },
    },
    emailVerification: {
      sendOnSignUp: true,
      autoSignInAfterVerification: false,
      sendVerificationEmail: async ({ user, url }) => {
        await sendAuthMail(request, user.email, 'verify', url)
      },
    },
    session: { expiresIn: 604_800, updateAge: 86_400 },
    rateLimit: {
      enabled: true,
      storage: 'database',
      window: 60,
      max: 60,
      customRules: {
        '/sign-in/email': { window: 60, max: 10 },
        '/send-verification-email': { window: 60, max: 5 },
      },
    },
    advanced: {
      backgroundTasks: isLocalRequest(request) ? undefined : { handler: waitUntil },
      useSecureCookies: !isLocalRequest(request),
      ipAddress: { ipAddressHeaders: ['cf-connecting-ip'] },
    },
  })
}
export async function requireUser(request: Request) {
  const session = await createAuth(request).api.getSession({ headers: request.headers })
  if (!session?.user.emailVerified) throw new HttpError(401, '请先登录并验证邮箱')
  return session.user
}
export async function isAdmin(userId: string) {
  return !!(await env.DB.prepare('SELECT user_id FROM admin_user WHERE user_id = ?')
    .bind(userId)
    .first())
}
