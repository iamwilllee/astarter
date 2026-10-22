import { browserLocale, translate } from '@/i18n/core'

export async function api<T>(
  path: string,
  options?: { method?: string; data?: unknown },
): Promise<T> {
  const response = await fetch(path, {
    method: options?.method ?? 'GET',
    credentials: 'same-origin',
    headers: {
      'x-starter-locale': browserLocale(),
      ...(options?.data === undefined ? {} : { 'Content-Type': 'application/json' }),
    },
    ...(options?.data === undefined ? {} : { body: JSON.stringify(options.data) }),
  })
  const data: unknown = await response.json()
  if (!response.ok)
    throw new Error(
      typeof data === 'object' && data !== null && 'error' in data
        ? String(data.error)
        : translate(browserLocale(), 'error_request_failed'),
    )
  return data as T
}
