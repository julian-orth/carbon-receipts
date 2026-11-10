import { Link, Outlet } from 'react-router'
import { BrandMark } from '@/components/BrandMark'
import { useAuth } from '@/features/auth/auth-context'
import { UserMenu } from '@/features/auth/UserMenu'
import { ProcessingDock } from '@/features/processing/components/ProcessingDock'
import { MainNav } from './MainNav'
import { ThemeToggle } from './ThemeToggle'

export function RootLayout() {
  const auth = useAuth()
  return (
    <div className="flex min-h-svh flex-col bg-background text-foreground">
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:absolute focus:top-2 focus:left-2 focus:z-50 focus:rounded-md focus:bg-primary focus:px-3 focus:py-2 focus:text-primary-foreground"
      >
        Zum Inhalt springen
      </a>
      <header className="sticky top-0 z-30 border-b bg-background/85 backdrop-blur-md supports-[backdrop-filter]:bg-background/70">
        <nav
          aria-label="Hauptnavigation"
          className="mx-auto flex max-w-6xl items-center gap-3 px-4 py-3 sm:gap-6 sm:px-6"
        >
          <Link
            to="/"
            className="flex shrink-0 items-center gap-2.5 rounded-md font-semibold tracking-tight whitespace-nowrap focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
          >
            <BrandMark className="size-8" />
            <span className="max-sm:sr-only">Carbon Receipts</span>
          </Link>
          <MainNav />
          <div className="ml-auto flex shrink-0 items-center gap-1 sm:gap-2">
            <ThemeToggle />
            <UserMenu />
          </div>
        </nav>
      </header>
      <main id="main" className="mx-auto w-full max-w-6xl flex-1 px-4 py-8 sm:px-6 sm:py-12">
        <Outlet />
      </main>
      {auth.status === 'authenticated' && <ProcessingDock userId={auth.user.id} />}
    </div>
  )
}
