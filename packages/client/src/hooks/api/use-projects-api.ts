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
  useOptimizeUserInput,
  useInvalidateProjects,
  useUpdateFileContent,
  useSuggestFiles
} from '../api-hooks'

// Type re-exports for backward compatibility
export type {
  CreateProjectBody as CreateProjectInput,
  UpdateProjectBody as UpdateProjectInput
} from '@octoprompt/schemas'
