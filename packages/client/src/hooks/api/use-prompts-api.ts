

// Last 5 changes:
// 1. Migrated to new consolidated client approach
// 2. Export hooks from main api.ts file  
// 3. Removed legacy generated hook implementations
// 4. Maintain backward compatibility with existing imports
// 5. Cleaned up unused imports and type definitions

// Re-export all prompt hooks from the main api file
export {
  useGetAllPrompts,
  useGetPrompt,
  useGetProjectPrompts,
  useCreatePrompt,
  useUpdatePrompt,
  useDeletePrompt,
  useAddPromptToProject,
  useRemovePromptFromProject,
  useOptimizeUserInput
} from '../api'

// Type exports for backward compatibility
import type {
  CreatePromptBody,
  UpdatePromptBody
} from 'shared/src/schemas/prompt.schemas'

export type CreatePromptInput = CreatePromptBody
export type UpdatePromptInput = UpdatePromptBody