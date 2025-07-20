export {
  useGetProjects,
  useGetProject,
  useGetProjectFiles,
  useGetProjectFilesWithoutContent,
  useGetProjectSummary,
  useGetProjectStatistics,
  useCreateProject,
  useUpdateProject,
  useDeleteProject,
  useSyncProject,
  useSuggestFiles,
  useOptimizeUserInput,
  useInvalidateProjects,
  useUpdateFileContent,
  useSummarizeProjectFiles,
  useRemoveSummariesFromFiles
} from '../api-hooks'

// Type re-exports for backward compatibility
export type {
  CreateProjectBody as CreateProjectInput,
  UpdateProjectBody as UpdateProjectInput
} from '@octoprompt/schemas'

// Legacy aliases for hooks that had different names
export { useSuggestFiles as useFindSuggestedFiles } from '../api-hooks'
