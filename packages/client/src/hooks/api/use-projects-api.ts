export {
  useGetProjects,
  useGetProject,
  useGetProjectFiles,
  useGetProjectSummary,
  useCreateProject,
  useUpdateProject,
  useDeleteProject,
  useSyncProject,
  useRefreshProject,
  useSuggestFiles,
  useSummarizeProjectFiles,
  useRemoveSummaries,
  useOptimizeUserInput,
  useInvalidateProjects
} from '../api-hooks'

// Type re-exports for backward compatibility
export type {
  CreateProjectBody as CreateProjectInput,
  UpdateProjectBody as UpdateProjectInput
} from '@octoprompt/schemas'

import type { z } from 'zod'
import type { SummarizeFilesBodySchema, RemoveSummariesBodySchema, SuggestFilesBodySchema } from '@octoprompt/schemas'

export type SummarizeFilesInput = z.infer<typeof SummarizeFilesBodySchema>
export type RemoveSummariesInput = z.infer<typeof RemoveSummariesBodySchema>
export type SuggestFilesInput = z.infer<typeof SuggestFilesBodySchema>

// Legacy aliases for hooks that had different names
export { useSuggestFiles as useFindSuggestedFiles } from '../api-hooks'
export { useRemoveSummaries as useRemoveSummariesFromFiles } from '../api-hooks'
