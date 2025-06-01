import { ApiError } from '@octoprompt/shared'
import { ProjectFile } from '@octoprompt/schemas'
import { getProjectById, getProjectFiles } from '@/services/project-service'
import { buildCombinedFileSummariesXml } from 'shared/src/utils/summary-formatter'

const buildProjectSummary = (includedFiles: ProjectFile[]) => {
  // Build the combined summaries using your summary-formatter
  return buildCombinedFileSummariesXml(includedFiles, {
    includeEmptySummaries: true
  })
}

export const getFullProjectSummary = async (projectId: number) => {
  const project = await getProjectById(projectId)
  if (!project) {
    throw new ApiError(404, 'Project not found', 'NOT_FOUND')
  }

  // Fetch all file summaries from the database
  const allFiles = (await getProjectFiles(projectId)) || []
  if (!allFiles.length) {
    return {
      success: false,
      message: 'No summaries available. Please summarize files first.'
    }
  }

  // Retrieve global state to get ignore patterns (or other filtering preferences)
  // const ignorePatterns = globalState.settings.summarizationIgnorePatterns || [];
  // const allowPatterns = globalState.settings.summarizationAllowPatterns || [];

  // Filter out files that match ignore patterns (unless a file also matches an allow pattern, if applicable)
  // The same logic your summarization page uses can be applied here:
  function isIncluded(file: ProjectFile): boolean {
    // If any ignore pattern matches, we skip—unless an allow pattern overrides it.
    // const matchesIgnore = matchesAnyPattern(file.path, ignorePatterns);
    // if (matchesIgnore && !matchesAnyPattern(file.path, allowPatterns)) {
    //     return false;
    // }
    return true
  }

  // Filter down to the "included" files
  const includedFiles = allFiles.filter(isIncluded)

  return buildProjectSummary(includedFiles)
}
