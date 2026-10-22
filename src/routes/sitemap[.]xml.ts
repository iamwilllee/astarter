import { createFileRoute } from '@tanstack/react-router'
import { env } from 'cloudflare:workers'
import { localizePath } from '@/i18n/core'
export const Route = createFileRoute('/sitemap.xml')({
  server: {
    handlers: {
      GET: () => {
        const origin = new URL(env.APP_ORIGIN).origin
        const entries =
          String(env.PUBLIC_INDEXABLE) === 'true'
            ? ['/', '/pricing']
                .flatMap((path) =>
                  (['en', 'zh'] as const).map(
                    (locale) => `<url><loc>${origin}${localizePath(path, locale)}</loc></url>`,
                  ),
                )
                .join('')
            : ''
        return new Response(
          `<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${entries}</urlset>`,
          {
            headers: {
              'Content-Type': 'application/xml; charset=utf-8',
              'Cache-Control': 'no-store',
            },
          },
        )
      },
    },
  },
})
