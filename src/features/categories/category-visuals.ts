import {
  Amphora,
  Apple,
  Avocado,
  Banana,
  Bean,
  Beef,
  Beer,
  CakeSlice,
  Can,
  CanSoda,
  Candy,
  Carrot,
  Cherry,
  Citrus,
  Coffee,
  Container,
  CookingPot,
  Croissant,
  Cuboid,
  Droplet,
  Droplets,
  Drumstick,
  Egg,
  Fish,
  Fuel,
  GlassWater,
  Grape,
  Ham,
  Hamburger,
  Hexagon,
  IceCreamBowl,
  LeafyGreen,
  type LucideIcon,
  Milk,
  Nut,
  Package,
  PawPrint,
  Salad,
  Sandwich,
  Shrimp,
  Snowflake,
  Sprout,
  TreeDeciduous,
  TreePalm,
  Vegan,
  Wheat,
  Wine,
} from 'lucide-react'
import type { EmissionUnit } from '@shared/emissions/types.ts'
import { CheeseIcon } from './CheeseIcon'

type GroupVisual = {
  icon: LucideIcon
  /** Icon tile: tinted background + readable foreground (≥ 4.5:1). */
  tile: string
}

const GROUP_VISUAL: Record<string, GroupVisual> = {
  fruit_vegetables: { icon: Carrot, tile: 'bg-emerald-100 text-emerald-800' },
  dairy_eggs: { icon: Milk, tile: 'bg-sky-100 text-sky-800' },
  meat_fish: { icon: Drumstick, tile: 'bg-rose-100 text-rose-800' },
  plant_protein: { icon: Vegan, tile: 'bg-lime-100 text-lime-800' },
  staples: { icon: Wheat, tile: 'bg-amber-100 text-amber-800' },
  fats_sweets: { icon: Candy, tile: 'bg-orange-100 text-orange-800' },
  beverages: { icon: CanSoda, tile: 'bg-cyan-100 text-cyan-800' },
  ready_meals: { icon: CookingPot, tile: 'bg-violet-100 text-violet-800' },
  pet: { icon: PawPrint, tile: 'bg-stone-200 text-stone-800' },
  fuel: { icon: Fuel, tile: 'bg-zinc-200 text-zinc-800' },
  other: { icon: Package, tile: 'bg-zinc-100 text-zinc-700' },
}

const FALLBACK_GROUP: GroupVisual = GROUP_VISUAL.other ?? {
  icon: Package,
  tile: 'bg-zinc-100 text-zinc-700',
}

const ICON_BY_SLUG: Record<string, LucideIcon> = {
  // fruit & vegetables
  pineapple: TreePalm,
  apples: Apple,
  avocados: Avocado,
  bananas: Banana,
  berries: Cherry,
  broccoli: TreeDeciduous,
  'canned-vegetables': Can,
  cucumbers: Sprout,
  carrots: Carrot,
  potatoes: Sprout,
  cabbage: LeafyGreen,
  citrus: Citrus,
  peppers: Sprout,
  'tomato-products': Can,
  mushrooms: Sprout,
  salad: Salad,
  'frozen-vegetables': Snowflake,
  tomatoes: Cherry,
  grapes: Grape,
  zucchini: Sprout,
  onions: Sprout,
  // dairy & eggs
  butter: Cuboid,
  eggs: Egg,
  'cream-cheese': Container,
  yogurt: IceCreamBowl,
  cheese: CheeseIcon,
  milk: Milk,
  quark: Container,
  cream: Droplet,
  // meat & fish
  'fish-farmed': Fish,
  'fish-frozen': Fish,
  'fish-wild': Fish,
  shrimp: Shrimp,
  chicken: Drumstick,
  'beef-cold-cuts': Sandwich,
  'ground-beef': Beef,
  beef: Beef,
  pork: Ham,
  sausage: Ham,
  // plant protein
  'oat-drink': Wheat,
  legumes: Bean,
  nuts: Nut,
  'soy-drink': Vegan,
  tofu: Cuboid,
  'veggie-sausage': Vegan,
  'veggie-patty': Hamburger,
  // staples
  bread: Wheat,
  'bread-rolls': Croissant,
  oats: Wheat,
  pasta: Wheat,
  fries: Snowflake,
  rice: Wheat,
  // fats & sweets
  honey: Hexagon,
  pastries: CakeSlice,
  margarine: Container,
  'olive-oil': Amphora,
  'vegetable-oil': Droplets,
  chocolate: Candy,
  sugar: Cuboid,
  // beverages
  'apple-juice': Apple,
  beer: Beer,
  coffee: Coffee,
  cocoa: Bean,
  'soft-drinks': CanSoda,
  'mineral-water': GlassWater,
  'orange-juice': Citrus,
  wine: Wine,
  // ready meals
  'ready-meal-fish': Fish,
  'ready-meal-meat': Drumstick,
  'ready-meal-beef': Beef,
  'ready-meal-vegan': Vegan,
  'ready-meal-vegetarian': Salad,
}

export function groupVisual(group: string): GroupVisual {
  return GROUP_VISUAL[group] ?? FALLBACK_GROUP
}

export function categoryVisual(category: { slug: string; category_group: string }) {
  const group = groupVisual(category.category_group)
  return { icon: ICON_BY_SLUG[category.slug] ?? group.icon, tile: group.tile }
}

export type Intensity = { level: 1 | 2 | 3 | 4 | 5; label: string }

const LEVELS = [1, 2, 3, 4, 5] as const
const INTENSITY_LABEL = ['sehr niedrig', 'niedrig', 'mittel', 'hoch', 'sehr hoch'] as const
/** kg CO₂e per kg or litre; upper bounds of the first four levels. */
const INTENSITY_BOUNDS = [0.5, 1.5, 4, 8] as const

/**
 * Rough climate impact per kg/litre, for orientation while choosing. Per-piece factors
 * (eggs, ready-meal portions) are not comparable on this scale and get none.
 */
export function intensity(category: { unit: EmissionUnit; co2e_per_unit: number }) {
  if (category.unit !== 'kg' && category.unit !== 'l') return null
  const index = INTENSITY_BOUNDS.findIndex((bound) => category.co2e_per_unit < bound)
  const level = LEVELS[index === -1 ? LEVELS.length - 1 : index] ?? 5
  const result: Intensity = { level, label: INTENSITY_LABEL[level - 1] ?? '' }
  return result
}

const UNIT_SHORT: Record<EmissionUnit, string> = { kg: 'kg', l: 'l', piece: 'Stk.', eur: '€' }
const factorFormatter = new Intl.NumberFormat('de-DE', { maximumFractionDigits: 2 })

/** "5,7 kg CO₂e/kg" */
export function formatFactor(category: { unit: EmissionUnit; co2e_per_unit: number }) {
  return `${factorFormatter.format(category.co2e_per_unit)} kg CO₂e/${UNIT_SHORT[category.unit]}`
}
