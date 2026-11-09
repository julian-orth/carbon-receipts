import { afterEach, describe, expect, it } from 'vitest'
import { resolveTheme, setThemePreference } from './theme'

describe('theme', () => {
  afterEach(() => {
    setThemePreference('system')
  })

  it('follows the system unless light or dark is chosen', () => {
    expect(resolveTheme('system', true)).toBe('dark')
    expect(resolveTheme('system', false)).toBe('light')
    expect(resolveTheme('light', true)).toBe('light')
    expect(resolveTheme('dark', false)).toBe('dark')
  })

  it('applies and remembers an explicit choice', () => {
    setThemePreference('dark')
    expect(document.documentElement).toHaveClass('dark')
    expect(document.documentElement.style.colorScheme).toBe('dark')
    expect(localStorage.getItem('theme')).toBe('dark')

    setThemePreference('system')
    expect(localStorage.getItem('theme')).toBeNull()
  })
})
