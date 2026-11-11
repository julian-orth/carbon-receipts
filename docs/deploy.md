# Deployment

Everything runs on free tiers: Supabase (database, auth, storage, realtime, edge functions),
Vercel (frontend), Google AI Studio (Gemini) and Groq.

## 1. Supabase project

1. Create a project at [supabase.com](https://supabase.com) – region **Frankfurt (eu-central-1)**.
2. Note the **Project URL**, the **project ref** and the **publishable key**
   (Project Settings → API Keys).
3. Link and push the schema (migrations include the emission factors and the demo function):

   ```bash
   supabase login
   supabase link --project-ref <project-ref>
   supabase db push
   ```

## 2. Edge function and AI keys

1. Get a free API key from [Google AI Studio](https://aistudio.google.com) and from
   [Groq](https://console.groq.com).
2. Store them as secrets (never in the frontend):

   ```bash
   supabase secrets set LLM_PROVIDERS=gemini,groq GEMINI_API_KEY=... GROQ_API_KEY=...
   # optional, model names rotate on the free tiers. Gemini's daily limit is per model
   # (20/day each, Nov 2026), so list several – they are tried in order:
   # supabase secrets set GEMINI_MODEL=gemini-3.6-flash,gemini-3.8-flash GROQ_MODEL=qwen/qwen3.8-27b
   ```

3. Tell the account-deletion function which account is the shared demo (it refuses that one):

   ```bash
   supabase secrets set DEMO_EMAIL=demo@carbon-receipts.app
   ```

4. Deploy both functions (`verify_jwt = false` comes from `supabase/config.toml`; the functions
   validate the user token themselves):

   ```bash
   supabase functions deploy process-receipt
   supabase functions deploy delete-account
   ```

## 3. Auth

In the dashboard under **Authentication → URL Configuration**:

- Site URL: `https://<your-app>.vercel.app`
- Redirect URLs: `https://<your-app>.vercel.app/auth/callback` (add
  `http://localhost:5173/auth/callback` if you want to use the hosted project locally)

**Email:** the built-in mail service only sends a few emails per hour. For a public demo set up a
custom SMTP provider (e.g. Resend, free tier) under **Authentication → Emails → SMTP Settings**.

## 4. Demo account

1. **Authentication → Users → Add user**: `demo@carbon-receipts.app`, a password of your choice,
   "Auto Confirm User" on. The password ends up in the frontend env, so use one that protects
   nothing else.
2. **SQL Editor**:

   ```sql
   update public.profiles
   set daily_ai_quota = 5
   where id = (select id from auth.users where email = 'demo@carbon-receipts.app');

   select private.reset_demo_data((select id from auth.users where email = 'demo@carbon-receipts.app'));
   ```

3. Optional – reset the demo every night (**Database → Extensions → enable `pg_cron`**):

   ```sql
   select cron.schedule(
     'reset-demo',
     '0 3 * * *',
     $$ select private.reset_demo_data((select id from auth.users where email = 'demo@carbon-receipts.app')) $$
   );
   ```

## 5. Vercel

1. **Add New → Project →** import `julian-orth/carbon-receipts`. Framework and build settings come
   from `vercel.json`.
2. Environment variables:

   | Name                            | Value                        |
   | ------------------------------- | ---------------------------- |
   | `VITE_SUPABASE_URL`             | Project URL                  |
   | `VITE_SUPABASE_PUBLISHABLE_KEY` | publishable key              |
   | `VITE_DEMO_EMAIL`               | `demo@carbon-receipts.app`   |
   | `VITE_DEMO_PASSWORD`            | the demo password from above |

3. Deploy, then put the final URL into the Supabase auth settings (step 3).

## 6. GitHub

Repository **Settings → Secrets and variables → Actions**:

- `SUPABASE_URL` and `SUPABASE_PUBLISHABLE_KEY` – used by the keep-alive workflow, which pings
  the database twice a week so the free project is not paused.

## 7. Before going public

These three are placeholders in the repo; nothing is invented for you.

- **Impressum and Datenschutz** – fill in `src/features/legal/legal-config.ts` (name, address,
  e-mail, hosting region of your Supabase project). Until then the pages show a yellow warning and
  visible `[noch ergänzen: …]` marks. The privacy text is a draft based on what the app does
  (Supabase, Vercel, Gemini/Groq on free tiers, no tracking) – have it checked.
- **Sample receipt** – replace `public/sample-receipt.png` with your real file (if the extension
  differs, update `SAMPLE_RECEIPT` in `src/features/receipts/upload/sample-receipt.ts`). The
  placeholder is a rendered example bon.
- **Accuracy** – enter the measured values in `src/features/factors/accuracy.ts` (shown on the
  "Datenbasis" page) and copy them into the README table. Until then both say "not measured yet".

## 8. Smoke test

1. Open the app → **Demo ansehen** → dashboard with six months of data.
2. Log out, request a magic link with your own address, upload a real receipt photo.
3. The status should move from "In Warteschlange" to "Bitte prüfen" within a few seconds.
   If it ends in "Fehlgeschlagen": **Edge Functions → process-receipt → Logs** (structured
   `receipt_failed` entries). The failed screen names the reason and what to do (a photo of
   something else, too blurry, cut off …); only service problems offer a retry.
4. Try **Beispielbeleg ausprobieren** on the receipts page, then **Konto** (avatar menu): download
   your data and delete the test account – the photos are removed with it.
