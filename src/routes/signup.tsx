import { features } from '@/config/features'
import { notFound } from '@tanstack/react-router'
import { createFileRoute } from '@tanstack/react-router'
import { AuthForm } from '@/components/auth-form'
import { getAuthInfo } from '@/server/functions'

export const Route = createFileRoute('/signup')({
  beforeLoad: () => {
    if (!features.auth) throw notFound()
  },
  loader: () => getAuthInfo(),
  component: Signup,
})
function Signup() {
  return (
    <AuthForm
      emailPasswordEnabled={Route.useLoaderData().emailPassword}
      mode="signup"
      local={Route.useLoaderData().local}
      googleReady={Route.useLoaderData().google.ready}
      mailReady={Route.useLoaderData().mailReady}
    />
  )
}
