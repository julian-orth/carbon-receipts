import { screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { authenticated, loading, unauthenticated } from '@/test/auth'
import { renderRoutes } from '@/test/render'
import { routes } from './routes'

describe('routes', () => {
  it('renders the home page for signed-in users', () => {
    renderRoutes(routes, { auth: authenticated })
    expect(screen.getByRole('heading', { level: 1, name: 'Carbon Receipts' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Abmelden' })).toBeInTheDocument()
  })

  it('redirects anonymous users from protected routes to /login', () => {
    const { router } = renderRoutes(routes, { auth: unauthenticated })
    expect(router.state.location.pathname).toBe('/login')
    expect(router.state.location.state).toEqual({ from: '/' })
    expect(screen.getByRole('heading', { name: 'Anmelden' })).toBeInTheDocument()
  })

  it('shows a spinner while the session is restored', () => {
    renderRoutes(routes, { auth: loading })
    expect(screen.getByRole('status', { name: 'Sitzung wird geprüft' })).toBeInTheDocument()
  })

  it('renders the not-found page for unknown paths', () => {
    renderRoutes(routes, { initialPath: '/does-not-exist' })
    expect(screen.getByRole('heading', { name: 'Seite nicht gefunden' })).toBeInTheDocument()
  })
})
