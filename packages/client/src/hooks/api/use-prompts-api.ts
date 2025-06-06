export {
  useGetAllPrompts,
  useGetPrompt,
  useGetProjectPrompts,
  useCreatePrompt,
  useUpdatePrompt,
  useDeletePrompt,
  useAddPromptToProject,
  useRemovePromptFromProject,
  useOptimizeUserInput,
  useInvalidatePrompts 
} from '../api-hooks'

// Type exports for backward compatibility
import type {
  CreatePromptBody,
  UpdatePromptBody
} from '@octoprompt/schemas'

export type CreatePromptInput = CreatePromptBody
export type UpdatePromptInput = UpdatePromptBody