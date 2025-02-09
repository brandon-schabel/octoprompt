// packages/server/src/services/file-services/ai-file-change-service.ts

import { z } from "zod";
import path from "path";
import { readFile } from "fs/promises";
import { eq } from "drizzle-orm";

import { fetchStructuredOutput } from "@/utils/structured-output-fetcher";
import { fileChanges } from "shared/schema";
import { OpenRouterProviderService } from "../model-providers/providers/open-router-provider";
import { AppDB } from "@db";

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
  openRouter?: OpenRouterProviderService;
  /** The Drizzle DB connection. */
  db: AppDB;
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
 * High-level function that:
 * 1) Reads the file's current content
 * 2) Calls the AI to generate updated content
 * 3) Stores the suggestion in the DB as a "pending" file change
 * 4) Returns { changeId, diff } for further use
 */
export async function generateFileChange(
  {
    filePath,
    prompt,
    openRouter = new OpenRouterProviderService(),
    db,
    chatId = `file-change-${Date.now()}`, // fallback
    model = "openai/gpt-4",
    temperature = 0.7,
  }: {
    /** Path to the file to be updated. */
    filePath: string;
    /** The user's request/prompt describing desired changes. */
    prompt: string;
    /** An instance of your OpenRouter provider. */
    openRouter?: OpenRouterProviderService;
    /** The Drizzle DB connection. */
    db: AppDB;
    /** ID for a new conversation or correlation, if desired. */
    chatId?: string;
    /**
     * Optional model config for the request,
     * if not using a default from your code.
     */
    model?: string;
    temperature?: number;
  }


): Promise<{ changeId: number; diff: string }> {

  // 1) Read the current file content from disk
  const originalContent = await Bun.file(filePath).text();

  // 2) Build system + user messages
  const systemMessage = `You are an AI dev assistant that modifies code files based on user requests.
Given the current file content and a user's request, return ONLY the complete updated file content.
Do not include any extraneous commentary outside the JSON.`;

  const userMessage = `Current file content:
\`\`\`
${originalContent}
\`\`\`

User request:
${prompt}

Please return a JSON object with this shape:
{
  "updatedContent": "the updated file content",
  "explanation": "brief explanation of the changes"
}`;

  // 3) Ask the AI for a structured result
  const structured: FileChangeResponse = await fetchStructuredOutput(openRouter, {
    userMessage,
    systemMessage,
    zodSchema: FileChangeResponseSchema,
    schemaName: "FileChangeResponse",
    model,
    temperature,
    chatId,
  });

  // 4) Insert a record of this suggestion into the DB
  const [row] = await db
    .insert(fileChanges as any)
    .values({
      filePath,
      originalContent,
      suggestedDiff: structured.updatedContent,
      status: "pending",
      timestamp: Date.now(),
    })
    .returning({ id: fileChanges.id as any });

  // 5) Return the info needed by the caller
  return {
    changeId: row.id as number,
    diff: structured.updatedContent,
  };
}

/**
 * Confirms a previously generated file change:
 * - Retrieves the pending record
 * - Writes the updated content to disk
 * - Marks the DB record as "confirmed"
 */
export async function confirmFileChange(
  db: AppDB,
  changeId: number
): Promise<boolean> {
  // 1) Fetch the file change record (explicitly type the selected row)
  const [record] = await db
    .select()
    .from(fileChanges as any) // cast to any due to module mismatch issues
    .where(eq(fileChanges.id as any, changeId)) // cast fileChanges.id to any within eq
    .limit(1) as Array<{ filePath: string; suggestedDiff: string }>;

  if (!record) {
    // No record => can't confirm
    return false;
  }

  // 2) Write updated content to disk
  await Bun.write(record.filePath, record.suggestedDiff);

  // 3) Update DB status
  await db
    .update(fileChanges as any) // cast to any here as well
    .set({ status: "confirmed" })
    .where(eq(fileChanges.id as any, changeId)); // cast fileChanges.id to any

  // Could trigger additional logic (sync with project or re-summarize, etc.)
  return true;
}

/**
 * Retrieves a file change record by ID.
 * Returns null if not found.
 */
export async function getFileChange(
  db: AppDB,
  changeId: number
) {
  const [record] = await db
    .select()
    .from(fileChanges as any)  // cast table to any
    .where(eq(fileChanges.id as any, changeId)) // cast fileChanges.id to any
    .limit(1) as Array<{
      id: number;
      filePath: string;
      originalContent: string;
      suggestedDiff: string;
      status: string;
      timestamp: number;
    }>;

  return record ?? null;
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