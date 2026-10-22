import { createFileRoute, getRouteApi } from '@tanstack/react-router'
import { useQuery } from '@tanstack/react-query'
import { api } from '@/lib/api'
import { PageHeading, ErrorNotice, Loading } from '@/components/common'
import { useI18n } from '@/components/providers'

interface UserRow {
  id: string
  name: string
  email: string
  email_verified: number
  created_at: number
}
export const Route = createFileRoute('/app/admin')({ component: Admin })
function Admin() {
  const viewer = getRouteApi('/app').useLoaderData()
  const { t } = useI18n()
  const query = useQuery({
    queryKey: ['admin-users'],
    queryFn: () => api<UserRow[]>('/api/admin/users'),
    enabled: viewer.admin,
  })
  return (
    <>
      <PageHeading
        eyebrow="ADMINISTRATION"
        title={t('user_administration')}
        description={t('read_only_user_directory_permissions_are_checked_on_every_server_request')}
      />
      {!viewer.admin ? (
        <ErrorNotice>{t('you_do_not_have_admin_access')}</ErrorNotice>
      ) : query.isPending ? (
        <Loading />
      ) : query.error ? (
        <ErrorNotice>{query.error.message}</ErrorNotice>
      ) : (
        <div className="divide-y rounded-xl border bg-card px-5">
          {query.data.map((user) => (
            <article
              key={user.id}
              className="flex flex-wrap items-center justify-between gap-3 py-4"
            >
              <div>
                <p className="text-sm font-medium">{user.name}</p>
                <p className="mt-1 break-all text-xs text-muted-foreground">{user.email}</p>
              </div>
              <span className="text-xs text-muted-foreground">
                {user.email_verified ? t('verified') : t('unverified')}
              </span>
            </article>
          ))}
        </div>
      )}
    </>
  )
}
