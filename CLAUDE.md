# Carbon Receipts

Scope, architecture, data model and build order: see `docs/briefing.md` (source of truth).
Decisions log: `docs/decisions.md` — add a short entry for every non-obvious choice.

## Commands

- `npm run dev` · `npm run build` · `npm run typecheck` · `npm run lint` · `npm test` · `npm run format`
- DB: `npm run db:start` · `db:reset` · `db:test` (pgTAP) · `db:types` (regenerate after every migration)
- E2E: `npm run test:e2e` (needs `db:start` + `functions:serve` with `LLM_PROVIDERS=mock`)
- Deployment steps: `docs/deploy.md`
- Before committing, all of these must pass: `npm run format:check && npm run lint && npm run typecheck && npm test`

## Rules

- The AI suggests, the code calculates: CO₂e math lives in pure functions under `supabase/functions/_shared/emissions/` (import via `@shared/*`), fully unit-tested.
- No `any`. DB types in `supabase/functions/_shared/database.types.ts` are generated (re-exported by `src/types/database.ts`) (`supabase gen types`), never hand-edited.
- Server state only via TanStack Query; query keys are defined centrally per feature.
- Every data-driven component handles loading, empty and error states.
- Accessibility: semantic HTML, keyboard operable, visible focus.
- Every new table: RLS on, explicit minimal grants (nothing is granted by default), pgTAP coverage in `supabase/tests/database/`.
- Linting is oxlint (not ESLint, see decision 002). Imports use the `@/` alias. oxlint override globs need a `**/` prefix (`**/src/...`), otherwise they silently don't match.
- `supabase/functions/_shared/emissions/` stays dependency-free with `.ts` import extensions (shared with the Deno edge function).
- Reference data needed in production goes into migrations, not `seed.sql`.
- Conventional Commits, small and focused.
