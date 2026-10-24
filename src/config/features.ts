import config from '@/config/features.json'
import { validateFeatures } from './feature-policy.mjs'

// Public build-time choices. Provider readiness and all permissions remain server-side.
export const features = validateFeatures(config)
