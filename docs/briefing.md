# Carbon Receipts – Projekt-Briefing

Portfolio-Projekt eines React-Frontend-Entwicklers. Ziel: Senior-Level zeigen (Architektur, Qualität, UX), ohne übertriebenen Umfang. Alles muss mit kostenlosen Diensten laufen.

## Idee

User laden Kassenbons (Foto/PDF) oder CSV-Kontoexporte hoch. Eine KI extrahiert die Positionen als strukturierte Daten und schlägt Kategorien vor. Die App ordnet Emissionsfaktoren zu und berechnet den CO₂-Fußabdruck. Unsichere Zuordnungen prüft der User in einem Review-Screen. Ein Dashboard zeigt Verlauf, Hotspots, Alternativen und Ziele.

**Grundprinzip: Die KI schlägt vor, der Code rechnet.** Die KI liefert nur Extraktion und Kategorie-Vorschlag. Die CO₂-Berechnung ist deterministisch, getestet und auf Faktor + Quelle rückführbar.

## Stack (alles Free Tier)

- Frontend: React + TypeScript (strict) + Vite, TanStack Query, React Router, Tailwind + shadcn/ui, Recharts, Zod, React Hook Form
- Backend: Supabase (Postgres, Auth, Storage, Realtime, Edge Functions)
- KI: Google Gemini Flash (AI Studio, Free Tier) als Primär-Provider, Groq (Free Tier) als Fallback
- Tests: Vitest + Testing Library, Playwright (E2E)
- CI: GitHub Actions (lint, typecheck, test, build) + Keep-Alive-Cron gegen Supabase-Auto-Pause
- Hosting: Vercel oder Netlify

## Architektur-Eckpunkte

- **KI-Pipeline als Job:** Upload → `receipts.status`: `pending → processing → review → done | failed`. Die Edge Function `process-receipt` verarbeitet, das UI folgt dem Status per Realtime.
- **Provider-Abstraktion:** Interface `LlmProvider` mit Gemini- und Groq-Implementierung. Bei 429/5xx: Exponential Backoff, dann Fallback-Provider.
- **KI-Output wird immer mit Zod validiert**, bevor er in die DB geht.
- **Caching/Lernen:** Tabelle `category_mappings` (normalisierter Produktname → Kategorie). Bekannte Namen gehen nicht an die KI.
- **Kostenschutz:** Tageslimit pro User für KI-Verarbeitungen.
- **Sicherheit:** API-Keys nur in Edge-Function-Secrets, nie im Client. RLS auf allen Tabellen.
- **Datenschutz:** Hinweis im UI, dass die Free-Tier-KI Daten verarbeiten kann. Demo nutzt Beispielbelege.
- Aggregationen (Monats-/Kategorie-Summen) laufen als SQL-Views, nicht im Client.

## Datenmodell (Entwurf)

- `profiles` (id → auth.users, display_name, daily_ai_quota)
- `receipts` (id, user_id, file_path, source_type: photo|pdf|csv, status, merchant, purchased_at, error, created_at)
- `line_items` (id, receipt_id, user_id, raw_text, normalized_name, quantity, unit, price, category_id, confidence, reviewed, co2e_kg)
- `emission_categories` (id, slug, label, unit, co2e_per_unit, source, source_url)
- `category_mappings` (id, user_id nullable = global, normalized_name, category_id)
- `goals` (id, user_id, period, target_co2e_kg)
- View `monthly_emissions` (user_id, month, category, sum_co2e_kg)

## MVP-Scope

1. Auth (Magic Link + GitHub OAuth), geschützte Routen
2. Upload (Foto + CSV) in Supabase Storage
3. Edge Function: Extraktion mit Gemini, Fallback Groq, Zod-Validierung
4. Review-Screen (Confidence-Markierung, Kategorie korrigieren, Korrektur → `category_mappings`)
5. Dashboard (Monatsverlauf, Kategorien, Top-Hotspots, Alternativen)
6. Demo-Account mit Seed-Daten

**Nicht im MVP:** Haushalte/Gruppen, PWA/Offline, PDF-OCR für alle Formate, Export, i18n. Diese Punkte stehen im README als „Next Steps“.

## Ordnerstruktur (Feature-basiert)

```
src/
  app/            # Router, Provider, Layout
  features/
    auth/
    receipts/     # Upload, Liste, Status
    review/
    dashboard/
  lib/
    supabase.ts
    emissions/    # reine Berechnungsfunktionen + Tests
  components/ui/  # shadcn
  types/database.ts  # generiert: supabase gen types
supabase/
  migrations/
  functions/process-receipt/
  seed.sql
```

## Konventionen

- TypeScript strict, keine `any`. DB-Typen werden generiert, nicht von Hand geschrieben.
- Server-State nur über TanStack Query (Query-Keys zentral pro Feature).
- Jede Komponente mit Loading-, Empty- und Error-State.
- Barrierefreiheit: semantisches HTML, Tastaturbedienung, sichtbarer Fokus.
- Kleine, fokussierte Commits (Conventional Commits).
- Wichtige Entscheidungen kommen kurz in `docs/decisions.md` (für die README-Sektion „Decisions & Trade-offs“).

## Reihenfolge

1. Projekt-Setup (Vite, TS, Tailwind, shadcn, ESLint/Prettier, Vitest) + CI
2. Supabase lokal (CLI), erste Migration mit Schema + RLS, Typen generieren
3. Auth-Flow + geschützte Routen
4. Upload + Receipts-Liste mit Realtime-Status
5. Emissions-Logik (rein, getestet) + Seed der Faktoren
6. Edge Function KI-Pipeline
7. Review-Screen
8. Dashboard
9. Demo-Daten, README, Playwright-E2E, Deploy
