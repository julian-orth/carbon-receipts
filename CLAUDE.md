# Carbon Receipts

Scope, architecture, data model and build order: see `docs/briefing.md` (source of truth).
Decisions log: `docs/decisions.md` — add a short entry for every non-obvious choice.

## Commands

- `npm run dev` · `npm run build` · `npm run typecheck` · `npm run lint` · `npm test` · `npm run format`
- Before committing, all of these must pass: `npm run format:check && npm run lint && npm run typecheck && npm test`

## Rules

- The AI suggests, the code calculates: CO₂e math lives in pure functions under `src/lib/emissions/`, fully unit-tested.
- No `any`. DB types in `src/types/database.ts` are generated (`supabase gen types`), never hand-edited.
- Server state only via TanStack Query; query keys are defined centrally per feature.
- Every data-driven component handles loading, empty and error states.
- Accessibility: semantic HTML, keyboard operable, visible focus.
- Linting is oxlint (not ESLint, see decision 002). Imports use the `@/` alias.
- Conventional Commits, small and focused.
