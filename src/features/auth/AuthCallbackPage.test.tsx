import { screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { routes } from '@/app/routes'
import { authenticated, loading, unauthenticated } from '@/test/auth'
import { renderRoutes } from '@/test/render'
import { rememberRedirect } from './redirect'

vi.mock('@/features/receipts/api')

function setBrowserUrl(url: string) {
  window.history.replaceState(null, '', url)
}

describe('AuthCallbackPage', () => {
  afterEach(() => {
    setBrowserUrl('/')
    localStorage.clear()
  })

  it('waits while the code is exchanged', () => {
    setBrowserUrl('/auth/callback?code=abc')
    renderRoutes(routes, { initialPath: '/auth/callback', auth: loading })
    expect(screen.getByRole('status', { name: 'Anmeldung wird abgeschlossen' })).toBeInTheDocument()
  })

  it('redirects to the remembered page once signed in', async () => {
    rememberRedirect('/receipts')
    const { router } = renderRoutes(routes, { initialPath: '/auth/callback', auth: authenticated })
    await waitFor(() => expect(router.state.location.pathname).toBe('/receipts'))
  })

  it('explains expired links', () => {
    setBrowserUrl('/auth/callback?error=access_denied&error_code=otp_expired')
    renderRoutes(routes, { initialPath: '/auth/callback', auth: loading })
    expect(screen.getByRole('alert')).toHaveTextContent(/abgelaufen/)
    expect(screen.getByRole('link', { name: 'Neuen Link anfordern' })).toHaveAttribute(
      'href',
      '/login',
    )
  })

  it('fails gracefully when no session could be established', () => {
    renderRoutes(routes, { initialPath: '/auth/callback', auth: unauthenticated })
    expect(screen.getByRole('heading', { name: 'Anmeldung fehlgeschlagen' })).toBeInTheDocument()
  })
})
