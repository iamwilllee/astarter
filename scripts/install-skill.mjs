import {
  existsSync,
  lstatSync,
  mkdirSync,
  readlinkSync,
  realpathSync,
  symlinkSync,
  unlinkSync,
} from 'node:fs'
import { homedir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

export function installSkill(source, skillsDirectory) {
  source = realpathSync(source)
  if (!existsSync(join(source, 'SKILL.md'))) throw new Error('Skill source is missing SKILL.md')
  mkdirSync(skillsDirectory, { recursive: true })
  const target = join(skillsDirectory, 'aster-new')
  let current
  try {
    current = lstatSync(target)
  } catch (error) {
    if (error.code !== 'ENOENT') throw error
  }
  if (current) {
    if (!(current.isSymbolicLink() && existsSync(target) && realpathSync(target) === source))
      throw new Error(`Skill already exists at ${target}; no files were overwritten`)
  } else {
    symlinkSync(source, target, process.platform === 'win32' ? 'junction' : 'dir')
  }
  // Migrate only the old link owned by this exact checkout, including a broken link
  // left by the folder rename. Unrelated Skills and real directories stay untouched.
  const legacy = join(skillsDirectory, 'starter-new')
  try {
    if (
      lstatSync(legacy).isSymbolicLink() &&
      [source, join(dirname(source), 'starter-new')].includes(
        resolve(dirname(legacy), readlinkSync(legacy)),
      )
    )
      unlinkSync(legacy)
  } catch (error) {
    if (error.code !== 'ENOENT') throw error
  }
  return target
}
if (process.argv[1] && realpathSync(resolve(process.argv[1])) === fileURLToPath(import.meta.url)) {
  try {
    const source = resolve(dirname(fileURLToPath(import.meta.url)), '../skills/aster-new')
    console.log(`Installed Skill link: ${installSkill(source, join(homedir(), '.agents/skills'))}`)
    console.log(
      'Invoke $aster-new in a new Codex session. Keep this Aster directory in place; the link uses its source and initializer.',
    )
  } catch (error) {
    console.error(error.message)
    process.exitCode = 1
  }
}
