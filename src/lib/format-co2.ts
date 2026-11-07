const kgFormatter = new Intl.NumberFormat('de-DE', {
  maximumFractionDigits: 2,
  minimumFractionDigits: 0,
})
const precise = new Intl.NumberFormat('de-DE', { maximumFractionDigits: 3 })

/** "4,6 kg CO₂e", small values in gram. */
export function formatCo2e(kg: number): string {
  if (kg > 0 && kg < 1) return `${Math.round(kg * 1000).toLocaleString('de-DE')} g CO₂e`
  return `${kgFormatter.format(kg)} kg CO₂e`
}

export function formatNumber(value: number): string {
  return precise.format(value)
}
