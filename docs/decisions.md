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

**Update:** oxlint's type-aware mode (`oxlint-tsgolint`, built on the native TS compiler) now works
with TS 7 and runs in `npm run lint` – `no-floating-promises`, `no-misused-promises`,
`no-unsafe-type-assertion` and friends. It found three forms that passed an unhandled promise to
`onSubmit` and several unchecked casts of external data.

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
  is now `gemini-3.8-flash`. On Groq the only vision model left is `qwen/qwen3.8-27b` (preview);
  `llama-4-scout` had disappeared. Tested with a rendered receipt: correct categories, weights,
  multi-packs and ignored deposits in ~1.7 s, but the free plan's 8k tokens/minute allow only about
  one receipt per minute – fine for a fallback, not for a primary provider.
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

## 018 – Real receipts rarely show amounts: estimate, mark, learn

A real Kaufland receipt showed the limit of the first version: packaged goods carry their size on
the package, not on the receipt, so only 3 of 13 items got a CO₂e value.

- The model may now suggest a typical pack size (`estimated_quantity`) when the receipt shows no
  amount. The code still does the calculation; the amount is stored with
  `quantity_source = 'estimated'` and flagged in the review ("Menge geschätzt"). Same receipt
  afterwards: 10 of 12 items with a value.
- Order of precedence for amounts: printed on the receipt → learned from the user → estimated.
  For categories: user mapping → global mapping → model.
- **Learning covers amounts, not only categories.** Saving an item (changed or "Passt so") and
  confirming a receipt store category and amount as the user's mapping. A learned amount is only
  used when the receipt shows none, so weighed goods keep their printed weight. A correction is
  also applied right away to other open items of the same product.
- Deposit and empties ("Pfand", "Leergut") are filtered in code; the prompt alone missed
  "Pfandartikel".
- Limitation: learning is keyed by the normalized product name, so the same product with a
  different abbreviation at another store ("Ferr.Duplo" vs. "FERRERO DUPLO") is learned separately.

## 019 – Ready meals per portion, pet food with a weaker source

- **Ready meals** use ifeu 2020, table 6 (dishes "ready on the plate", kg CO₂e per portion), by main
  ingredient: beef 2.6, meat 1.6, fish 0.6, vegetarian 1.0, vegan 0.9. The unit is one portion
  (`piece`); the model estimates portions (e.g. an 800 g can ≈ 2). Limitation: the ifeu dishes are
  home-cooked for a 4-person household, not industrially produced.
- **Pet food** uses the French government calculator Nos Gestes Climat (ADEME): 2.5 kg CO₂e/kg as
  the average for cat food (dry 1.5, premium/wet 4.5), based on "The global environmental paw print
  of pet food" (2020). This is weaker than the ifeu values: no German study, no per-kg value for dog
  food, and the source page is not fully consistent about its average. It is still better than
  leaving pet food out of the footprint.
- Prompt context: section headers on the receipt ("SB - Wurst") now inform category and pack size,
  and deposit lines hint at the number of bottles. Plausibility rules such as "price ÷ amount must be
  a realistic price per kg" are only partly followed by the model – estimates stay flagged for review.

## 020 – Hardening pass

- **Atomic processing:** `claim_receipt` and `complete_receipt_processing` (service_role only) claim
  a receipt and write its result in single statements/transactions. Before, a crash between
  "delete old items", "insert new items" and "set status" could leave a receipt half written.
- **Crash recovery:** a receipt stuck in `processing` for more than 5 minutes (function killed) can be
  claimed again; the list offers "Analyse starten" for it.
- **Smaller uploads:** photos are downscaled in the browser to JPEG with a 2048 px long edge
  (4032×3024 / 2.5 MB → 2048×1536 / 0.5 MB in a real browser test). Faster uploads, fewer LLM
  timeouts, fewer tokens. Formats the browser cannot decode (HEIC outside Safari) are uploaded as is.
- **Validate, don't cast:** responses from Gemini, Groq and Mailpit (E2E) are parsed with Zod; router
  state and chart payloads use type guards. No `as` on external data remains.
- **Dead code:** `knip` runs in CI; unused exports and helpers were removed.
- **CSP** and other security headers for the Vercel deployment.

## 021 – Live processing view and visual identity

- **Full-screen live view** (`/receipts/:id/live`) right after an upload: five steps (upload, read,
  check, match, calculate), each labelled _KI_ or _Code_, so "the AI suggests, the code calculates"
  is visible. The whole screen fills as the progress bar; the result is "printed" on a receipt.
- **Honest progress:** the edge function writes `receipts.processing_step` and `ai_provider`
  (service_role only, via Realtime to the client). A provider fallback shows up in the protocol.
  Within a step the fill creeps towards 90 % and slows down – it never claims "done" early.
- **Pacing:** the steps after the AI call take milliseconds. The client shows every step for at
  least 650 ms (`usePacedStep`) and prints the line items once they are loaded. Steps are shown in
  the order they really ran, just not faster than a person can follow.
- **Per-receipt totals** come from a `security_invoker` view (`receipt_totals`), not from summing
  line items in the browser.
- **Look:** ink + lime signal colour + receipt paper, Geist and Geist Mono (self-hosted; the CSP
  only allows `font-src 'self'`). Animations use `transform`/`opacity` only and respect
  `prefers-reduced-motion`.
- **Bundle:** chunk groups no longer capture shared dependencies recursively; before, every page
  preloaded the chart library (~84 kB gzip) through a shared helper.

## 022 – Line items keep the receipt order

All items of a receipt are written in one insert and share `created_at`, so sorting by
`(created_at, id)` was effectively random. Correcting is easiest when the list reads like the
photo, so `line_items.position` stores the line on the receipt: the prompt asks for top-to-bottom
order and `complete_receipt_processing` numbers the array `with ordinality`. Existing rows were
backfilled with the old tie-break (their real order is unknown).

## 023 – Analysis in a dialog over the receipt page; line editor and category picker

Supersedes the full-screen live view of 021 (layout only; honest progress and pacing stay).

- **One page per receipt:** `/receipts/:id` is where a receipt is checked; while it is analysed
  the progress runs in a dialog on top (bottom sheet on phones). The live view's "printed
  receipt" was a read-only copy of the review list – now the dialog hands over to the real,
  editable list. Closing the dialog never stops anything; the page shows a placeholder with
  "Fortschritt anzeigen", the dock shows progress elsewhere.
- **Line editor:** lines in receipt order, collapsed to one row each; the first open line starts
  expanded and saving moves on to the next open one. Forms stay mounted while collapsed so an
  unsaved change survives, and they take server updates (`values` + `keepDirtyValues`), so a
  correction learned on one line shows up on the others right away.
- **Category picker:** an ARIA combobox (search field keeps focus, `aria-activedescendant`),
  because options need icon, factor and an intensity hint, which `<select>` cannot render.
  Suggestions come from the receipt text (label words + a small keyword list such as
  Gouda → Käse); compound words only match at their start or end ("tomaten" ≠ "mate").
  Intensity is shown for kg/litre factors only – per-piece factors are not comparable.

## 024 – Skip overloaded models instead of retrying them

`gemini-3.8-flash` answered 503 "high demand" on almost every request (free tier, Nov 2026);
three backoff retries cost ~20–30 s before Groq took over, every time. A 503 now moves on to the
next provider immediately (429 and other 5xx are still retried), Gemini gets a 20 s timeout and
the default model is `gemini-3.5-flash`. `GEMINI_MODEL` accepts a list, so a newer model can be
tried first without making it the only Gemini option. Failed attempts before a successful
fallback are logged (`llm_fallback`) – before, they were invisible.

## 025 – Progress dialog speaks to users, not developers

The dialog of 023 showed "KI/Code" labels, provider names, fallbacks, timings and a log –
interesting for us, noise for someone uploading a receipt. Now: steps in plain language with
one explaining sentence for the running step, a neutral "dauert etwas länger" when a fallback
happens, and a receipt drawn in HTML/CSS that fills up as the analysis goes on (blank → read →
lines print → categories → CO₂e count up → "Fertig" stamp). The dialog is wider (two columns:
receipt and steps; on phones a bottom sheet with a one-line step indicator). Provider names are
no longer shown anywhere in the UI; they stay in the database and logs.

## 026 – Dark mode

Follows the system by default; a header menu switches between light, dark and system (stored in
`localStorage`, failures ignored). `public/theme-init.js` applies the class before the first
paint – an external file because the CSP forbids inline scripts. The dark palette is selected,
not flipped: ink background, lime as primary action, the receipt paper stays light. Chart bars
use one green ramp per mode (validated: light end ≥ 2:1 on the card surface in both modes).
Status colours moved from hex literals to tokens (`success-soft`, `danger-*`).

## 027 – Dashboard widgets rethought

The old dashboard was nine equal cards. Now one hero (ink in both themes): the running month,
a projection to month end (only from day 7 – earlier it is noise) and the last complete month
against the one before, next to a goal ring with a text status; the goal is edited in a dialog
that suggests the average of the completed months. Beside it the next step (receipts waiting
for review, otherwise an upload) and key figures of the range from the receipts already in the
cache (no new SQL). Trend in one green ramp with a swatch legend; areas, hotspots and swaps use
the category icons and group colours of the picker, so identity never relies on bar colour.
"Alternativen" became "Sparpotenzial" with the summed saving for what was actually bought.

## 028 – Data basis page: every factor, visible and exportable

The factors were only visible one at a time while picking a category. The new page "Datenbasis"
(`/datenbasis`, main navigation) lists all of them, grouped, with value, unit and the exact source
(table and row of the study, linked), the three sources with their factor counts, and the known
limits (averages per category, life-cycle vs. combustion-only boundary, per-piece assumptions). A
CSV download gives the same table as a snapshot of the data basis.

Completeness is guarded on three levels instead of trusted: `fetchCategories` asks for the exact
row count and fails if fewer rows arrive (a server row limit would otherwise cut the table
silently); groups the UI does not know are appended, never dropped; and the E2E test compares the
rendered rows with the total the server reports (`content-range`) and requires a source link on
every row. A factor without a link is flagged on the page. This is the reference table only; a
per-line-item snapshot is not needed because of decision 029.

## 029 – Emission factors are a fixed state, no per-item snapshot

The factors are transcribed from the studies into migrations (nothing is fetched at runtime) and
are **not updated** after publication – this is a portfolio project, a frozen state is enough. A
stored `co2e_kg` therefore always equals quantity × the factor in the table, and a per-line-item
snapshot of the factor (which only protects against later factor changes) would add columns and a
backfill for no benefit. If a factor ever has to change, the snapshot becomes necessary first:
otherwise old receipts keep the old result while the table and every edited item use the new one.
New categories can be added without that problem. The data basis page states the freeze.

## 030 – The range switch gets its own section and no longer reloads

The switch sat in the page header but only changed part of the page (trend, areas, key figures,
hotspots, swaps); the hero – the running month, the projection and the goal – never moved, and
its goal hint secretly followed the range. Switching also replaced the whole page with skeletons,
because every query key contained the range.

Now: the switch lives in an "Auswertung" section below the hero and says what it controls. Monthly
totals and area totals are loaded once for 12 months and sliced in the browser (no request, no
loading state); only the hotspots depend on the range and keep the old list, dimmed, until the new
one arrives (`keepPreviousData`). The goal hint uses a fixed basis of six months.

## 031 – Failed analyses explain themselves; the AI classifies, the code words it

Before, every problem ended in one of two sentences. Now the model also reports what it sees:
`document_type` (receipt / not a receipt), `currency` and `issues` (unreadable, cut off, several
receipts, no food). It never writes the user-facing text. The code decides (`assessExtraction`),
stores a machine-readable `receipts.error_code` and `receipts.notes`, and the UI turns those into
concrete help (`failure.ts`): what is wrong and what to do – a retry only where it can help (service
hiccup), a new photo where the photo is the problem, nothing pointless in between.

- Foreign receipts are read as well (item names are translated by meaning); prices of a non-EUR
  receipt are dropped instead of being shown as euros.
- Very long receipts: the browser resize keeps the short side at 1000 px (up to 4096 px long)
  instead of squeezing a tall photo to 2048 px, where the text would be unreadable.
- A receipt that only had deposits or discounts now fails as "no items" instead of an empty review.
- The upload flow (file input, upload, progress dialog) moved from the receipts page into one
  provider in the layout, so any page can start it – see the header and dashboard buttons.
- `complete_receipt_processing` / `claim_receipt` were redefined on the latest versions (progress
  step, item positions); the pgTAP suite caught an earlier draft that would have dropped those.
