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

## 011 – Emission factors: ifeu 2020 for food, BAFU 2026 for fuel, seeded by migration

Food factors come from ifeu (2020), _Ökologische Fußabdrücke von Lebensmitteln und Gerichten in
Deutschland_ – CO₂ footprints "at the supermarket checkout" in Germany, reference year 2019. It is
German, covers ~200 products and is published by the UBA's contractor; global averages such as
Poore & Nemecek (2018) are much higher for animal products (e.g. beef 99 vs. 13.6 kg CO₂e/kg)
because they reflect global production mixes. Every row stores the exact table and line number
(`source`) and the PDF URL (`source_url`), so each result can be traced back to a single number.

Fuel factors come from the BAFU fact sheet (January 2026): 2.32 kg CO₂/l petrol, 2.62 kg CO₂/l
diesel.

**Trade-offs / known limitations**

- System boundaries differ: food values are life-cycle values, fuel values cover combustion only
  (no upstream emissions, which would add roughly a quarter).
- Beverages and milk are reported per kg and stored per litre (density ≈ 1).
- Eggs are stored per piece, derived as 3.0 kg CO₂e/kg × 60 g per egg (assumption).
- Some categories use a reference product (e.g. frozen vegetables → frozen broccoli).
- Spend-based factors (CO₂e per EUR) for bank CSV exports are **not** seeded yet; a source still
  has to be chosen.

The factors are seeded in a migration (idempotent `on conflict (slug) do update`), not in
`seed.sql`: they are reference data needed in every environment, and `supabase db push` does not
run the seed file.

## 012 – One pure calculation module, shared with the edge function

`src/lib/emissions/` contains the only CO₂e formula (`calculateCo2e`), unit normalization,
product-name normalization for `category_mappings` and rounding. It has no dependencies and uses
`.ts` import extensions, so the Deno edge function can import the same files; an oxlint override
blocks any import from outside the folder.

- Results are a discriminated union: missing quantity, missing price or a unit mismatch (e.g.
  pieces vs. kg) fail explicitly, so the item is sent to the review screen instead of getting a
  guessed number. kg ↔ l is accepted and flagged as `density_1`.
- Rounding to the DB precision (4 decimals) shifts via the decimal exponent, because
  `Math.round(x * 1e4)` rounds 12.34565 down (binary 12.3456499…).
- A type-level test asserts that the domain `EmissionUnit` equals the generated DB enum.
