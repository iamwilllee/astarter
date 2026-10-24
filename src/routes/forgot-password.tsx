import { features } from '@/config/features'
import { notFound } from '@tanstack/react-router'
import { createFileRoute } from '@tanstack/react-router'
import { AuthForm } from '@/components/auth-form'
import { getAuthInfo } from '@/server/functions'

export const Route = createFileRoute('/forgot-password')({
  beforeLoad: () => {
    if (!features.auth || !features.emailPassword) throw notFound()
  },
  loader: () => getAuthInfo(),
  component: Forgot,
})
function Forgot() {
  return (
    <AuthForm
      emailPasswordEnabled={Route.useLoaderData().emailPassword}
      mode="forgot"
      local={Route.useLoaderData().local}
      googleReady={Route.useLoaderData().google.ready}
      mailReady={Route.useLoaderData().mailReady}
    />
  )
}
