// Last 5 changes:
// 1. Migrated to new consolidated client approach
// 2. Export hooks from main api.ts file
// 3. Removed legacy generated hook implementations
// 4. Maintain backward compatibility with existing imports  
// 5. Cleaned up unused query key constants

// Re-export all key hooks from the main api file
export {
  useGetKeys,
  useGetKey,
  useCreateKey,
  useUpdateKey,
  useDeleteKey
} from '../api'

// Type exports for backward compatibility
import type {
  CreateProviderKeyBody,
  UpdateProviderKeyBody
} from 'shared/src/schemas/provider-key.schemas'

export type CreateKeyInput = CreateProviderKeyBody
export type UpdateKeyInput = UpdateProviderKeyBody