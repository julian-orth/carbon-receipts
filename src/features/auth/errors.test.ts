import { AuthApiError } from '@supabase/supabase-js'
import { describe, expect, it } from 'vitest'
import { getAuthErrorMessage } from './errors'

describe('getAuthErrorMessage', () => {
  it('explains rate limits', () => {
    const error = new AuthApiError('rate limit', 429, 'over_email_send_rate_limit')
    expect(getAuthErrorMessage(error)).toMatch(/Zu viele Anfragen/)
  })

  it('explains expired links', () => {
    const error = new AuthApiError('expired', 403, 'otp_expired')
    expect(getAuthErrorMessage(error)).toMatch(/abgelaufen/)
  })

  it('treats fetch failures as connectivity problems', () => {
    expect(getAuthErrorMessage(new TypeError('Failed to fetch'))).toMatch(/Keine Verbindung/)
  })

  it('falls back to a generic message', () => {
    expect(getAuthErrorMessage(new Error('boom'))).toMatch(/schiefgelaufen/)
  })
})
