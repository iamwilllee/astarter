import { useSyncExternalStore } from 'react'
const subscribe = () => () => {}
// Keep buttons inert during SSR until React can handle the action (including form submissions).
export function useHydrated() {
  return useSyncExternalStore(
    subscribe,
    () => true,
    () => false,
  )
}
