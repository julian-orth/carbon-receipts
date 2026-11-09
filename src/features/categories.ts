import { useQuery } from '@tanstack/react-query'
import { fetchCategories } from './categories-api'
import type { Tables } from '@/types/db-helpers'

export type EmissionCategory = Pick<
  Tables<'emission_categories'>,
  'id' | 'slug' | 'label' | 'unit' | 'co2e_per_unit' | 'category_group' | 'source' | 'source_url'
>

export const categoryKeys = { all: ['emission-categories'] as const }

export const GROUP_LABEL: Record<string, string> = {
  fruit_vegetables: 'Obst & Gemüse',
  dairy_eggs: 'Milchprodukte & Eier',
  meat_fish: 'Fleisch & Fisch',
  plant_protein: 'Pflanzliche Alternativen',
  staples: 'Grundnahrungsmittel',
  fats_sweets: 'Fette & Süßes',
  beverages: 'Getränke',
  ready_meals: 'Fertiggerichte',
  pet: 'Tiernahrung',
  fuel: 'Kraftstoff',
  other: 'Sonstiges',
}

/** Reference data – changes only with a migration, so it is cached for the session. */
export function useEmissionCategories() {
  return useQuery({ queryKey: categoryKeys.all, queryFn: fetchCategories, staleTime: Infinity })
}
