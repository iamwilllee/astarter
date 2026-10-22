import { spawnSync } from 'node:child_process'
import { assertLocalProject, dependenciesPresent, localBootstrapEnv } from './project-local.mjs'

// This entrypoint intentionally has no package imports: it must work after install failed.
const root = process.cwd()
try {
  if (process.argv.length > 2) throw new Error('在现有产品目录执行 project:resume，无需额外参数')
  assertLocalProject(root)
  let installed = false
  if (!dependenciesPresent(root)) {
    const result = spawnSync('pnpm', ['install', '--frozen-lockfile'], {
      cwd: root,
      stdio: 'inherit',
      env: localBootstrapEnv(),
    })
    if (result.error || result.status !== 0)
      throw new Error('依赖安装失败，文件与已有业务保留；修复环境后继续 project:resume')
    installed = true
  }
  const { resumeProject } = await import('./project-workflow.mjs')
  resumeProject(root, { dependenciesInstalled: installed })
  console.log('本地初始化已恢复；业务代码和验收状态保留。下一步运行 pnpm project:status')
} catch (error) {
  console.error(error instanceof SyntaxError ? 'JSON 配置无效；未显示原始内容。' : error.message)
  process.exitCode = 2
}
