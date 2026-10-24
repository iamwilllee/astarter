import { env } from 'cloudflare:workers'
import { features } from '@/config/features'
import { HttpError } from './http.server'

export function database(): D1Database {
  if (!features.database) throw new HttpError(404, '接口不存在')
  const binding: unknown = Reflect.get(env, 'DB')
  if (
    !binding ||
    typeof binding !== 'object' ||
    !('prepare' in binding) ||
    typeof binding.prepare !== 'function'
  )
    throw new HttpError(503, '服务暂时不可用，请稍后重试')
  return binding as D1Database
}
