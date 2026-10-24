import { formText } from '@/lib/forms'
import { createFileRoute, getRouteApi, useRouter, Link } from '@tanstack/react-router'
import { useMutation } from '@tanstack/react-query'
import type { FormEvent } from 'react'
import { CheckCircle2, ShieldCheck, KeyRound } from 'lucide-react'
import { PageHeading, ErrorNotice } from '@/components/common'
import { useI18n } from '@/components/providers'
import { Button, buttonVariants } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { api } from '@/lib/api'
import { SettingsSection } from '@/components/patterns/page-patterns'

export const Route = createFileRoute('/app/settings')({ component: Settings })
function Settings() {
  const viewer = getRouteApi('/app').useLoaderData()
  const { registrationReady } = getRouteApi('__root__').useLoaderData()
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
      <SettingsSection
        id="profile-settings"
        title={t('profile')}
        description={t('these_details_belong_to_your_workspace')}
      >
        <form onSubmit={submit} className="space-y-5">
          <div className="grid gap-2">
            <Label htmlFor="profile-name">{t('your_name')}</Label>
            <Input
              id="profile-name"
              name="name"
              defaultValue={viewer.user.name}
              maxLength={60}
              required
            />
          </div>
          <div className="grid gap-2">
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
      </SettingsSection>
      <SettingsSection
        id="security-settings"
        title={t('password_security')}
        description={t('reset_via_email_all_sessions_are_revoked_after_a_password_reset')}
      >
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex gap-3">
            <KeyRound className="mt-0.5 size-5 text-muted-foreground" />
            <div>
              <p className="text-sm font-medium">{t('email_address')}</p>
              <p className="mt-2 break-all text-xs text-muted-foreground">{viewer.user.email}</p>
            </div>
          </div>
          {registrationReady ? (
            <Link to="/forgot-password" className={buttonVariants({ variant: 'outline' })}>
              {t('reset_password')}
            </Link>
          ) : (
            <p className="text-xs text-muted-foreground">{t('email_access_unavailable')}</p>
          )}
        </div>
      </SettingsSection>
    </>
  )
}
