import { supabase } from '@/lib/supabase'
import type { EmissionCategory } from './categories'

export async function fetchCategories(): Promise<EmissionCategory[]> {
  const { data, error } = await supabase
    .from('emission_categories')
    .select('id, slug, label, unit, co2e_per_unit, category_group, source, source_url')
    .order('label')
  if (error) throw error
  return data
}
