import { NavLink } from 'react-router'
import { useAuth } from '@/features/auth/auth-context'
import { useReceipts } from '@/features/receipts/queries'
import { cn } from '@/lib/utils'

const LINKS = [
  { to: '/', label: 'Übersicht', end: true },
  { to: '/receipts', label: 'Belege', end: false },
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
    <ul className="flex items-center gap-1">
      {LINKS.map((link) => (
        <li key={link.to}>
          <NavLink
            to={link.to}
            end={link.end}
            className={({ isActive }) =>
              cn(
                'inline-flex min-h-10 items-center gap-2 rounded-full border border-transparent px-3.5 text-sm text-muted-foreground transition-colors hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none',
                isActive && 'border-border bg-card font-medium text-foreground shadow-xs',
              )
            }
          >
            {link.label}
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
