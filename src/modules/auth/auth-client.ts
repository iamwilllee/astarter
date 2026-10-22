import { createAuthClient } from 'better-auth/react'
import { browserLocale } from '@/i18n/core'

export const authClient = createAuthClient({
  fetchOptions: {
    onRequest(context) {
      context.headers.set('x-starter-locale', browserLocale())
    },
  },
})
