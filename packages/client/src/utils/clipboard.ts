import { toast } from 'sonner'

/**
 * Copy text to clipboard with toast feedback
 * @param text The text to copy to clipboard
 * @param successMessage Optional custom success message
 */
export async function copyToClipboard(text: string, successMessage = 'Copied to clipboard') {
  try {
    await navigator.clipboard.writeText(text)
    toast.success(successMessage)
  } catch (error) {
    toast.error('Failed to copy. Please try copying manually.')
  }
}
