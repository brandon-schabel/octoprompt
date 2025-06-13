import { ApiError, buildProjectSummary } from '@octoprompt/shared'
import { getProjectFiles } from '@octoprompt/services'

export const getSafeAllProjectFiles = async (projectId: number, includeAllVersions: boolean = false) => {
  const allFiles = await getProjectFiles(projectId, includeAllVersions)
  if (!allFiles) {
    throw new ApiError(404, 'Project files not found', 'NOT_FOUND')
  }
  if (!allFiles.length) {
    throw new ApiError(404, 'No files found in project', 'NO_PROJECT_FILES')
  }
  return allFiles
}

export const getFullProjectSummary = async (projectId: number) => {
  // Only get latest versions for project summary
  const latestFiles = await getSafeAllProjectFiles(projectId, false)

  return buildProjectSummary(latestFiles)
}
