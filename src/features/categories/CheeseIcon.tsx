import { createLucideIcon } from 'lucide-react'

/** Lucide has no cheese; a wedge with holes in the same 24px stroke style. */
export const CheeseIcon = createLucideIcon('cheese', [
  ['path', { d: 'M2 18h20v-7L2 18', key: 'side' }],
  ['path', { d: 'M2 18 15 5.5 22 11', key: 'top' }],
  ['circle', { cx: '16', cy: '15', r: '1.2', key: 'hole-1' }],
  ['circle', { cx: '11', cy: '16.2', r: '0.8', key: 'hole-2' }],
])
