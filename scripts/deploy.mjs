import { readFeatures } from './project-features.mjs'
import { readFileSync, existsSync, unlinkSync } from 'node:fs'
import { spawnSync } from 'node:child_process'
import { parse } from 'jsonc-parser'
import { deploymentPolicy, missingDeploymentSecrets } from './deployment-policy.mjs'
import { checkDatabase } from './database-release.mjs'

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
const plan = existsSync('starter.project.json')
  ? (await import('./project-workflow.mjs')).loadPlan(process.cwd())
  : undefined
const { problems, requiredSecrets } = deploymentPolicy(
  base,
  target,
  plan,
  readFeatures(process.cwd()).explicit ? readFeatures(process.cwd()).features : undefined,
)
if (!target && plan) {
  const { planProblems } = await import('./project-workflow.mjs')
  if (planProblems(process.cwd(), plan).errors.length)
    problems.push(
      'Product acceptance evidence or plan records are invalid. Run project:check before publishing.',
    )
}
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
// Actual deployment is authorized separately. Read names only for its exact target.
// Local --check never contacts Cloudflare and cannot prove remote secrets exist.
const listed = requiredSecrets.length
  ? spawnSync(
      'pnpm',
      [
        'exec',
        'wrangler',
        'secret',
        'list',
        '--format',
        'json',
        ...(target ? ['--env', target] : []),
      ],
      { encoding: 'utf8', env: taskEnv },
    )
  : { status: 0, stdout: '[]' }
let names
try {
  const items = JSON.parse(listed.stdout)
  if (
    listed.status !== 0 ||
    !Array.isArray(items) ||
    items.some((item) => typeof item.name !== 'string')
  )
    throw new Error('invalid')
  names = items.map((item) => item.name)
} catch {
  throw new Error(
    'Unable to verify remote secret names for the selected Worker. Restore Cloudflare access and configure this environment before deploying; provider output was not printed.',
  )
}
const missing = missingDeploymentSecrets(requiredSecrets, names)
if (missing.length)
  throw new Error(
    `Selected authentication is not configured: missing remote secrets ${missing.join(', ')}. No build or deployment was started.`,
  )
console.log(
  'Required remote secret names exist. Values, OAuth callbacks and real email delivery still require acceptance.',
)
async function databasePreflight() {
  const result = await checkDatabase(process.cwd(), target ?? 'production')
  if (result.pending.length)
    throw new Error(
      `Remote database has ${result.pending.length} pending migrations. Use project:database plan/apply for this environment before deploying. No database migration was executed by deploy.`,
    )
}
await databasePreflight()
for (const command of [
  ['build'],
  ['exec', 'wrangler', 'deploy', ...(target ? ['--env', target] : [])],
]) {
  // Recheck after the build as another operator may have changed the database meanwhile.
  if (command[0] === 'exec') await databasePreflight()
  const result = spawnSync('pnpm', command, { stdio: 'inherit', env: taskEnv })
  if (result.status !== 0) process.exit(result.status || 1)
  // This generated file is for local preview only. It must not accompany deployment artifacts.
  if (command[0] === 'build' && existsSync('dist/server/.dev.vars'))
    unlinkSync('dist/server/.dev.vars')
}
