export interface SubscriptionState {
  status: string
  price_id: string
  current_period_end: number
}

export function hasProAccess(
  subscription: SubscriptionState,
  priceId: string | undefined,
  now = Date.now(),
) {
  return (
    !!priceId &&
    subscription.price_id === priceId &&
    ['active', 'trialing'].includes(subscription.status) &&
    subscription.current_period_end * 1000 > now
  )
}

export function isTestKey(key: string | undefined) {
  return !!key && /^sk_test_[A-Za-z0-9]+$/.test(key)
}
