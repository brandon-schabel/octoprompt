// Re-export all project-related hooks from the new client-based API
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
  useOptimizeUserInput
} from '../api'

// Type re-exports for backward compatibility
export type {
  CreateProjectBody as CreateProjectInput,
  UpdateProjectBody as UpdateProjectInput
} from 'shared/src/schemas/project.schemas'

import type { z } from 'zod'
import type {
  SummarizeFilesBodySchema,
  RemoveSummariesBodySchema,
  SuggestFilesBodySchema
} from 'shared/src/schemas/project.schemas'

export type SummarizeFilesInput = z.infer<typeof SummarizeFilesBodySchema>
export type RemoveSummariesInput = z.infer<typeof RemoveSummariesBodySchema>
export type SuggestFilesInput = z.infer<typeof SuggestFilesBodySchema>

// Legacy aliases for hooks that had different names
export { useSuggestFiles as useFindSuggestedFiles } from '../api'
export { useRemoveSummaries as useRemoveSummariesFromFiles } from '../api'
