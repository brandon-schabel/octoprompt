import { z } from "zod";
import path from "path";
import { readFile } from "fs/promises";
import { Database } from "bun:sqlite";

import { createOpenRouterProviderService, openRouterProvider } from "../model-providers/providers/open-router-provider";

/**
 * Zod schema describing AI's JSON output structure
 * for a file-change request.
 */
export const FileChangeResponseSchema = z.object({
  updatedContent: z.string(),
  explanation: z.string(),
});

/**
 * Type inferred from our Zod schema. This ensures we
 * have strong TS types matching the AI response.
 */
export type FileChangeResponse = z.infer<typeof FileChangeResponseSchema>;

/**
 * Minimal set of parameters needed for generating a file change
 * from the AI provider.
 */
export interface GenerateFileChangeParams {
  /** Path to the file to be updated. */
  filePath: string;
  /** The user's request/prompt describing desired changes. */
  prompt: string;
  /** An instance of your OpenRouter provider. */
  openRouter?: ReturnType<typeof createOpenRouterProviderService>;
  db: Database;
  /** ID for a new conversation or correlation, if desired. */
  chatId?: string;
  /**
   * Optional model config for the request,
   * if not using a default from your code.
   */
  model?: string;
  temperature?: number;
}


/**
 * Reads the content of a file from disk.
 * Throws an Error if it fails to read.
 */
export async function readLocalFileContent(
  filePath: string
): Promise<string> {
  try {
    const absolutePath = path.resolve(process.cwd(), filePath);
    const content = await readFile(absolutePath, "utf-8");
    return content;
  } catch (error) {
    console.error("Failed to read file:", error);
    throw new Error("Could not read file content");
  }
}

export type GenerateFileChangeOptions = {
  filePath: string;
  prompt: string;
  db: Database;
}

// Generates a file change by simulating diff creation from a prompt and inserting a record using a raw sqlite query
export async function generateFileChange({ filePath, prompt, db }: GenerateFileChangeOptions) {
  // In a real implementation, you might read the file content and generate a diff using an AI model
  // For this example, we'll simulate the original content and the generated diff
  const originalContent = "Original content of the file"; // Dummy content, replace with actual file read if needed
  const suggestedDiff = `Diff for ${filePath}: ${prompt}`;

  const status = "pending";
  const timestamp = Math.floor(Date.now() / 1000);

  // Insert into the file_changes table using a raw sqlite query
  const stmt = db.prepare("INSERT INTO file_changes (file_path, original_content, suggested_diff, status, timestamp) VALUES (?, ?, ?, ?, ?)");
  const result = stmt.run(filePath, originalContent, suggestedDiff, status, timestamp);

  const changeId = result.lastInsertRowid;

  return { changeId, diff: suggestedDiff };
}

// Retrieves a file change record from the database using a raw sqlite query
export async function getFileChange(db: Database, changeId: number) {
  const stmt = db.prepare("SELECT * FROM file_changes WHERE id = ?");
  const change = stmt.get(changeId);
  return change || null;
}

// Confirms a file change by updating its status to 'confirmed' using a raw sqlite query
export async function confirmFileChange(db: Database, changeId: number) {
  const stmt = db.prepare("UPDATE file_changes SET status = ? WHERE id = ?");
  const result = stmt.run("confirmed", changeId);
  return result.changes > 0;
}