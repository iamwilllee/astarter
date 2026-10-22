import { Miniflare } from 'miniflare'
import { readdir, readFile } from 'node:fs/promises'
export async function testDatabase() {
  const runtime = new Miniflare({
    workers: [
      {
        config: {
          name: 'isolated-tests',
          compatibilityDate: '2026-10-19',
          manifest: {
            mainModule: 'index.js',
            modules: {
              'index.js': {
                type: 'esm',
                contents: 'export default {fetch(){return new Response("ok")}}',
              },
            },
          },
          env: { DB: { type: 'd1', id: 'isolated-tests' } },
        },
      },
    ],
  })
  const db = await runtime.getD1Database('DB')
  const directory = new URL('../../migrations/', import.meta.url)
  for (const file of (await readdir(directory)).filter((name) => name.endsWith('.sql')).sort()) {
    for (const statement of (await readFile(new URL(file, directory), 'utf8')).split(
      '--> statement-breakpoint',
    ))
      if (statement.trim()) await db.prepare(statement).run()
  }
  return { db, dispose: () => runtime.dispose() }
}
