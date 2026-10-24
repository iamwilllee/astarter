import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  mkdtempSync,
  mkdirSync,
  writeFileSync,
  readFileSync,
  rmSync,
  symlinkSync,
  unlinkSync,
  existsSync,
} from 'node:fs'
import { tmpdir } from 'node:os'
import { resolve, join } from 'node:path'
import { spawnSync } from 'node:child_process'
import {
  initialPlan,
  loadPlan,
  savePlan,
  parsePlan,
  planProblems,
  projectStatus,
} from '../../scripts/project-workflow.mjs'
import {
  planService,
  recordService,
  serviceSteps,
  serviceStatus,
} from '../../scripts/service-workflow.mjs'

const cli = resolve('scripts/project-service.mjs')
function fixture(t, provider = 'brevo') {
  const root = mkdtempSync(join(tmpdir(), 'aster-service-'))
  t.after(() => rmSync(root, { recursive: true, force: true }))
  mkdirSync(join(root, 'src'))
  mkdirSync(join(root, '.local'))
  const steps = serviceSteps(provider)
  for (const key of steps) {
    writeFileSync(join(root, `src/${key}.ts`), `// ${key} input`)
    writeFileSync(join(root, `.local/${key}.md`), `Fixture for ${key}; not real acceptance`)
  }
  const spec = {
    id: `${provider}-staging`,
    provider,
    environment: 'staging',
    account: 'existing-account',
    worker: 'product-staging',
    origin: 'https://staging.product.test',
    credentialRevision: 'initial-key',
    ...(provider === 'google' ? {} : { domain: 'mail.product.test' }),
    inputs: Object.fromEntries(steps.map((key) => [key, [`src/${key}.ts`]])),
  }
  const plan = initialPlan('Test product')
  planService(root, plan, spec)
  const record = (key, input = {}) =>
    recordService(root, plan, spec.id, key, {
      status: 'done',
      verification: 'real',
      evidence: [`.local/${key}.md`],
      ...input,
    })
  const status = () => serviceStatus(root, plan.integrations)[0]
  return { root, spec, plan, record, status, complete: () => steps.forEach((key) => record(key)) }
}
function passedCase(plan) {
  plan.acceptance.push({
    id: 'auth-email-live',
    title: 'Fixture auth',
    kind: 'business',
    scope: 'provider',
    required: true,
    status: 'passed',
    verification: 'real',
    evidence: ['.local/auth.md'],
    steps: ['Fixture'],
    expected: 'Fixture',
  })
}

test('old plans load without integrations; new initialization cannot inherit external progress', (t) => {
  const f = fixture(t)
  const legacy = initialPlan('Legacy')
  delete legacy.integrations
  assert.deepEqual(parsePlan(legacy).integrations, [])
  assert.deepEqual(initialPlan('Fresh', f.plan).integrations, [])
  assert.throws(
    () => parsePlan({ integrations: [{ secret: 'never-echo-this' }] }),
    (error) => !error.message.includes('never-echo-this'),
  )
})

test('resume after serialization preserves completed stages and identifies one concrete handoff', (t) => {
  const f = fixture(t)
  f.record('account')
  f.record('domain', {
    status: 'blocked',
    verification: 'unverified',
    evidence: [],
    blocker: {
      kind: 'activation',
      detail: 'Domain activation pending',
      userAction: 'Complete the account activation screen',
      resume: 'Recheck domain activation and continue delivery',
    },
  })
  // A domain review does not prevent independent credential/deployment work.
  f.record('credentials')
  f.record('deployment')
  savePlan(f.root, f.plan)
  const restored = loadPlan(f.root)
  const status = projectStatus(f.root)
  assert.equal(restored.integrations[0].steps.account.status, 'done')
  assert.equal(status.integrations[0].next.key, 'domain')
  assert.equal(status.integrations[0].next.blocker.kind, 'activation')
  assert.equal(
    status.integrations[0].steps.find((step) => step.key === 'deployment').status,
    'done',
  )
  recordService(f.root, restored, f.spec.id, 'domain', {
    status: 'done',
    verification: 'real',
    evidence: ['.local/domain.md'],
  })
  assert.equal(
    serviceStatus(f.root, restored.integrations)[0].steps.find((step) => step.key === 'credentials')
      .status,
    'done',
  )
  assert.deepEqual(serviceStatus(f.root, restored.integrations)[0].actionable, ['delivery'])
})

test('real evidence and prerequisites are mandatory; mock and API-only shortcuts cannot finish auth', (t) => {
  const f = fixture(t)
  assert.throws(() => f.record('account', { verification: 'mock' }), /real evidence/)
  assert.throws(() => f.record('account', { evidence: [] }), /real evidence/)
  assert.throws(() => f.record('auth'), /prerequisite/)
  assert.throws(() => f.record('account', { status: 'blocked', evidence: [] }), /handoff/)
  f.complete()
  assert.equal(f.status().complete, true)
  assert.equal(
    f.plan.acceptance.some((item) => item.id === 'auth-email-live'),
    false,
  )
  // Stage progress never manufactures a passed business/provider case.
  assert.equal(planProblems(f.root, f.plan).ready, false)
})

test('source changes invalidate only the dependent branch, and stale acceptance blocks release checks', (t) => {
  const f = fixture(t)
  f.complete()
  passedCase(f.plan)
  writeFileSync(join(f.root, 'src/domain.ts'), '// changed domain configuration')
  const stages = Object.fromEntries(f.status().steps.map((step) => [step.key, step.status]))
  assert.equal(stages.account, 'done')
  assert.equal(stages.domain, 'stale')
  assert.equal(stages.credentials, 'done')
  assert.equal(stages.deployment, 'done')
  assert.equal(stages.delivery, 'stale')
  assert.equal(stages.auth, 'stale')
  assert.ok(planProblems(f.root, f.plan).errors.some((message) => message.includes('过期')))
  f.record('domain')
  assert.equal(f.plan.acceptance.at(-1).status, 'pending')
  assert.deepEqual(f.plan.acceptance.at(-1).evidence, [])
  assert.equal(f.status().steps.find((step) => step.key === 'deployment').status, 'done')
})

test('domain changes and credential rotation preserve unrelated checkpoints; environment/provider changes recheck credentials', (t) => {
  const f = fixture(t)
  f.complete()
  planService(f.root, f.plan, { ...f.spec, domain: 'new.product.test' })
  assert.equal(f.status().steps.find((step) => step.key === 'domain').status, 'pending')
  assert.equal(f.status().steps.find((step) => step.key === 'credentials').status, 'done')
  assert.equal(f.status().steps.find((step) => step.key === 'deployment').status, 'done')
  planService(f.root, f.plan, { ...f.spec, credentialRevision: 'rotated-key' })
  assert.equal(f.status().steps.find((step) => step.key === 'account').status, 'done')
  assert.equal(f.status().steps.find((step) => step.key === 'credentials').status, 'pending')
  assert.equal(f.status().steps.find((step) => step.key === 'deployment').status, 'pending')
  f.complete()
  planService(f.root, f.plan, {
    ...f.spec,
    environment: 'production',
    worker: 'product-production',
  })
  assert.equal(f.status().steps.find((step) => step.key === 'credentials').status, 'pending')
  planService(f.root, f.plan, { ...f.spec, provider: 'resend' })
  assert.ok(f.status().steps.every((step) => step.status === 'pending'))
})

test('unchanged plan retains real checkpoints and accepted business evidence; changed evidence becomes stale', (t) => {
  const f = fixture(t)
  f.complete()
  passedCase(f.plan)
  planService(f.root, f.plan, f.spec)
  assert.equal(f.status().complete, true)
  assert.equal(f.plan.acceptance.at(-1).status, 'passed')
  writeFileSync(join(f.root, '.local/delivery.md'), 'Different report')
  assert.equal(f.status().steps.find((step) => step.key === 'delivery').status, 'stale')
  unlinkSync(join(f.root, '.local/delivery.md'))
  assert.ok(planProblems(f.root, f.plan).errors.length)
})

test('private paths, traversal, symlinks and credential payloads are refused without echoing values', (t) => {
  const f = fixture(t)
  writeFileSync(join(f.root, '.dev.vars'), 'SECRET=do-not-print')
  symlinkSync(join(f.root, '.dev.vars'), join(f.root, 'src/link.ts'))
  for (const reference of [
    '.dev.vars',
    '../outside.md',
    '/tmp/report',
    'src/link.ts',
    'src/../.dev.vars',
  ]) {
    assert.throws(() =>
      planService(f.root, f.plan, {
        ...f.spec,
        inputs: { ...f.spec.inputs, account: [reference] },
      }),
    )
    assert.throws(() => f.record('account', { evidence: [reference] }))
  }
  assert.throws(
    () => planService(f.root, f.plan, { ...f.spec, apiKey: 'never-echo-this' }),
    (error) => !error.message.includes('never-echo-this'),
  )
  assert.throws(() =>
    planService(f.root, f.plan, { ...f.spec, origin: 'https://product.test/?token=secret' }),
  )
  assert.throws(() =>
    planService(f.root, f.plan, { ...f.spec, inputs: { ...f.spec.inputs, delivery: [] } }),
  )
})

test('Google uses its own checkpoints and never creates a mail requirement', (t) => {
  const f = fixture(t, 'google')
  assert.deepEqual(
    f.status().steps.map((step) => step.key),
    ['account', 'credentials', 'deployment', 'auth'],
  )
  f.complete()
  assert.equal(f.status().acceptanceId, 'auth-google-live')
  assert.equal(f.status().complete, true)
  planService(f.root, f.plan, { ...f.spec, origin: 'https://other.product.test' })
  assert.equal(f.status().steps.find((step) => step.key === 'account').status, 'done')
  assert.equal(f.status().steps.find((step) => step.key === 'credentials').status, 'pending')
})

test('CLI works from a product directory, persists checkpoints, prints no bad input, and preserves concurrent locks', (t) => {
  const f = fixture(t)
  savePlan(f.root, f.plan)
  const run = (args) =>
    spawnSync(process.execPath, [cli, ...args], { cwd: f.root, encoding: 'utf8' })
  const before = readFileSync(join(f.root, 'starter.project.json'), 'utf8')
  assert.equal(run(['status']).status, 0)
  assert.equal(readFileSync(join(f.root, 'starter.project.json'), 'utf8'), before)
  const input = join(f.root, '.local/input.json')
  writeFileSync(
    input,
    JSON.stringify({ status: 'done', verification: 'real', evidence: ['.local/account.md'] }),
  )
  assert.equal(run(['record', '--id', f.spec.id, '--step', 'account', '--input', input]).status, 0)
  assert.equal(loadPlan(f.root).integrations[0].steps.account.status, 'done')
  assert.equal(existsSync(join(f.root, 'starter.project.json.service-lock')), false)
  writeFileSync(join(f.root, 'starter.project.json.service-lock'), 'existing owner')
  assert.equal(run(['plan', '--input', input]).status, 2)
  assert.equal(
    readFileSync(join(f.root, 'starter.project.json.service-lock'), 'utf8'),
    'existing owner',
  )
  unlinkSync(join(f.root, 'starter.project.json.service-lock'))
  writeFileSync(input, JSON.stringify({ secret: 'never-print-this' }))
  const bad = run(['plan', '--input', input])
  assert.equal(bad.status, 2)
  assert.equal((bad.stdout + bad.stderr).includes('never-print-this'), false)
  assert.equal(run(['status', '--input', input]).status, 2)
})

test('retired optional progress remains visible without invalidating the current provider acceptance', (t) => {
  const f = fixture(t)
  f.complete()
  passedCase(f.plan)
  planService(f.root, f.plan, { ...f.spec, required: false })
  writeFileSync(join(f.root, 'src/domain.ts'), '// historical provider changed')
  assert.equal(f.status().steps.find((step) => step.key === 'domain').status, 'stale')
  assert.equal(f.plan.acceptance.at(-1).status, 'passed')
  assert.equal(
    planProblems(f.root, f.plan).errors.some((message) => message.includes('外部服务')),
    false,
  )
  f.record('domain')
  assert.equal(f.plan.acceptance.at(-1).status, 'passed')
})

test('CLI plan and full checkpoint sequence resume across fresh processes without changing application configuration', (t) => {
  const f = fixture(t, 'resend')
  const plan = initialPlan('Existing product')
  savePlan(f.root, plan)
  const config = join(f.root, 'wrangler.jsonc')
  writeFileSync(config, '{"vars":{"MAIL_MODE":"local"}}')
  const before = readFileSync(config, 'utf8')
  const input = join(f.root, '.local/result.json')
  const run = (args) =>
    spawnSync(process.execPath, [cli, ...args], { cwd: f.root, encoding: 'utf8' })
  writeFileSync(input, JSON.stringify(f.spec))
  assert.equal(run(['plan', '--input', input]).status, 0)
  for (const key of serviceSteps('resend')) {
    writeFileSync(
      input,
      JSON.stringify({ status: 'done', verification: 'real', evidence: [`.local/${key}.md`] }),
    )
    const result = run(['record', '--id', f.spec.id, '--step', key, '--input', input])
    assert.equal(result.status, 0, result.stderr)
  }
  const result = run(['status', '--id', f.spec.id])
  assert.equal(JSON.parse(result.stdout)[0].complete, true)
  assert.equal(readFileSync(config, 'utf8'), before)
  assert.equal(
    loadPlan(f.root).acceptance.some((item) => item.id === 'auth-email-live'),
    false,
  )
})
