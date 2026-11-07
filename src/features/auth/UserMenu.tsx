import { LogOut } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Spinner } from '@/components/ui/spinner'
import { useAuth } from './auth-context'
import { useSignOut } from './mutations'

export function UserMenu() {
  const auth = useAuth()
  const signOut = useSignOut()

  if (auth.status !== 'authenticated') return null

  return (
    <div className="ml-auto flex items-center gap-3">
      <span className="hidden max-w-48 truncate text-sm text-muted-foreground sm:inline">
        {auth.user.email}
      </span>
      <Button
        variant="ghost"
        size="sm"
        onClick={() => signOut.mutate()}
        disabled={signOut.isPending}
      >
        {signOut.isPending ? <Spinner /> : <LogOut aria-hidden />}
        Abmelden
      </Button>
      {signOut.isError && (
        <p role="alert" className="text-sm text-destructive">
          Abmelden fehlgeschlagen.
        </p>
      )}
    </div>
  )
}
