import { db } from "@/utils/database";
import { eq, and, inArray } from "drizzle-orm";
import { GlobalState, DEFAULT_MODEL_CONFIGS, schema } from "shared";
import { matchesAnyPattern } from "shared/src/utils/pattern-matcher";

import { websocketStateAdapter } from "@/utils/websocket/websocket-state-adapter";
import { unifiedProvider } from "../model-providers/providers/unified-provider-service";

const { files } = schema;

type ProjectFileType = schema.ProjectFile;

/**
 * A concurrency limit for summarization tasks.
 */
let concurrency = 5;


function chunkArray<T>(arr: T[], size: number): T[][] {
    const chunks: T[][] = [];
    for (let i = 0; i < arr.length; i += size) {
        chunks.push(arr.slice(i, i + size));
    }
    return chunks;
}

async function shouldSummarizeFile(projectId: string, filePath: string): Promise<boolean> {
    const state = await websocketStateAdapter.getState();
    const settings = state.settings;

    if (!settings.summarizationEnabledProjectIds.includes(projectId)) {
        return false;
    }
    if (matchesAnyPattern(filePath, settings.summarizationIgnorePatterns)) {
        return false;
    }
    if (settings.summarizationAllowPatterns.length > 0) {
        if (!matchesAnyPattern(filePath, settings.summarizationAllowPatterns)) {
            return false;
        }
    }
    return true;
}

/**
 * Retrieves file summaries for a project. Optionally filter by fileIds.
 */
export async function getFileSummaries(
    projectId: string,
    fileIds?: string[],
): Promise<ProjectFileType[]> {
    const conditions = [eq(files.projectId, projectId)];
    if (fileIds && fileIds.length > 0) {
        conditions.push(inArray(files.id, fileIds));
    }

    return db
        .select()
        .from(files)
        .where(and(...conditions))
        .all();
}

/**
 * Summarizes a single file's content by calling the provider.
 */
async function summarizeFile(file: ProjectFileType) {
    if (!(await shouldSummarizeFile(file.projectId, file.path))) {
        console.log(`[FileSummaryService] Skipping summarization for file: ${file.name}`);
        return;
    }

    try {
        const fileContent = file.content || "";
        if (!fileContent.trim()) {
            console.warn(`[FileSummaryService] File content is empty for file: ${file.name}`);
            return;
        }

        if (fileContent.length > 50000) {
            console.warn(`[FileSummaryService] File content is too long for file: ${file.name}`);
            return;
        }

        const systemPrompt = `
## You are a coding assistant that specializes in concise code summaries.
Goal: Given a code file, your task is to create a short, essential overview of its contents.

Specifically, cover the following:
1. A brief summary of what the file does.
2. Exported functions/classes: outline each one along with key inputs (parameters) and outputs (return values).
3. Any other critical information needed to understand the file's core functionality.

**Rules**
- Do **not** provide suggestions for improvements or refactoring.
- Do **not** include code blocks.
- Your output must be strictly textual, focusing only on the essential information about the file.
- Avoid any filler words or phases, just get straight to the information, use abbreviations, use symbols to reduce verbosity.
- Summaries of variables and functions must be extremely brief.
        `;

        const userMessage = fileContent.slice(0, 50000);

        const cfg = DEFAULT_MODEL_CONFIGS['summarize-file'];

        const stream = await unifiedProvider.processMessage({
            chatId: "fileSummaryChat",
            userMessage,
            provider: "openrouter",
            options: {
                model: cfg.model,
                max_tokens: cfg.max_tokens,
                temperature: cfg.temperature,
            },
            systemMessage: systemPrompt,
        });

        const reader = stream.getReader();
        let text = "";
        const decoder = new TextDecoder();

        while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            text += decoder.decode(value);
        }

        const summaryText = text.trim();

        if (!summaryText) {
            console.warn(`[FileSummaryService] Summarization returned empty for file: ${file.name}`);
            return;
        }

        await db
            .update(files)
            .set({
                summary: summaryText,
                summaryLastUpdatedAt: new Date(),
            })
            .where(eq(files.id, file.id))
            .run();

    } catch (error) {
        console.error("[FileSummaryService] Error summarizing file:", file.name, error);
    }
}

/**
 * Summarize multiple files, respecting concurrency and skip rules.
 */
export async function summarizeFiles(
    projectId: string,
    filesToSummarize: ProjectFileType[],
    globalState: GlobalState
): Promise<{ included: number; skipped: number }> {
    const allowPatterns = globalState.settings.summarizationAllowPatterns || [];
    const ignorePatterns = globalState.settings.summarizationIgnorePatterns || [];
    const enabledProjectIds = globalState.settings.summarizationEnabledProjectIds || [];

    if (!enabledProjectIds.includes(projectId)) {
        return { included: 0, skipped: filesToSummarize.length };
    }

    const chunks = chunkArray(filesToSummarize, concurrency);
    const results: { included: boolean }[] = [];

    for (const chunk of chunks) {
        const chunkPromises = chunk.map(async (file) => {
            const isAllowed = matchesAnyPattern(file.path, allowPatterns);
            const isIgnored = matchesAnyPattern(file.path, ignorePatterns);

            if (isIgnored && !isAllowed) {
                return { included: false };
            }

            const fileUpdatedAt = new Date(file.updatedAt).getTime();
            const summaryUpdatedAt = file.summaryLastUpdatedAt
                ? file.summaryLastUpdatedAt.getTime()
                : 0;
            const summaryIsStale = fileUpdatedAt > summaryUpdatedAt;

            if (!file.summary || summaryIsStale) {
                await summarizeFile(file);
                return { included: true };
            } else {
                return { included: true };
            }
        });
        const chunkResults = await Promise.all(chunkPromises);
        results.push(...chunkResults);
    }

    const includedCount = results.filter((res) => res.included).length;
    const skippedCount = filesToSummarize.length - includedCount;

    return { included: includedCount, skipped: skippedCount };
}

/**
 * Forces summarization of each given file, ignoring existing summaries.
 */
export async function forceSummarizeFiles(
    projectId: string,
    filesToSummarize: ProjectFileType[],
    globalState: GlobalState
): Promise<void> {
    const chunks = chunkArray(filesToSummarize, concurrency);

    for (const chunk of chunks) {
        const chunkPromises = chunk.map(async (file) => {
            await summarizeFile(file);
        });
        await Promise.all(chunkPromises);
    }
}

/**
 * Forces re-summarization of only the selected files if they match summarization rules.
 */
export async function forceResummarizeSelectedFiles(
    projectId: string,
    filesToSummarize: ProjectFileType[],
    globalState: GlobalState
): Promise<{ included: number; skipped: number }> {
    const chunks = chunkArray(filesToSummarize, concurrency);
    let included = 0;
    let skipped = 0;

    for (const chunk of chunks) {
        const chunkPromises = chunk.map(async (file) => {
            if (await shouldSummarizeFile(projectId, file.path)) {
                await summarizeFile(file);
                return { included: true };
            }
            return { included: false };
        });
        const results = await Promise.all(chunkPromises);
        included += results.filter((r) => r.included).length;
        skipped += results.filter((r) => !r.included).length;
    }

    return { included, skipped };
}