import { features } from '@/config/features'
import { env } from 'cloudflare:workers'
export function googleAuthStatus() {
  const enabled = features.auth && features.google && String(env.GOOGLE_AUTH_ENABLED) === 'true'
  const configured = !!env.GOOGLE_CLIENT_ID?.trim() && !!env.GOOGLE_CLIENT_SECRET?.trim()
  return { enabled, configured, ready: enabled && configured }
}
