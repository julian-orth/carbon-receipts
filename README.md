# Carbon Receipts

Photograph a grocery receipt and see its carbon footprint. An LLM reads the line items and
suggests a category; the app maps them to published emission factors and calculates CO₂e
deterministically. Uncertain matches go to a review screen, corrections are learned, and a
dashboard shows the trend, hotspots, concrete alternatives and a monthly goal.

> **The AI suggests, the code calculates.** The model only extracts text and proposes a category.
> Every CO₂e value is `quantity × factor`, computed by one tested function and traceable to a
> table row in a published study.

![Dashboard](docs/screenshots/dashboard.png)

| Review                                 | Mobile                                                                                  |
| -------------------------------------- | --------------------------------------------------------------------------------------- |
| ![Review](docs/screenshots/review.png) | <img src="docs/screenshots/dashboard-mobile.png" width="260" alt="Dashboard on mobile"> |

## Features

- **Magic-link login** (PKCE) and an optional public demo account
- **Photo upload** to private storage, processed by an edge function in the background; the list
  follows the status live via Realtime
- **LLM pipeline** with Gemini Flash, Groq as fallback, exponential backoff, Zod validation of
  every response, a daily quota per user and a deterministic mock provider for local work and E2E
- **Review screen** with confidence flags, a live CO₂e preview, the factor and its source; category
  corrections become mappings for the next receipt
- **Dashboard** with monthly trend vs. goal, breakdown by area, top hotspots and like-for-like
  alternatives with the saving for the actual purchase
- **Accessible**: semantic HTML, keyboard operable, visible focus, table view for the chart, status
  never by colour alone, axe scan in E2E

## Architecture

```mermaid
flowchart LR
  U[Browser] -- upload --> S[(Storage)]
  U -- insert pending --> R[(receipts)]
  U -- invoke --> F[Edge function<br/>process-receipt]
  F -- claim pending to processing --> R
  F -- image --> L{{Gemini, then Groq}}
  L -- JSON --> Z[Zod validation]
  Z --> M[mappings + factors<br/>calculateCo2e]
  M --> I[(line_items)]
  F -- review / failed --> R
  R -. Realtime .-> U
  I --> V[(SQL views)] --> D[Dashboard]
```

- **Postgres does the guarding**: RLS on every table, explicit column grants (users cannot set a
  receipt's status on insert or write global mappings), a trigger that only allows the status
  transitions a user may make, and a composite foreign key that keeps line items on the owner's
  receipt.
- **One calculation module** in `supabase/functions/_shared/emissions/` is imported by both the
  React app and the Deno edge function, so the preview in the review screen is exactly what gets
  stored.
- **Aggregations are SQL views** with `security_invoker`, so RLS applies to them too.

The reasoning behind these and other choices – including what was traded away – is in
[`docs/decisions.md`](docs/decisions.md).

## Emission factors

- **Food & beverages:** ifeu (2020),
  [_Ökologische Fußabdrücke von Lebensmitteln und Gerichten in Deutschland_](https://www.ifeu.de/fileadmin/uploads/Reinhardt-Gaertner-Wagner-2020-Oekologische-Fu%C3%9Fabdruecke-von-Lebensmitteln-und-Gerichten-in-Deutschland-ifeu-2020.pdf)
  – "at the supermarket checkout" in Germany, reference year 2019
- **Fuel:** BAFU (2026),
  [_CO2-Emissionsfaktoren des Treibhausgasinventars der Schweiz_](https://www.bafu.admin.ch/dam/de/sd-web/NlGIhzJ8OW0t/CO2_Emissionsfaktoren_THG_Inventar.pdf)
  – combustion only

69 categories, each storing the table and row it comes from. Known limitations (system boundaries,
density assumption for beverages, per-piece eggs) are listed in decision 011.

## Tech stack

React 19 · TypeScript (strict) · Vite · TanStack Query · React Router · Tailwind CSS + shadcn/ui ·
Recharts · Zod · React Hook Form · Supabase (Postgres, Auth, Storage, Realtime, Edge Functions) ·
Gemini Flash / Groq · Vitest + Testing Library · pgTAP · Playwright + axe · GitHub Actions · Vercel

## Quality

| Layer            | What                                                                                          |
| ---------------- | --------------------------------------------------------------------------------------------- |
| Unit & component | 214 Vitest tests: calculation, units, normalization, LLM fallback, Zod schema, all pages      |
| Database         | 44 pgTAP tests: RLS per role, grants, status transitions, quota, views, demo data             |
| Edge function    | Deno type check in CI                                                                         |
| End-to-end       | Playwright on desktop + mobile: magic link → upload → AI → Realtime → review → dashboard, axe |
| CI               | format, lint, typecheck, tests, build · DB tests + generated-types drift check · E2E          |

## Getting started

Requirements: Node 24, Docker (for local Supabase).

```bash
npm install
npm run db:start                    # local Supabase incl. demo data
cp .env.example .env.local          # fill in PUBLISHABLE_KEY from `supabase status`
cp supabase/functions/.env.example supabase/functions/.env   # LLM_PROVIDERS=mock needs no keys
npm run functions:serve             # second terminal
npm run dev
```

- App: http://localhost:5173 – "Demo ansehen" or magic link
- Mails: http://127.0.0.1:54324 (Mailpit) · Studio: http://127.0.0.1:54323
- Demo account: `demo@carbon-receipts.app` / `demo-carbon-receipts`

## Scripts

| Script                    | Purpose                                           |
| ------------------------- | ------------------------------------------------- |
| `npm run dev` / `build`   | Dev server / production build                     |
| `npm run typecheck`       | TypeScript project references                     |
| `npm run lint`            | oxlint, fails on warnings                         |
| `npm run format`          | Prettier (with Tailwind class ordering)           |
| `npm test`                | Vitest                                            |
| `npm run test:e2e`        | Playwright (needs `db:start` + `functions:serve`) |
| `npm run db:start`        | Start local Supabase                              |
| `npm run db:reset`        | Re-apply migrations + seed                        |
| `npm run db:test`         | pgTAP tests                                       |
| `npm run db:types`        | Regenerate database types                         |
| `npm run functions:serve` | Serve edge functions locally                      |
| `npm run functions:check` | Deno type check of the edge function              |

## Project structure

```
src/
  app/                 router, providers, layout, error boundary
  features/
    auth/              magic link, demo login, route guard
    receipts/          upload, list, realtime status
    review/            line item review and corrections
    dashboard/         trend, breakdown, hotspots, alternatives, goal
  components/ui/       shadcn/ui
supabase/
  migrations/          schema, RLS, grants, factors, views, demo function
  functions/
    _shared/           emissions module, LLM providers, pipeline, DB types
    process-receipt/   edge function
  tests/database/      pgTAP
e2e/                   Playwright
docs/                  briefing, decisions, deployment
```

## Deployment

Step by step in [`docs/deploy.md`](docs/deploy.md): Supabase project, secrets, edge function,
auth URLs, demo account, Vercel, GitHub secrets.

## Privacy

The free tiers of Gemini and Groq may use submitted data to improve their models. The upload screen
says so, and the public demo uses sample data only.

## Next steps

- **CSV bank exports** – need spend-based factors (kg CO₂e per EUR); there is no open table for
  Germany yet, EXIOBASE would have to be mapped to consumption categories
- **PDF receipts**
- **Snapshot of the factor per line item**, so later factor updates don't change history
- **Upstream emissions for fuel**, to match the life-cycle boundary of the food factors
- **Households / shared accounts**, PWA with offline capture, export, i18n
