import { NavLink } from 'react-router'
import { useAuth } from '@/features/auth/auth-context'
import { cn } from '@/lib/utils'

const LINKS = [
  { to: '/', label: 'Übersicht', end: true },
  { to: '/receipts', label: 'Belege', end: false },
]

export function MainNav() {
  const auth = useAuth()
  if (auth.status !== 'authenticated') return null

  return (
    <ul className="flex items-center gap-1">
      {LINKS.map((link) => (
        <li key={link.to}>
          <NavLink
            to={link.to}
            end={link.end}
            className={({ isActive }) =>
              cn(
                'rounded-md px-3 py-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none',
                isActive && 'bg-muted font-medium text-foreground',
              )
            }
          >
            {link.label}
          </NavLink>
        </li>
      ))}
    </ul>
  )
}
