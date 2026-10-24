import { test, expect, features } from './fixtures'

test('unselected capabilities stay closed through direct pages and API requests', async ({
  request,
}) => {
  const closed = [
    ...(!features.auth ? ['/login', '/signup', '/app', '/api/workspace', '/api/profile'] : []),
    ...(!features.projects ? ['/app/projects', '/api/projects'] : []),
    ...(!features.billing
      ? ['/pricing', '/app/billing', '/api/billing', '/api/billing/checkout']
      : []),
  ]
  test.skip(!closed.length, 'This product has selected all tested capabilities')
  for (const path of closed) {
    const response = await request.get(path)
    expect(response.status(), path).toBe(404)
  }
  expect((await request.get('/api/health')).status()).toBe(200)
})
