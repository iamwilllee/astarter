import { formText } from '@/lib/forms'
import { createFileRoute, getRouteApi, useRouter, Link } from '@tanstack/react-router'
import { useMutation } from '@tanstack/react-query'
import type { FormEvent } from 'react'
import { CheckCircle2, ShieldCheck, KeyRound } from 'lucide-react'
import { PageHeading, ErrorNotice } from '@/components/common'
import { useI18n } from '@/components/providers'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { api } from '@/lib/api'

export const Route = createFileRoute('/app/settings')({ component: Settings })
function Settings() {
  const viewer = getRouteApi('/app').useLoaderData()
  const { t } = useI18n()
  const router = useRouter()
  const save = useMutation({
    mutationFn: (name: string) => api('/api/profile', { method: 'PATCH', data: { name } }),
    onSuccess: async () => {
      await router.invalidate()
    },
  })
  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    save.mutate(formText(new FormData(event.currentTarget), 'name'))
  }
  return (
    <>
      <PageHeading
        eyebrow="ACCOUNT SETTINGS"
        title={t('account_settings')}
        description={t('manage_your_profile_and_account_security')}
      />
      <section className="max-w-2xl rounded-xl border bg-card">
        <div className="border-b p-6">
          <h2 className="text-sm font-semibold">{t('profile')}</h2>
          <p className="mt-2 text-xs text-muted-foreground">
            {t('these_details_belong_to_your_workspace')}
          </p>
        </div>
        <form onSubmit={submit} className="space-y-5 p-6">
          <div className="space-y-2">
            <Label htmlFor="profile-name">{t('your_name')}</Label>
            <Input
              id="profile-name"
              name="name"
              defaultValue={viewer.user.name}
              maxLength={60}
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="profile-email">{t('email_address')}</Label>
            <Input id="profile-email" value={viewer.user.email} readOnly disabled />
            <p className="flex items-center gap-1.5 text-[11px] text-primary">
              <ShieldCheck size={13} />
              {t('verified_email_changes_are_not_available_in_v0_1')}
            </p>
          </div>
          {save.error && <ErrorNotice>{save.error.message}</ErrorNotice>}
          {save.isSuccess && (
            <p role="status" className="flex items-center gap-2 text-xs text-primary">
              <CheckCircle2 size={15} />
              {t('profile_saved')}
            </p>
          )}
          <Button type="submit" disabled={save.isPending}>
            {save.isPending ? t('saving') : t('save_changes')}
          </Button>
        </form>
      </section>
      <section className="mt-6 flex max-w-2xl flex-wrap items-center justify-between gap-4 rounded-xl border bg-card p-6">
        <div className="flex gap-3">
          <KeyRound className="mt-0.5 size-5 text-muted-foreground" />
          <div>
            <h2 className="text-sm font-semibold">{t('password_security')}</h2>
            <p className="mt-2 text-xs text-muted-foreground">
              {t('reset_via_email_all_sessions_are_revoked_after_a_password_reset')}
            </p>
          </div>
        </div>
        <Link to="/forgot-password" className="rounded-lg border px-3 py-2 text-xs font-medium">
          {t('reset_password')}
        </Link>
      </section>
    </>
  )
}
