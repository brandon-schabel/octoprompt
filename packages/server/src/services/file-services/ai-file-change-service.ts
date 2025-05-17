import { z } from 'zod'
import { readFile } from 'fs/promises'
import { Database } from 'bun:sqlite'
import { generateStructuredData } from '../gen-ai-services'
import { resolvePath } from '@/utils/path-utils'
import { APIProviders } from 'shared/src/schemas/provider-key.schemas'
import { MEDIUM_MODEL_CONFIG } from 'shared/src/constants/model-default-configs'

export const FileChangeResponseSchema = z.object({
  updatedContent: z.string().describe('The complete, updated content of the file after applying the changes.'),
  explanation: z.string().describe('A brief explanation of the changes made.')
})

export type FileChangeResponse = z.infer<typeof FileChangeResponseSchema>

export interface GenerateAIFileChangeParams {
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

export async function generateAIFileChange(params: GenerateAIFileChangeParams) {
  const { filePath, prompt } = params
  const originalContent = await readLocalFileContent(filePath)

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

    return aiResponse
  } catch (error) {
    console.error(`[AIFileChangeService] Failed to generate AI file change for ${filePath}:`, error)
    throw new Error(
      `AI failed to generate changes for ${filePath}: ${error instanceof Error ? error.message : String(error)}`
    )
  }
}

export type GenerateFileChangeOptions = {
  filePath: string
  prompt: string
  db: Database
}

export interface FileChangeDBRecord {
  id: number
  file_path: string
  original_content: string
  suggested_diff: string | null
  status: 'pending' | 'confirmed'
  timestamp: number
  prompt: string | null
  suggested_content: string | null
}

export async function generateFileChange({ filePath, prompt, db }: GenerateFileChangeOptions) {
  const aiSuggestion = await generateAIFileChange({ filePath, prompt })

  const originalContent = await readLocalFileContent(filePath)
  const status = 'pending'
  const timestamp = Math.floor(Date.now() / 1000)
  const suggestedDiffOrExplanation = aiSuggestion.object.explanation

  const stmt = db.prepare(
    'INSERT INTO file_changes (file_path, original_content, suggested_diff, status, timestamp, prompt, suggested_content) VALUES (?, ?, ?, ?, ?, ?, ?)'
  )
  const result = stmt.run(
    filePath,
    originalContent,
    suggestedDiffOrExplanation,
    status,
    timestamp,
    prompt,
    aiSuggestion.object.updatedContent // Store the suggested content
  )

  const changeId = result.lastInsertRowid as number

  const newRecord = await getFileChange(db, changeId)
  if (!newRecord) {
    // Should not happen, but handle defensively
    throw new Error(`Failed to retrieve newly created file change record with ID: ${changeId}`)
  }
  return newRecord
}

export async function getFileChange(db: Database, changeId: number): Promise<FileChangeDBRecord | null> {
  const stmt = db.prepare('SELECT * FROM file_changes WHERE id = ?')
  const result = stmt.get(changeId) as FileChangeDBRecord | undefined
  return result || null
}

// Confirms a file change by updating its status in the database.
// Returns true if the update was successful.
export async function confirmFileChange(db: Database, changeId: number): Promise<{ status: string; message: string }> {
  const existing = await getFileChange(db, changeId)
  if (!existing) {
    throw Object.assign(new Error(`File change with ID ${changeId} not found.`), { code: 'NOT_FOUND' })
  }
  if (existing.status !== 'pending') {
    throw Object.assign(new Error(`File change with ID ${changeId} is already ${existing.status}.`), {
      code: 'INVALID_STATE'
    })
  }

  const stmt = db.prepare("UPDATE file_changes SET status = 'confirmed' WHERE id = ?")
  const result = stmt.run(changeId)

  if (result.changes > 0) {
    return { status: 'confirmed', message: `File change ${changeId} confirmed successfully.` }
  } else {
    throw new Error(`Failed to confirm file change ${changeId}. No rows updated.`)
  }
}
