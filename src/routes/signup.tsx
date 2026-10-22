import { createFileRoute } from '@tanstack/react-router'
import { AuthForm } from '@/components/auth-form'
import { getAuthInfo } from '@/server/functions'

export const Route = createFileRoute('/signup')({ loader: () => getAuthInfo(), component: Signup })
function Signup() {
  return (
    <AuthForm
      mode="signup"
      local={Route.useLoaderData().local}
      googleReady={Route.useLoaderData().google.ready}
      mailReady={Route.useLoaderData().mailReady}
    />
  )
}
