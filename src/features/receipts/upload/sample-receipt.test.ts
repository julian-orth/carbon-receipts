import { describe, expect, it } from 'vitest'
import { loadSampleReceipt, SAMPLE_RECEIPT, SampleReceiptError } from './sample-receipt'

const respond = (body: string, init: { type?: string; status?: number } = {}) =>
  (() =>
    Promise.resolve(
      new Response(body, {
        status: init.status ?? 200,
        headers: init.type ? { 'content-type': init.type } : {},
      }),
    )) as typeof fetch

describe('loadSampleReceipt', () => {
  it('returns the image as a named file', async () => {
    const file = await loadSampleReceipt(respond('png', { type: 'image/png' }))
    expect(file.name).toBe(SAMPLE_RECEIPT.fileName)
    expect(file.type).toBe('image/png')
  })

  it('refuses the HTML a host serves for a missing file', async () => {
    await expect(loadSampleReceipt(respond('<html>', { type: 'text/html' }))).rejects.toThrow(
      SampleReceiptError,
    )
  })

  it('refuses a 404', async () => {
    await expect(
      loadSampleReceipt(respond('x', { type: 'image/png', status: 404 })),
    ).rejects.toThrow(/noch nicht verfügbar/)
  })

  it('reports a network error', async () => {
    const offline = (() => Promise.reject(new TypeError('offline'))) as typeof fetch
    await expect(loadSampleReceipt(offline)).rejects.toThrow(/konnte nicht geladen/)
  })
})
