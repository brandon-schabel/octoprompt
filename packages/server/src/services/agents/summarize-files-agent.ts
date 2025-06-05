

import { z } from 'zod'
import { ProjectFile } from '@octoprompt/schemas'
import { LOW_MODEL_CONFIG, APIProviders } from '@octoprompt/schemas'
import { generateStructuredData } from '../gen-ai-services'
import { projectStorage } from '@octoprompt/storage'
import { ApiError } from '@octoprompt/shared'
import { getProjectFiles } from '../project-service'

/**
 * Summarizes a single file using AI and updates the file record with the summary.
 * 
 * @param file - The ProjectFile to summarize
 * @returns The updated ProjectFile with summary, or null if the file is empty
 */
export async function summarizeSingleFile(file: ProjectFile): Promise<ProjectFile | null> {
  const fileContent = file.content || ''

  if (!fileContent.trim()) {
    console.warn(
      `[SummarizeSingleFile] File ${file.path} (ID: ${file.id}) in project ${file.projectId} is empty, skipping summarization.`
    )
    return null
  }

  const systemPrompt = `
  ## You are a coding assistant specializing in concise code summaries.
  1. Provide a short overview of what the file does.
  2. Outline main exports (functions/classes).
  3. Respond with only the textual summary, minimal fluff, no suggestions or code blocks.
  `

  const cfg = LOW_MODEL_CONFIG
  const provider = (cfg.provider as APIProviders) || 'openrouter'
  const modelId = cfg.model

  if (!modelId) {
    console.error(`[SummarizeSingleFile] Model not configured for summarize-file task for file ${file.path}.`)
    throw new ApiError(
      500,
      `AI Model not configured for summarize-file task (file ${file.path}).`,
      'AI_MODEL_NOT_CONFIGURED',
      { projectId: file.projectId, fileId: file.id }
    )
  }

  try {
    const result = await generateStructuredData({
      prompt: fileContent,
      options: cfg,
      schema: z.object({
        summary: z.string()
      }),
      systemMessage: systemPrompt
    })

    const summary = result.object.summary
    const trimmedSummary = summary.trim()

    const updatedFile = await projectStorage.updateProjectFile(file.projectId, file.id, {
      summary: trimmedSummary,
      summaryLastUpdated: Date.now()
    })

    console.log(
      `[SummarizeSingleFile] Successfully summarized and updated file: ${file.path} in project ${file.projectId}`
    )
    return updatedFile
  } catch (error) {
    if (error instanceof ApiError) throw error
    throw new ApiError(
      500,
      `Failed to summarize file ${file.path} in project ${file.projectId}. Reason: ${error instanceof Error ? error.message : String(error)}`,
      'FILE_SUMMARIZE_FAILED',
      { originalError: error, projectId: file.projectId, fileId: file.id }
    )
  }
}

/**
 * Summarizes multiple files in a project by their IDs.
 * 
 * @param projectId - The ID of the project containing the files
 * @param fileIdsToSummarize - Array of file IDs to summarize
 * @returns Object containing counts of included/skipped files and updated file records
 */
export async function summarizeFiles(
  projectId: number,
  fileIdsToSummarize: number[]
): Promise<{ included: number; skipped: number; updatedFiles: ProjectFile[] }> {
  const allProjectFiles = await getProjectFiles(projectId, false) // Only latest versions

  if (!allProjectFiles) {
    console.warn(`[BatchSummarize] No files found for project ${projectId}.`)
    return { included: 0, skipped: 0, updatedFiles: [] }
  }

  const filesToProcess = allProjectFiles.filter((f) => fileIdsToSummarize.includes(f.id))

  const updatedFilesResult: ProjectFile[] = []
  let summarizedCount = 0
  let skippedByEmptyCount = 0
  let errorCount = 0

  for (const file of filesToProcess) {
    try {
      const summarizedFile = await summarizeSingleFile(file)
      if (summarizedFile) {
        updatedFilesResult.push(summarizedFile)
        summarizedCount++
      } else {
        skippedByEmptyCount++
      }
    } catch (error) {
      console.error(
        `[BatchSummarize] Error processing file ${file.path} (ID: ${file.id}) in project ${projectId} for summarization: ${error instanceof Error ? error.message : String(error)}`,
        error instanceof ApiError ? error.details : ''
      )
      errorCount++
    }
  }

  const totalProcessed = filesToProcess.length
  const finalSkippedCount = skippedByEmptyCount + errorCount

  console.log(
    `[BatchSummarize] File summarization batch complete for project ${projectId}. ` +
      `Total to process: ${totalProcessed}, ` +
      `Successfully summarized: ${summarizedCount}, ` +
      `Skipped (empty): ${skippedByEmptyCount}, ` +
      `Skipped (errors): ${errorCount}, ` +
      `Total not summarized: ${finalSkippedCount}`
  )

  return {
    included: summarizedCount,
    skipped: finalSkippedCount,
    updatedFiles: updatedFilesResult
  }
}