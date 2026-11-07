# Decisions & Trade-offs

Short log of architectural decisions. Newest at the bottom. Feeds the README section “Decisions & Trade-offs”.

## 001 – The AI suggests, the code calculates

The LLM only extracts line items and proposes a category. CO₂e is computed deterministically
(`quantity × co2e_per_unit`) in pure, unit-tested functions, and every result is traceable to a
factor and its source. AI output is always validated with Zod before it is persisted.

## 002 – oxlint instead of ESLint

The Vite template ships TypeScript 7 (native compiler). `typescript-eslint` currently supports
TypeScript `<6.1`, so ESLint would have forced a TypeScript downgrade. oxlint covers the rules we need
(`react`, `react-hooks`, `jsx-a11y`, `typescript`, `import`, `vitest`) natively, is much faster and
works with TS 7. Prettier stays responsible for formatting.

**Trade-off:** no type-aware lint rules (e.g. `no-floating-promises`) for now. Revisit once
typescript-eslint or oxlint's type-aware mode supports TS 7.

## 003 – Strict TypeScript beyond `strict`

`noUncheckedIndexedAccess` and `noImplicitOverride` are on. `exactOptionalPropertyTypes` is off:
it causes friction with Radix/shadcn and React Hook Form typings for little gain in this project.

## 004 – Grants decide _what_, RLS decides _which rows_

Supabase no longer grants table privileges in `public` automatically, so the migration grants
explicitly and minimally. Column-level grants keep server-owned fields out of the client's reach:
users cannot set `receipts.status` on insert, choose a `user_id`, or create global
`category_mappings`. `TRUNCATE` (which bypasses RLS) is revoked. `anon` can only read
`emission_categories`.

## 005 – Receipt status transitions guarded in the database

The edge function (`service_role`) drives `pending → processing → review | failed`. A trigger allows
end users only `review → done` (confirm) and `failed → pending` (retry). This holds even if a
client bypasses the UI.

## 006 – `line_items.user_id` is denormalized, but kept consistent

`line_items` carries `user_id` so RLS policies don't need a join. A composite foreign key
`(receipt_id, user_id) → receipts(id, user_id)` makes it impossible to attach items to someone
else's receipt.

## 007 – Database behaviour is tested with pgTAP

`supabase/tests/database` checks RLS, grants and status transitions per role. CI runs them against
a fresh database and also fails when `src/types/database.ts` is out of date with the migrations.

## 008 – Magic link with PKCE; session in context, not in TanStack Query

The magic link uses the PKCE flow: the link returns a one-time `?code=` that supabase-js exchanges
itself, so no tokens appear in the URL or browser history. Trade-off: the link must be opened in the
browser where it was requested; the callback page explains this.

The session is client state owned by supabase-js (`onAuthStateChange`), so it lives in a small
context instead of TanStack Query. On sign-out the query cache is cleared so no data of the previous
user remains.

The "return to" path survives the round trip through the mail client in `localStorage` and is
sanitized to same-origin paths (no open redirect).

## 009 – Realtime patches the query cache instead of refetching

Status changes from the processing pipeline arrive via Supabase Realtime (`postgres_changes`,
filtered by `user_id`, RLS still applies). Each event is merged into the TanStack Query cache by a
pure, unit-tested function (`applyReceiptChange`), so the list updates without a network round trip.
After every (re)subscribe the list is refetched once, so events missed while offline are not lost.

## 010 – Upload: file first, then row; cleanup on failure

The file is uploaded to `<user_id>/<uuid>.<ext>` (storage policies check the first folder), then the
`receipts` row is inserted with status `pending`. If the insert fails, the file is removed again.
Deleting goes the other way: row first (line items cascade), then the file. A leftover file is only
logged; an orphaned row pointing to a missing file would be worse.

File type detection prefers the MIME type and falls back to the extension, because browsers report
CSV as `application/vnd.ms-excel` or `''` and HEIC often as `''`. PDFs are accepted by the bucket
but not offered in the UI yet (not in MVP scope).
