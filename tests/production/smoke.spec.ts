import { expect, test } from '@playwright/test'

test.describe('default authenticated starter', () => {
  test.skip(process.env.STARTER_SMOKE_PROFILE !== 'default', 'Different capability profile')
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
      expect(html).toContain(i % 2 ? '给 Agent 一个' : 'For your agent.')
      expect(html).toContain('noindex,nofollow')
      expect(html).not.toContain('fixture-only-not-a-real-google-secret')
    }
  })
  test('production closes local-only pages and redirects private pages without leaking data', async ({
    request,
  }) => {
    expect((await request.get('/api/health')).status()).toBe(200)
    expect((await request.get('/api/dev/mail')).status()).toBe(404)
    for (const path of ['/dev/inbox', '/zh/dev/inbox', '/dev/ui', '/zh/dev/ui'])
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

  test('missing mail does not advertise unavailable signup or expose setup errors to visitors', async ({
    page,
  }) => {
    await page.goto('/login')
    await expect(
      page.getByRole('button', { name: 'Continue with Google', exact: true }),
    ).toBeEnabled()
    await expect(
      page.getByText(
        'Email registration and password reset are currently unavailable. Please try again later.',
        { exact: true },
      ),
    ).toBeVisible()
    await expect(page.getByRole('link', { name: 'Get started', exact: true })).toHaveCount(0)
    await expect(page.getByRole('link', { name: 'Forgot password?', exact: true })).toHaveCount(0)
    await expect(page.getByText(/not configured/i)).toHaveCount(0)
    await page.goto('/signup')
    await expect(page.getByRole('button', { name: 'Create account', exact: true })).toHaveCount(0)
    await expect(page.getByRole('textbox', { name: 'Email address', exact: true })).toHaveCount(0)
    // A simulated provider failure checks UI feedback only; it is not live OAuth acceptance.
    await page.route('**/api/auth/sign-in/social', (route) =>
      route.fulfill({
        status: 400,
        contentType: 'application/json',
        body: JSON.stringify({ code: 'PROVIDER_UNAVAILABLE', message: 'Fixture failure' }),
      }),
    )
    await page.getByRole('button', { name: 'Continue with Google', exact: true }).click()
    await expect(page.getByRole('alert')).toContainText('Google sign-in')
    await page.goto('/forgot-password')
    await expect(page.getByRole('button', { name: 'Send reset link', exact: true })).toHaveCount(0)
    await page.goto('/')
    // Selected and configured Google remains a usable registration method even when email is unavailable.
    await expect(page.locator('a[href="/signup"]')).toHaveCount(1)
  })
})

test.describe('public showcase without external resources', () => {
  test.skip(process.env.STARTER_SMOKE_PROFILE !== 'showcase', 'Showcase profile only')
  test('SSR, hydration, theme and locale work without a DB or auth secret', async ({
    page,
    request,
  }) => {
    expect(await (await request.get('/api/health')).json()).toMatchObject({
      ok: true,
      storage: 'none',
    })
    await page.goto('/')
    await expect(page.getByRole('heading', { name: /For your agent/ })).toBeVisible()
    await expect(
      page.locator('a[href="/login"],a[href="/signup"],a[href="/app"],a[href="/pricing"]'),
    ).toHaveCount(0)
    await expect(page.getByText('Better Auth', { exact: true })).toHaveCount(0)
    await expect(page.getByText('Cloudflare D1', { exact: true })).toHaveCount(0)
    await page.getByRole('button', { name: '切换中文' }).click()
    await expect(page).toHaveURL(/\/zh$/)
    await page.reload()
    await expect(page.locator('html')).toHaveAttribute('lang', 'zh-CN')
    await page.setViewportSize({ width: 390, height: 844 })
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
  })
  test('disabled pages and direct APIs stay unavailable', async ({ request }) => {
    for (const prefix of ['', '/zh'])
      for (const path of [
        '/login',
        '/signup',
        '/forgot-password',
        '/reset-password',
        '/app',
        '/app/billing',
        '/pricing',
        '/dev/inbox',
      ])
        expect((await request.get(prefix + path)).status(), prefix + path).toBe(404)
    for (const path of [
      '/api/projects',
      '/api/workspace',
      '/api/profile',
      '/api/billing',
      '/api/dev/mail',
      '/api/auth/get-session',
    ])
      expect((await request.get(path)).status(), path).toBe(404)
    for (const path of [
      '/api/auth/sign-up/email',
      '/api/auth/sign-in/email',
      '/api/auth/reset-password',
      '/api/billing/webhook',
    ])
      expect((await request.post(path, { data: { fixture: true } })).status(), path).toBe(404)
  })
})

test.describe('Google-only authentication', () => {
  test.skip(process.env.STARTER_SMOKE_PROFILE !== 'google-only', 'Google-only profile')
  test('shows only the selected method and rejects direct email endpoints', async ({
    page,
    request,
  }) => {
    await page.goto('/login')
    await expect(
      page.getByRole('button', { name: 'Continue with Google', exact: true }),
    ).toBeVisible()
    await expect(page.getByRole('textbox', { name: 'Email address', exact: true })).toHaveCount(0)
    await expect(page.getByText(/Email registration and password reset/)).toHaveCount(0)
    for (const path of ['/forgot-password', '/reset-password', '/pricing'])
      expect((await request.get(path)).status()).toBe(404)
    const origin = new URL(test.info().project.use.baseURL!).origin
    for (const path of [
      '/api/auth/sign-up/email',
      '/api/auth/sign-in/email',
      '/api/auth/request-password-reset',
      '/api/auth/reset-password',
    ])
      expect(
        (await request.post(path, { headers: { origin }, data: { fixture: true } })).status(),
      ).toBe(404)
    // Fixture credentials only prove request construction, never live Google authorization.
    expect(
      (
        await request.post('/api/auth/sign-in/social', {
          headers: { origin },
          data: { provider: 'google', callbackURL: '/app', disableRedirect: true },
        })
      ).status(),
    ).toBe(200)
    expect((await request.get('/api/billing')).status()).toBe(404)
  })
})
