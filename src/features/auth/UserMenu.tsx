import { Check, LogOut, Monitor, Moon, Sun, UserRound } from 'lucide-react'
import { DropdownMenu } from 'radix-ui'
import { Link } from 'react-router'
import { initialsOf } from '@/features/account/account-logic'
import { useProfile } from '@/features/account/queries'
import { type ThemePreference, useTheme } from '@/lib/theme'
import { useAuth } from './auth-context'
import { useSignOut } from './mutations'

const THEMES: { value: ThemePreference; label: string; icon: typeof Sun }[] = [
  { value: 'light', label: 'Hell', icon: Sun },
  { value: 'dark', label: 'Dunkel', icon: Moon },
  { value: 'system', label: 'Wie das System', icon: Monitor },
]

const isPreference = (value: string): value is ThemePreference =>
  value === 'light' || value === 'dark' || value === 'system'

const ITEM =
  'flex cursor-pointer items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm outline-none select-none data-[highlighted]:bg-muted'

/**
 * The account menu behind the avatar: account page, appearance and sign-out. Replaces the
 * e-mail and sign-out button of the header, so the header stays short on phones.
 */
export function UserMenu() {
  const auth = useAuth()
  const signOut = useSignOut()
  const profile = useProfile()
  const { preference, setPreference } = useTheme()

  if (auth.status !== 'authenticated') return null
  const email = auth.user.email ?? ''
  const name = profile.data?.display_name ?? null
  const initials = initialsOf(name, email)

  return (
    <DropdownMenu.Root modal={false}>
      <DropdownMenu.Trigger
        aria-label={`Konto-Menü, angemeldet als ${name ?? email}`}
        className="grid size-10 shrink-0 place-items-center rounded-full bg-brand text-sm font-semibold text-brand-foreground transition-shadow hover:shadow-[0_0_0_4px_color-mix(in_oklab,var(--brand)_35%,transparent)] focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none data-[state=open]:shadow-[0_0_0_4px_color-mix(in_oklab,var(--brand)_45%,transparent)]"
      >
        <span aria-hidden="true">{initials}</span>
      </DropdownMenu.Trigger>
      <DropdownMenu.Portal>
        <DropdownMenu.Content
          align="end"
          sideOffset={8}
          className="z-50 w-64 rounded-xl border bg-popover p-1 text-popover-foreground shadow-[0_12px_32px_rgba(0,0,0,.16)] data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:zoom-in-95"
        >
          <div className="px-2.5 pt-2 pb-2.5">
            {name && <p className="truncate text-sm font-medium">{name}</p>}
            <p className="truncate text-sm text-muted-foreground">{email}</p>
          </div>
          <DropdownMenu.Separator className="my-1 h-px bg-border" />
          <DropdownMenu.Item asChild>
            <Link to="/konto" className={ITEM}>
              <UserRound aria-hidden className="size-4 text-muted-foreground" />
              Konto
            </Link>
          </DropdownMenu.Item>
          <DropdownMenu.Separator className="my-1 h-px bg-border" />
          <DropdownMenu.Label className="px-2.5 pt-1.5 pb-1 text-xs font-medium text-muted-foreground">
            Darstellung
          </DropdownMenu.Label>
          <DropdownMenu.RadioGroup
            value={preference}
            onValueChange={(value) => {
              if (isPreference(value)) setPreference(value)
            }}
          >
            {THEMES.map(({ value, label, icon: Icon }) => (
              <DropdownMenu.RadioItem key={value} value={value} className={ITEM}>
                <Icon aria-hidden className="size-4 text-muted-foreground" />
                <span className="flex-1">{label}</span>
                <DropdownMenu.ItemIndicator>
                  <Check aria-hidden className="size-4" />
                </DropdownMenu.ItemIndicator>
              </DropdownMenu.RadioItem>
            ))}
          </DropdownMenu.RadioGroup>
          <DropdownMenu.Separator className="my-1 h-px bg-border" />
          <DropdownMenu.Item
            disabled={signOut.isPending}
            onSelect={() => signOut.mutate()}
            className={ITEM}
          >
            <LogOut aria-hidden className="size-4 text-muted-foreground" />
            Abmelden
          </DropdownMenu.Item>
          {signOut.isError && (
            <p role="alert" className="px-2.5 py-1.5 text-sm text-destructive">
              Abmelden fehlgeschlagen.
            </p>
          )}
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  )
}
