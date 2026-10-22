import { useEffect, useState, type FormEvent } from 'react'
import { formText } from '@/lib/forms'
import { authClient } from '@/modules/auth/auth-client'
import { localizePath } from '@/i18n/core'
import { authError } from '@/i18n/auth-errors'
import { useI18n } from './providers'
import { ErrorNotice } from './common'
import { Button } from './ui/button'
import { Input } from './ui/input'
import { Label } from './ui/label'

export function VerificationResend({ email }: { email: string }) {
  const { t, locale } = useI18n()
  const [pending, setPending] = useState(false)
  const [seconds, setSeconds] = useState(0)
  const [error, setError] = useState('')
  const [accepted, setAccepted] = useState(false)
  useEffect(() => {
    if (!seconds) return
    const timer = window.setTimeout(() => setSeconds((value) => Math.max(0, value - 1)), 1000)
    return () => window.clearTimeout(timer)
  }, [seconds])
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (pending || seconds) return
    const address = formText(new FormData(event.currentTarget), 'verification-email').trim()
    setPending(true)
    setError('')
    setAccepted(false)
    try {
      const result = await authClient.sendVerificationEmail({
        email: address,
        callbackURL: localizePath('/login', locale) + '?verified=1',
      })
      if (result.error) {
        if (result.error.status === 429) setSeconds(60)
        throw new Error(authError(result.error.code ?? '', locale))
      }
      setAccepted(true)
      setSeconds(60)
    } catch (error) {
      setError(error instanceof Error ? error.message : t('resend_failed'))
    } finally {
      setPending(false)
    }
  }
  return (
    <form onSubmit={submit} className="mt-6 space-y-3 border-t pt-5">
      <Label htmlFor="verification-email">{t('resend_verification')}</Label>
      <Input
        id="verification-email"
        name="verification-email"
        type="email"
        autoComplete="email"
        defaultValue={email}
        placeholder="you@example.com"
        maxLength={254}
        required
      />
      <Button type="submit" className="w-full" variant="outline" disabled={pending || seconds > 0}>
        {pending
          ? t('please_wait')
          : seconds
            ? t('resend_wait', { seconds })
            : t('resend_verification')}
      </Button>
      {error && <ErrorNotice>{error}</ErrorNotice>}
      {accepted && (
        <p role="status" className="text-xs leading-6 text-primary">
          {t('resend_accepted')}
        </p>
      )}
    </form>
  )
}
