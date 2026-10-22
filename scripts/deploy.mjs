import { readFileSync, existsSync, unlinkSync } from 'node:fs'
import { spawnSync } from 'node:child_process'
import { parse } from 'jsonc-parser'

const args = process.argv.slice(2)
const check = args.includes('--check')
const at = args.indexOf('--env')
const target = at >= 0 ? args[at + 1] : undefined
if (target !== undefined && target !== 'staging')
  throw new Error('Supported named environment: staging; omit --env for production')
if (at >= 0 && !target) throw new Error('--env needs a value')
const allowed = check ? ['--check'] : []
if (target) allowed.push('--env', target)
if (args.some((arg) => !allowed.includes(arg)))
  throw new Error('Usage: pnpm run deploy [--env staging], or deploy:check [--env staging]')
const errors = []
const base = parse(readFileSync('wrangler.jsonc', 'utf8'), errors, { allowTrailingComma: true })
if (errors.length) throw new Error('wrangler.jsonc is not valid JSONC')
const config = target ? base.env?.[target] : base
if (!config) throw new Error('Selected environment is missing')
const problems = []
const vars = config.vars ?? {}
let origin
try {
  origin = new URL(vars.APP_ORIGIN)
} catch {
  problems.push('Set APP_ORIGIN to your public HTTPS origin')
}
if (
  !origin ||
  origin.protocol !== 'https:' ||
  origin.hostname.endsWith('.invalid') ||
  ['localhost', '127.0.0.1', '[::1]'].includes(origin.hostname) ||
  origin.origin !== vars.APP_ORIGIN
)
  problems.push('APP_ORIGIN must be an exact public HTTPS origin, without a trailing slash')
if (vars.ENVIRONMENT !== (target ?? 'production'))
  problems.push('ENVIRONMENT must match the selected deployment target')
if (target === 'staging' && vars.PUBLIC_INDEXABLE !== 'false')
  problems.push('Staging must remain unindexed')
if (!['disabled', 'cloudflare'].includes(vars.MAIL_MODE))
  problems.push('Local mail must never be enabled remotely')
const db = config.d1_databases?.find((db) => db.binding === 'DB')
if (!db?.database_id || db.database_id.startsWith('00000000'))
  problems.push('Replace the placeholder D1 database_id')
const otherDb = (target ? base : base.env?.staging)?.d1_databases?.find((db) => db.binding === 'DB')
if (db?.database_id === otherDb?.database_id)
  problems.push('Staging and production must use different D1 databases')
if (Object.keys(vars).some((name) => /SECRET|TOKEN|PASSWORD/.test(name)))
  problems.push('Store secrets with wrangler secret put, never in vars')
if (problems.length) {
  console.error(`Deployment configuration incomplete:\n${problems.map((p) => `- ${p}`).join('\n')}`)
  process.exit(1)
}
console.log(
  `Configuration checks passed for ${target ?? 'production'}. Remote resources, secrets, email delivery and billing remain unverified.`,
)
if (check) process.exit(0)
const taskEnv = { ...process.env, WRANGLER_SEND_METRICS: 'false' }
if (target) taskEnv.CLOUDFLARE_ENV = target
else delete taskEnv.CLOUDFLARE_ENV
for (const command of [
  ['build'],
  ['exec', 'wrangler', 'deploy', ...(target ? ['--env', target] : [])],
]) {
  const result = spawnSync('pnpm', command, { stdio: 'inherit', env: taskEnv })
  if (result.status !== 0) process.exit(result.status || 1)
  // This generated file is for local preview only. It must not accompany deployment artifacts.
  if (command[0] === 'build' && existsSync('dist/server/.dev.vars'))
    unlinkSync('dist/server/.dev.vars')
}
