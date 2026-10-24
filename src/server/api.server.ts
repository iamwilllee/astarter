import { features } from '@/config/features'
import { database } from '@/server/database.server'
import { env } from 'cloudflare:workers'
import { requestLocale, localizedError } from '@/i18n/core'
import { z } from 'zod'
import { requireUser, isAdmin } from '@/modules/auth/auth.server'
import {
  billingStatus,
  getBilling,
  checkout,
  portal,
  webhook,
} from '@/modules/billing/billing.server'
import { projectInput, type Project } from '@/modules/projects/validation'
import { allowPrivateMutation } from './rate-limit.server'
import { workspace } from './app.server'
import {
  HttpError,
  assertOrigin,
  body,
  bufferRequestBody,
  isLocalRequest,
  json,
} from './http.server'

export async function handleApi(request: Request): Promise<Response> {
  try {
    const path = new URL(request.url).pathname
    const method = request.method
    if (!['GET', 'HEAD'].includes(method))
      request = await bufferRequestBody(request, path === '/api/billing/webhook' ? 262_144 : 16_384)
    if (path === '/api/health' && method === 'GET') {
      if (features.database) await database().prepare('SELECT 1').first()
      return json({
        ok: true,
        storage: features.database ? 'd1' : 'none',
        runtime: 'cloudflare',
        billing: billingStatus().ready ? 'test' : 'unconfigured',
      })
    }
    if (
      (!features.auth && path !== '/api/dev/mail') ||
      (!features.projects && path.startsWith('/api/projects')) ||
      (!features.billing && path.startsWith('/api/billing')) ||
      ((!features.mail || !features.database) && path === '/api/dev/mail')
    )
      throw new HttpError(404, '接口不存在')
    if (path === '/api/billing/webhook' && method === 'POST') return json(await webhook(request))
    if (!['GET', 'HEAD'].includes(method)) assertOrigin(request)
    if (path === '/api/dev/mail' && method === 'GET') {
      if (!isLocalRequest(request) || env.MAIL_MODE !== 'local')
        throw new HttpError(404, '页面不存在')
      const result = await database()
        .prepare(
          'SELECT id, recipient, subject, url, created_at FROM dev_mail ORDER BY created_at DESC LIMIT 30',
        )
        .all()
      return json(result.results)
    }
    if (path === '/api/workspace' && method === 'GET') return json(await workspace(request))
    const user = await requireUser(request)
    if (!['GET', 'HEAD'].includes(method) && !(await allowPrivateMutation(user.id)))
      throw new HttpError(429, '请求过于频繁，请稍后重试')
    if (path === '/api/projects') {
      if (method === 'GET') {
        const url = new URL(request.url)
        const query = (url.searchParams.get('q') ?? '').slice(0, 80)
        const status = url.searchParams.get('status') ?? 'all'
        const result = await database()
          .prepare(
            `SELECT id, name, description, status, created_at, updated_at FROM project
          WHERE user_id = ? AND instr(lower(name), lower(?)) > 0 AND (? = 'all' OR status = ?) ORDER BY created_at DESC LIMIT 100`,
          )
          .bind(user.id, query, status, status)
          .all<Project>()
        return json(result.results)
      }
      if (method === 'POST') {
        const input = await body(request, projectInput)
        const billing = await getBilling(user.id)
        const id = crypto.randomUUID()
        const now = Date.now()
        // The quota check is in the INSERT, so simultaneous requests cannot overrun it.
        const result = await database()
          .prepare(
            `INSERT INTO project (id, user_id, name, description, status, created_at, updated_at)
          SELECT ?, ?, ?, ?, ?, ?, ? WHERE (SELECT COUNT(*) FROM project WHERE user_id = ?) < ?`,
          )
          .bind(
            id,
            user.id,
            input.name,
            input.description,
            input.status,
            now,
            now,
            user.id,
            billing.projectLimit,
          )
          .run()
        if (!result.meta.changes)
          throw new HttpError(409, `当前套餐最多创建 ${billing.projectLimit} 个项目`)
        return json({ id, ...input, created_at: now, updated_at: now }, 201)
      }
    }
    const match = /^\/api\/projects\/([a-zA-Z0-9-]+)$/.exec(path)
    if (match) {
      const id = match[1]!
      if (method === 'PATCH') {
        const input = await body(request, projectInput)
        const result = await database()
          .prepare(
            'UPDATE project SET name = ?, description = ?, status = ?, updated_at = ? WHERE id = ? AND user_id = ?',
          )
          .bind(input.name, input.description, input.status, Date.now(), id, user.id)
          .run()
        if (!result.meta.changes) throw new HttpError(404, '项目不存在')
        return json({ ok: true })
      }
      if (method === 'DELETE') {
        const result = await database()
          .prepare('DELETE FROM project WHERE id = ? AND user_id = ?')
          .bind(id, user.id)
          .run()
        if (!result.meta.changes) throw new HttpError(404, '项目不存在')
        return json({ ok: true })
      }
    }
    if (path === '/api/billing' && method === 'GET') return json(await getBilling(user.id))
    if (path === '/api/billing/checkout' && method === 'POST')
      return json(await checkout(user.id, user.email, requestLocale(request)))
    if (path === '/api/billing/portal' && method === 'POST')
      return json(await portal(user.id, requestLocale(request)))
    if (path === '/api/billing/checkout-status' && method === 'GET') {
      const id = new URL(request.url).searchParams.get('id') ?? ''
      const record = await database()
        .prepare('SELECT status FROM checkout WHERE id = ? AND user_id = ?')
        .bind(id, user.id)
        .first<{ status: string }>()
      if (!record) throw new HttpError(404, '订单不存在')
      return json(record)
    }
    if (path === '/api/admin/users' && method === 'GET') {
      if (!(await isAdmin(user.id))) throw new HttpError(403, '需要管理员权限')
      return json(
        (
          await database()
            .prepare(
              'SELECT id, name, email, email_verified, created_at FROM user ORDER BY created_at DESC LIMIT 100',
            )
            .all()
        ).results,
      )
    }
    if (path === '/api/profile' && method === 'PATCH') {
      const input = await body(
        request,
        z.object({ name: z.string().trim().min(1, '请输入姓名').max(60, '姓名不超过 60 个字符') }),
      )
      await database()
        .prepare('UPDATE user SET name = ?, updated_at = ? WHERE id = ?')
        .bind(input.name, Date.now(), user.id)
        .run()
      return json({ ok: true })
    }
    throw new HttpError(404, '接口不存在')
  } catch (error) {
    if (error instanceof HttpError)
      return json({ error: localizedError(error.message, requestLocale(request)) }, error.status)
    console.error(
      JSON.stringify({
        event: 'api_error',
        path: new URL(request.url).pathname,
        error: error instanceof Error ? error.name : 'UnknownError',
      }),
    )
    return json(
      { error: localizedError('服务暂时不可用，请稍后重试', requestLocale(request)) },
      500,
    )
  }
}
