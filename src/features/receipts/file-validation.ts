import type { Enums } from '@/types/db-helpers'
import { formatFileSize } from '@/lib/format'

/** Must match the `receipts` storage bucket limit (see migration). */
export const MAX_FILE_SIZE = 10 * 1024 * 1024

type UploadKind = {
  sourceType: Extract<Enums<'receipt_source'>, 'photo'>
  contentType: string
  extension: string
}

const BY_EXTENSION: Record<string, UploadKind> = {
  jpg: { sourceType: 'photo', contentType: 'image/jpeg', extension: 'jpg' },
  jpeg: { sourceType: 'photo', contentType: 'image/jpeg', extension: 'jpg' },
  png: { sourceType: 'photo', contentType: 'image/png', extension: 'png' },
  webp: { sourceType: 'photo', contentType: 'image/webp', extension: 'webp' },
  heic: { sourceType: 'photo', contentType: 'image/heic', extension: 'heic' },
  heif: { sourceType: 'photo', contentType: 'image/heic', extension: 'heic' },
}

const BY_MIME: Record<string, UploadKind | undefined> = {
  'image/jpeg': BY_EXTENSION.jpg,
  'image/png': BY_EXTENSION.png,
  'image/webp': BY_EXTENSION.webp,
  'image/heic': BY_EXTENSION.heic,
  'image/heif': BY_EXTENSION.heic,
}

/** Value for `<input accept>`; extensions cover browsers that report no MIME type (HEIC). */
export const ACCEPT_ATTRIBUTE = [
  ...Object.keys(BY_MIME),
  ...Object.keys(BY_EXTENSION).map((ext) => `.${ext}`),
].join(',')

export type FileValidationResult = { ok: true; kind: UploadKind } | { ok: false; error: string }

function extensionOf(name: string): string {
  const dot = name.lastIndexOf('.')
  return dot === -1 ? '' : name.slice(dot + 1).toLowerCase()
}

/**
 * Decides how a file is stored and processed. The MIME type wins when it is known;
 * the extension is the fallback because browsers often report HEIC as `''`.
 */
export function validateReceiptFile(
  file: Pick<File, 'name' | 'type' | 'size'>,
): FileValidationResult {
  const kind = BY_MIME[file.type] ?? BY_EXTENSION[extensionOf(file.name)]

  if (!kind) {
    return {
      ok: false,
      error:
        'Dieser Dateityp wird nicht unterstützt. Erlaubt sind Fotos im Format JPG, PNG, WebP oder HEIC.',
    }
  }
  if (file.size === 0) {
    return { ok: false, error: 'Die Datei ist leer.' }
  }
  if (file.size > MAX_FILE_SIZE) {
    return {
      ok: false,
      error: `Die Datei ist zu groß (${formatFileSize(file.size)}). Maximal ${formatFileSize(MAX_FILE_SIZE)} sind erlaubt.`,
    }
  }
  return { ok: true, kind }
}
