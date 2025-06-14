export {
  useGetProjects,
  useGetProject,
  useGetProjectFiles,
  useGetProjectFilesWithoutContent,
  useGetProjectSummary,
  useCreateProject,
  useUpdateProject,
  useDeleteProject,
  useSyncProject,
  useRefreshProject,
  useSuggestFiles,
  useOptimizeUserInput,
  useInvalidateProjects,
  useGetFileVersions,
  useGetFileVersion,
  useRevertFileToVersion,
  useUpdateFileContent
} from '../api-hooks'

// Type re-exports for backward compatibility
export type {
  CreateProjectBody as CreateProjectInput,
  UpdateProjectBody as UpdateProjectInput
} from '@octoprompt/schemas'

// Legacy aliases for hooks that had different names
export { useSuggestFiles as useFindSuggestedFiles } from '../api-hooks'
