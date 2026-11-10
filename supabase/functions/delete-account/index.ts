// Edge function: deletes the signed-in user's account and everything that belongs to it.
//
//   POST (Authorization: Bearer <user JWT>)
//   → 200 { deleted: true }
//
// The photos live in Storage, which SQL cannot clean up, so this runs with the service
// role: first the files under `<userId>/`, then the auth user – the database rows follow by
// `on delete cascade` (profile → receipts, line items, mappings, goals, usage).
// The shared demo account (DEMO_EMAIL) is refused.

import { createClient } from '@supabase/supabase-js'
import type { Database } from '../_shared/database.types.ts'
import { isDemoAccount, userFolder } from '../_shared/account.ts'

const BUCKET = 'receipts'
const PAGE = 100

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
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

  const { data: auth, error: authError } = await admin.auth.getUser(token)
  if (authError || !auth.user) return json(401, { error: 'Invalid token' })
  const user = auth.user

  if (isDemoAccount(user.email, Deno.env.get('DEMO_EMAIL'))) {
    return json(403, { error: 'The demo account cannot be deleted' })
  }

  try {
    // Files first: if this fails the account is still intact and the user can try again.
    const folder = userFolder(user.id)
    for (;;) {
      const { data: files, error } = await admin.storage.from(BUCKET).list(folder, { limit: PAGE })
      if (error) throw error
      if (files.length === 0) break
      const removed = await admin.storage
        .from(BUCKET)
        .remove(files.map((file) => `${folder}/${file.name}`))
      if (removed.error) throw removed.error
    }

    const { error } = await admin.auth.admin.deleteUser(user.id)
    if (error) throw error
  } catch (error) {
    console.error(
      JSON.stringify({
        event: 'account_delete_failed',
        user_id: user.id,
        error: error instanceof Error ? error.message : String(error),
      }),
    )
    return json(500, { error: 'Could not delete the account' })
  }

  console.log(JSON.stringify({ event: 'account_deleted', user_id: user.id }))
  return json(200, { deleted: true })
})
