import { createFileRoute } from '@tanstack/react-router'
import { AuthForm } from '@/components/auth-form'
import { getAuthInfo } from '@/server/functions'

export const Route = createFileRoute('/forgot-password')({
  loader: () => getAuthInfo(),
  component: Forgot,
})
function Forgot() {
  return (
    <AuthForm
      mode="forgot"
      local={Route.useLoaderData().local}
      googleReady={Route.useLoaderData().google.ready}
      mailReady={Route.useLoaderData().mailReady}
    />
  )
}
