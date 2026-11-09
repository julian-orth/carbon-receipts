import type { Receipt } from './types'

export function receiptFixture(overrides: Partial<Receipt> = {}): Receipt {
  return {
    id: crypto.randomUUID(),
    user_id: '11111111-1111-1111-1111-111111111111',
    file_path: '11111111-1111-1111-1111-111111111111/file.jpg',
    original_filename: 'bon.jpg',
    source_type: 'photo',
    status: 'pending',
    merchant: null,
    purchased_at: null,
    error: null,
    processing_step: null,
    ai_provider: null,
    created_at: '2026-11-07T10:00:00Z',
    updated_at: '2026-11-07T10:00:00Z',
    ...overrides,
  }
}
