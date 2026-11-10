/** The example receipt shipped in `public/`: lets visitors try the whole flow without a bon at hand. */
export const SAMPLE_RECEIPT = { url: '/sample-receipt.png', fileName: 'beispielbeleg.png' } as const

export class SampleReceiptError extends Error {}

/**
 * Loads the example receipt as a file, ready for the normal upload. A missing file must not
 * pass for an image: the dev server and many hosts answer unknown paths with the app's HTML.
 */
export async function loadSampleReceipt(fetcher: typeof fetch = fetch): Promise<File> {
  let response: Response
  try {
    response = await fetcher(SAMPLE_RECEIPT.url)
  } catch {
    throw new SampleReceiptError('Der Beispielbeleg konnte nicht geladen werden.')
  }
  if (!response.ok) throw new SampleReceiptError('Der Beispielbeleg ist noch nicht verfügbar.')
  const blob = await response.blob()
  if (!blob.type.startsWith('image/'))
    throw new SampleReceiptError('Der Beispielbeleg ist noch nicht verfügbar.')
  return new File([blob], SAMPLE_RECEIPT.fileName, { type: blob.type })
}
