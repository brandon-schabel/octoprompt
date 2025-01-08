import { useState } from 'react'
import { toast } from 'sonner'

type CopyStatus = 'idle' | 'copying' | 'success' | 'error'

type CopyOptions = {
  successMessage?: string
  errorMessage?: string
}

type UseCopyClipboardReturn = {
  copyToClipboard: (text: string, options?: CopyOptions) => Promise<void>
  status: CopyStatus
}

export const useCopyClipboard = (): UseCopyClipboardReturn => {
  const [status, setStatus] = useState<CopyStatus>('idle')

  const copyToClipboard = async (
    text: string,
    options?: CopyOptions
  ): Promise<void> => {
    const {
      successMessage = 'Copied to clipboard',
      errorMessage = 'Failed to copy to clipboard'
    } = options ?? {}

    try {
      setStatus('copying')
      await navigator.clipboard.writeText(text)
      setStatus('success')
      toast.success(successMessage)
    } catch (error) {
      setStatus('error')
      toast.error(errorMessage)
      console.error('Failed to copy text:', error)
    } finally {
      setTimeout(() => setStatus('idle'), 2000)
    }
  }

  return {
    copyToClipboard,
    status
  }
}
