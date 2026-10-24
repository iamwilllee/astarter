import { features } from '@/config/features'
import { createFileRoute, Link, notFound } from '@tanstack/react-router'
import { useQuery } from '@tanstack/react-query'
import { Mail, ArrowUpRight, ArrowLeft, RefreshCw } from 'lucide-react'
import { getAuthInfo } from '@/server/functions'
import { Logo, PageHeading, Loading, ErrorNotice } from '@/components/common'
import { Button } from '@/components/ui/button'
import { useI18n } from '@/components/providers'
import { api } from '@/lib/api'

interface MailRow {
  id: string
  recipient: string
  subject: string
  url: string
  created_at: number
}
export const Route = createFileRoute('/dev/inbox')({
  loader: async () => {
    if (!features.mail || !features.database || !(await getAuthInfo()).local) throw notFound()
  },
  component: Inbox,
})
function Inbox() {
  const { t, locale } = useI18n()
  const query = useQuery({
    queryKey: ['dev-mail'],
    queryFn: () => api<MailRow[]>('/api/dev/mail'),
    refetchInterval: 3000,
  })
  return (
    <div className="mx-auto max-w-4xl p-6 sm:p-10">
      <Logo />
      <Link
        to="/login"
        className="mb-9 mt-10 inline-flex items-center gap-2 text-xs text-muted-foreground"
      >
        <ArrowLeft size={13} />
        {t('go_to_sign_in')}
      </Link>
      <PageHeading
        eyebrow="LOCAL DEVELOPMENT ONLY"
        title={t('local_test_inbox')}
        description={t('inbox_description')}
        action={
          <Button
            variant="outline"
            onClick={() => {
              void query.refetch()
            }}
          >
            <RefreshCw size={14} />
            {t('refresh')}
          </Button>
        }
      />
      <div className="mb-6 rounded-lg border border-primary/20 bg-accent p-4 text-xs leading-6 text-primary">
        {t('inbox_warning')}
      </div>
      {query.isPending ? (
        <Loading />
      ) : query.error ? (
        <ErrorNotice>{query.error.message}</ErrorNotice>
      ) : query.data.length ? (
        <div className="space-y-3">
          {query.data.map((mail) => (
            <article key={mail.id} className="rounded-xl border bg-card p-5">
              <div className="flex items-start gap-3">
                <Mail className="mt-1 size-5 shrink-0 text-primary" />
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold">{mail.subject}</p>
                  <p className="mt-2 break-all text-xs text-muted-foreground">{mail.recipient}</p>
                  <p className="mt-1 text-[10px] text-muted-foreground">
                    {new Date(mail.created_at).toLocaleString(locale === 'zh' ? 'zh-CN' : 'en-US')}
                  </p>
                  <a
                    href={mail.url}
                    referrerPolicy="no-referrer"
                    className="mt-4 inline-flex items-center gap-2 text-xs font-medium text-primary"
                  >
                    {t('inbox_open_link')}
                    <ArrowUpRight size={14} />
                  </a>
                </div>
              </div>
            </article>
          ))}
        </div>
      ) : (
        <div className="rounded-xl border border-dashed p-12 text-center text-sm text-muted-foreground">
          {t('inbox_empty')}
        </div>
      )}
    </div>
  )
}
