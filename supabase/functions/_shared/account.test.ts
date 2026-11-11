import { describe, expect, it } from 'vitest'
import { isDemoAccount, isOwnFile, userFolder } from './account.ts'

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

describe('isOwnFile', () => {
  const user = 'aaaa0000-0000-0000-0000-000000000001'

  it('accepts a file directly in the own folder', () => {
    expect(isOwnFile(`${user}/1b2c.jpg`, user)).toBe(true)
  })

  it('rejects files of other users, traversal and nested folders', () => {
    expect(isOwnFile('bbbb0000-0000-0000-0000-000000000002/1b2c.jpg', user)).toBe(false)
    expect(isOwnFile(`${user}/../other/x.jpg`, user)).toBe(false)
    expect(isOwnFile(`${user}/sub/x.jpg`, user)).toBe(false)
    expect(isOwnFile(`${user}/`, user)).toBe(false)
    expect(isOwnFile(`${user}x/a.jpg`, user)).toBe(false)
    expect(isOwnFile('x.jpg', user)).toBe(false)
  })
})
