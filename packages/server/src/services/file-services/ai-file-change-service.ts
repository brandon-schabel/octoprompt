import { OpenRouterProviderService } from "../model-providers/providers/open-router-provider";
import { fetchStructuredOutput } from "@/utils/structured-output-fetcher";
import { z } from "zod";
import { db } from "shared/database";
import { fileChanges } from "shared/schema";
import { eq } from "drizzle-orm";

// Schema for AI's response
const FileChangeResponseSchema = z.object({
  updatedContent: z.string(),
  explanation: z.string(),
});

export interface FileChangeRecord {
  id: number;
  filePath: string;
  originalContent: string;
  suggestedDiff: string;
  status: "pending" | "confirmed";
  timestamp: number;
}

export class AIFileChangeService {
  constructor(
    private openRouter: OpenRouterProviderService,
  ) { }

  async generateFileChange(
    filePath: string,
    prompt: string
  ): Promise<{ changeId: number; diff: string }> {
    // 1. Read the current file content
    const originalContent = await Bun.file(filePath).text();

    // 2. Generate AI suggestion
    const result = await this.getAISuggestion(originalContent, prompt);

    // 3. Store the change record
    const changeId = await this.createFileChange(
      filePath,
      originalContent,
      result.updatedContent
    );

    // 4. Return the change info
    return {
      changeId,
      diff: result.updatedContent, // For now, returning full content. Could use actual diff later
    };
  }

  private async getAISuggestion(
    currentContent: string,
    userPrompt: string
  ): Promise<z.infer<typeof FileChangeResponseSchema>> {
    const systemMessage = `You are an AI dev assistant that modifies code files based on user requests.
Given the current file content and a user's request, return ONLY the complete updated file content.
Do not include any explanations or comments outside the code.
Ensure the code is valid TypeScript/JavaScript and maintains the same basic structure.
Return a JSON object with:
{
  "updatedContent": "the complete updated file content",
  "explanation": "brief explanation of changes made"
}`;

    const userMessage = `Current file content:
\`\`\`
${currentContent}
\`\`\`

User request: ${userPrompt}

Return only the JSON response with updatedContent and explanation.`;

    const result = await fetchStructuredOutput(this.openRouter, {
      userMessage,
      systemMessage,
      zodSchema: FileChangeResponseSchema,
      schemaName: "FileChangeResponse",
      model: "qwen/qwen-plus",
      temperature: 0.2,
      chatId: `file-change-${Date.now()}`,
    });

    return result;
  }

  private async createFileChange(
    filePath: string,
    originalContent: string,
    suggestedDiff: string
  ): Promise<number> {
    const [row] = await db
      .insert(fileChanges)
      .values({
        filePath,
        originalContent,
        suggestedDiff,
        status: "pending",
        timestamp: Date.now(),
      })
      .returning({ id: fileChanges.id });

    return row.id;
  }

  async confirmChange(changeId: number): Promise<boolean> {
    // 1. Get the change record
    const [record] = await db
      .select()
      .from(fileChanges)
      .where(eq(fileChanges.id, changeId))
      .limit(1);

    if (!record) {
      return false;
    }

    // 2. Write the updated content
    await Bun.write(record.filePath, record.suggestedDiff);

    // 3. Update status
    await db
      .update(fileChanges)
      .set({ status: "confirmed" })
      .where(eq(fileChanges.id, changeId));

    // 4. Trigger a file sync and summary update if needed
    // This will update any file tracking or summaries in the system
    // const projectPath = record.filePath.split("/")[0]; // Adjust based on your path structure

    return true;
  }

  async getChange(changeId: number): Promise<FileChangeRecord | null> {
    const [record] = await db
      .select()
      .from(fileChanges)
      .where(eq(fileChanges.id, changeId))
      .limit(1);

    return record ?? null;
  }
}