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

`supabase/functions/_shared/emissions/` contains the only CO₂e formula (`calculateCo2e`), unit normalization,
product-name normalization for `category_mappings` and rounding. It has no dependencies and uses
`.ts` import extensions; the app imports it via the `@shared/*` alias and the Deno edge function
imports the same files. It lives under `supabase/functions/` because the local edge runtime only
mounts that folder. An oxlint override blocks any import from outside the module. The generated
database types live there too (`_shared/database.types.ts`, re-exported by `src/types/database.ts`).

- Results are a discriminated union: missing quantity, missing price or a unit mismatch (e.g.
  pieces vs. kg) fail explicitly, so the item is sent to the review screen instead of getting a
  guessed number. kg ↔ l is accepted and flagged as `density_1`.
- Rounding to the DB precision (4 decimals) shifts via the decimal exponent, because
  `Math.round(x * 1e4)` rounds 12.34565 down (binary 12.3456499…).
- A type-level test asserts that the domain `EmissionUnit` equals the generated DB enum.

## 013 – MVP: photo receipts only

CSV bank exports and PDFs are out of scope for now. Bank exports only contain totals per merchant
("REWE 54,30 €"); they would need spend-based factors (kg CO₂e per EUR), and there is no open,
ready-to-use table for Germany (EXIOBASE would have to be mapped to consumption categories
first). The upload, the validation and the storage bucket accept images only; a check constraint
enforces `source_type = 'photo'`. The `receipt_source` enum keeps `csv` and `pdf` for later.

## 014 – Processing pipeline: client trigger, atomic claim, background work

- After the upload the client calls the `process-receipt` edge function. The function validates the
  JWT (`auth.getUser`, works with legacy and asymmetric keys – hence `verify_jwt = false`), then
  claims the receipt with a single conditional update (`pending → processing`). A second call gets
  409, so double clicks or retries cannot process a receipt twice.
- It answers 202 immediately and continues with `EdgeRuntime.waitUntil`, so closing the tab does
  not cancel the work. The UI follows the status via Realtime. If starting fails, the receipt stays
  `pending` and the list offers "Analyse starten".
- `LlmProvider` has a Gemini and a Groq implementation plus a deterministic mock (local
  development, E2E tests, demo without keys). `generateWithFallback` retries 429/5xx with
  exponential backoff and full jitter, then moves to the next provider. Output that fails Zod
  validation also moves on to the next provider instead of being stored.
- Model ids are configuration (`GEMINI_MODEL`, `GROQ_MODEL`), because free-tier model names
  rotate – `gemini-2.5-flash` was closed to new users shortly after the first deploy; the default
  is now `gemini-3.8-flash`.
- Every provider call has a 30 s timeout. A timeout is not retried on the same provider (it already
  used the budget) but moves on to the next one; network errors and 429/5xx are retried with backoff.
  Edge functions have a wall-clock limit, so a hanging model must not consume it.
- Learned `category_mappings` (user before global) override the model's category and get
  confidence 1. For photos the model is still needed to read the receipt, so "known names don't
  go to the AI" applies to the categorisation, not to the extraction.
- The daily quota is consumed atomically in Postgres (`consume_ai_quota`) right before the LLM
  call; only `service_role` may execute it.
- Re-processing replaces earlier line items, so a retry is idempotent.

## 015 – Review: per-item forms, same formula, corrections are learned

- Every line item is its own small form (React Hook Form + Zod). The CO₂e preview uses the same
  `calculateCo2e` as the pipeline, so what the user sees is exactly what gets stored, together
  with the factor and a link to its source.
- Items are flagged (not re-sorted) when the category is missing or uncertain (confidence < 0.7)
  or no CO₂e could be calculated. Re-sorting after each save would move the row being edited.
- Changing the category upserts a user mapping (`normalized_name → category`); the next receipt
  with the same product skips the model's guess. The upsert needs an update grant on
  `normalized_name`, RLS still limits it to the user's own rows.
- "Beleg bestätigen" marks all items as reviewed and moves the receipt `review → done` – the only
  transition besides retry that the database allows for users. Only `done` receipts count in the
  dashboard.

## 016 – Dashboard: SQL views, one hue, traceable alternatives

- Aggregation happens in `security_invoker` views (`line_item_emissions`, `monthly_totals`,
  `monthly_emissions`), so RLS applies and the client only fetches small result sets. Only `done`
  receipts count; the effective date is the purchase date, falling back to the upload date.
- Charts follow a data-viz checklist: everything shown is magnitude, so it uses **one sequential
  hue** (validated reference palette) and carries identity in labels, not colour. The trend is a
  Recharts bar chart with tooltip and a table view; the running month is drawn lighter because it
  is incomplete. The category breakdown is plain HTML bars with direct value labels – six sorted
  values don't need an SVG chart. The goal status uses icon + text, never colour alone. No dual
  axes. The "previous month" tile compares two _complete_ months; comparing with the running month
  would always look like a big drop early in the month.
- Screenshots of every page (desktop + mobile) were reviewed before shipping; that is how the
  misleading month comparison and a too-narrow bar chart were caught.
- Alternatives are like-for-like swaps in the same unit (e.g. ground beef → soy patties, milk →
  oat drink). Savings are computed from the same factors and cite their ifeu table row; products
  without an own category (e.g. tap water, soy yoghurt) carry their ifeu factor inline.
- The monthly goal is saved with update-or-insert because users may only update
  `target_co2e_kg`; an upsert would also write `period`.
- Feature pages are lazy routes; Recharts, React and Supabase are separate vendor chunks
  (entry chunk 1.2 MB → 199 kB). A route error boundary asks for a reload when a chunk is gone
  after a deploy.

## 017 – Demo account as a database function; E2E against the real stack

- `private.reset_demo_data(user_id)` (migration) creates six months of receipts relative to today
  plus one receipt waiting for review. Locally `seed.sql` creates the demo user and calls it; in
  production the same function runs once from the SQL editor (optionally nightly via `pg_cron`).
  The demo user signs in with a password from public env vars and has a low AI quota.
- Playwright runs against local Supabase and the edge function with the mock LLM: magic link via
  Mailpit → upload → Realtime status → review → dashboard total, on desktop and mobile. An axe scan
  (WCAG 2.1 AA, serious/critical) covers login, dashboard, receipts and review – it caught a
  focusable chart inside an `aria-hidden` container.
