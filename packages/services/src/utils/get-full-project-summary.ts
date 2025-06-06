import { ApiError, buildProjectSummary } from '@octoprompt/shared'
import { getProjectFiles } from '@octoprompt/services'

export const getSafeAllProjectFiles = async (projectId: number) => {
  const allFiles = await getProjectFiles(projectId, true)
  if (!allFiles) {
    throw new ApiError(404, 'Project files not found', 'NOT_FOUND')
  }
  if (!allFiles.length) {
    throw new ApiError(404, 'No files found in project', 'NO_PROJECT_FILES')
  }
  return allFiles
}

export const getFullProjectSummary = async (projectId: number) => {
  const allFiles = await getSafeAllProjectFiles(projectId)

  return buildProjectSummary(allFiles)
}
