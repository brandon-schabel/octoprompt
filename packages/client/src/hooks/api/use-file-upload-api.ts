// Recent changes:
// 1. Created file upload API hook for chat attachments
// 2. Added useMutation for file upload with proper error handling
// 3. Added useDeleteAttachment for removing uploaded files
// 4. Implemented proper TypeScript types from shared schemas
// 5. Updated to use proper query keys and invalidators from main API file

import { useMutation, useQueryClient } from '@tanstack/react-query'
import type { ChatMessageAttachment, FileUploadResponseSchema } from '@octoprompt/schemas'
import { z } from 'zod'
import { toast } from 'sonner'

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000'

// Query Keys - imported pattern from main API file
const CHAT_KEYS = {
  all: ['chats'] as const,
  list: () => [...CHAT_KEYS.all, 'list'] as const,
  detail: (chatId: number) => [...CHAT_KEYS.all, 'detail', chatId] as const,
  messages: (chatId: number) => [...CHAT_KEYS.all, 'messages', chatId] as const
}

export function useUploadFile() {
  const queryClient = useQueryClient()
  
  return useMutation({
    mutationFn: async ({ chatId, file }: { chatId: number; file: File }): Promise<ChatMessageAttachment> => {
      const formData = new FormData()
      formData.append('file', file)
      
      const response = await fetch(`${API_BASE_URL}/api/chats/${chatId}/upload`, {
        method: 'POST',
        body: formData,
      })
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        throw new Error(errorData.error?.message || `Upload failed: ${response.status}`)
      }
      
      const result = await response.json() as z.infer<typeof FileUploadResponseSchema>
      return result.data
    },
    onSuccess: (attachment, { chatId }) => {
      // Invalidate chat messages to ensure UI stays in sync
      queryClient.invalidateQueries({ queryKey: CHAT_KEYS.messages(chatId) })
      toast.success(`File "${attachment.fileName}" uploaded successfully`)
    },
    onError: (error: Error) => {
      console.error('File upload error:', error)
      toast.error(`Upload failed: ${error.message}`)
    },
  })
}

export function useDeleteAttachment() {
  const queryClient = useQueryClient()
  
  return useMutation({
    mutationFn: async ({ 
      chatId, 
      messageId, 
      attachmentId 
    }: { 
      chatId: number
      messageId: number
      attachmentId: number 
    }): Promise<void> => {
      const response = await fetch(
        `${API_BASE_URL}/api/chats/${chatId}/messages/${messageId}/attachments/${attachmentId}`, 
        {
          method: 'DELETE',
        }
      )
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        throw new Error(errorData.error?.message || `Delete failed: ${response.status}`)
      }
    },
    onSuccess: (_, { chatId }) => {
      // Invalidate chat messages to refresh the UI
      queryClient.invalidateQueries({ queryKey: CHAT_KEYS.messages(chatId) })
      toast.success('Attachment deleted successfully')
    },
    onError: (error: Error) => {
      console.error('Delete attachment error:', error)
      toast.error(`Delete failed: ${error.message}`)
    },
  })
}
