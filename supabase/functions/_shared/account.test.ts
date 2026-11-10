import { describe, expect, it } from 'vitest'
import { isDemoAccount, userFolder } from './account.ts'

describe('isDemoAccount', () => {
  it('recognises the demo account regardless of case and spaces', () => {
    expect(isDemoAccount('Demo@Carbon-Receipts.app', ' demo@carbon-receipts.app ')).toBe(true)
  })

  it('does not match other accounts', () => {
    expect(isDemoAccount('alice@example.com', 'demo@carbon-receipts.app')).toBe(false)
  })

  it('never matches when no demo account is configured (fail closed for real users)', () => {
    expect(isDemoAccount('alice@example.com', undefined)).toBe(false)
    expect(isDemoAccount('alice@example.com', '')).toBe(false)
    expect(isDemoAccount(undefined, 'demo@carbon-receipts.app')).toBe(false)
  })
})

describe('userFolder', () => {
  it('is the user id, as the upload path says', () => {
    expect(userFolder('abc')).toBe('abc')
  })
})
