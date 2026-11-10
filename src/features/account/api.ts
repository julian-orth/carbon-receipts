import { FunctionsHttpError } from '@supabase/supabase-js'
import { supabase } from '@/lib/supabase'
import { buildExport } from './account-logic'

export type Profile = { display_name: string | null; daily_ai_quota: number; created_at: string }

export async function fetchProfile(): Promise<Profile | null> {
  const { data, error } = await supabase
    .from('profiles')
    .select('display_name, daily_ai_quota, created_at')
    .maybeSingle()
  if (error) throw error
  return data
}

/** Analyses used today; the counter's day is the database's (UTC) date. */
export async function fetchAiUsageToday(): Promise<number> {
  const today = new Date().toISOString().slice(0, 10)
  const { data, error } = await supabase
    .from('ai_usage')
    .select('request_count')
    .eq('usage_date', today)
    .maybeSingle()
  if (error) throw error
  return data?.request_count ?? 0
}

export async function updateDisplayName(userId: string, displayName: string | null) {
  const { error } = await supabase
    .from('profiles')
    .update({ display_name: displayName })
    .eq('id', userId)
  if (error) throw error
}

const PAGE = 1000

/** The API caps a response at 1000 rows; line items can exceed that, so read page by page. */
async function fetchAllLineItems() {
  const rows: unknown[] = []
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await supabase
      .from('line_items')
      .select('*')
      .order('created_at')
      .order('id')
      .range(from, from + PAGE - 1)
    if (error) throw error
    rows.push(...data)
    if (data.length < PAGE) return rows
  }
}

/** Everything stored about the user, ready to be saved as a JSON file. */
export async function fetchExport(email: string | undefined) {
  const [profile, receipts, lineItems, goals] = await Promise.all([
    supabase.from('profiles').select('display_name, created_at').maybeSingle(),
    supabase.from('receipts').select('*').order('created_at'),
    fetchAllLineItems(),
    supabase.from('goals').select('*'),
  ])
  if (profile.error) throw profile.error
  if (receipts.error) throw receipts.error
  if (goals.error) throw goals.error
  return buildExport({
    exportedAt: new Date(),
    email,
    profile: profile.data,
    receipts: receipts.data,
    lineItems,
    goals: goals.data,
  })
}

export class DemoAccountError extends Error {}

/** Deletes files and account on the server, then ends the local session. */
export async function deleteAccount(): Promise<void> {
  const { error } = await supabase.functions.invoke('delete-account')
  if (error) {
    if (error instanceof FunctionsHttpError && error.context instanceof Response) {
      if (error.context.status === 403) throw new DemoAccountError()
    }
    throw error
  }
  // The user is gone: only the local session is left to clear.
  await supabase.auth.signOut({ scope: 'local' })
}
