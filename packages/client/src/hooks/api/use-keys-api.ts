export { useGetKeys, useGetKey, useCreateKey, useUpdateKey, useDeleteKey, useInvalidateKeys } from '../api-hooks'

// Type exports for backward compatibility
import type { CreateProviderKeyBody, UpdateProviderKeyBody } from '@promptliano/schemas'

export type CreateKeyInput = CreateProviderKeyBody
export type UpdateKeyInput = UpdateProviderKeyBody
