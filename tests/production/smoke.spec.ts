import { expect, test } from '@playwright/test'

test('built Worker renders English/Chinese SSR and isolates concurrent language requests', async ({
  request,
}) => {
  const responses = await Promise.all(
    Array.from({ length: 6 }, (_, i) => request.get(i % 2 ? '/zh' : '/')),
  )
  for (const [i, response] of responses.entries()) {
    expect(response.status()).toBe(200)
    const html = await response.text()
    expect(html).toContain(i % 2 ? 'lang="zh-CN"' : 'lang="en"')
    expect(html).toContain(i % 2 ? '少一些重复' : 'Less setup.')
    expect(html).toContain('noindex,nofollow')
    expect(html).not.toContain('fixture-only-not-a-real-google-secret')
  }
})
test('production closes both inbox routes and redirects private pages without leaking data', async ({
  request,
}) => {
  expect((await request.get('/api/health')).status()).toBe(200)
  expect((await request.get('/api/dev/mail')).status()).toBe(404)
  for (const path of ['/dev/inbox', '/zh/dev/inbox'])
    expect((await request.get(path)).status()).toBe(404)
  for (const prefix of ['', '/zh']) {
    const response = await request.get(prefix + '/app')
    expect(new URL(response.url()).pathname).toBe(prefix + '/login')
    expect(await response.text()).not.toContain('fixture-only-not-a-real-google-secret')
  }
  expect((await request.get('/api/projects')).status()).toBe(401)
  const origin = new URL(test.info().project.use.baseURL!).origin
  expect(
    (
      await request.post('/api/auth/sign-up/email', {
        headers: { origin },
        data: {
          email: 'disabled@example.test',
          name: 'Disabled',
          password: 'Fixture-only-password-2026!',
        },
      })
    ).status(),
  ).toBe(503)
  expect(await (await request.get('/robots.txt')).text()).toContain('Disallow: /')
  expect(await (await request.get('/sitemap.xml')).text()).not.toContain('<loc>')
  expect(
    (
      await request.post('/api/projects', {
        headers: { origin: 'https://untrusted.example' },
        data: { name: 'CSRF' },
      })
    ).status(),
  ).toBe(403)
})
test('production hydration preserves locale, links and mobile navigation', async ({ page }) => {
  const errors: string[] = []
  page.on('pageerror', (error) => errors.push(error.message))
  await page.goto('/zh')
  await expect(page.locator('html')).toHaveAttribute('lang', 'zh-CN')
  await page.getByRole('link', { name: '套餐', exact: true }).click()
  await expect(page).toHaveURL(/\/zh\/pricing$/)
  await page.reload()
  await expect(page.locator('html')).toHaveAttribute('lang', 'zh-CN')
  await page.getByRole('button', { name: 'Switch to English' }).click()
  await expect(page).toHaveURL(/\/pricing$/)
  await expect(page.locator('html')).toHaveAttribute('lang', 'en')
  await page.setViewportSize({ width: 390, height: 844 })
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
  expect(errors).toEqual([])
})
test('configured Google builds a stateful authorization URL with the exact callback; test credentials never leave this test', async ({
  request,
}) => {
  const origin = new URL(test.info().project.use.baseURL!).origin
  const response = await request.post('/api/auth/sign-in/social', {
    headers: { origin },
    data: { provider: 'google', callbackURL: '/zh/app', disableRedirect: true },
  })
  expect(response.status(), await response.text()).toBe(200)
  const result = (await response.json()) as { url: string }
  const url = new URL(result.url)
  expect(url.hostname).toBe('accounts.google.com')
  expect(url.searchParams.get('redirect_uri')).toBe(origin + '/api/auth/callback/google')
  expect(url.searchParams.get('client_id')).toBe('fixture-only.apps.googleusercontent.com')
  expect(url.searchParams.get('state')).toBeTruthy()
  expect(result.url).not.toContain('fixture-only-not-a-real-google-secret')
})

test('OAuth error callbacks render a localized error instead of claiming successful sign-in', async ({
  page,
}) => {
  await page.goto('/zh/login?oauthError=1')
  await expect(page.getByRole('alert').filter({ hasText: 'Google 登录未完成' })).toBeVisible()
  await expect(page.getByRole('button', { name: '使用 Google 继续' })).toBeEnabled()
})
