import { randomBytes, randomUUID } from 'node:crypto'
import { mkdirSync, readFileSync, writeFileSync, existsSync, unlinkSync } from 'node:fs'
import { spawn, spawnSync } from 'node:child_process'
import { resolve, join } from 'node:path'
import https from 'node:https'
import net from 'node:net'
import { parse } from 'jsonc-parser'

// Everything writable for this run is below a fresh, ignored directory. No developer DB or secrets are read.
const work = resolve('.wrangler/acceptance', randomUUID())
mkdirSync(work, { recursive: true })
const config = join(work, 'wrangler.json')
const output = join(work, 'dist')
const state = join(work, 'state')
const base = parse(readFileSync('wrangler.jsonc', 'utf8'), [], { allowTrailingComma: true })
const origin = 'https://127.0.0.1:3110'
writeFileSync(
  config,
  JSON.stringify({
    name: 'starter-production-smoke',
    main: base.main,
    compatibility_date: base.compatibility_date,
    compatibility_flags: base.compatibility_flags,
    vars: {
      ENVIRONMENT: 'production',
      APP_ORIGIN: origin,
      MAIL_MODE: 'disabled',
      MAIL_FROM: 'Starter <no-reply@example.invalid>',
      BILLING_ENABLED: 'false',
      GOOGLE_AUTH_ENABLED: 'true',
      PUBLIC_INDEXABLE: 'false',
    },
    d1_databases: [
      {
        binding: 'DB',
        database_name: 'starter-smoke-db',
        database_id: randomUUID(),
        migrations_dir: resolve('migrations'),
      },
    ],
  }),
)
writeFileSync(
  join(work, '.dev.vars'),
  `BETTER_AUTH_SECRET=${randomBytes(32).toString('hex')}\nGOOGLE_CLIENT_ID=fixture-only.apps.googleusercontent.com\nGOOGLE_CLIENT_SECRET=fixture-only-not-a-real-google-secret\n`,
  { mode: 0o600 },
)
const redirect = resolve('.wrangler/deploy/config.json')
const previous = existsSync(redirect) ? readFileSync(redirect) : null
const taskEnv = {
  ...process.env,
  STARTER_SMOKE_CONFIG: config,
  STARTER_SMOKE_OUT: output,
  STARTER_SMOKE_URL: origin,
  WRANGLER_SEND_METRICS: 'false',
  CLOUDFLARE_LOAD_DEV_VARS_FROM_DOT_ENV: 'false',
}
for (const key of Object.keys(taskEnv)) {
  if (
    /^(GOOGLE_|STRIPE_)/.test(key) ||
    [
      'BETTER_AUTH_SECRET',
      'CLOUDFLARE_ENV',
      'CLOUDFLARE_API_TOKEN',
      'CLOUDFLARE_API_KEY',
      'CF_API_TOKEN',
      'CF_API_KEY',
    ].includes(key)
  )
    delete taskEnv[key]
}
function assertPortAvailable() {
  return new Promise((done, reject) => {
    const probe = net.createServer()
    probe.once('error', () =>
      reject(
        new Error('Port 3110 is occupied; stop that service or choose another acceptance port.'),
      ),
    )
    probe.listen(3110, '127.0.0.1', () => probe.close(done))
  })
}
function run(args) {
  const result = spawnSync('pnpm', args, { stdio: 'inherit', env: taskEnv })
  if (result.status !== 0) throw new Error(`Command failed: pnpm ${args.join(' ')}`)
}
function ready() {
  return new Promise((done) => {
    const request = https.get(origin + '/api/health', { rejectUnauthorized: false }, (response) => {
      response.resume()
      done(response.statusCode === 200)
    })
    request.setTimeout(1000, () => request.destroy())
    request.on('error', () => done(false))
  })
}
let server
let code = 1
try {
  await assertPortAvailable()
  run(['exec', 'vite', 'build'])
  run([
    'exec',
    'wrangler',
    'd1',
    'migrations',
    'apply',
    'starter-smoke-db',
    '--config',
    config,
    '--local',
    '--persist-to',
    state,
  ])
  server = spawn(
    'pnpm',
    [
      'exec',
      'wrangler',
      'dev',
      '--config',
      join(output, 'server/wrangler.json'),
      '--local',
      '--port',
      '3110',
      '--local-protocol',
      'https',
      '--persist-to',
      state,
    ],
    { stdio: ['ignore', 'pipe', 'pipe'], env: taskEnv, detached: true },
  )
  server.stdout.on('data', () => {})
  server.stderr.on('data', () => {})
  const deadline = Date.now() + 30_000
  while (!(await ready())) {
    if (Date.now() > deadline || server.exitCode !== null)
      throw new Error('Isolated production Worker did not become healthy')
    await new Promise((resolve) => setTimeout(resolve, 250))
  }
  run(['exec', 'playwright', 'test', '--config', 'playwright.production.config.ts'])
  code = 0
} catch (error) {
  console.error(error.message)
} finally {
  if (server?.pid) {
    try {
      process.kill(-server.pid, 'SIGTERM')
    } catch {}
  }
  if (previous) writeFileSync(redirect, previous)
  else if (existsSync(redirect)) unlinkSync(redirect)
  console.log('Production smoke finished. No cloud resources or developer data were changed.')
}
process.exitCode = code
