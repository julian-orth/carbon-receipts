import { screen, waitFor } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { authenticated, loading, unauthenticated } from '@/test/auth'
import { renderRoutes } from '@/test/render'
import { routes } from './routes'

// Feature pages are lazy routes; the first dynamic import can be slow on a busy CI runner.
const LAZY_ROUTE = { timeout: 5000 }

vi.mock('@/features/dashboard/api')
vi.mock('@/features/categories/api')
vi.mock('@/features/account/api')

describe('routes', () => {
  it('renders the dashboard for signed-in users', async () => {
    renderRoutes(routes, { auth: authenticated })
    expect(
      await screen.findByRole('heading', { level: 1, name: 'Übersicht' }, LAZY_ROUTE),
    ).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Konto-Menü/ })).toBeInTheDocument()
  })

  it('redirects anonymous users from protected routes to /login', async () => {
    const { router } = renderRoutes(routes, { auth: unauthenticated })
    await waitFor(() => expect(router.state.location.pathname).toBe('/login'))
    expect(router.state.location.state).toEqual({ from: '/' })
    expect(await screen.findByRole('heading', { name: 'Anmelden' })).toBeInTheDocument()
  })

  it('shows a spinner while the session is restored', async () => {
    renderRoutes(routes, { auth: loading })
    expect(await screen.findByRole('status', { name: 'Sitzung wird geprüft' })).toBeInTheDocument()
  })

  it('shows the legal pages without a login', async () => {
    renderRoutes(routes, { initialPath: '/impressum', auth: unauthenticated })
    expect(
      await screen.findByRole('heading', { level: 1, name: 'Impressum' }, LAZY_ROUTE),
    ).toBeInTheDocument()
  })

  it('protects the account page', async () => {
    const { router } = renderRoutes(routes, { initialPath: '/konto', auth: unauthenticated })
    await waitFor(() => expect(router.state.location.pathname).toBe('/login'))
  })

  it('renders the not-found page for unknown paths', async () => {
    renderRoutes(routes, { initialPath: '/does-not-exist' })
    expect(await screen.findByRole('heading', { name: 'Seite nicht gefunden' })).toBeInTheDocument()
  })
})
