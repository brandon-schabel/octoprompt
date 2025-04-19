import { z } from "zod";
import path from "path";
import { readFile } from "fs/promises";
import { Database } from "bun:sqlite";
// Import the refactored unified provider
import { unifiedProvider } from "../model-providers/providers/unified-provider-service";
import { resolvePath } from "@/utils/path-utils";
import { APIProviders, DEFAULT_MODEL_CONFIGS } from "shared"; // Import necessary types

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
  const cfg = DEFAULT_MODEL_CONFIGS['generate-file-change'] || DEFAULT_MODEL_CONFIGS['generate-structured-output']; // Use specific or fallback config
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
    const aiResponse = await unifiedProvider.generateStructuredData({
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

/**
 * Generates and records a file change suggestion based on user prompt.
 * This is the main function called by the routes.
 */
export async function generateFileChange({ filePath, prompt, db }: GenerateFileChangeOptions) {
  // 1. Generate the change suggestion using AI
  // Consider making provider/model configurable here if needed
  const aiSuggestion = await generateAIFileChange({ filePath, prompt });

  // 2. Extract necessary info for DB (e.g., explanation, maybe calculate diff if needed)
  // For simplicity, storing explanation. Diff calculation is complex.
  // You might store originalContent and aiSuggestion.updatedContent instead of calculating a diff.
  const originalContent = await readLocalFileContent(filePath); // Read again or pass from generateAIFileChange

  const status = "pending"; // Initial status
  const timestamp = Math.floor(Date.now() / 1000);

  // 3. Insert into the file_changes table
  // Adapt the table schema if you want to store updatedContent or explanation
  // Assuming schema: (file_path, original_content, suggested_diff_or_explanation, status, timestamp)
  const stmt = db.prepare("INSERT INTO file_changes (file_path, original_content, suggested_diff, status, timestamp) VALUES (?, ?, ?, ?, ?)");
  // Storing explanation in suggested_diff column for this example
  const result = stmt.run(filePath, originalContent, aiSuggestion.explanation, status, timestamp);

  const changeId = result.lastInsertRowid;

  // Return ID and maybe the full AI response for further use
  return { changeId, suggestion: aiSuggestion };
}

/**
 * Retrieves a file change by ID from the database.
 * Returns the file change information or null if not found.
 */
export async function getFileChange(db: Database, changeId: number) {
  const stmt = db.prepare("SELECT * FROM file_changes WHERE id = ?");
  const result = stmt.get(changeId);
  return result || null; // Return null instead of undefined when not found
}

/**
 * Confirms a file change by updating its status in the database.
 * Returns true if the update was successful.
 */
export async function confirmFileChange(db: Database, changeId: number) {
  const stmt = db.prepare("UPDATE file_changes SET status = 'confirmed' WHERE id = ?");
  const result = stmt.run(changeId);
  
  // Return a boolean indicating success based on changes
  return result.changes > 0;
}