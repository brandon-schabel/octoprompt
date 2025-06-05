import { executeCodeChangeWorkflow } from '../workflows/mastra-code-change-workflow'
import { projectStorage } from '@octoprompt/storage'
import { getProjectById, getProjectFiles } from '../../../server/src/services/project-service'
import { ApiError, buildProjectSummary } from '@octoprompt/shared'
import { normalizeToUnixMs } from '@octoprompt/shared'
import type { ProjectFile } from '@octoprompt/schemas'

export interface MastraCoderRequest {
  projectId: number
  userRequest: string
  selectedFileIds: number[]
}

export interface MastraCoderResult {
  success: boolean
  agentJobId: number
  updatedFiles: Array<{
    id: number
    path: string
    content: string
    explanation: string
  }>
  summary: string
  error?: string
}

/**
 * Main service function that replaces the complex orchestrator
 * This is MUCH simpler than the original agent-coder-service.ts
 */
export async function executeMastraCodeChange(request: MastraCoderRequest): Promise<MastraCoderResult> {
  const { projectId, userRequest, selectedFileIds } = request

  // Generate a simple job ID
  const agentJobId = normalizeToUnixMs(new Date())

  try {
    // Validate inputs
    const project = await getProjectById(projectId)
    if (!project) {
      throw new ApiError(404, `Project not found: ${projectId}`, 'PROJECT_NOT_FOUND')
    }

    if (!userRequest.trim()) {
      throw new ApiError(400, 'User request cannot be empty', 'EMPTY_REQUEST')
    }

    if (selectedFileIds.length === 0) {
      throw new ApiError(400, 'At least one file must be selected', 'NO_FILES_SELECTED')
    }

    // Validate that selected files exist
    const projectFiles = await getProjectFiles(projectId, false)
    if (!projectFiles) {
      throw new ApiError(404, 'No files found in project', 'NO_PROJECT_FILES')
    }

    const validFileIds = projectFiles.map((f) => f.id)
    const invalidFileIds = selectedFileIds.filter((id) => !validFileIds.includes(id))

    if (invalidFileIds.length > 0) {
      throw new ApiError(400, `Invalid file IDs: ${invalidFileIds.join(', ')}`, 'INVALID_FILE_IDS')
    }

    console.log(`[MastraCoderService] Starting job ${agentJobId} for project ${projectId}`)
    console.log(`[MastraCoderService] Request: ${userRequest.substring(0, 100)}...`)
    console.log(`[MastraCoderService] Selected files: ${selectedFileIds.length}`)

    // Execute the workflow - this replaces hundreds of lines of orchestration!
    const workflowResult = await executeCodeChangeWorkflow({
      projectId,
      userRequest,
      selectedFileIds,
      agentJobId
    })

    console.log(`[MastraCoderService] Job ${agentJobId} completed: ${workflowResult.success ? 'SUCCESS' : 'FAILED'}`)

    return {
      success: workflowResult.success,
      agentJobId,
      updatedFiles: workflowResult.updatedFiles,
      summary: workflowResult.summary,
      error: workflowResult.error
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error)
    console.error(`[MastraCoderService] Job ${agentJobId} failed:`, errorMessage)

    if (error instanceof ApiError) {
      throw error
    }

    throw new ApiError(500, `Code generation failed: ${errorMessage}`, 'MASTRA_CODER_FAILED', {
      agentJobId,
      originalError: errorMessage
    })
  }
}

/**
 * Simplified file summarization using Mastra
 * This replaces the complex summarization logic
 */
export async function summarizeFileWithMastra(
  projectId: number,
  fileId: number,
  focusArea?: string
): Promise<{
  summary: string
  updatedFile: any
}> {
  try {
    // Read the file
    const file = await projectStorage.readProjectFile(projectId, fileId)
    if (!file) {
      throw new ApiError(404, `File not found: ${fileId}`, 'FILE_NOT_FOUND')
    }

    if (!file.content?.trim()) {
      throw new ApiError(400, 'File is empty', 'EMPTY_FILE')
    }

    // Use the analyzeCodeTool from our existing tools
    const { analyzeCodeTool } = await import('@/mastra/tools/file-tools')

    const analysisResult = await analyzeCodeTool.execute({
      context: {
        content: file.content,
        filePath: file.path,
        analysisType: 'all'
      },
      runtimeContext: new Map() as any
    })

    if (analysisResult.error) {
      throw new Error(analysisResult.error)
    }

    // Create a focused summary based on the analysis
    let summary = analysisResult.summary

    if (focusArea) {
      summary += ` Focus area: ${focusArea}.`
    }

    if (analysisResult.structure) {
      const { functions, classes, interfaces } = analysisResult.structure
      summary += ` Contains ${functions.length} functions, ${classes.length} classes, ${interfaces.length} interfaces.`
    }

    if (analysisResult.dependencies) {
      const { externalDeps } = analysisResult.dependencies
      if (externalDeps.length > 0) {
        summary += ` External dependencies: ${externalDeps.slice(0, 3).join(', ')}${externalDeps.length > 3 ? '...' : ''}.`
      }
    }

    // Update the file with the summary
    const updatedFile = await projectStorage.updateProjectFile(projectId, fileId, {
      summary: summary.trim(),
      summaryLastUpdated: normalizeToUnixMs(new Date())
    })

    console.log(`[MastraCoderService] Summarized file ${file.path} (${summary.length} chars)`)

    return {
      summary: summary.trim(),
      updatedFile
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error)
    console.error(`[MastraCoderService] Summarization failed for file ${fileId}:`, errorMessage)

    if (error instanceof ApiError) {
      throw error
    }

    throw new ApiError(500, `File summarization failed: ${errorMessage}`, 'MASTRA_SUMMARIZE_FAILED', {
      fileId,
      originalError: errorMessage
    })
  }
}

/**
 * Batch summarization using Mastra
 * Much simpler than the original batch processing
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
  const summaries = []
  let included = 0
  let skipped = 0

  for (const fileId of fileIds) {
    try {
      const result = await summarizeFileWithMastra(projectId, fileId)
      summaries.push({
        fileId,
        path: result.updatedFile.path,
        summary: result.summary
      })
      included++
    } catch (error) {
      console.warn(
        `[MastraCoderService] Skipped file ${fileId}:`,
        error instanceof Error ? error.message : String(error)
      )
      skipped++
    }
  }

  return { included, skipped, summaries }
}

/**
 * Simple context builder for the workflow
 * This replaces complex context gathering logic
 */
export async function buildSimpleProjectContext(
  projectId: number,
  selectedFileIds: number[],
  projectFiles: ProjectFile[]
): Promise<{
  projectSummary: string
  selectedFiles: Array<{
    id: number
    path: string
    content: string
  }>
}> {
  // const { getFullProjectSummary } = await import('@/utils/get-full-project-summary')

  // Get project summary
  const projectSummaryResult = await buildProjectSummary(projectFiles)
  const projectSummary = projectSummaryResult

  // Get selected files
  const selectedFiles = []
  for (const fileId of selectedFileIds) {
    const file = await projectStorage.readProjectFile(projectId, fileId)
    if (file && file.content) {
      selectedFiles.push({
        id: file.id,
        path: file.path,
        content: file.content
      })
    }
  }

  return {
    projectSummary,
    selectedFiles
  }
}
