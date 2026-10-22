# Aster development guide

## Project

TanStack Start + React + TypeScript, Cloudflare Workers/D1, Better Auth + Drizzle. Use pnpm and preserve the lockfile. Keep solutions simple; extend existing modules before adding dependencies. Do not introduce Next.js, a second component framework, state library, or database deployment branch without a concrete need.

## Product handoff

Use the bundled `aster-new` Skill in the current project by default; explicit target paths are optional. It detects missing/empty/metadata-only directories, existing Aster products and other apps. Initialize in place when safe; preserve Git, README, personal rules and editor config. Existing apps are inspected and extended rather than overwritten or forcibly migrated. The CLI can also run from the original Aster source with a target directory. Read `docs/AGENT-GUIDE.md` and the product's `PROJECT.md` before implementation. Use `docs/templates/PROJECT-BRIEF.md` to create a brief when needed; keep business scope and human handoff there. Track choices/provenance, tasks, current acceptance evidence and bootstrap checkpoints in `starter.project.json`. Use `project:doctor`/`project:status` before resuming and `project:resume` for interrupted local initialization. Never mark mock tests as real provider acceptance; reset affected cases when requirements or code change. `project:check --ready` checks records and paths, not business behavior. Preserve this guide's technical boundaries and the recorded starter source version. Keep local QA, personal research and conversation records out of the public repository; every product needs its own acceptance evidence.

## Map

- `skills/aster-new`: Skill entrypoint and deterministic new-product initializer.
- `scripts/project*.mjs`: project plan validation, redacted doctor, status and local-only bootstrap recovery.
- `scripts/install-skill.mjs`: install a non-overwriting user Skill link.
- `tests/starter`: initializer isolation and overwrite protection checks.
- `src/routes`: file routes, public pages, protected `/app` workspace, API catch-all.
- `src/modules`: authentication, mail, Stripe test integration, project validation.
- `src/server`: server functions, request validation, authorization, private API.
- `src/db/schema.ts` and `migrations`: authoritative schema and generated SQL.
- `src/components/ui`: shadcn/ui base-nova source; `src/styles.css`: shared tokens.
- `src/config/site.ts`: name, localized description and plan limits.
- `src/i18n`: typed English/Chinese dictionaries, path locale and public error mapping.
- `tests/production`: isolated production Worker acceptance; no developer data or real provider secrets.
- `tests/unit`: policy/request boundaries and Stripe/D1 reconciliation.
- `tests/e2e`: API isolation and browser workflows.

## Rules

1. Import Cloudflare bindings only from server modules. Never send secrets, sessions, password hashes, or verification tokens into client loaders or logs.
2. Build auth per request. Scope every private read/write by authenticated user ID. Admin status comes from `admin_user`, never client input.
3. Apply project quota in the same atomic statement as creation. D1 batch/conditional writes are used for consistency; KV is not an authority or lock.
4. Stripe is TEST ONLY. Returning from checkout does not grant access. Verify the raw signed webhook, deduplicate, retrieve current provider state, then reconcile with revision checks. Keep webhook/portal working if new checkout is disabled.
5. `.dev.vars` and `.wrangler` stay private. Local mail URLs may only be exposed on the matching loopback origin with `ENVIRONMENT=local`. Never seed real accounts or publish test secrets.
6. Preserve loading, empty, error, dark-theme and mobile states. Use Base UI/shadcn components, Lucide and existing tokens. Mark unconnected functionality honestly.
7. Generate migrations with `pnpm db:generate`; do not silently edit an already applied migration. Update docs/changelog for meaningful behavioral changes.
8. English is the default; Chinese URLs use `/zh`. Keep SSR locale request-scoped, preserve locale across navigation and auth callbacks, and run `pnpm locale:check` after message changes. Never expose arbitrary provider errors.
9. Do not commit, push, publish or rewrite history unless requested. Preserve unrelated working-tree changes.

## Checks

Initial: `pnpm install --frozen-lockfile`, `pnpm setup`. Then `pnpm check`, `pnpm format:check`. Use `pnpm exec playwright install chromium` and `pnpm test:e2e` when a user workflow changes. Use `pnpm test:production` for runtime/auth/environment changes. Check rendered desktop/mobile pages for visual changes. Document actual validation separately from cloud/provider acceptance.

The generated `worker-configuration.d.ts` and `src/routeTree.gen.ts` must not be hand-edited. Regenerate using setup/build when bindings or routes change.
