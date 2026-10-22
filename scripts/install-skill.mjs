import { existsSync, lstatSync, mkdirSync, realpathSync, symlinkSync } from 'node:fs'
import { homedir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

export function installSkill(source, skillsDirectory) {
  source = realpathSync(source)
  if (!existsSync(join(source, 'SKILL.md'))) throw new Error('Skill source is missing SKILL.md')
  mkdirSync(skillsDirectory, { recursive: true })
  const target = join(skillsDirectory, 'starter-new')
  let current
  try {
    current = lstatSync(target)
  } catch (error) {
    if (error.code !== 'ENOENT') throw error
  }
  if (current) {
    if (current.isSymbolicLink() && existsSync(target) && realpathSync(target) === source)
      return target
    throw new Error(`Skill already exists at ${target}; no files were overwritten`)
  }
  symlinkSync(source, target, process.platform === 'win32' ? 'junction' : 'dir')
  return target
}
if (process.argv[1] && realpathSync(resolve(process.argv[1])) === fileURLToPath(import.meta.url)) {
  try {
    const source = resolve(dirname(fileURLToPath(import.meta.url)), '../skills/starter-new')
    console.log(`Installed Skill link: ${installSkill(source, join(homedir(), '.agents/skills'))}`)
    console.log(
      'Invoke $starter-new in a new Codex session. Keep this Starter directory in place; the link uses its source and initializer.',
    )
  } catch (error) {
    console.error(error.message)
    process.exitCode = 1
  }
}
