import { supabase } from '@/lib/supabase'
import type { GroupRow, HotspotRow, MonthlyTotalRow } from './dashboard-logic'

// Aggregation happens in SQL views (security_invoker → RLS applies).

export async function fetchMonthlyTotals(fromMonth: string): Promise<MonthlyTotalRow[]> {
  const { data, error } = await supabase
    .from('monthly_totals')
    .select('month, total_co2e_kg')
    .gte('month', fromMonth)
  if (error) throw error
  return data
}

export async function fetchGroupTotals(fromMonth: string): Promise<GroupRow[]> {
  const { data, error } = await supabase
    .from('monthly_emissions')
    .select('month, category_group, sum_co2e_kg')
    .gte('month', fromMonth)
  if (error) throw error
  return data
}

/** The biggest items; the top 5 are shown, all of them feed the alternatives. */
export async function fetchHotspots(fromMonth: string, limit = 20): Promise<HotspotRow[]> {
  const { data, error } = await supabase
    .from('line_item_emissions')
    .select('id, raw_text, quantity, unit, co2e_kg, category_slug, category_label, purchased_on')
    .gte('month', fromMonth)
    .order('co2e_kg', { ascending: false })
    .limit(limit)
  if (error) throw error
  return data
}

export type MonthlyGoal = { id: string; target_co2e_kg: number }

export async function fetchMonthlyGoal(): Promise<MonthlyGoal | null> {
  const { data, error } = await supabase
    .from('goals')
    .select('id, target_co2e_kg')
    .eq('period', 'month')
    .maybeSingle()
  if (error) throw error
  return data
}

/**
 * Update-or-insert instead of an upsert: users may only update `target_co2e_kg`
 * (column grant), and PostgREST's upsert would also update `period`.
 */
export async function saveMonthlyGoal(targetKg: number, existingId: string | null): Promise<void> {
  const { error } = existingId
    ? await supabase.from('goals').update({ target_co2e_kg: targetKg }).eq('id', existingId)
    : await supabase.from('goals').insert({ period: 'month', target_co2e_kg: targetKg })
  if (error) throw error
}
