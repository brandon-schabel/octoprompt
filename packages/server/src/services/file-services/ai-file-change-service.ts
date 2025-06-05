import { z } from 'zod'
import { readFile } from 'fs/promises'
import { generateStructuredData } from '../gen-ai-services'
import { resolvePath } from '@/utils/path-utils'
import { APIProviders } from '@octoprompt/schemas'
import { MEDIUM_MODEL_CONFIG } from '@octoprompt/schemas'
import { projectStorage } from '@octoprompt/storage'
import { type AIFileChangeRecord, AIFileChangeStatusSchema, type AIFileChangeStatus } from '@octoprompt/schemas'
import { ApiError } from '@octoprompt/shared'
import { normalizeToUnixMs } from '@octoprompt/shared'

export const FileChangeResponseSchema = z.object({
  updatedContent: z.string().describe('The complete, updated content of the file after applying the changes.'),
  explanation: z.string().describe('A brief explanation of the changes made.')
})

export type FileChangeResponse = z.infer<typeof FileChangeResponseSchema>

export interface GenerateAIFileChangeParams {
  projectId: number
  filePath: string
  prompt: string
  provider?: APIProviders
  model?: string
  temperature?: number
}

export async function readLocalFileContent(filePath: string): Promise<string> {
  try {
    const resolvedPath = resolvePath(filePath)
    const content = await readFile(resolvedPath, 'utf-8')
    return content
  } catch (error) {
    console.error('Failed to read file:', filePath, error)
    throw new Error(`Could not read file content for: ${filePath}`)
  }
}

async function performAIFileGeneration(
  params: Pick<GenerateAIFileChangeParams, 'filePath' | 'prompt' | 'provider' | 'model' | 'temperature'> & {
    originalContent: string
  }
) {
  const { filePath, prompt, originalContent } = params

  const cfg = MEDIUM_MODEL_CONFIG

  const systemMessage = `
You are an expert coding assistant. You will be given the content of a file and a user request describing changes.
Your task is to:
1. Understand the user's request and apply the necessary modifications to the file content.
2. Output a JSON object containing:
   - "updatedContent": The *entire* file content after applying the changes.
   - "explanation": A concise summary of the modifications you made.
Strictly adhere to the JSON output format. Only output the JSON object.
File Path: ${filePath}
`

  const userPrompt = `
Original File Content:
\`\`\`
${originalContent}
\`\`\`

User Request: ${prompt}
`

  try {
    const aiResponse = await generateStructuredData({
      systemMessage: systemMessage,
      prompt: userPrompt,
      schema: FileChangeResponseSchema,
      options: cfg
    })

    return aiResponse.object
  } catch (error) {
    console.error(`[AIFileChangeService] Failed to generate AI file change for ${filePath}:`, error)
    throw new ApiError(
      500,
      `AI failed to generate changes for ${filePath}: ${error instanceof Error ? error.message : String(error)}`,
      'AI_FILE_CHANGE_GENERATION_FAILED'
    )
  }
}

export type GenerateFileChangeOptions = {
  projectId: number
  filePath: string
  prompt: string
}

export async function generateFileChange(options: GenerateFileChangeOptions): Promise<AIFileChangeRecord> {
  const { projectId, filePath, prompt } = options
  const originalContent = await readLocalFileContent(filePath)

  const aiSuggestion = await performAIFileGeneration({ filePath, prompt, originalContent })

  const now = new Date()
  const changeId = projectStorage.generateId()

  const newRecord: AIFileChangeRecord = {
    id: changeId,
    projectId,
    filePath,
    originalContent,
    suggestedContent: aiSuggestion.updatedContent,
    diff: null,
    explanation: aiSuggestion.explanation,
    prompt,
    status: 'pending' as AIFileChangeStatus,
    created: normalizeToUnixMs(now),
    updated: normalizeToUnixMs(now)
  }

  await projectStorage.saveAIFileChange(projectId, newRecord)

  const retrievedRecord = await projectStorage.getAIFileChangeById(projectId, changeId)
  if (!retrievedRecord) {
    throw new ApiError(
      500,
      `Failed to retrieve newly created file change record with ID: ${changeId}`,
      'FILE_CHANGE_STORE_FAILED'
    )
  }
  return retrievedRecord
}

export async function getFileChange(projectId: number, aiFileChangeId: number): Promise<AIFileChangeRecord | null> {
  const record = await projectStorage.getAIFileChangeById(projectId, aiFileChangeId)
  if (!record) return null
  return record
}

export async function confirmFileChange(
  projectId: number,
  aiFileChangeId: number
): Promise<{ status: AIFileChangeStatus; message: string }> {
  const existingRecord = await projectStorage.getAIFileChangeById(projectId, aiFileChangeId)

  if (!existingRecord) {
    throw new ApiError(
      404,
      `File change with ID ${aiFileChangeId} not found in project ${projectId}.`,
      'AI_FILE_CHANGE_NOT_FOUND'
    )
  }
  if (existingRecord.status !== 'pending') {
    throw new ApiError(
      400,
      `File change with ID ${aiFileChangeId} is already ${existingRecord.status}.`,
      'AI_FILE_CHANGE_INVALID_STATE'
    )
  }

  const now = new Date().toISOString()
  const updatedRecord: AIFileChangeRecord = {
    ...existingRecord,
    status: 'confirmed' as AIFileChangeStatus,
    updated: normalizeToUnixMs(now)
  }

  await projectStorage.saveAIFileChange(projectId, updatedRecord)

  return { status: 'confirmed', message: `File change ${aiFileChangeId} confirmed successfully.` }
}

export async function rejectFileChange(
  projectId: number,
  aiFileChangeId: number
): Promise<{ status: AIFileChangeStatus; message: string }> {
  const existingRecord = await projectStorage.getAIFileChangeById(projectId, aiFileChangeId)

  if (!existingRecord) {
    throw new ApiError(
      404,
      `File change with ID ${aiFileChangeId} not found in project ${projectId}.`,
      'AI_FILE_CHANGE_NOT_FOUND'
    )
  }
  if (existingRecord.status !== 'pending') {
    throw new ApiError(
      400,
      `File change with ID ${aiFileChangeId} is already ${existingRecord.status}.`,
      'AI_FILE_CHANGE_INVALID_STATE'
    )
  }

  const now = new Date().toISOString()
  const updatedRecord: AIFileChangeRecord = {
    ...existingRecord,
    status: 'rejected' as AIFileChangeStatus,
    updated: normalizeToUnixMs(now)
  }

  await projectStorage.saveAIFileChange(projectId, updatedRecord)

  return { status: 'rejected', message: `File change ${aiFileChangeId} rejected.` }
}
