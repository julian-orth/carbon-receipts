// Edge function: extracts line items from a receipt photo with an LLM, maps them
// to emission categories and calculates CO2e deterministically.
//
//   POST { receipt_id }  (Authorization: Bearer <user JWT>)
//   → 202 once the receipt is claimed (pending → processing); the rest runs in
//     the background and ends in `review` or `failed`. The UI follows via Realtime.

import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { z } from 'zod'
import type { Database } from '../_shared/database.types.ts'
import { normalizeProductName } from '../_shared/emissions/normalize-name.ts'
import { bytesToBase64 } from '../_shared/encoding.ts'
import { createGeminiProvider } from '../_shared/llm/gemini.ts'
import { createGroqProvider } from '../_shared/llm/groq.ts'
import { createMockProvider } from '../_shared/llm/mock.ts'
import { AllProvidersFailedError, generateWithFallback } from '../_shared/llm/resilient.ts'
import type { LlmProvider } from '../_shared/llm/types.ts'
import { buildLineItems } from '../_shared/pipeline/enrich.ts'
import { buildExtractionRequest } from '../_shared/pipeline/prompts.ts'
import { parseReceiptExtraction } from '../_shared/pipeline/schema.ts'

declare const EdgeRuntime: { waitUntil(promise: Promise<unknown>): void } | undefined

type Admin = SupabaseClient<Database>
type ClaimedReceipt = { id: string; user_id: string; file_path: string | null }

const DEFAULT_GEMINI_MODEL = 'gemini-3.8-flash'
const DEFAULT_GROQ_MODEL = 'qwen/qwen3.8-27b'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

const bodySchema = z.object({ receipt_id: z.uuid() })

/** Errors whose message is safe and helpful to show to the user. */
class UserFacingError extends Error {}

function json(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'content-type': 'application/json' },
  })
}

function requireEnv(name: string): string {
  const value = Deno.env.get(name)
  if (!value) throw new Error(`Missing environment variable ${name}`)
  return value
}

/** `LLM_PROVIDERS` defines the order, e.g. "gemini,groq" (default) or "mock". */
function createProviders(): LlmProvider[] {
  const names = (Deno.env.get('LLM_PROVIDERS') ?? 'gemini,groq')
    .split(',')
    .map((name) => name.trim())
    .filter(Boolean)

  return names.flatMap((name): LlmProvider[] => {
    if (name === 'mock') return [createMockProvider()]
    if (name === 'gemini') {
      const apiKey = Deno.env.get('GEMINI_API_KEY')
      if (!apiKey) return []
      return [
        createGeminiProvider({
          apiKey,
          model: Deno.env.get('GEMINI_MODEL') ?? DEFAULT_GEMINI_MODEL,
        }),
      ]
    }
    if (name === 'groq') {
      const apiKey = Deno.env.get('GROQ_API_KEY')
      if (!apiKey) return []
      return [
        createGroqProvider({ apiKey, model: Deno.env.get('GROQ_MODEL') ?? DEFAULT_GROQ_MODEL }),
      ]
    }
    console.warn(`Unknown LLM provider "${name}" ignored`)
    return []
  })
}

async function processReceipt(admin: Admin, receipt: ClaimedReceipt): Promise<void> {
  const startedAt = Date.now()
  try {
    if (!receipt.file_path) throw new UserFacingError('Zu diesem Beleg gibt es keine Datei.')

    const providers = createProviders()
    if (providers.length === 0)
      throw new Error('No LLM provider configured (LLM_PROVIDERS / API keys)')

    const [categories, file] = await Promise.all([
      admin.from('emission_categories').select('id, slug, label, unit, co2e_per_unit'),
      admin.storage.from('receipts').download(receipt.file_path),
    ])
    if (categories.error) throw categories.error
    if (file.error) throw file.error

    const quota = await admin.rpc('consume_ai_quota', { p_user_id: receipt.user_id })
    if (quota.error) throw quota.error
    if (!quota.data) {
      throw new UserFacingError(
        'Dein Tageslimit für KI-Analysen ist erreicht. Morgen geht es weiter.',
      )
    }

    const bytes = new Uint8Array(await file.data.arrayBuffer())
    const request = buildExtractionRequest(categories.data, {
      mimeType: file.data.type || 'image/jpeg',
      base64: bytesToBase64(bytes),
    })
    const { value: extraction, provider } = await generateWithFallback(
      providers,
      request,
      parseReceiptExtraction,
    )
    if (extraction.items.length === 0) {
      throw new UserFacingError(
        'Auf dem Foto wurden keine Positionen erkannt. Ist der Bon gut lesbar?',
      )
    }

    // Learned mappings (user first, then global) override the model's category.
    const normalizedNames = [
      ...new Set(
        extraction.items.map((item) => normalizeProductName(item.raw_text)).filter(Boolean),
      ),
    ]
    const mappings = normalizedNames.length
      ? await admin
          .from('category_mappings')
          .select('normalized_name, category_id, user_id, quantity, unit')
          .in('normalized_name', normalizedNames)
          .or(`user_id.is.null,user_id.eq.${receipt.user_id}`)
      : { data: [], error: null }
    if (mappings.error) throw mappings.error

    const lineItems = buildLineItems({
      items: extraction.items,
      categories: categories.data,
      mappings: mappings.data,
      userId: receipt.user_id,
    })

    // Idempotent on retry: replace whatever an earlier attempt left behind.
    const cleared = await admin.from('line_items').delete().eq('receipt_id', receipt.id)
    if (cleared.error) throw cleared.error
    const inserted = await admin
      .from('line_items')
      .insert(
        lineItems.map((item) => ({ ...item, receipt_id: receipt.id, user_id: receipt.user_id })),
      )
    if (inserted.error) throw inserted.error

    const updated = await admin
      .from('receipts')
      .update({
        status: 'review',
        merchant: extraction.merchant,
        purchased_at: extraction.purchased_at,
      })
      .eq('id', receipt.id)
    if (updated.error) throw updated.error

    console.log(
      JSON.stringify({
        event: 'receipt_processed',
        receipt_id: receipt.id,
        provider,
        items: lineItems.length,
        with_co2e: lineItems.filter((item) => item.co2e_kg !== null).length,
        ms: Date.now() - startedAt,
      }),
    )
  } catch (error) {
    const message =
      error instanceof UserFacingError
        ? error.message
        : error instanceof AllProvidersFailedError
          ? 'Die KI-Dienste sind gerade nicht erreichbar oder überlastet. Bitte versuche es später erneut.'
          : 'Die Analyse ist fehlgeschlagen. Bitte versuche es erneut.'
    console.error(
      JSON.stringify({
        event: 'receipt_failed',
        receipt_id: receipt.id,
        error: error instanceof Error ? error.message : String(error),
      }),
    )
    const { error: updateError } = await admin
      .from('receipts')
      .update({ status: 'failed', error: message })
      .eq('id', receipt.id)
    if (updateError) console.error('Could not mark receipt as failed', updateError)
  }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (req.method !== 'POST') return json(405, { error: 'Method not allowed' })

  const token = req.headers.get('Authorization')?.replace(/^Bearer\s+/i, '')
  if (!token) return json(401, { error: 'Missing authorization' })

  const admin = createClient<Database>(
    requireEnv('SUPABASE_URL'),
    requireEnv('SUPABASE_SERVICE_ROLE_KEY'),
    { auth: { persistSession: false, autoRefreshToken: false } },
  )

  // Validates the JWT against Supabase Auth (works with legacy and asymmetric keys).
  const { data: auth, error: authError } = await admin.auth.getUser(token)
  if (authError || !auth.user) return json(401, { error: 'Invalid token' })

  const body = bodySchema.safeParse(await req.json().catch(() => null))
  if (!body.success) return json(400, { error: 'Body must be { receipt_id: uuid }' })

  // Atomic claim: only one invocation can move a receipt out of `pending`.
  const { data: receipt, error: claimError } = await admin
    .from('receipts')
    .update({ status: 'processing', error: null })
    .eq('id', body.data.receipt_id)
    .eq('user_id', auth.user.id)
    .eq('status', 'pending')
    .select('id, user_id, file_path')
    .maybeSingle()
  if (claimError) return json(500, { error: 'Could not claim receipt' })
  if (!receipt) return json(409, { error: 'Receipt is not pending' })

  const work = processReceipt(admin, receipt)
  if (typeof EdgeRuntime !== 'undefined') {
    EdgeRuntime.waitUntil(work)
    return json(202, { status: 'processing' })
  }
  await work
  return json(200, { status: 'done' })
})
