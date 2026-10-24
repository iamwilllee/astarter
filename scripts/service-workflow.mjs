import { createHash } from 'node:crypto'
import { lstatSync, readFileSync, realpathSync } from 'node:fs'
import { join } from 'node:path'
import { z } from 'zod'

const id = z.string().regex(/^[a-z][a-z0-9-]{0,63}$/)
const note = z.string().trim().min(1).max(1000)
const path = z.string().min(1).max(240)
const hash = z.string().regex(/^[a-f0-9]{64}$/)
export const serviceSteps = (provider) =>
  provider === 'google'
    ? ['account', 'credentials', 'deployment', 'auth']
    : ['account', 'domain', 'credentials', 'deployment', 'delivery', 'auth']
export function serviceDependencies(provider, key) {
  return {
    account: [],
    domain: ['account'],
    credentials: ['account'],
    deployment: ['credentials'],
    delivery: ['domain', 'deployment'],
    auth: [provider === 'google' ? 'deployment' : 'delivery'],
  }[key]
}
function descendants(provider, key) {
  const affected = new Set([key])
  for (const step of serviceSteps(provider))
    if (serviceDependencies(provider, step).some((parent) => affected.has(parent)))
      affected.add(step)
  affected.delete(key)
  return [...affected]
}
const checkpointBase = z
  .object({
    inputs: z
      .array(path)
      .max(30)
      .default(() => []),
    status: z.enum(['pending', 'done', 'failed', 'blocked']).default('pending'),
    verification: z.enum(['unverified', 'local', 'mock', 'real']).default('unverified'),
    evidence: z
      .array(path)
      .max(20)
      .default(() => []),
    fingerprint: hash.optional(),
    updatedAt: z.iso.datetime().optional(),
    blocker: z
      .object({
        kind: z.enum(['login', 'verification', 'activation', 'permission', 'purchase', 'scope']),
        detail: note,
        userAction: note,
        resume: note,
      })
      .strict()
      .optional(),
  })
  .strict()
const checkpoint = checkpointBase.superRefine((value, ctx) => {
  if (
    value.status === 'done' &&
    (value.verification !== 'real' ||
      !value.evidence.length ||
      !value.fingerprint ||
      !value.updatedAt)
  )
    ctx.addIssue({
      code: 'custom',
      message: 'Completed external steps need real evidence and a checkpoint',
    })
  if ((value.status === 'blocked') !== Boolean(value.blocker))
    ctx.addIssue({ code: 'custom', message: 'Only blocked steps require a precise handoff' })
})
const integrationBase = z
  .object({
    id,
    provider: z.enum(['cloudflare', 'brevo', 'resend', 'google']),
    environment: z.enum(['staging', 'production']),
    // Public identifiers only. No credentials, recipient addresses, callback queries or tokens.
    account: id,
    worker: id,
    origin: z
      .string()
      .url()
      .refine((value) => {
        try {
          const url = new URL(value)
          return url.protocol === 'https:' && url.origin === value
        } catch {
          return false
        }
      }, 'Use an exact HTTPS origin'),
    domain: z
      .string()
      .regex(/^(?:[a-z0-9](?:[a-z0-9-]*[a-z0-9])?\.)+[a-z]{2,63}$/)
      .optional(),
    credentialRevision: id,
    required: z.boolean().default(true),
    steps: z.partialRecord(
      z.enum(['account', 'domain', 'credentials', 'deployment', 'delivery', 'auth']),
      checkpoint,
    ),
  })
  .strict()
export const integrationSchema = integrationBase.superRefine((value, ctx) => {
  const expected = serviceSteps(value.provider)
  if (
    Object.keys(value.steps).length !== expected.length ||
    expected.some((key) => !value.steps[key])
  )
    ctx.addIssue({ code: 'custom', message: 'Steps must match the selected provider' })
  if (value.provider !== 'google' && !value.domain)
    ctx.addIssue({ code: 'custom', message: 'Mail needs a sending domain' })
})

// Do not display arbitrary validation values: an accidental pasted credential stays private.
function parse(schema, value) {
  const result = schema.safeParse(value)
  if (!result.success)
    throw new Error('Invalid service record; check the documented fields without printing values')
  return result.data
}
function file(root, reference, input = false) {
  if (
    !/^[a-zA-Z0-9._/-]+$/.test(reference) ||
    reference.split('/').some((part) => !part || part === '.' || part === '..') ||
    reference.startsWith('/') ||
    /(?:^|\/)(?:\.env[^/]*|\.dev\.vars[^/]*|\.git|\.aws|\.ssh|\.wrangler|\.local-secrets|private|node_modules|dist)(?:\/|$)/.test(
      reference,
    ) ||
    /\.(?:key|pem|p12|pfx|sqlite|sqlite3|db)$/i.test(reference)
  )
    throw new Error('Service paths must be non-sensitive project-relative files')
  if (
    input &&
    !/^(?:src\/|scripts\/|migrations\/|wrangler\.jsonc$|package\.json$|pnpm-lock\.yaml$)/.test(
      reference,
    )
  )
    throw new Error('Service inputs must be source files or public deployment configuration')
  root = realpathSync(root)
  let current = root
  for (const part of reference.split('/')) {
    current = join(current, part)
    if (lstatSync(current).isSymbolicLink()) throw new Error('Service paths cannot use symlinks')
  }
  const stat = lstatSync(current)
  if (!stat.isFile() || stat.size > 2_000_000)
    throw new Error('Service files must be regular files under 2 MB')
  return createHash('sha256').update(readFileSync(current)).digest('hex')
}
const digest = (value) => createHash('sha256').update(JSON.stringify(value)).digest('hex')
function fingerprint(root, integration, key) {
  const { steps, provider, account, domain, credentialRevision, worker, environment, origin } =
    integration
  const context = {
    account: { provider, account },
    domain: { provider, account, domain },
    credentials: {
      provider,
      account,
      credentialRevision,
      worker,
      environment,
      ...(provider === 'google' ? { origin } : {}),
    },
    deployment: { provider, worker, environment, origin },
    delivery: { provider, worker, environment, origin, domain },
    auth: { provider, worker, environment, origin },
  }[key]
  const parents = serviceDependencies(provider, key)
  return digest({
    context,
    parents: parents.map((parent) => [parent, steps[parent].fingerprint, steps[parent].updatedAt]),
    inputs: steps[key].inputs.map((reference) => [reference, file(root, reference, true)]),
    evidence: steps[key].evidence.map((reference) => [reference, file(root, reference)]),
  })
}
export function serviceStatus(root, integrations = []) {
  return integrations.map((raw) => {
    const integration = parse(integrationSchema, raw)
    const states = {}
    const steps = serviceSteps(integration.provider).map((key) => {
      const step = integration.steps[key]
      let valid = true
      try {
        const current = fingerprint(root, integration, key)
        valid = !step.fingerprint || step.fingerprint === current
      } catch {
        valid = false
      }
      const waitingFor = serviceDependencies(integration.provider, key).filter(
        (parent) => states[parent] !== 'done',
      )
      const status =
        step.status !== 'pending' && (!valid || (step.status === 'done' && waitingFor.length))
          ? 'stale'
          : step.status
      states[key] = status
      return {
        key,
        status,
        waitingFor,
        verification: step.verification,
        evidence: step.evidence,
        ...(status === 'blocked' ? { blocker: step.blocker } : {}),
        ...(!valid
          ? { problem: 'Tracked files, evidence or context changed/missing; inspect and reverify' }
          : {}),
      }
    })
    const next = steps.find((step) => step.status !== 'done') ?? null
    return {
      id: integration.id,
      provider: integration.provider,
      environment: integration.environment,
      target: {
        account: integration.account,
        worker: integration.worker,
        origin: integration.origin,
        ...(integration.domain ? { domain: integration.domain } : {}),
        credentialRevision: integration.credentialRevision,
      },
      required: integration.required,
      steps,
      next,
      actionable: steps
        .filter(
          (step) => step.status !== 'done' && step.status !== 'blocked' && !step.waitingFor.length,
        )
        .map((step) => step.key),
      complete: !next,
      acceptanceId: integration.provider === 'google' ? 'auth-google-live' : 'auth-email-live',
      note: 'Recorded progress only; recheck current authorization and live account state before continuing',
    }
  })
}
const reset = (inputs) => ({ inputs, status: 'pending', verification: 'unverified', evidence: [] })
function invalidateAcceptance(plan, provider) {
  const id = provider === 'google' ? 'auth-google-live' : 'auth-email-live'
  for (const item of plan.acceptance.filter((item) => item.id === id))
    Object.assign(item, { status: 'pending', verification: 'unverified', evidence: [] })
}
export function planService(root, plan, input) {
  const spec = parse(
    integrationBase
      .omit({ steps: true })
      .extend({
        inputs: z.partialRecord(
          z.enum(['account', 'domain', 'credentials', 'deployment', 'delivery', 'auth']),
          z.array(path).max(30),
        ),
      })
      .strict(),
    input,
  )
  const keys = serviceSteps(spec.provider)
  if (
    Object.keys(spec.inputs).some((key) => !keys.includes(key)) ||
    keys.some(
      (key) =>
        !spec.inputs[key] || (!['account', 'domain'].includes(key) && !spec.inputs[key].length),
    )
  )
    throw new Error(
      'Provide inputs for every step and track source/config for credentials, deployment, delivery and auth',
    )
  for (const inputs of Object.values(spec.inputs))
    for (const reference of inputs) file(root, reference, true)
  const { inputs, ...context } = spec
  const old = plan.integrations.find((item) => item.id === spec.id)
  const candidate = parse(integrationSchema, {
    ...context,
    steps: Object.fromEntries(keys.map((key) => [key, reset(inputs[key])])),
  })
  // Recompute checkpoints against the new context; preserve independent valid steps.
  if (old && old.provider === spec.provider) {
    for (const key of keys)
      if (digest(old.steps[key].inputs) === digest(inputs[key]))
        candidate.steps[key] = structuredClone(old.steps[key])
    const reports = serviceStatus(root, [candidate])[0].steps
    for (const step of reports)
      if (step.status === 'stale') {
        candidate.steps[step.key] = reset(inputs[step.key])
        for (const child of descendants(spec.provider, step.key))
          candidate.steps[child] = reset(inputs[child])
      }
  }
  if (
    candidate.required &&
    (!old || digest(old) !== digest(candidate) || !serviceStatus(root, [candidate])[0].complete)
  ) {
    invalidateAcceptance(plan, spec.provider)
    if (old && old.provider !== spec.provider) invalidateAcceptance(plan, old.provider)
  }
  plan.integrations = [...plan.integrations.filter((item) => item.id !== spec.id), candidate]
  return plan
}
export function recordService(root, plan, serviceId, key, input) {
  const integration = plan.integrations.find((item) => item.id === serviceId)
  if (!integration || !serviceSteps(integration.provider).includes(key))
    throw new Error('Unknown service or step')
  const result = parse(
    checkpointBase.omit({ inputs: true, fingerprint: true, updatedAt: true }),
    input,
  )
  if (result.status === 'done' && (result.verification !== 'real' || !result.evidence.length))
    throw new Error('Completed external steps need real evidence; mocks cannot prove connectivity')
  if ((result.status === 'blocked') !== Boolean(result.blocker))
    throw new Error('Only blocked steps require a precise handoff')
  const report = serviceStatus(root, [integration])[0]
  if (
    result.status === 'done' &&
    serviceDependencies(integration.provider, key).some(
      (parent) => report.steps.find((step) => step.key === parent).status !== 'done',
    )
  )
    throw new Error('Verify prerequisite steps before completing this step')
  for (const reference of result.evidence) file(root, reference)
  if (integration.required) invalidateAcceptance(plan, integration.provider)
  integration.steps[key] = {
    ...result,
    inputs: integration.steps[key].inputs,
    updatedAt: new Date().toISOString(),
  }
  integration.steps[key].fingerprint = fingerprint(root, integration, key)
  for (const child of descendants(integration.provider, key))
    integration.steps[child] = reset(integration.steps[child].inputs)
  return plan
}

export function serviceProblems(root, integrations) {
  const errors = [],
    pending = []
  for (const service of serviceStatus(root, integrations)) {
    for (const step of service.steps)
      if (service.required && step.problem)
        errors.push(`外部服务记录待检查：${service.id}/${step.key}`)
    if (service.required && !service.complete)
      pending.push(`外部服务待继续：${service.id}/${service.next.key} (${service.next.status})`)
  }
  return { errors, pending }
}
