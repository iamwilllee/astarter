import {
  chmodSync,
  closeSync,
  existsSync,
  lstatSync,
  mkdirSync,
  mkdtempSync,
  openSync,
  readFileSync,
  readSync,
  readdirSync,
  realpathSync,
  renameSync,
  rmSync,
  writeFileSync,
} from 'node:fs'
import { createHash, randomUUID } from 'node:crypto'
import { spawn } from 'node:child_process'
import { hostname, tmpdir } from 'node:os'
import { isAbsolute, join, relative, resolve } from 'node:path'
import { parse } from 'jsonc-parser'
import { readFeatures } from './project-features.mjs'

const storage = '.local/database-releases'
const hash = (value) => createHash('sha256').update(value).digest('hex')
function fileHash(path) {
  const digest = createHash('sha256')
  const file = openSync(path, 'r')
  const buffer = Buffer.alloc(1024 * 1024)
  try {
    let count
    while ((count = readSync(file, buffer, 0, buffer.length, null)))
      digest.update(buffer.subarray(0, count))
    return digest.digest('hex')
  } finally {
    closeSync(file)
  }
}
const fingerprint = (value) => hash(JSON.stringify(value))
const fail = (message) => {
  throw new Error(message)
}
const safeName = /^[a-zA-Z_][a-zA-Z0-9_]*$/
const uuid = /^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i

// Paths are project-local and never traverse symlinks, including the private backup root.
function pathIn(root, path) {
  const full = resolve(root, path)
  const rel = relative(root, full)
  if (!rel || rel.startsWith('..') || isAbsolute(rel))
    fail('Database path must stay inside the project')
  let current = root
  for (const part of rel.split('/')) {
    current = join(current, part)
    if (lstatSync(current, { throwIfNoEntry: false })?.isSymbolicLink())
      fail('Database workflow paths must not be symlinks')
  }
  return full
}
function privateDirectory(root, path) {
  const full = pathIn(root, path)
  mkdirSync(full, { recursive: true, mode: 0o700 })
  chmodSync(full, 0o700)
  return full
}
function writeJSON(path, value) {
  const temp = `${path}.tmp-${randomUUID()}`
  writeFileSync(temp, `${JSON.stringify(value, null, 2)}\n`, { flag: 'wx', mode: 0o600 })
  renameSync(temp, path)
}
function loadJSON(path) {
  try {
    return JSON.parse(readFileSync(path, 'utf8'))
  } catch {
    fail('Database release record is missing or invalid; raw contents were not printed')
  }
}
function runDir(root, id) {
  if (!uuid.test(id ?? '')) fail('A valid database release id is required')
  return pathIn(root, `${storage}/${id}`)
}

export function databaseContext(root, environment, { local = false } = {}) {
  root = realpathSync(root)
  if (!['staging', 'production'].includes(environment))
    fail('Choose --env staging or --env production explicitly')
  if (!readFeatures(root).features.database) return { enabled: false, environment }
  const errors = []
  const base = parse(readFileSync(pathIn(root, 'wrangler.jsonc'), 'utf8'), errors, {
    allowTrailingComma: true,
  })
  if (errors.length || !base || typeof base !== 'object')
    fail('Invalid Wrangler JSONC configuration')
  const config = environment === 'production' ? base : base.env?.staging
  const bindings = config?.d1_databases?.filter((item) => item.binding === 'DB') ?? []
  const db = bindings[0]
  if (bindings.length !== 1 || !/^[a-zA-Z0-9][a-zA-Z0-9_-]{0,62}$/.test(db?.database_name ?? ''))
    fail('Selected environment needs exactly one named DB binding')
  if (db.remote === true && local) fail('Local development must not use a remote DB binding')
  if (!uuid.test(db.database_id ?? '') || (!local && db.database_id.startsWith('00000000')))
    fail('Configure the selected remote D1 database_id before planning a release')
  const other = (environment === 'production' ? base.env?.staging : base)?.d1_databases ?? []
  if (!local && other.some((item) => item.database_id === db.database_id))
    fail('Staging and production must use different databases')
  if (db.migrations_pattern)
    fail(
      'Custom migration globs require manual review; this workflow supports top-level SQL migrations',
    )
  const table = db.migrations_table ?? 'd1_migrations'
  if (!safeName.test(table)) fail('Use a simple SQL identifier for migrations_table')
  const migrationPath = db.migrations_dir ?? 'migrations'
  if (isAbsolute(migrationPath)) fail('migrations_dir must be project-relative')
  const directory = pathIn(root, migrationPath)
  const names = readdirSync(directory)
    .filter((name) => name.endsWith('.sql'))
    .sort()
  if (!names.length) fail('No SQL migrations found')
  const numbers = new Set()
  const migrations = names
    .map((name) => {
      if (!/^\d+_[a-zA-Z0-9_-]+\.sql$/.test(name))
        fail('Migration names must use numbered top-level SQL files')
      const number = Number(name.split('_')[0])
      if (numbers.has(number)) fail('Migration sequence numbers must be unique')
      numbers.add(number)
      const sql = readFileSync(pathIn(root, join(migrationPath, name)), 'utf8')
      return { name, hash: hash(sql), review: /\b(DROP|DELETE|UPDATE|ALTER|REPLACE)\b/i.test(sql) }
    })
    .sort((a, b) => Number(a.name.split('_')[0]) - Number(b.name.split('_')[0]))
  const account = base.account_id ?? process.env.CLOUDFLARE_ACCOUNT_ID ?? null
  if (account !== null && !/^[0-9a-f]{32}$/i.test(account))
    fail('Invalid Cloudflare account identifier')
  const target = {
    environment,
    worker: config.name ?? base.name,
    account,
    database: db.database_name,
    databaseId: db.database_id,
    table,
    migrationPath,
    migrations,
    ...(local && db.preview_database_id ? { previewDatabaseId: db.preview_database_id } : {}),
  }
  return { enabled: true, ...target, fingerprint: fingerprint(target) }
}

// Minimal explicit config avoids Vite's .wrangler/deploy/config.json redirection and local secrets.
function configFor(context, directory) {
  const config = {
    ...(context.account ? { account_id: context.account } : {}),
    d1_databases: [
      {
        binding: 'DB',
        database_name: context.database,
        database_id: context.databaseId,
        ...(context.previewDatabaseId ? { preview_database_id: context.previewDatabaseId } : {}),
        migrations_table: context.table,
        migrations_dir: join(directory, 'migrations'),
      },
    ],
  }
  if (context.environment === 'staging') return { env: { staging: config } }
  return config
}
function writeSnapshot(root, context, directory) {
  mkdirSync(join(directory, 'migrations'), { mode: 0o700 })
  for (const item of context.migrations) {
    const content = readFileSync(pathIn(root, join(context.migrationPath, item.name)))
    if (hash(content) !== item.hash)
      fail('Migration changed while preparing its snapshot; create a new plan')
    writeFileSync(join(directory, 'migrations', item.name), content, { flag: 'wx', mode: 0o600 })
  }
  writeJSON(join(directory, 'wrangler.json'), configFor(context, directory))
}

// Provider stdout/stderr can include signed backup URLs or SQL data. Never stream or persist it.
export function wranglerCommand(root, args) {
  const env = { ...process.env, WRANGLER_SEND_METRICS: 'false', CI: 'true' }
  delete env.CLOUDFLARE_ENV
  delete env.WRANGLER_LOG_PATH
  env.WRANGLER_LOG_SANITIZE = 'true'
  env.WRANGLER_WRITE_LOGS = 'false'
  env.WRANGLER_LOG = 'log'
  return new Promise((done, reject) => {
    const child = spawn('pnpm', ['exec', 'wrangler', ...args], {
      cwd: root,
      env,
      stdio: ['ignore', 'pipe', 'pipe'],
    })
    let output = '',
      overflow = false
    child.stdout.on('data', (chunk) => {
      if (output.length + chunk.length > 4_000_000) {
        overflow = true
        child.kill()
      } else output += chunk.toString()
    })
    child.stderr.resume()
    child.on('error', () =>
      reject(new Error('Unable to start Wrangler; verify the locked dependencies')),
    )
    child.on('close', (code) => {
      if (code !== 0 || overflow)
        reject(
          new Error(
            'Wrangler operation failed; provider output was redacted. Check access, D1 limits and the recorded phase before resuming.',
          ),
        )
      else done(output)
    })
  })
}
function commandArgs(context, directory, args) {
  return [
    ...args,
    '--config',
    join(directory, 'wrangler.json'),
    '--env',
    context.environment === 'staging' ? 'staging' : '',
  ]
}
function resultRows(output) {
  try {
    const results = JSON.parse(output)
    if (
      !Array.isArray(results) ||
      results.length !== 1 ||
      results[0].success !== true ||
      !Array.isArray(results[0].results)
    )
      throw new Error()
    return results[0].results
  } catch {
    fail('Unexpected D1 response; no rows or provider output were printed')
  }
}
async function sql(context, directory, command, run) {
  return resultRows(
    await run(
      commandArgs(context, directory, [
        'd1',
        'execute',
        context.database,
        '--remote',
        '--json',
        '--command',
        command,
      ]),
    ),
  )
}
async function inspect(context, directory, run) {
  const tables = await sql(
    context,
    directory,
    "SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' AND name NOT LIKE '_cf_%' ORDER BY name",
    run,
  )
  const hasTable = tables.some((row) => row.name === context.table)
  if (!hasTable && tables.length)
    fail(
      'Existing database has no migration history; review and baseline it manually before using this workflow',
    )
  const rows = hasTable
    ? await sql(context, directory, `SELECT name FROM "${context.table}" ORDER BY id`, run)
    : []
  const applied = rows.map((row) => row.name)
  if (!applied.length && tables.some((row) => row.name !== context.table))
    fail('Existing business tables have no applied migrations; review a baseline manually')
  if (applied.some((name, i) => name !== context.migrations[i]?.name))
    fail(
      'Remote migration history diverges from this ordered migration set; do not apply or deploy',
    )
  return { applied, pending: context.migrations.slice(applied.length).map((item) => item.name) }
}

function knownHashes(root, context, remoteApplied = []) {
  const directory = pathIn(root, storage)
  if (!existsSync(directory)) return
  for (const id of readdirSync(directory).filter((name) => uuid.test(name))) {
    const record = loadJSON(pathIn(root, `${storage}/${id}/state.json`))
    if (record.context?.databaseId !== context.databaseId) continue
    const attempted = record.attempts?.some((attempt) => attempt.migrationStarted)
      ? remoteApplied.filter((name) => record.context.migrations.some((item) => item.name === name))
      : []
    for (const name of new Set([...(record.observedApplied ?? []), ...attempted])) {
      const previous = record.context.migrations.find((item) => item.name === name)
      const current = context.migrations.find((item) => item.name === name)
      if (!previous || current?.hash !== previous.hash)
        fail(
          'A previously observed applied migration was changed or removed; generate a new migration instead',
        )
    }
  }
}
export async function checkDatabase(
  root,
  environment,
  { run = (args) => wranglerCommand(root, args) } = {},
) {
  const context = databaseContext(root, environment)
  if (!context.enabled)
    return {
      enabled: false,
      environment,
      pending: [],
      note: 'Database is not selected; no remote access',
    }
  knownHashes(root, context)
  const directory = mkdtempSync(join(tmpdir(), 'aster-db-check-'))
  try {
    writeSnapshot(root, context, directory)
    const remote = await inspect(context, directory, run)
    knownHashes(root, context, remote.applied)
    await verifyIntegrity(context, directory, run)
    return {
      enabled: true,
      environment,
      database: context.database,
      ...remote,
      integrity: 'passed',
      note: 'Read-only history/integrity check; applied SQL contents and business behavior are not proven',
    }
  } finally {
    rmSync(directory, { recursive: true, force: true })
  }
}
export function planDatabase(root, environment) {
  root = realpathSync(root)
  const context = databaseContext(root, environment)
  if (!context.enabled)
    return {
      enabled: false,
      environment,
      note: 'Database is not selected; no plan or resource created',
    }
  knownHashes(root, context)
  const id = randomUUID()
  const directory = privateDirectory(root, `${storage}/${id}`)
  writeSnapshot(root, context, directory)
  const state = {
    version: 1,
    id,
    context,
    phase: 'planned',
    createdAt: new Date().toISOString(),
    attempts: [],
  }
  writeJSON(join(directory, 'state.json'), state)
  return {
    enabled: true,
    id,
    environment,
    database: context.database,
    migrations: context.migrations,
    note: 'Local plan only; remote pending migrations remain unknown',
  }
}
function loadState(root, environment, id, { current = true } = {}) {
  const directory = runDir(root, id)
  const state = loadJSON(pathIn(root, `${storage}/${id}/state.json`))
  const {
    fingerprint: recordedFingerprint,
    enabled: _enabled,
    ...recordedTarget
  } = state.context ?? {}
  if (
    state.id !== id ||
    state.version !== 1 ||
    state.context?.environment !== environment ||
    recordedFingerprint !== fingerprint(recordedTarget)
  )
    fail('Release record does not match its target or fingerprint')
  if (current && databaseContext(root, environment).fingerprint !== state.context.fingerprint)
    fail('Database target, account or migrations changed; create a new release plan')
  for (const item of state.context.migrations) {
    if (hash(readFileSync(pathIn(root, `${storage}/${id}/migrations/${item.name}`))) !== item.hash)
      fail('Pinned migration snapshot changed; do not resume this release')
  }
  if (
    fingerprint(loadJSON(pathIn(root, `${storage}/${id}/wrangler.json`))) !==
    fingerprint(configFor(state.context, directory))
  )
    fail('Pinned database configuration changed; do not resume this release')
  return { state, directory }
}
function lock(root, id) {
  const directory = privateDirectory(root, storage)
  const file = pathIn(root, `${storage}/lock`)
  try {
    writeFileSync(file, JSON.stringify({ id, pid: process.pid, host: hostname() }), {
      flag: 'wx',
      mode: 0o600,
    })
  } catch {
    fail(
      'Database operation is locked. Inspect status; unlock only after the owning process has stopped',
    )
  }
  return () => rmSync(join(directory, 'lock'))
}
export function unlockDatabase(root) {
  const file = pathIn(realpathSync(root), `${storage}/lock`)
  const owner = loadJSON(file)
  if (owner.host !== hostname() || !Number.isInteger(owner.pid) || owner.pid <= 0)
    fail('Lock owner cannot be verified on this host; inspect it manually')
  try {
    process.kill(owner.pid, 0)
    fail('Database operation is still running; leave its lock intact')
  } catch (error) {
    if (error.code !== 'ESRCH') throw error
  }
  rmSync(file)
  return { unlocked: true }
}
export async function applyDatabase(
  root,
  environment,
  id,
  { run = (args) => wranglerCommand(root, args), progress = () => {} } = {},
) {
  root = realpathSync(root)
  const release = lock(root, id)
  let state, directory
  try {
    ;({ state, directory } = loadState(root, environment, id))
    const context = state.context
    knownHashes(root, context)
    const save = () => writeJSON(join(directory, 'state.json'), state)
    const phase = (name) => {
      state.phase = name
      state.updatedAt = new Date().toISOString()
      save()
      progress(name)
    }
    phase('preflight')
    let remote = await inspect(context, directory, run)
    knownHashes(root, context, remote.applied)
    if (state.observedApplied?.some((name, i) => remote.applied[i] !== name))
      fail('Remote database history moved backwards; review recovery before resuming')
    state.observedApplied = remote.applied
    save()
    if (remote.pending.length) {
      phase('backup')
      const attempt = {
        id: randomUUID(),
        startedAt: new Date().toISOString(),
        appliedBefore: remote.applied,
      }
      state.attempts.push(attempt)
      save()
      const bookmarkOutput = await run(
        commandArgs(context, directory, ['d1', 'time-travel', 'info', context.database, '--json']),
      )
      try {
        attempt.bookmark = JSON.parse(bookmarkOutput).bookmark
        if (!/^[0-9a-f]+(?:-[0-9a-f]+)+$/i.test(attempt.bookmark ?? '')) throw new Error()
      } catch {
        fail('Unable to capture a D1 Time Travel bookmark; no migration started')
      }
      save()
      const backup = pathIn(root, `${storage}/${id}/backup-${attempt.id}.sql`)
      writeFileSync(backup, '', { flag: 'wx', mode: 0o600 })
      await run(
        commandArgs(context, directory, [
          'd1',
          'export',
          context.database,
          '--remote',
          '--output',
          backup,
          '--skip-confirmation',
        ]),
      )
      chmodSync(backup, 0o600)
      if (!lstatSync(backup).size) fail('Backup is empty; no migration started')
      attempt.backup = { file: relative(root, backup), hash: fileHash(backup) }
      save()
      // Refuse drift during export; the bookmark/backup is not a global write lock.
      const latest = await inspect(context, directory, run)
      if (fingerprint(latest) !== fingerprint(remote))
        fail('Remote migrations changed during backup; review before resuming')
      // Revalidate live source/config before the first SQL mutation.
      loadState(root, environment, id)
      attempt.migrationStarted = true
      phase('migrating')
      await run(
        commandArgs(context, directory, [
          'd1',
          'migrations',
          'apply',
          context.database,
          '--remote',
        ]),
      )
    }
    phase('verifying')
    remote = await inspect(context, directory, run)
    state.observedApplied = remote.applied
    save()
    if (remote.pending.length)
      fail('Remote migrations remain pending; deployment must stay blocked')
    await verifyIntegrity(context, directory, run)
    phase('verified')
    return {
      id,
      environment,
      phase: state.phase,
      applied: remote.applied,
      note: 'Database migration/integrity verified; application and provider acceptance remain separate',
    }
  } catch (error) {
    if (state && directory) {
      state.failedPhase = state.phase
      state.phase = 'failed'
      state.updatedAt = new Date().toISOString()
      writeJSON(join(directory, 'state.json'), state)
    }
    throw error
  } finally {
    release()
  }
}
async function verifyIntegrity(context, directory, run) {
  const quick = await sql(context, directory, 'PRAGMA quick_check', run)
  if (quick.length !== 1 || Object.values(quick[0])[0] !== 'ok')
    fail('Database integrity check failed; inspect recovery options')
  if ((await sql(context, directory, 'PRAGMA foreign_key_check', run)).length)
    fail('Database foreign-key check failed; inspect recovery options')
}
export function databaseStatus(root, environment) {
  root = realpathSync(root)
  if (!['staging', 'production'].includes(environment))
    fail('Choose --env staging or --env production explicitly')
  const directory = pathIn(root, storage)
  if (!existsSync(directory)) return { environment, releases: [], locked: false }
  let currentFingerprint
  try {
    currentFingerprint = databaseContext(root, environment).fingerprint
  } catch {
    /* Still expose recovery records when live config is invalid. */
  }
  return {
    environment,
    locked: existsSync(pathIn(root, `${storage}/lock`)),
    releases: readdirSync(directory)
      .filter((name) => uuid.test(name))
      .map((id) => {
        const state = loadJSON(pathIn(root, `${storage}/${id}/state.json`))
        return {
          id,
          environment: state.context.environment,
          database: state.context.database,
          phase: state.phase,
          stale: state.context.fingerprint !== currentFingerprint,
          failedPhase: state.failedPhase,
          updatedAt: state.updatedAt ?? state.createdAt,
          backups: state.attempts.filter((item) => item.backup).length,
        }
      })
      .filter((item) => item.environment === environment)
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)),
    note: 'Local records only; recheck remote history before acting',
  }
}
export function recoveryDatabase(root, environment, id) {
  root = realpathSync(root)
  // Recovery must remain inspectable after a source change; use the exact pinned DB target.
  const { state, directory } = loadState(root, environment, id, { current: false })
  return {
    id,
    environment,
    database: state.context.database,
    databaseId: state.context.databaseId,
    executed: false,
    warning:
      'Restore overwrites data written after the selected bookmark. Stop/reconcile writes, back up current data, review Worker compatibility and obtain authorization for the specific restore. SQL export is private data, not a migration or a safe in-place undo.',
    points: state.attempts
      .filter((item) => item.bookmark)
      .map((item) => {
        let backupValid = false
        try {
          backupValid = Boolean(
            item.backup && fileHash(pathIn(root, item.backup.file)) === item.backup.hash,
          )
        } catch {
          /* A missing/corrupt export does not hide the Time Travel recovery point. */
        }
        return {
          startedAt: item.startedAt,
          bookmark: item.bookmark,
          backup: item.backup?.file ?? null,
          backupValid,
          command: [
            'pnpm',
            'exec',
            'wrangler',
            ...commandArgs(state.context, directory, [
              'd1',
              'time-travel',
              'restore',
              state.context.database,
              '--bookmark',
              item.bookmark,
            ]),
          ],
        }
      }),
    note: 'Check the current account plan retention window and remote bookmark validity; no restore or Worker rollback was executed',
  }
}
export async function migrateLocalDatabase(
  root,
  { run = (args) => wranglerCommand(root, args) } = {},
) {
  const context = databaseContext(root, 'production', { local: true })
  if (!context.enabled)
    return { enabled: false, note: 'Database not selected; local migration skipped' }
  const directory = mkdtempSync(join(tmpdir(), 'aster-db-local-'))
  try {
    writeSnapshot(root, context, directory)
    await run(
      commandArgs(context, directory, [
        'd1',
        'migrations',
        'apply',
        context.database,
        '--local',
        '--persist-to',
        resolve(root, '.wrangler/state'),
      ]),
    )
    return { enabled: true, note: 'Local migrations applied; no cloud database was accessed' }
  } finally {
    rmSync(directory, { recursive: true, force: true })
  }
}
