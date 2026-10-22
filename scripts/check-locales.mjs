import { readFileSync } from 'node:fs'
const messages = ['en', 'zh'].map((lang) =>
  JSON.parse(readFileSync(`src/i18n/${lang}.json`, 'utf8')),
)
const keys = new Set(messages.flatMap(Object.keys))
const problems = []
for (const key of keys) {
  if (messages.some((dictionary) => typeof dictionary[key] !== 'string'))
    problems.push(`Missing message: ${key}`)
  else {
    const params = messages.map((dictionary) =>
      [...dictionary[key].matchAll(/\{(\w+)\}/g)]
        .map((match) => match[1])
        .sort()
        .join(','),
    )
    if (params[0] !== params[1]) problems.push(`Parameter mismatch: ${key}`)
  }
}
if (problems.length) {
  console.error(problems.join('\n'))
  process.exit(1)
}
console.log(`Locale dictionaries match: ${keys.size} messages, with matching placeholders.`)
