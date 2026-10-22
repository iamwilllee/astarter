import { createRouter } from '@tanstack/react-router'
import { routeTree } from './routeTree.gen'
import { localeFromPath, localizePath, stripLocale } from './i18n/core'

function isPage(path: string) {
  return !/^\/(?:api|_serverFn|assets)(?:\/|$)/.test(path)
}
export function getRouter() {
  return createRouter({
    routeTree,
    scrollRestoration: true,
    defaultPreload: 'intent',
    rewrite: {
      input: ({ url }) => {
        if (isPage(url.pathname)) {
          const locale = localeFromPath(url.pathname)
          url.pathname = stripLocale(url.pathname)
          url.searchParams.set('_locale', locale)
        }
        return url
      },
      output: ({ url }) => {
        if (isPage(url.pathname)) {
          url.pathname = localizePath(
            url.pathname,
            url.searchParams.get('_locale') === 'zh' ? 'zh' : 'en',
          )
          url.searchParams.delete('_locale')
        }
        return url
      },
    },
  })
}
declare module '@tanstack/react-router' {
  interface Register {
    router: ReturnType<typeof getRouter>
  }
}
