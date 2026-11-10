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
import {
  assessExtraction,
  collectNotes,
  FAILURE_MESSAGE,
  type FailureCode,
  isForeignCurrency,
} from '../_shared/pipeline/assess.ts'
import { buildLineItems } from '../_shared/pipeline/enrich.ts'
import { buildExtractionRequest } from '../_shared/pipeline/prompts.ts'
import { parseReceiptExtraction } from '../_shared/pipeline/schema.ts'

declare const EdgeRuntime: { waitUntil(promise: Promise<unknown>): void } | undefined

type Admin = SupabaseClient<Database>
type ProcessingStep = Database['public']['Enums']['processing_step']
type ClaimedReceipt = { id: string; user_id: string; file_path: string | null }

// gemini-3.8-flash answers 503 "high demand" on the free tier most of the time (Nov 2026).
const DEFAULT_GEMINI_MODEL = 'gemini-3.5-flash'
/** Shorter than the default: a slow Gemini must leave time for the fallback. */
const GEMINI_TIMEOUT_MS = 20_000
const DEFAULT_GROQ_MODEL = 'qwen/qwen3.8-27b'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

const bodySchema = z.object({ receipt_id: z.uuid() })

/** Errors whose message is safe and helpful to show to the user; `code` lets the UI explain more. */
class UserFacingError extends Error {
  constructor(
    message: string,
    readonly code: FailureCode,
  ) {
    super(message)
  }
}

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
      // GEMINI_MODEL may list several models, tried in order: "gemini-3.5-flash,gemini-3.8-flash".
      const models = (Deno.env.get('GEMINI_MODEL') ?? DEFAULT_GEMINI_MODEL)
        .split(',')
        .map((model) => model.trim())
        .filter(Boolean)
      return models.map((model) =>
        createGeminiProvider({ apiKey, model, timeoutMs: GEMINI_TIMEOUT_MS }),
      )
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

/**
 * Progress for the live UI (via Realtime). Best effort: a failed progress update
 * is logged but never fails the analysis itself.
 */
async function reportProgress(
  admin: Admin,
  receiptId: string,
  progress: { processing_step?: ProcessingStep; ai_provider?: string },
): Promise<void> {
  const { error } = await admin
    .from('receipts')
    .update(progress)
    .eq('id', receiptId)
    .eq('status', 'processing')
  if (error) console.warn('Could not report progress', error.message)
}

function describeError(error: unknown): { message: string; code: FailureCode } {
  if (error instanceof UserFacingError) return { message: error.message, code: error.code }
  if (error instanceof AllProvidersFailedError) {
    return {
      message:
        'Die KI-Dienste sind gerade nicht erreichbar oder überlastet. Bitte versuche es später erneut.',
      code: 'ai_unavailable',
    }
  }
  return { message: 'Die Analyse ist fehlgeschlagen. Bitte versuche es erneut.', code: 'unknown' }
}

async function processReceipt(admin: Admin, receipt: ClaimedReceipt): Promise<void> {
  const startedAt = Date.now()
  try {
    if (!receipt.file_path)
      throw new UserFacingError('Zu diesem Beleg gibt es keine Datei.', 'no_file')

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
        'quota',
      )
    }

    const bytes = new Uint8Array(await file.data.arrayBuffer())
    const request = buildExtractionRequest(categories.data, {
      mimeType: file.data.type || 'image/jpeg',
      base64: bytesToBase64(bytes),
    })
    const {
      value: extraction,
      provider,
      attempts,
    } = await generateWithFallback(providers, request, parseReceiptExtraction, undefined, {
      onProviderStart: (name) => reportProgress(admin, receipt.id, { ai_provider: name }),
    })
    if (attempts.length > 0) {
      // A fallback that works is invisible to the user – keep it visible in the logs.
      console.warn(
        JSON.stringify({
          event: 'llm_fallback',
          receipt_id: receipt.id,
          provider,
          failed: attempts,
        }),
      )
    }
    // The response passed the Zod schema inside generateWithFallback; now the content checks.
    await reportProgress(admin, receipt.id, { processing_step: 'validating' })
    const failure = assessExtraction(extraction)
    if (failure) throw new UserFacingError(FAILURE_MESSAGE[failure], failure)

    await reportProgress(admin, receipt.id, { processing_step: 'matching' })
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

    await reportProgress(admin, receipt.id, { processing_step: 'calculating' })
    // Prices are only kept for EUR: a foreign amount would be shown (and checked) as euros.
    const foreign = isForeignCurrency(extraction.currency)
    const lineItems = buildLineItems({
      items: foreign
        ? extraction.items.map((item) => ({ ...item, price: null }))
        : extraction.items,
      categories: categories.data,
      mappings: mappings.data,
      userId: receipt.user_id,
    })

    // Only deposits, discounts or empty names were on it: nothing left to review.
    if (lineItems.length === 0) throw new UserFacingError(FAILURE_MESSAGE.no_items, 'no_items')

    // One transaction: replaces earlier attempts' items and moves the receipt to `review`.
    const completed = await admin.rpc('complete_receipt_processing', {
      p_receipt_id: receipt.id,
      p_items: lineItems,
      p_merchant: extraction.merchant ?? undefined,
      p_purchased_at: extraction.purchased_at ?? undefined,
      p_notes: collectNotes(extraction, lineItems),
    })
    if (completed.error) throw completed.error

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
    const { message, code } = describeError(error)
    console.error(
      JSON.stringify({
        event: 'receipt_failed',
        receipt_id: receipt.id,
        error: error instanceof Error ? error.message : String(error),
      }),
    )
    const { error: updateError } = await admin
      .from('receipts')
      .update({ status: 'failed', error: message, error_code: code })
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

  // Atomic claim (pending, or stuck in processing after a crash). A second call gets 409.
  const { data: claimed, error: claimError } = await admin.rpc('claim_receipt', {
    p_receipt_id: body.data.receipt_id,
    p_user_id: auth.user.id,
  })
  if (claimError) return json(500, { error: 'Could not claim receipt' })
  const receipt = claimed[0]
  if (!receipt) return json(409, { error: 'Receipt is not pending' })

  const work = processReceipt(admin, receipt)
  if (typeof EdgeRuntime !== 'undefined') {
    EdgeRuntime.waitUntil(work)
    return json(202, { status: 'processing' })
  }
  await work
  return json(200, { status: 'done' })
})
