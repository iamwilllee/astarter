import { spawnSync } from 'node:child_process'

const [action, email] = process.argv.slice(2)
if (!['grant', 'revoke'].includes(action) || !email || !email.includes('@')) {
  console.error('Usage: pnpm admin:grant email@example.test (or admin:revoke). Local D1 only.')
  process.exit(1)
}
// Hex encoding keeps arbitrary email input out of SQL syntax. No shell interpolation.
const value = `CAST(X'${Buffer.from(email.toLowerCase()).toString('hex')}' AS TEXT)`
const command =
  action === 'grant'
    ? `INSERT INTO admin_user (user_id) SELECT id FROM user WHERE email = ${value} ON CONFLICT(user_id) DO NOTHING;`
    : `DELETE FROM admin_user WHERE user_id IN (SELECT id FROM user WHERE email = ${value});`
const result = spawnSync(
  'pnpm',
  ['exec', 'wrangler', 'd1', 'execute', 'starter-db', '--local', '--command', command],
  { stdio: 'inherit' },
)
if (result.status !== 0) process.exit(result.status || 1)
console.log(
  'Local role operation finished. The account must already exist; refresh the workspace to see its current role.',
)
