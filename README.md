# Carbon Receipts

Upload receipts (photo/PDF) or bank CSV exports. An LLM extracts line items and proposes categories;
the app maps them to emission factors and calculates the CO₂ footprint deterministically. Uncertain
matches are reviewed by the user, and a dashboard shows trends, hotspots, alternatives and goals.

> Work in progress. See [`docs/briefing.md`](docs/briefing.md) for scope and
> [`docs/decisions.md`](docs/decisions.md) for decisions & trade-offs.

## Stack

React 19 · TypeScript (strict) · Vite · TanStack Query · React Router · Tailwind CSS + shadcn/ui ·
Recharts · Zod · React Hook Form · Supabase · Gemini Flash (fallback: Groq) · Vitest · Playwright

## Getting started

```bash
nvm use            # Node 24
npm install
cp .env.example .env.local
npm run dev
```

## Scripts

| Script                  | Purpose                                 |
| ----------------------- | --------------------------------------- |
| `npm run dev`           | Start the dev server                    |
| `npm run build`         | Typecheck and build for production      |
| `npm run typecheck`     | TypeScript project references, no emit  |
| `npm run lint`          | oxlint, fails on warnings               |
| `npm run format`        | Prettier (with Tailwind class ordering) |
| `npm test`              | Vitest (single run)                     |
| `npm run test:coverage` | Vitest with V8 coverage                 |
