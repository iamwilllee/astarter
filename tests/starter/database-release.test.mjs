import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  chmodSync,
  mkdtempSync,
  mkdirSync,
  readFileSync,
  writeFileSync,
  rmSync,
  existsSync,
  readdirSync,
  statSync,
  symlinkSync,
} from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { spawnSync } from 'node:child_process'
import { featurePreset } from '../../src/config/feature-policy.mjs'
import {
  applyDatabase,
  checkDatabase,
  databaseContext,
  databaseStatus,
  migrateLocalDatabase,
  planDatabase,
  recoveryDatabase,
  unlockDatabase,
} from '../../scripts/database-release.mjs'

const put = (root, path, value) => {
  mkdirSync(dirname(join(root, path)), { recursive: true })
  writeFileSync(join(root, path), typeof value === 'string' ? value : JSON.stringify(value))
}
function fixture(t) {
  const root = mkdtempSync(join(tmpdir(), 'aster-database-test-'))
  t.after(() => rmSync(root, { recursive: true, force: true }))
  const db = (name, id) => ({
    binding: 'DB',
    database_name: name,
    database_id: id,
    migrations_dir: 'migrations',
  })
  put(root, 'wrangler.jsonc', {
    name: 'fixture',
    account_id: 'a'.repeat(32),
    vars: {
      ENVIRONMENT: 'production',
      APP_ORIGIN: 'https://fixture.example.test',
      MAIL_MODE: 'disabled',
    },
    d1_databases: [db('fixture-production', '11111111-1111-1111-1111-111111111111')],
    env: {
      staging: {
        name: 'fixture-staging',
        d1_databases: [db('fixture-staging', '22222222-2222-2222-2222-222222222222')],
      },
    },
  })
  put(root, 'src/config/features.json', { ...featurePreset('showcase'), database: true })
  put(root, 'migrations/0000_first.sql', 'CREATE TABLE example(id TEXT PRIMARY KEY);')
  put(root, 'migrations/0001_second.sql', 'ALTER TABLE example ADD COLUMN title TEXT;')
  put(root, '.dev.vars', 'DO_NOT_READ=private-fixture-value')
  return root
}
function provider({
  applied = [],
  hasTable = true,
  failApply = false,
  failExport = false,
  fk = [],
  quick = 'ok',
} = {}) {
  const calls = []
  const run = async (args) => {
    calls.push(args)
    assert.ok(!args.includes('--local'))
    const config = JSON.parse(readFileSync(args[args.indexOf('--config') + 1], 'utf8'))
    assert.ok(!JSON.stringify(config).includes('private-fixture-value'))
    const ctx = config.env?.staging ?? config
    assert.equal(ctx.d1_databases.length, 1)
    const statement = args[args.indexOf('--command') + 1]
    const rows = statement?.includes('sqlite_master')
      ? hasTable
        ? [{ name: 'd1_migrations' }, ...(applied.length ? [{ name: 'example' }] : [])]
        : []
      : statement?.startsWith('SELECT name FROM "')
        ? applied.map((name) => ({ name }))
        : statement === 'PRAGMA quick_check'
          ? [{ quick_check: quick }]
          : statement === 'PRAGMA foreign_key_check'
            ? fk
            : null
    if (rows) return JSON.stringify([{ success: true, results: rows }])
    if (args.includes('info'))
      return JSON.stringify({ bookmark: '00000001-00000002-00000003-abcdef' })
    if (args.includes('export')) {
      if (failExport) throw new Error('Fixture export failure')
      writeFileSync(
        args[args.indexOf('--output') + 1],
        '-- private backup fixture\nCREATE TABLE example(id TEXT);',
      )
      return 'signed URL should never be persisted'
    }
    if (args.includes('apply')) {
      if (failApply) {
        applied.push('0000_first.sql')
        failApply = false
        throw new Error('Fixture interrupted after first migration')
      }
      applied.splice(0, applied.length, '0000_first.sql', '0001_second.sql')
      hasTable = true
      return ''
    }
    throw new Error('Unexpected fixture command')
  }
  return { run, calls, applied }
}

test('planning is local, environment-specific and does not copy developer data or secrets', (t) => {
  const root = fixture(t)
  assert.throws(() => planDatabase(root), /explicitly/)
  const plan = planDatabase(root, 'staging')
  assert.equal(plan.database, 'fixture-staging')
  assert.equal(plan.migrations[1].review, true)
  const directory = join(root, '.local/database-releases', plan.id)
  assert.equal(readdirSync(directory).includes('.dev.vars'), false)
  assert.equal(statSync(directory).mode & 0o777, 0o700)
  assert.ok(!readFileSync(join(directory, 'wrangler.json'), 'utf8').includes('fixture-production'))
  assert.equal(databaseStatus(root, 'staging').releases[0].phase, 'planned')
  assert.throws(() => recoveryDatabase(root, 'production', plan.id), /target/)
})
test('remote check is read-only, handles empty new DBs and blocks divergent histories', async (t) => {
  const root = fixture(t)
  const mock = provider({ hasTable: false })
  const result = await checkDatabase(root, 'staging', mock)
  assert.equal(result.pending.length, 2)
  assert.ok(mock.calls.every((args) => args.includes('execute') && !args.includes('apply')))
  assert.ok(!existsSync(join(root, '.local')))
  await assert.rejects(
    checkDatabase(root, 'production', provider({ applied: ['9999_unknown.sql'] })),
    /diverges/,
  )
  await assert.rejects(
    checkDatabase(root, 'production', provider({ applied: ['0001_second.sql'] })),
    /diverges/,
  )
  await assert.rejects(
    checkDatabase(root, 'production', {
      run: async () => JSON.stringify([{ success: true, results: [{ name: 'legacy_business' }] }]),
    }),
    /baseline/,
  )
})
test('backup and bookmark precede migration, verification is current, recovery never restores', async (t) => {
  const root = fixture(t)
  const plan = planDatabase(root, 'production')
  const mock = provider()
  const result = await applyDatabase(root, 'production', plan.id, mock)
  assert.equal(result.phase, 'verified')
  const index = (word) => mock.calls.findIndex((args) => args.includes(word))
  assert.ok(index('info') < index('export') && index('export') < index('apply'))
  assert.equal(mock.calls[index('apply')][mock.calls[index('apply')].indexOf('--env') + 1], '')
  const recovery = recoveryDatabase(root, 'production', plan.id)
  assert.equal(recovery.executed, false)
  assert.equal(recovery.points[0].backupValid, true)
  assert.equal(statSync(join(root, recovery.points[0].backup)).mode & 0o777, 0o600)
  assert.ok(
    !readFileSync(join(root, '.local/database-releases', plan.id, 'state.json'), 'utf8').includes(
      'signed URL',
    ),
  )
  assert.ok(!existsSync(join(root, '.local/database-releases/lock')))
  // A second run rechecks remote state/integrity and does not export or replay migrations.
  const before = mock.calls.length
  await applyDatabase(root, 'production', plan.id, mock)
  assert.ok(mock.calls.slice(before).every((args) => args.includes('execute')))
  rmSync(join(root, recovery.points[0].backup))
  assert.equal(recoveryDatabase(root, 'production', plan.id).points[0].backupValid, false)
})
test('failed backup blocks writes; partial migration resumes from real history with another backup', async (t) => {
  const root = fixture(t)
  const plan = planDatabase(root, 'staging')
  const bad = provider({ failExport: true })
  await assert.rejects(applyDatabase(root, 'staging', plan.id, bad), /export/)
  assert.ok(!bad.calls.some((args) => args.includes('apply')))
  const partial = provider({ failApply: true })
  await assert.rejects(applyDatabase(root, 'staging', plan.id, partial), /interrupted/)
  assert.equal(databaseStatus(root, 'staging').releases[0].failedPhase, 'migrating')
  const final = await applyDatabase(root, 'staging', plan.id, partial)
  assert.equal(final.phase, 'verified')
  assert.equal(
    recoveryDatabase(root, 'staging', plan.id).points.filter((point) => point.backupValid).length,
    2,
  )
})
test('changed targets, snapshots and previously observed applied SQL fail closed', async (t) => {
  const root = fixture(t)
  const plan = planDatabase(root, 'production')
  put(root, 'migrations/0001_second.sql', 'ALTER TABLE example ADD COLUMN changed TEXT;')
  await assert.rejects(applyDatabase(root, 'production', plan.id, provider()), /changed/)
  put(root, 'migrations/0001_second.sql', 'ALTER TABLE example ADD COLUMN title TEXT;')
  await applyDatabase(root, 'production', plan.id, provider())
  put(root, 'migrations/0000_first.sql', 'CREATE TABLE hacked(id TEXT);')
  assert.equal(databaseStatus(root, 'production').releases[0].stale, true)
  assert.throws(() => planDatabase(root, 'production'), /previously observed/)
  await assert.rejects(checkDatabase(root, 'production', provider()), /previously observed/)
  // A recovery plan is still readable when source has advanced.
  assert.equal(recoveryDatabase(root, 'production', plan.id).points[0].backupValid, true)
  put(root, `.local/database-releases/${plan.id}/migrations/0000_first.sql`, 'tampered')
  assert.throws(() => recoveryDatabase(root, 'production', plan.id), /snapshot/)
})
test('failed integrity checks never become successful receipts and block preflight', async (t) => {
  const root = fixture(t)
  const plan = planDatabase(root, 'production')
  const mock = provider({ fk: [{ table: 'example', rowid: 42 }] })
  await assert.rejects(applyDatabase(root, 'production', plan.id, mock), /foreign-key/)
  assert.equal(databaseStatus(root, 'production').releases[0].phase, 'failed')
  await assert.rejects(checkDatabase(root, 'production', mock), /foreign-key/)
  await assert.rejects(
    checkDatabase(root, 'production', provider({ quick: 'corrupt' })),
    /integrity/,
  )
})
test('a new plan cannot hide SQL edits after an interrupted partial application', async (t) => {
  const root = fixture(t)
  const plan = planDatabase(root, 'production')
  const mock = provider({ failApply: true })
  await assert.rejects(applyDatabase(root, 'production', plan.id, mock), /interrupted/)
  put(root, 'migrations/0000_first.sql', 'CREATE TABLE changed(id TEXT);')
  const fresh = planDatabase(root, 'production')
  const before = mock.calls.length
  await assert.rejects(applyDatabase(root, 'production', fresh.id, mock), /previously observed/)
  assert.ok(mock.calls.slice(before).every((args) => args.includes('execute')))
})
test('disabled DB causes no cloud work, unsafe shared IDs/symlinks are rejected, local stays local', async (t) => {
  const root = fixture(t)
  put(root, 'src/config/features.json', featurePreset('showcase'))
  const run = () => {
    throw new Error('must not execute')
  }
  assert.equal(planDatabase(root, 'production').enabled, false)
  assert.equal((await checkDatabase(root, 'production', { run })).enabled, false)
  assert.equal((await migrateLocalDatabase(root, { run })).enabled, false)
  put(root, 'src/config/features.json', { ...featurePreset('showcase'), database: true })
  let called = false
  await migrateLocalDatabase(root, {
    run: async (args) => {
      called = true
      assert.ok(args.includes('--local') && !args.includes('--remote'))
      assert.equal(args[args.indexOf('--persist-to') + 1], join(root, '.wrangler/state'))
    },
  })
  assert.ok(called)
  const config = JSON.parse(readFileSync(join(root, 'wrangler.jsonc')))
  config.d1_databases[0].preview_database_id = '33333333-3333-3333-3333-333333333333'
  put(root, 'wrangler.jsonc', config)
  await migrateLocalDatabase(root, {
    run: async (args) => {
      const isolatedConfig = JSON.parse(readFileSync(args[args.indexOf('--config') + 1], 'utf8'))
      assert.equal(
        isolatedConfig.d1_databases[0].preview_database_id,
        config.d1_databases[0].preview_database_id,
      )
    },
  })
  config.d1_databases[0].remote = true
  put(root, 'wrangler.jsonc', config)
  await assert.rejects(migrateLocalDatabase(root, { run }), /remote DB binding/)
  config.env.staging.d1_databases[0].database_id = config.d1_databases[0].database_id
  put(root, 'wrangler.jsonc', config)
  assert.throws(() => databaseContext(root, 'staging'), /different databases/)
  config.env.staging.d1_databases[0].database_id = '22222222-2222-2222-2222-222222222222'
  put(root, 'wrangler.jsonc', config)
  mkdirSync(join(root, 'private-fixture'))
  symlinkSync(join(root, 'private-fixture'), join(root, '.local'))
  assert.throws(() => planDatabase(root, 'production'), /symlinks/)
})
test('active locks and ambiguous CLI inputs do not start cloud commands', async (t) => {
  const root = fixture(t)
  const plan = planDatabase(root, 'staging')
  put(root, '.local/database-releases/lock', {
    pid: process.pid,
    host: (await import('node:os')).hostname(),
  })
  await assert.rejects(applyDatabase(root, 'staging', plan.id, provider()), /locked/)
  assert.throws(() => unlockDatabase(root), /still running/)
  const cli = resolve('scripts/project-database.mjs')
  for (const args of [
    ['plan'],
    ['check', '--env', 'staging', '--env', 'production'],
    ['local', '--env', 'production'],
    ['apply', '--env', 'production'],
  ]) {
    const result = spawnSync(process.execPath, [cli, ...args], { cwd: root, encoding: 'utf8' })
    assert.equal(result.status, 2)
    assert.ok(!result.stderr.includes('private-fixture-value'))
  }
})
test('deploy rejects pending remote migrations before building or publishing', (t) => {
  const root = fixture(t)
  const bin = join(root, 'bin')
  mkdirSync(bin)
  const log = join(root, 'commands.log')
  put(
    root,
    'bin/pnpm',
    `#!/usr/bin/env node\nconst fs=require('fs'); const a=process.argv.slice(2); fs.appendFileSync(process.env.DB_TEST_LOG,JSON.stringify(a)+'\\n'); let rows=[]; if(a.some(x=>x.includes('sqlite_master'))) rows=[{name:'d1_migrations'}]; if(a.includes('PRAGMA quick_check')) rows=[{quick_check:'ok'}]; process.stdout.write(JSON.stringify([{success:true,results:rows}]));\n`,
  )
  // Executable shim records commands only; no Cloudflare CLI is invoked.
  chmodSync(join(bin, 'pnpm'), 0o700)
  const result = spawnSync(process.execPath, [resolve('scripts/deploy.mjs')], {
    cwd: root,
    encoding: 'utf8',
    env: { ...process.env, PATH: bin + ':' + process.env.PATH, DB_TEST_LOG: log },
  })
  assert.equal(result.status, 1)
  assert.match(result.stderr, /pending migrations/)
  const calls = readFileSync(log, 'utf8').trim().split('\n').map(JSON.parse)
  assert.ok(calls.length > 0 && calls.every((args) => args.includes('execute')))
})
test('deploy checks again after build; disabled databases and local-only checks make no D1 calls', (t) => {
  const root = fixture(t)
  const bin = join(root, 'bin')
  mkdirSync(bin)
  const log = join(root, 'commands.log')
  put(
    root,
    'bin/pnpm',
    `#!/usr/bin/env node
const fs=require('fs');const a=process.argv.slice(2);fs.appendFileSync(process.env.DB_TEST_LOG,JSON.stringify(a)+'\\n');
let rows=[];
if(a.some(x=>x.includes('sqlite_master'))) rows=[{name:'d1_migrations'}];
if(a.some(x=>x.startsWith('SELECT name FROM "'))) rows=[{name:'0000_first.sql'},{name:'0001_second.sql'}];
if(a.includes('PRAGMA quick_check')) rows=[{quick_check:'ok'}];
process.stdout.write(JSON.stringify([{success:true,results:rows}]));
`,
  )
  chmodSync(join(bin, 'pnpm'), 0o700)
  const invoke = (args = []) =>
    spawnSync(process.execPath, [resolve('scripts/deploy.mjs'), ...args], {
      cwd: root,
      encoding: 'utf8',
      env: { ...process.env, PATH: bin + ':' + process.env.PATH, DB_TEST_LOG: log },
    })
  assert.equal(invoke(['--check']).status, 0)
  assert.ok(!existsSync(log))
  const result = invoke()
  assert.equal(result.status, 0, result.stderr)
  let calls = readFileSync(log, 'utf8').trim().split('\n').map(JSON.parse)
  const build = calls.findIndex((args) => args[0] === 'build')
  const deploy = calls.findIndex((args) => args.includes('deploy'))
  assert.ok(calls.slice(0, build).some((args) => args.includes('execute')))
  assert.ok(calls.slice(build + 1, deploy).some((args) => args.includes('execute')))
  assert.ok(!calls.some((args) => args.includes('apply') || args.includes('export')))
  rmSync(log)
  put(root, 'src/config/features.json', featurePreset('showcase'))
  assert.equal(invoke().status, 0)
  calls = readFileSync(log, 'utf8').trim().split('\n').map(JSON.parse)
  assert.equal(calls.length, 2)
  assert.ok(calls.every((args) => args[0] === 'build' || args.includes('deploy')))
})
