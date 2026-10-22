import { createFileRoute } from '@tanstack/react-router'
import { AuthForm } from '@/components/auth-form'
import { getAuthInfo } from '@/server/functions'

export const Route = createFileRoute('/login')({
  validateSearch: (
    search: Record<string, unknown>,
  ): { verified?: boolean; oauthError?: boolean } => ({
    verified: search.verified === '1' || search.verified === 1 || search.verified === true,
    oauthError: search.oauthError === '1' || search.oauthError === 1 || search.oauthError === true,
  }),
  loader: () => getAuthInfo(),
  component: Login,
})
function Login() {
  const info = Route.useLoaderData()
  const { verified, oauthError } = Route.useSearch()
  return (
    <AuthForm
      mode="login"
      local={info.local}
      googleReady={info.google.ready}
      mailReady={info.mailReady}
      verified={verified}
      oauthError={oauthError}
    />
  )
}
