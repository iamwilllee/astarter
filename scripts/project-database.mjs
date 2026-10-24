import {
  applyDatabase,
  checkDatabase,
  databaseStatus,
  migrateLocalDatabase,
  planDatabase,
  recoveryDatabase,
  unlockDatabase,
} from './database-release.mjs'

const usage =
  'Usage: pnpm project:database plan|check|status --env staging|production; apply|recovery --env staging|production --id <release-id>; local; unlock'
try {
  const [command, ...args] = process.argv.slice(2)
  if (command === '--help') {
    console.log(usage)
  } else {
    const values = {}
    for (let i = 0; i < args.length; i += 2) {
      if (
        !['--env', '--id'].includes(args[i]) ||
        values[args[i]] ||
        !args[i + 1] ||
        args[i + 1].startsWith('--')
      )
        throw new Error(usage)
      values[args[i]] = args[i + 1]
    }
    const env = values['--env'],
      id = values['--id'],
      root = process.cwd()
    if (
      !['plan', 'check', 'status', 'apply', 'recovery', 'local', 'unlock'].includes(command) ||
      (['local', 'unlock'].includes(command)
        ? args.length !== 0
        : !['staging', 'production'].includes(env)) ||
      (['apply', 'recovery'].includes(command) ? !id : Boolean(id))
    )
      throw new Error(usage)
    const output =
      command === 'local'
        ? await migrateLocalDatabase(root)
        : command === 'unlock'
          ? unlockDatabase(root)
          : command === 'plan'
            ? planDatabase(root, env)
            : command === 'check'
              ? await checkDatabase(root, env)
              : command === 'status'
                ? databaseStatus(root, env)
                : command === 'recovery'
                  ? recoveryDatabase(root, env, id)
                  : await applyDatabase(root, env, id, {
                      progress: (phase) => console.error(`Database release: ${phase}`),
                    })
    console.log(JSON.stringify(output, null, 2))
    if (command === 'check' && output.pending.length) process.exitCode = 2
  }
} catch (error) {
  // Filesystem/JSON errors may contain sensitive content or paths. Only intentional messages escape.
  console.error(
    error.code || error instanceof SyntaxError
      ? 'Database workflow could not read/write its files; raw details were redacted.'
      : error.message,
  )
  process.exitCode = 2
}
