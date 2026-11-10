import { createContext, useContext } from 'react'

export type UploadFlow = {
  /** Opens the file picker (camera or gallery on phones) and uploads the chosen photo. */
  openPicker: () => void
  /** Validates and uploads a file the user dropped or picked elsewhere. */
  uploadFile: (file: File | undefined) => void
  isUploading: boolean
  /** Name of the file being uploaded, for the hint text of the drop zone. */
  uploadingName: string | null
}

const IDLE: UploadFlow = {
  openPicker: () => undefined,
  uploadFile: () => undefined,
  isUploading: false,
  uploadingName: null,
}

export const UploadFlowContext = createContext<UploadFlow>(IDLE)

/** The one upload flow of the app: any page can start it, the progress dialog is shared. */
export function useUploadFlow(): UploadFlow {
  return useContext(UploadFlowContext)
}
