import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import net from 'node:net'
import { spawnSync } from 'node:child_process'
import { parseLocalVars, dependenciesPresent } from './project-local.mjs'
const planFile = 'starter.project.json'

export function probePort(port) {
  return new Promise((done) => {
    const server = net.createServer()
    server.once('error', (error) => done(error.code === 'EADDRINUSE' ? 'occupied' : 'unknown'))
    server.listen(port, '127.0.0.1', () => server.close(() => done('available')))
  })
}
// Reports only presence/config shape, never secret values or credential fragments.
export async function doctor(root, { portProbe = probePort, pnpmVersion } = {}) {
  const checks = []
  const add = (id, status, message) => checks.push({ id, status, message })
  const [major, minor] = process.versions.node.split('.').map(Number)
  add(
    'node',
    major > 22 || (major === 22 && minor >= 12) ? 'ok' : 'error',
    'Node 需 >=22.12；建议 Node 24',
  )
  if (pnpmVersion === undefined) {
    const result = spawnSync('pnpm', ['--version'], {
      cwd: root,
      encoding: 'utf8',
      timeout: 15_000,
    })
    pnpmVersion = result.status === 0 ? result.stdout.trim() : ''
  }
  add('pnpm', pnpmVersion === '12.11.2' ? 'ok' : 'error', '需要锁定的 pnpm 12.11.2')
  add(
    'dependencies',
    ['vite', 'wrangler', 'prettier', 'zod'].every((name) =>
      existsSync(join(root, 'node_modules', name, 'package.json')),
    )
      ? 'ok'
      : 'error',
    '依赖缺失时先执行 pnpm install --frozen-lockfile',
  )
  let config,
    vars = {},
    plan
  try {
    const { parse } = await import('jsonc-parser')
    const errors = []
    config = parse(readFileSync(join(root, 'wrangler.jsonc'), 'utf8'), errors, {
      allowTrailingComma: true,
    })
    if (errors.length || !config || typeof config !== 'object') throw new Error('invalid')
    add('worker-config', 'ok', '本地读取 Worker 配置；未连接云端')
  } catch (error) {
    add(
      'worker-config',
      error.code === 'ERR_MODULE_NOT_FOUND' ? 'unknown' : 'error',
      'Worker 配置待检查；依赖缺失时先安装，配置存在也不证明云端可用',
    )
  }
  try {
    vars = parseLocalVars(readFileSync(join(root, '.dev.vars'), 'utf8'))
    add('local-vars', 'ok', '本地配置已读取，值不显示')
  } catch {
    add('local-vars', 'error', '本地配置缺失或无效；新项目运行 setup，已有项目先恢复自己的配置')
  }
  let origin
  try {
    origin = new URL(vars.APP_ORIGIN)
  } catch {
    /* report shape only */
  }
  add(
    'local-origin',
    vars.ENVIRONMENT === 'local' &&
      ['http:', 'https:'].includes(origin?.protocol) &&
      origin?.origin === vars.APP_ORIGIN &&
      ['127.0.0.1', 'localhost', '[::1]'].includes(origin?.hostname) &&
      (origin?.port || '80') === '3100'
      ? 'ok'
      : 'error',
    '当前开发/测试要求 local 环境与匹配的回环 origin，端口 3100',
  )
  add(
    'auth-secret',
    typeof vars.BETTER_AUTH_SECRET === 'string' &&
      vars.BETTER_AUTH_SECRET.length >= 32 &&
      !vars.BETTER_AUTH_SECRET.startsWith('replace-')
      ? 'ok'
      : 'error',
    '本地认证密钥需至少 32 字符；不会打印或自动替换',
  )
  add(
    'd1-binding',
    !config ? 'unknown' : config?.d1_databases?.some((db) => db.binding === 'DB') ? 'ok' : 'error',
    '需要 DB binding；本地检查不证明云端数据库可用',
  )
  add(
    'local-schema',
    existsSync(join(root, 'worker-configuration.d.ts')) && existsSync(join(root, '.wrangler/state'))
      ? 'unknown'
      : 'warn',
    '目录/类型文件不证明迁移已应用；project:resume 会幂等执行本地 setup',
  )
  if (existsSync(join(root, planFile))) {
    try {
      if (!dependenciesPresent(root)) throw new Error('dependencies missing')
      const { loadPlan } = await import('./project-workflow.mjs')
      plan = loadPlan(root)
      add('project-plan', 'ok', '已读取产品计划；模块选择不自动启用提供商')
    } catch {
      add('project-plan', 'error', '产品计划无效，先运行 project:check')
    }
  } else add('project-plan', 'warn', '尚无产品计划；底座源目录不需要填写虚构产品')
  const required = (key) => plan?.modules[key].selection === 'required'
  const effective = { ...config?.vars, ...vars }
  const present = (key) =>
    typeof vars[key] === 'string' &&
    vars[key].trim().length > 0 &&
    !/^(?:replace-|\.\.\.)/.test(vars[key])
  add(
    'mail',
    effective.MAIL_MODE === 'local' ? 'ok' : 'warn',
    effective.MAIL_MODE === 'local'
      ? '本地收件箱模式；真实发信尚未验收'
      : '未使用本地邮件；真实发信需 EMAIL binding 与域名验收',
  )
  const googleConfigured =
    effective.GOOGLE_AUTH_ENABLED === 'true' &&
    present('GOOGLE_CLIENT_ID') &&
    present('GOOGLE_CLIENT_SECRET')
  add(
    'google',
    googleConfigured ? 'warn' : required('google') ? 'warn' : 'unknown',
    googleConfigured
      ? '本地 Google 配置形状齐备；真实登录/回调未验证'
      : 'Google 待配置：GOOGLE_AUTH_ENABLED、GOOGLE_CLIENT_ID、GOOGLE_CLIENT_SECRET',
  )
  const stripeConfigured = ['STRIPE_SECRET_KEY', 'STRIPE_WEBHOOK_SECRET', 'STRIPE_PRICE_ID'].every(
    present,
  )
  add(
    'stripe',
    vars.STRIPE_SECRET_KEY?.startsWith('sk_live_')
      ? 'error'
      : stripeConfigured
        ? 'warn'
        : required('billing')
          ? 'warn'
          : 'unknown',
    vars.STRIPE_SECRET_KEY?.startsWith('sk_live_')
      ? '禁止使用 Stripe live 密钥'
      : stripeConfigured
        ? '本地 Stripe 配置存在；仅支持测试，结账/Webhook 尚待真实测试验收'
        : 'Stripe 测试待配置：STRIPE_SECRET_KEY、STRIPE_WEBHOOK_SECRET、STRIPE_PRICE_ID；新结账另需 BILLING_ENABLED',
  )
  for (const key of ['ai', 'files', 'usage'])
    if (required(key))
      add(`module-${key}`, 'warn', `${key} 的业务尚未实现；需补实现、权限和用量/失败验收`)
  for (const port of [3100, 3110]) {
    const state = await portProbe(port)
    add(
      `port-${port}`,
      state === 'available' ? 'ok' : 'warn',
      state === 'available'
        ? `回环端口 ${port} 可用`
        : `端口 ${port} 已占用或无法确认；先识别现有服务，不会停止进程`,
    )
  }
  add(
    'remote',
    'unknown',
    '未读取远端 secrets、资格或资源；云端邮件/Google/Stripe 需独立配置与真实验收',
  )
  return { ok: checks.every((item) => item.status !== 'error'), checks }
}
