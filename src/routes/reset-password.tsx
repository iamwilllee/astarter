import { features } from '@/config/features'
import { notFound } from '@tanstack/react-router'
import { createFileRoute } from '@tanstack/react-router'
import { AuthForm } from '@/components/auth-form'
import { getAuthInfo } from '@/server/functions'

export const Route = createFileRoute('/reset-password')({
  beforeLoad: () => {
    if (!features.auth || !features.emailPassword) throw notFound()
  },
  validateSearch: (search: Record<string, unknown>) => ({
    token: typeof search.token === 'string' ? search.token : '',
  }),
  loader: () => getAuthInfo(),
  component: Reset,
})
function Reset() {
  return (
    <AuthForm
      emailPasswordEnabled={Route.useLoaderData().emailPassword}
      mode="reset"
      local={Route.useLoaderData().local}
      googleReady={Route.useLoaderData().google.ready}
      mailReady={Route.useLoaderData().mailReady}
      token={Route.useSearch().token}
    />
  )
}
