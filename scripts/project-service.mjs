import { createHash } from 'node:crypto'
import { lstatSync, readFileSync, openSync, closeSync, unlinkSync } from 'node:fs'
import { resolve, join } from 'node:path'
import { loadPlan, savePlan, planFile } from './project-workflow.mjs'
import { planService, recordService, serviceStatus } from './service-workflow.mjs'

const root = process.cwd()
const [command, ...args] = process.argv.slice(2)
let lock
try {
  const allowed = { status: ['--id'], plan: ['--input'], record: ['--id', '--step', '--input'] }
  if (!allowed[command]) throw new Error('usage')
  const options = {}
  for (let at = 0; at < args.length; at += 2) {
    if (
      !allowed[command].includes(args[at]) ||
      options[args[at]] ||
      !args[at + 1] ||
      args[at + 1].startsWith('--')
    )
      throw new Error('usage')
    options[args[at]] = args[at + 1]
  }
  if (
    command !== 'status' &&
    (!options['--input'] || (command === 'record' && (!options['--id'] || !options['--step'])))
  )
    throw new Error('usage')
  if (lstatSync(join(root, planFile)).isSymbolicLink()) throw new Error('unsafe plan')
  if (command !== 'status') lock = openSync(join(root, planFile + '.service-lock'), 'wx', 0o600)
  const original = readFileSync(join(root, planFile))
  const plan = loadPlan(root)
  if (command !== 'status') {
    const inputPath = resolve(options['--input'])
    if (lstatSync(inputPath).size > 100_000) throw new Error('input too large')
    const input = JSON.parse(readFileSync(inputPath, 'utf8'))
    if (command === 'plan') planService(root, plan, input)
    else recordService(root, plan, options['--id'], options['--step'], input)
    const hash = (bytes) => createHash('sha256').update(bytes).digest('hex')
    if (hash(original) !== hash(readFileSync(join(root, planFile)))) throw new Error('plan changed')
    savePlan(root, plan)
  }
  const reports = serviceStatus(root, plan.integrations)
  if (options['--id'] && !reports.some((item) => item.id === options['--id']))
    throw new Error('unknown service')
  console.log(
    JSON.stringify(
      reports.filter((item) => !options['--id'] || item.id === options['--id']),
      null,
      2,
    ),
  )
} catch {
  console.error(
    'Service workflow failed; no provider operation was run. Check fields, project paths, evidence, prerequisites and concurrent edits. Usage: project:service status [--id ID] | plan --input JSON | record --id ID --step STEP --input JSON. Input values were not printed. A stale .service-lock requires inspection before removal.',
  )
  process.exitCode = 2
} finally {
  if (lock !== undefined) {
    closeSync(lock)
    unlinkSync(join(root, planFile + '.service-lock'))
  }
}
