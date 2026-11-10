import { NavLink } from 'react-router'
import { useAuth } from '@/features/auth/auth-context'
import { useReceipts } from '@/features/receipts/queries'
import { cn } from '@/lib/utils'

const LINKS: { to: string; label: string; short?: string; end: boolean }[] = [
  { to: '/', label: 'Übersicht', end: true },
  { to: '/receipts', label: 'Belege', end: false },
  { to: '/datenbasis', label: 'Datenbasis', short: 'Daten', end: false },
]

export function MainNav() {
  const auth = useAuth()
  if (auth.status !== 'authenticated') return null
  return <AuthenticatedNav />
}

function AuthenticatedNav() {
  const receipts = useReceipts()
  const toReview = receipts.data?.filter((receipt) => receipt.status === 'review').length ?? 0

  return (
    // On phones the three links would push the account buttons out of the screen: tighter
    // padding, a short label, and a scrollable list as the last resort (padding keeps the focus ring).
    <ul className="-m-1 flex min-w-0 [scrollbar-width:none] items-center gap-0.5 overflow-x-auto p-1 sm:gap-1">
      {LINKS.map((link) => (
        <li key={link.to}>
          <NavLink
            to={link.to}
            end={link.end}
            className={({ isActive }) =>
              cn(
                'inline-flex min-h-10 items-center gap-2 rounded-full border border-transparent px-2 text-sm text-muted-foreground transition-colors hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none sm:px-3.5',
                isActive && 'border-border bg-card font-medium text-foreground shadow-xs',
              )
            }
          >
            {link.short ? (
              <>
                <span aria-hidden="true" className="sm:hidden">
                  {link.short}
                </span>
                <span className="max-sm:sr-only">{link.label}</span>
              </>
            ) : (
              link.label
            )}
            {link.to === '/receipts' && toReview > 0 && (
              <>
                <span
                  aria-hidden="true"
                  className="rounded-full bg-brand px-1.5 font-mono text-[11px] leading-[18px] text-brand-foreground"
                >
                  {toReview}
                </span>
                <span className="sr-only">, {toReview} zu prüfen</span>
              </>
            )}
          </NavLink>
        </li>
      ))}
    </ul>
  )
}
