import { resolve } from 'node:path'
import { existsSync } from 'node:fs'
import { doctor } from './project-doctor.mjs'
const planFile = 'starter.project.json'

const [command, ...args] = process.argv.slice(2)
const root = process.cwd()
try {
  const allowed = { doctor: ['--json'], status: [], check: ['--ready', '--if-present'] }
  if (!allowed[command] || args.some((arg) => !allowed[command].includes(arg)))
    throw new Error('Unknown workflow option')
  if (command === 'doctor') {
    const report = await doctor(root)
    if (args.includes('--json')) console.log(JSON.stringify(report, null, 2))
    else
      for (const check of report.checks)
        console.log(`[${check.status}] ${check.id}: ${check.message}`)
    if (!report.ok) process.exitCode = 2
  } else if (
    command === 'check' &&
    args.includes('--if-present') &&
    !existsSync(resolve(root, planFile))
  ) {
    console.log('No product plan in this source directory; skipped.')
  } else if (command === 'check') {
    const { loadPlan, moduleCatalog, planProblems } = await import('./project-workflow.mjs')
    const plan = loadPlan(root)
    const report = planProblems(root, plan)
    console.log(
      JSON.stringify(
        {
          ...report,
          modules: Object.fromEntries(
            Object.entries(plan.modules).map(([key, choice]) => [
              key,
              { ...choice, capability: moduleCatalog[key].capability },
            ]),
          ),
        },
        null,
        2,
      ),
    )
    if (report.errors.length || (args.includes('--ready') && !report.ready)) process.exitCode = 2
  } else if (command === 'status') {
    const { projectStatus } = await import('./project-workflow.mjs')
    console.log(JSON.stringify(projectStatus(root), null, 2))
  } else
    throw new Error(
      'Usage: pnpm project:doctor [--json] | project:status | project:check [--ready] | project:resume',
    )
} catch (error) {
  // Invalid plan/config input must not be echoed: it could contain accidental credentials.
  console.error(
    error?.code === 'ENOENT'
      ? '缺少项目文件；请在已初始化产品目录运行。'
      : error.code === 'ERR_MODULE_NOT_FOUND'
        ? '依赖尚未安装；先运行 project:doctor 或 project:resume。'
        : error instanceof SyntaxError
          ? 'JSON 配置无效；未显示原始内容。'
          : error.message,
  )
  process.exitCode = 2
}
