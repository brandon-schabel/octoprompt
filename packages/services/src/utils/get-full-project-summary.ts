import { ApiError, buildProjectSummary, promptsMap, truncateForSummarization } from '@octoprompt/shared'
import { getProjectFiles } from '@octoprompt/services'
import { generateSingleText } from '../gen-ai-services'
import { LOW_MODEL_CONFIG } from '@octoprompt/schemas'

export const getSafeAllProjectFiles = async (projectId: number) => {
  const allFiles = await getProjectFiles(projectId)
  if (!allFiles) {
    throw new ApiError(404, 'Project files not found', 'NOT_FOUND')
  }
  if (!allFiles.length) {
    throw new ApiError(404, 'No files found in project', 'NO_PROJECT_FILES')
  }
  return allFiles
}

export const getFullProjectSummary = async (projectId: number) => {
  // Get all project files for project summary
  const latestFiles = await getSafeAllProjectFiles(projectId)

  return buildProjectSummary(latestFiles)
}

export const getCompactProjectSummary = async (projectId: number) => {
  // Get the full project summary first
  const fullSummary = await getFullProjectSummary(projectId)

  // Ensure the summary doesn't exceed our character limits
  const truncationResult = truncateForSummarization(fullSummary)

  if (truncationResult.wasTruncated) {
    console.log(
      `[CompactProjectSummary] Project summary truncated for AI processing:\n` +
        `  Project ID: ${projectId}\n` +
        `  Original length: ${truncationResult.originalLength.toLocaleString()} chars\n` +
        `  Truncated to: ${truncationResult.content.length.toLocaleString()} chars\n` +
        `  Reduction: ${Math.round((1 - truncationResult.content.length / truncationResult.originalLength) * 100)}%`
    )
  }

  try {
    // Use AI to create a compact version
    const compactSummary = await generateSingleText({
      prompt: truncationResult.content,
      systemMessage: promptsMap.compactProjectSummary,
      options: LOW_MODEL_CONFIG
    })

    return compactSummary.trim()
  } catch (error) {
    // If AI service fails, provide a truncated version of the full summary as fallback
    console.error(`[CompactProjectSummary] AI service failed for project ${projectId}:`, error)
    
    // Return a manually truncated version with key information
    const lines = truncationResult.content.split('\n')
    const fallbackSummary = lines
      .slice(0, Math.min(50, lines.length)) // Take first 50 lines
      .join('\n') + 
      '\n\n[Note: AI summary service temporarily unavailable. Showing truncated file listing.]'
    
    return fallbackSummary
  }
}
