import { supabase } from '@/lib/supabase'
import type { EmissionCategory } from './categories'

export async function fetchCategories(): Promise<EmissionCategory[]> {
  const { data, error, count } = await supabase
    .from('emission_categories')
    .select('id, slug, label, unit, co2e_per_unit, category_group, source, source_url', {
      count: 'exact',
    })
    .order('label')
  if (error) throw error
  // A row limit on the server would silently cut the table; the data-basis page promises all rows.
  const rows = data ?? []
  if (count !== null && count !== rows.length) {
    throw new Error(`Incomplete emission factors: received ${rows.length} of ${count}`)
  }
  return rows
}
