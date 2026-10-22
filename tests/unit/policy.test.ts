import { describe, expect, it } from 'vitest'
import { hasProAccess, isTestKey } from '../../src/modules/billing/policy'
import { projectInput } from '../../src/modules/projects/validation'

describe('entitlements are based on an active matching unexpired subscription', () => {
  const now = 1_800_000_000_000
  const subscription = {
    status: 'active',
    price_id: 'price_allowed',
    current_period_end: now / 1000 + 100,
  }
  it('accepts active/trialing subscriptions only for the configured price', () => {
    expect(hasProAccess(subscription, 'price_allowed', now)).toBe(true)
    expect(hasProAccess({ ...subscription, status: 'trialing' }, 'price_allowed', now)).toBe(true)
    for (const status of ['past_due', 'unpaid', 'canceled', 'incomplete', 'paused'])
      expect(hasProAccess({ ...subscription, status }, 'price_allowed', now)).toBe(false)
    expect(hasProAccess(subscription, 'price_other', now)).toBe(false)
    expect(hasProAccess(subscription, undefined, now)).toBe(false)
    expect(
      hasProAccess({ ...subscription, current_period_end: now / 1000 }, 'price_allowed', now),
    ).toBe(false)
  })
  it('never accepts live or restricted keys as test secret keys', () => {
    expect(isTestKey('sk_test_fixture123')).toBe(true)
    for (const key of [undefined, '', 'sk_live_secret', 'rk_test_secret', 'sk_test_bad key'])
      expect(isTestKey(key)).toBe(false)
  })
})
describe('project input validation', () => {
  it('normalizes input and rejects blank, oversized, or invalid status values', () => {
    expect(projectInput.parse({ name: '  我的想法  ' })).toEqual({
      name: '我的想法',
      description: '',
      status: 'idea',
    })
    for (const value of [
      { name: ' ' },
      { name: 'x'.repeat(81) },
      { name: 'Valid', status: 'admin' },
      { name: 'Valid', description: 'x'.repeat(501) },
    ])
      expect(projectInput.safeParse(value).success).toBe(false)
  })
})
