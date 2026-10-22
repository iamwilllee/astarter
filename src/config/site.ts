export const site = {
  name: 'Starter',
  description: {
    en: 'An open-source product foundation on TanStack Start and Cloudflare.',
    zh: '从一个可靠的起点，做下一个产品。',
  },
  version: '0.1.1',
} as const

export const plans = {
  free: { name: 'Free', projectLimit: 3 },
  pro: { name: 'Pro', projectLimit: 50 },
} as const
