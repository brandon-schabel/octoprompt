
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