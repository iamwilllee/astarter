import { createFileRoute } from '@tanstack/react-router'
import { AuthForm } from '@/components/auth-form'
import { getAuthInfo } from '@/server/functions'

export const Route = createFileRoute('/reset-password')({
  validateSearch: (search: Record<string, unknown>) => ({
    token: typeof search.token === 'string' ? search.token : '',
  }),
  loader: () => getAuthInfo(),
  component: Reset,
})
function Reset() {
  return (
    <AuthForm
      mode="reset"
      local={Route.useLoaderData().local}
      googleReady={Route.useLoaderData().google.ready}
      mailReady={Route.useLoaderData().mailReady}
      token={Route.useSearch().token}
    />
  )
}
