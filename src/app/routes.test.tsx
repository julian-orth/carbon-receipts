import { screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { renderRoutes } from '@/test/render'
import { routes } from './routes'

describe('routes', () => {
  it('renders the home page at /', () => {
    renderRoutes(routes, '/')
    expect(screen.getByRole('heading', { level: 1, name: 'Carbon Receipts' })).toBeInTheDocument()
    expect(screen.getByRole('main')).toBeInTheDocument()
  })

  it('renders the not-found page for unknown paths', () => {
    renderRoutes(routes, '/does-not-exist')
    expect(screen.getByRole('heading', { name: 'Seite nicht gefunden' })).toBeInTheDocument()
  })
})
