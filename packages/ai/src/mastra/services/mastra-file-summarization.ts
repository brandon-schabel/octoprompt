// Recent changes:
// 1. Created Mastra-based file summarization service
// 2. Replaces old summarize-files-agent.ts with Mastra agents
// 3. Uses structured output for consistent summarization
// 4. Integrates with existing project storage layer
// 5. Provides both single file and batch summarization

import { Agent } from '@mastra/core'
import { openai } from '@ai-sdk/openai'
import { z } from 'zod'
import { readProjectFileTool } from '../tools/file-tools'
import { LOW_MODEL_CONFIG } from '@octoprompt/schemas'
import { projectStorage } from '@octoprompt/storage'
import { getProjectFiles } from '@octoprompt/services'
import { ApiError } from '@octoprompt/shared'
import type { ProjectFile } from '@octoprompt/schemas'

// Schema for file summary output
const FileSummaryOutputSchema = z.object({
  summary: z.string().describe('Concise summary of the file\'s purpose and main functionality'),
  mainExports: z.array(z.string()).describe('List of main functions, classes, or exports'),
  fileType: z.enum(['component', 'service', 'utility', 'config', 'test', 'type', 'other']).describe('Type of file'),
  keyFeatures: z.array(z.string()).describe('Key features or capabilities provided by this file')
})

// Create the file summarization agent
const fileSummarizationAgent = new Agent({
  name: 'file-summarizer',
  description: 'Analyzes and summarizes code files providing concise overviews',
  model: openai(LOW_MODEL_CONFIG.model || 'gpt-4o-mini'),
  tools: {
    readProjectFileTool
  }
})

/**
 * Summarizes a single file using Mastra and updates the file record with the summary.
 */
export async function summarizeFileWithMastra(
  projectId: number, 
  fileId: number, 
  focusArea?: string
): Promise<{
  summary: string
  updatedFile: ProjectFile
}> {
  try {
    // Get the file first
    const file = await projectStorage.readProjectFile(projectId, fileId)
    if (!file) {
      throw new ApiError(404, `File not found: ID ${fileId} in project ${projectId}`, 'FILE_NOT_FOUND')
    }

    const fileContent = file.content || ''
    if (!fileContent.trim()) {
      throw new ApiError(400, `File ${file.path} is empty and cannot be summarized`, 'EMPTY_FILE')
    }

    const systemPrompt = `You are a coding assistant specializing in concise code summaries.
Analyze the provided code file and provide:
1. A short overview of what the file does
2. Main exports (functions/classes/components)
3. File type classification
4. Key features or capabilities

${focusArea ? `Focus specifically on: ${focusArea}` : ''}

Keep the summary concise and actionable.`

    const userPrompt = `Please analyze this file: ${file.path}

File content:
${fileContent}

Provide a structured summary with the main purpose, exports, and key features.`

    // Use the agent to generate structured summary
    const result = await fileSummarizationAgent.generate(
      [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt }
      ],
      {
        output: 'object',
        schema: FileSummaryOutputSchema
      }
    )

    const summaryData = result.object
    
    // Create a comprehensive summary text
    const summaryText = `${summaryData.summary}

Main exports: ${summaryData.mainExports.join(', ')}
File type: ${summaryData.fileType}
Key features: ${summaryData.keyFeatures.join(', ')}`

    // Update the file with the summary
    const updatedFile = await projectStorage.updateProjectFile(projectId, fileId, {
      summary: summaryText,
      summaryLastUpdated: Date.now()
    })

    console.log(`[MastraFileSummarization] Successfully summarized file: ${file.path} in project ${projectId}`)
    
    return {
      summary: summaryText,
      updatedFile
    }
  } catch (error) {
    if (error instanceof ApiError) throw error
    console.error(`[MastraFileSummarization] Error summarizing file ${fileId}:`, error)
    throw new ApiError(
      500,
      `Failed to summarize file ${fileId} in project ${projectId}: ${error instanceof Error ? error.message : String(error)}`,
      'MASTRA_FILE_SUMMARIZE_FAILED',
      { originalError: error, projectId, fileId }
    )
  }
}

/**
 * Batch summarizes multiple files in a project using Mastra.
 */
export async function batchSummarizeWithMastra(
  projectId: number,
  fileIds: number[]
): Promise<{
  included: number
  skipped: number
  summaries: Array<{
    fileId: number
    path: string
    summary: string
  }>
}> {
  const allProjectFiles = await getProjectFiles(projectId, false)
  
  if (!allProjectFiles || allProjectFiles.length === 0) {
    console.warn(`[MastraBatchSummarize] No files found for project ${projectId}`)
    return { included: 0, skipped: 0, summaries: [] }
  }

  const filesToProcess = allProjectFiles.filter((f) => fileIds.includes(f.id))
  const summaries: Array<{ fileId: number; path: string; summary: string }> = []
  let successCount = 0
  let skippedCount = 0

  for (const file of filesToProcess) {
    try {
      const result = await summarizeFileWithMastra(projectId, file.id)
      summaries.push({
        fileId: file.id,
        path: file.path,
        summary: result.summary
      })
      successCount++
    } catch (error) {
      console.error(
        `[MastraBatchSummarize] Error processing file ${file.path} (ID: ${file.id}):`,
        error instanceof Error ? error.message : String(error)
      )
      skippedCount++
    }
  }

  console.log(
    `[MastraBatchSummarize] Batch complete for project ${projectId}. ` +
    `Processed: ${filesToProcess.length}, Success: ${successCount}, Skipped: ${skippedCount}`
  )

  return {
    included: successCount,
    skipped: skippedCount,
    summaries
  }
}