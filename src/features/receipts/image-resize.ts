/** Longest edge sent to the model: receipts stay readable, uploads and LLM calls stay small. */
export const MAX_DIMENSION = 2048
const JPEG_QUALITY = 0.85
/** Below this size an image that already fits is uploaded unchanged. */
const SMALL_ENOUGH_BYTES = 1.5 * 1024 * 1024

/** A very long receipt may exceed `MAX_DIMENSION` so its short side stays readable, up to this. */
export const MAX_LONG_DIMENSION = 4096
/** Shortest edge a long receipt keeps (when the original has that many pixels). */
const MIN_READABLE_SHORT_EDGE = 1000

export function fitWithin(width: number, height: number, max = MAX_DIMENSION) {
  let scale = Math.min(1, max / Math.max(width, height))
  // A receipt photographed top to bottom is very tall and narrow: scaling its long side to
  // `max` would shrink the text to mush. Keep the short side readable, within a hard cap.
  const short = Math.min(width, height)
  if (short * scale < MIN_READABLE_SHORT_EDGE) {
    scale = Math.min(
      1,
      MIN_READABLE_SHORT_EDGE / short,
      MAX_LONG_DIMENSION / Math.max(width, height),
    )
  }
  return { width: Math.round(width * scale), height: Math.round(height * scale) }
}

function toJpegName(name: string): string {
  const dot = name.lastIndexOf('.')
  return `${dot === -1 ? name : name.slice(0, dot)}.jpg`
}

/**
 * Downscales and re-encodes a photo as JPEG in the browser. Returns the original when
 * the browser cannot decode it (e.g. HEIC outside Safari), when it is already small,
 * or when re-encoding would not make it smaller.
 */
export async function prepareImage(file: File): Promise<File> {
  if (typeof createImageBitmap !== 'function' || typeof document === 'undefined') return file

  let bitmap: ImageBitmap
  try {
    bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' })
  } catch {
    return file
  }

  try {
    const target = fitWithin(bitmap.width, bitmap.height)
    const fits = target.width === bitmap.width && target.height === bitmap.height
    if (fits && file.size <= SMALL_ENOUGH_BYTES) return file

    const canvas = document.createElement('canvas')
    canvas.width = target.width
    canvas.height = target.height
    const context = canvas.getContext('2d')
    if (!context) return file
    context.drawImage(bitmap, 0, 0, target.width, target.height)

    const blob = await new Promise<Blob | null>((resolve) => {
      canvas.toBlob(resolve, 'image/jpeg', JPEG_QUALITY)
    })
    if (!blob || blob.size >= file.size) return file
    return new File([blob], toJpegName(file.name), { type: 'image/jpeg' })
  } finally {
    bitmap.close()
  }
}
