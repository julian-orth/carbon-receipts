import { describe, expect, it } from 'vitest'
import { type LegalConfig, missingLegalFields } from './legal-config'

const full: LegalConfig = {
  name: 'Max Mustermann',
  street: 'Musterweg 1',
  city: '12345 Musterstadt',
  email: 'max@example.com',
  phone: null,
  hostingRegion: 'Frankfurt (EU)',
}

describe('missingLegalFields', () => {
  it('reports empty and blank fields among the required ones', () => {
    expect(
      missingLegalFields({ ...full, name: null, city: '  ' }, ['name', 'city', 'email']),
    ).toEqual(['name', 'city'])
  })

  it('ignores optional fields that are empty', () => {
    expect(missingLegalFields(full, ['name', 'street', 'city', 'email'])).toEqual([])
  })
})
