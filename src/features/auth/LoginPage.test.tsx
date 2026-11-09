import { AuthApiError } from '@supabase/supabase-js'
import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { routes } from '@/app/routes'
import { supabase } from '@/lib/supabase'
import { authenticated, testSession, testUser } from '@/test/auth'
import { renderRoutes } from '@/test/render'

vi.mock('@/features/dashboard/api')
vi.mock('@/features/categories/api')

const signInWithOtp = vi.spyOn(supabase.auth, 'signInWithOtp')
const signInWithPassword = vi.spyOn(supabase.auth, 'signInWithPassword')

function renderLogin(from?: string) {
  return renderRoutes(routes, {
    initialPath: '/login',
    initialState: from ? { from } : undefined,
  })
}

describe('LoginPage', () => {
  beforeEach(() => {
    signInWithOtp.mockReset()
    localStorage.clear()
  })

  it('validates the email before calling Supabase', async () => {
    const user = userEvent.setup()
    renderLogin()

    await user.type(screen.getByLabelText('E-Mail-Adresse'), 'not-an-email')
    await user.click(screen.getByRole('button', { name: 'Login-Link senden' }))

    expect(screen.getByLabelText('E-Mail-Adresse')).toHaveAccessibleDescription(
      'Bitte gib eine gültige E-Mail-Adresse ein.',
    )
    expect(signInWithOtp).not.toHaveBeenCalled()
  })

  it('sends a magic link and confirms it', async () => {
    signInWithOtp.mockResolvedValue({ data: { user: null, session: null }, error: null })
    const user = userEvent.setup()
    renderLogin('/receipts')

    await user.type(screen.getByLabelText('E-Mail-Adresse'), '  Alice@Example.com ')
    await user.click(screen.getByRole('button', { name: 'Login-Link senden' }))

    expect(signInWithOtp).toHaveBeenCalledWith({
      email: 'alice@example.com',
      options: {
        emailRedirectTo: `${window.location.origin}/auth/callback`,
        shouldCreateUser: true,
      },
    })
    const heading = await screen.findByRole('heading', { name: 'Prüfe dein Postfach' })
    expect(heading).toHaveFocus()
    expect(screen.getByText('alice@example.com')).toBeInTheDocument()
    expect(localStorage.getItem('carbon-receipts:auth-redirect')).toBe('/receipts')
  })

  it('shows a helpful message when rate limited', async () => {
    signInWithOtp.mockResolvedValue({
      data: { user: null, session: null },
      error: new AuthApiError('rate limit', 429, 'over_email_send_rate_limit'),
    })
    const user = userEvent.setup()
    renderLogin()

    await user.type(screen.getByLabelText('E-Mail-Adresse'), 'alice@example.com')
    await user.click(screen.getByRole('button', { name: 'Login-Link senden' }))

    expect(await screen.findByRole('alert')).toHaveTextContent(/Zu viele Anfragen/)
  })

  it('redirects signed-in users away from the login page', async () => {
    const { router } = renderRoutes(routes, { initialPath: '/login', auth: authenticated })
    await waitFor(() => expect(router.state.location.pathname).toBe('/'), { timeout: 5000 })
  })

  it('signs in to the demo account', async () => {
    signInWithPassword.mockResolvedValue({
      data: { user: testUser, session: testSession },
      error: null,
    })
    const user = userEvent.setup()
    renderLogin()

    await user.click(screen.getByRole('button', { name: 'Demo ansehen' }))

    expect(signInWithPassword).toHaveBeenCalledWith({ email: 'demo@example.com', password: 'demo' })
  })
})
