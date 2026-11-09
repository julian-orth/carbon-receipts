import { cn } from '@/lib/utils'

/** Logo mark (same drawing as `public/favicon.svg`): a receipt on ink with lime lines. */
export function BrandMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" aria-hidden="true" className={cn('shrink-0', className)}>
      <rect width="32" height="32" rx="8" fill="#121412" />
      {/* Hairline so the ink square stays visible on the dark background. */}
      <rect
        x="0.5"
        y="0.5"
        width="31"
        height="31"
        rx="7.5"
        fill="none"
        className="stroke-transparent dark:stroke-white/15"
      />
      <path
        d="M9 6h14v20l-2.33-1.5-2.34 1.5L16 24.5 13.67 26l-2.34-1.5L9 26z"
        fill="none"
        stroke="#c8f169"
        strokeWidth="1.8"
        strokeLinejoin="round"
      />
      <path
        d="M12.5 11h7M12.5 14.5h7M12.5 18h4"
        stroke="#c8f169"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
    </svg>
  )
}
