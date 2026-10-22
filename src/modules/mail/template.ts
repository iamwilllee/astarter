import { translate, type Locale } from '@/i18n/core'
import { site } from '@/config/site'
export type AuthMailKind = 'verify' | 'reset'
const escape = (value: string) =>
  value.replace(
    /[&<>"']/g,
    (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]!,
  )
export function authMail(kind: AuthMailKind, url: string, locale: Locale) {
  const subject = translate(
    locale,
    kind === 'verify' ? 'mail_verify_subject' : 'mail_reset_subject',
    { name: site.name },
  )
  const intro = translate(locale, kind === 'verify' ? 'mail_verify_intro' : 'mail_reset_intro')
  const ignore = translate(locale, 'mail_ignore')
  return {
    subject,
    text: `${intro}\n\n${url}\n\n${ignore}`,
    html: `<!doctype html><html lang="${locale}"><body style="font-family:system-ui,sans-serif;color:#173c2b;line-height:1.7;max-width:560px;margin:40px auto;padding:24px"><p>${escape(site.name)}</p><h1 style="font-size:24px">${escape(subject)}</h1><p>${escape(intro)}</p><p><a href="${escape(url)}">${escape(subject)}</a></p><p style="font-size:12px;color:#66766c">${escape(ignore)}</p></body></html>`,
  }
}
