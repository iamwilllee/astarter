import { createFileRoute } from '@tanstack/react-router'
import { env } from 'cloudflare:workers'
export const Route = createFileRoute('/robots.txt')({
  server: {
    handlers: {
      GET: () =>
        new Response(
          String(env.PUBLIC_INDEXABLE) === 'true'
            ? `User-agent: *\nAllow: /\nDisallow: /app\nDisallow: /zh/app\nDisallow: /api\nDisallow: /dev\nDisallow: /zh/dev\nSitemap: ${new URL(env.APP_ORIGIN).origin}/sitemap.xml\n`
            : 'User-agent: *\nDisallow: /\n',
          { headers: { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'no-store' } },
        ),
    },
  },
})
