import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { createContext, useContext, useState, type ReactNode } from 'react'
import { translate, localizePath, type Locale, type MessageKey } from '@/i18n/core'
import { ToastProvider } from './ui/toast'
import { TooltipProvider } from './ui/tooltip'

interface I18n {
  locale: Locale
  toggle: () => void
  t: (key: MessageKey, values?: Record<string, string | number>) => string
}
const LocaleContext = createContext<I18n>({
  locale: 'en',
  toggle: () => {},
  t: (key, values) => translate('en', key, values),
})
export function Providers({ children, locale }: { children: ReactNode; locale: Locale }) {
  const [client] = useState(
    () => new QueryClient({ defaultOptions: { queries: { staleTime: 15_000, retry: 1 } } }),
  )
  return (
    <QueryClientProvider client={client}>
      <LocaleContext.Provider
        value={{
          locale,
          toggle: () => {
            const url = new URL(window.location.href)
            url.pathname = localizePath(url.pathname, locale === 'en' ? 'zh' : 'en')
            window.location.assign(url.href)
          },
          t: (key, values) => translate(locale, key, values),
        }}
      >
        <TooltipProvider delay={400}>
          <ToastProvider
            dismissLabel={translate(locale, 'dismiss_notification')}
            regionLabel={translate(locale, 'notifications')}
          >
            {children}
          </ToastProvider>
        </TooltipProvider>
      </LocaleContext.Provider>
    </QueryClientProvider>
  )
}
export function useI18n() {
  return useContext(LocaleContext)
}
