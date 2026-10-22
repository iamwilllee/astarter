import { describe, it, expect } from 'vitest'
import en from '../../src/i18n/en.json'
import zh from '../../src/i18n/zh.json'
import {
  translate,
  localeFromPath,
  localizePath,
  requestLocale,
  localizedError,
} from '../../src/i18n/core'
import { authMail } from '../../src/modules/mail/template'

describe('localized routes and messages', () => {
  it('keeps dictionary keys and interpolation tokens aligned', () => {
    expect(Object.keys(en).sort()).toEqual(Object.keys(zh).sort())
    for (const key of Object.keys(en) as (keyof typeof en)[]) {
      const tokens = (text: string) =>
        [...text.matchAll(/\{(\w+)\}/g)].map((match) => match[1]).sort()
      expect(tokens(en[key]), key).toEqual(tokens(zh[key]))
    }
    expect(translate('en', 'hello_name', { name: 'Developer' })).toBe('Hello, Developer.')
  })
  it('does not confuse unrelated path prefixes with a language', () => {
    expect(localeFromPath('/zh/pricing')).toBe('zh')
    expect(localeFromPath('/zh')).toBe('zh')
    expect(localeFromPath('/zhang')).toBe('en')
    expect(localizePath('/zh/pricing', 'en')).toBe('/pricing')
    expect(localizePath('/pricing', 'zh')).toBe('/zh/pricing')
  })
  it('uses an explicit request locale and localizes dynamic quota failures', () => {
    expect(
      requestLocale(
        new Request('https://app.example/api/projects', { headers: { 'x-starter-locale': 'zh' } }),
      ),
    ).toBe('zh')
    expect(localizedError('当前套餐最多创建 3 个项目', 'en')).toBe(
      'Your plan allows up to 3 projects.',
    )
    expect(localizedError('Unrecognized internal failure', 'en')).toBe(
      'Request failed. Please try again.',
    )
  })
  it('generates localized mail with escaped HTML and a readable plain-text alternative', () => {
    const url = 'https://app.example/api/auth/verify-email?token=fixture&callbackURL=%2Fzh%2Flogin'
    const english = authMail('verify', url, 'en'),
      chinese = authMail('reset', url, 'zh')
    expect(english.subject).toContain('Verify')
    expect(english.html).toContain('&amp;callbackURL=')
    expect(english.text).toContain(url)
    expect(chinese.subject).toContain('重置')
    expect(chinese.html).toContain('lang="zh"')
  })
})
