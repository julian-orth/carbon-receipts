import { Link, Outlet } from 'react-router'
import { UserMenu } from '@/features/auth/UserMenu'
import { MainNav } from './MainNav'

export function RootLayout() {
  return (
    <div className="flex min-h-svh flex-col bg-background text-foreground">
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:absolute focus:top-2 focus:left-2 focus:z-50 focus:rounded-md focus:bg-primary focus:px-3 focus:py-2 focus:text-primary-foreground"
      >
        Zum Inhalt springen
      </a>
      <header className="border-b">
        <nav
          aria-label="Hauptnavigation"
          className="mx-auto flex max-w-5xl items-center gap-3 px-4 py-3 sm:gap-6"
        >
          <Link to="/" className="font-semibold whitespace-nowrap">
            Carbon Receipts
          </Link>
          <MainNav />
          <UserMenu />
        </nav>
      </header>
      <main id="main" className="mx-auto w-full max-w-5xl flex-1 px-4 py-8">
        <Outlet />
      </main>
    </div>
  )
}
