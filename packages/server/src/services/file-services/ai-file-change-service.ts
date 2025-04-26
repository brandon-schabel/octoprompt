import { z } from "zod";
import { readFile } from "fs/promises";
import { Database } from "bun:sqlite";
import { aiProviderInterface } from "../model-providers/providers/ai-provider-interface-services";
import { resolvePath } from "@/utils/path-utils";
import { APIProviders } from "shared/src/schemas/provider-key.schemas";

// Zod schema for the expected AI response
export const FileChangeResponseSchema = z.object({
  updatedContent: z.string().describe("The complete, updated content of the file after applying the changes."),
  explanation: z.string().describe("A brief explanation of the changes made."),
});

export type FileChangeResponse = z.infer<typeof FileChangeResponseSchema>;

// Parameters for the AI generation function
export interface GenerateAIFileChangeParams {
  filePath: string;
  prompt: string; // User's request for changes
  provider?: APIProviders;
  model?: string;
  temperature?: number;
  // Add db if needed for context, but likely not for the AI call itself
}

/**
 * Reads the content of a file from disk.
 */
export async function readLocalFileContent(filePath: string): Promise<string> {
  try {
    const resolvedPath = resolvePath(filePath);
    const content = await readFile(resolvedPath, "utf-8");
    return content;
  } catch (error) {
    console.error("Failed to read file:", filePath, error);
    throw new Error(`Could not read file content for: ${filePath}`);
  }
}

/**
 * Uses an AI model to generate suggested file changes based on a prompt.
 */
export async function generateAIFileChange(
  params: GenerateAIFileChangeParams
): Promise<FileChangeResponse> {
  const { filePath, prompt } = params;

  // 1. Read existing file content
  const originalContent = await readLocalFileContent(filePath);

  // 2. Prepare AI request
  const cfg = MEDIUM_MODEL_CONFIG;
  const provider = params.provider || cfg.provider as APIProviders || 'openai'; // Default provider good at JSON
  const modelId = params.model || cfg.model;
  const temperature = params.temperature ?? cfg.temperature;

  if (!modelId) {
    throw new Error("Model not configured for generate-file-change task.");
  }

  const systemMessage = `
You are an expert coding assistant. You will be given the content of a file and a user request describing changes.
Your task is to:
1. Understand the user's request and apply the necessary modifications to the file content.
2. Output a JSON object containing:
   - "updatedContent": The *entire* file content after applying the changes.
   - "explanation": A concise summary of the modifications you made.
Strictly adhere to the JSON output format. Only output the JSON object.
File Path: ${filePath}
`;

  const userPrompt = `
Original File Content:
\`\`\`
${originalContent}
\`\`\`

User Request: ${prompt}
`;

  try {
    // 3. Call generateStructuredData
    const aiResponse = await aiProviderInterface.generateStructuredData({
      provider: provider,
      systemMessage: systemMessage,
      prompt: userPrompt, // Combine original content and user request in the prompt
      schema: FileChangeResponseSchema,
      options: {
        model: modelId,
        temperature: temperature,
        // Set appropriate maxTokens depending on expected file size + explanation
        maxTokens: 4096, // Example: Adjust as needed
      },
    });

    return aiResponse;

  } catch (error) {
    console.error(`[AIFileChangeService] Failed to generate AI file change for ${filePath}:`, error);
    throw new Error(`AI failed to generate changes for ${filePath}: ${error instanceof Error ? error.message : String(error)}`);
  }
}


// --- Database interaction functions (remain largely the same) ---

export type GenerateFileChangeOptions = {
  filePath: string;
  prompt: string; // The user's original prompt
  db: Database;
}

// Define the structure of the file_changes table row
export interface FileChangeDBRecord {
  id: number;
  file_path: string;
  original_content: string;
  suggested_diff: string | null; // Explanation stored here
  status: 'pending' | 'confirmed';
  timestamp: number;
  prompt: string | null;
  suggested_content: string | null;
}

/**
 * Generates and records a file change suggestion based on user prompt.
 * This is the main function called by the routes.
 */
export async function generateFileChange({ filePath, prompt, db }: GenerateFileChangeOptions) {
  // 1. Generate the change suggestion using AI
  const aiSuggestion = await generateAIFileChange({ filePath, prompt });

  // 2. Prepare data for DB insertion
  const originalContent = await readLocalFileContent(filePath);
  const status = "pending";
  const timestamp = Math.floor(Date.now() / 1000);
  // Store explanation, original content. suggestedContent could also be stored if needed.
  const suggestedDiffOrExplanation = aiSuggestion.explanation;
  // Store the prompt that generated this change
  const storedPrompt = prompt;

  // 3. Insert into the file_changes table
  const stmt = db.prepare(
    "INSERT INTO file_changes (file_path, original_content, suggested_diff, status, timestamp, prompt, suggested_content) VALUES (?, ?, ?, ?, ?, ?, ?)"
  );
  const result = stmt.run(
    filePath,
    originalContent,
    suggestedDiffOrExplanation,
    status,
    timestamp,
    storedPrompt,
    aiSuggestion.updatedContent // Store the suggested content
  );

  const changeId = result.lastInsertRowid as number;

  // 4. Fetch and return the newly created record
  const newRecord = await getFileChange(db, changeId);
  if (!newRecord) {
    // Should not happen, but handle defensively
    throw new Error(`Failed to retrieve newly created file change record with ID: ${changeId}`);
  }
  return newRecord;
}

/**
 * Retrieves a file change by ID from the database.
 * Returns the file change information or null if not found.
 */
export async function getFileChange(db: Database, changeId: number): Promise<FileChangeDBRecord | null> {
  const stmt = db.prepare("SELECT * FROM file_changes WHERE id = ?");
  const result = stmt.get(changeId) as FileChangeDBRecord | undefined;
  return result || null;
}

/**
 * Confirms a file change by updating its status in the database.
 * Returns true if the update was successful.
 */
export async function confirmFileChange(db: Database, changeId: number): Promise<{ status: string; message: string }> {
  // Check if the record exists and is pending before confirming
  const existing = await getFileChange(db, changeId);
  if (!existing) {
    throw Object.assign(new Error(`File change with ID ${changeId} not found.`), { code: 'NOT_FOUND' });
  }
  if (existing.status !== 'pending') {
    throw Object.assign(new Error(`File change with ID ${changeId} is already ${existing.status}.`), { code: 'INVALID_STATE' });
  }

  const stmt = db.prepare("UPDATE file_changes SET status = 'confirmed' WHERE id = ?");
  const result = stmt.run(changeId);

  if (result.changes > 0) {
    return { status: "confirmed", message: `File change ${changeId} confirmed successfully.` };
  } else {
    // This case might indicate a race condition or unexpected DB state
    throw new Error(`Failed to confirm file change ${changeId}. No rows updated.`);
  }
}