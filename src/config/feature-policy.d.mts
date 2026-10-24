export type Features = typeof import('./features.json')
export type FeatureKey = keyof Features
export const featureKeys: FeatureKey[]
export const featureDependencies: Record<FeatureKey, FeatureKey[]>
export const unsupportedFeatures: FeatureKey[]
export function validateFeatures(value: unknown): Features
export function featurePreset(name: string): Features
export function featuresFromPlan(plan: {
  modules?: Partial<Record<FeatureKey, { selection: string }>>
}): Features
