import { randomBytes } from 'node:crypto'
import { existsSync, writeFileSync } from 'node:fs'
import { spawnSync } from 'node:child_process'

if (!existsSync('.dev.vars')) {
  writeFileSync(
    '.dev.vars',
    `ENVIRONMENT=local\nAPP_ORIGIN=http://127.0.0.1:3100\nMAIL_MODE=local\nBILLING_ENABLED=false\nBETTER_AUTH_SECRET=${randomBytes(32).toString('hex')}\n`,
    { mode: 0o600 },
  )
  console.log('Created .dev.vars with a fresh local secret (not printed).')
}
for (const args of [['exec', 'wrangler', 'types'], ['db:migrate']]) {
  const result = spawnSync('pnpm', args, {
    stdio: 'inherit',
    env: { ...process.env, WRANGLER_SEND_METRICS: 'false' },
  })
  if (result.status !== 0) process.exit(result.status || 1)
}
console.log('Local setup ready. Run pnpm dev → http://127.0.0.1:3100')
