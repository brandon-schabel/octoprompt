// File: packages/server/src/services/file-services/file-summary-service.ts

import { db } from "@/utils/database";
import { eq, and, inArray } from "drizzle-orm";
import { GlobalState, DEFAULT_MODEL_CONFIGS, schema } from "shared";
import { matchesAnyPattern } from "shared/src/utils/pattern-matcher";
import { websocketStateAdapter } from "@/utils/websocket/websocket-state-adapter";
import { unifiedProvider } from "@/services/model-providers/providers/unified-provider-service";

const { files } = schema;
type ProjectFileType = schema.ProjectFile;

let concurrency = 5;

function chunkArray<T>(arr: T[], size: number): T[][] {
    const chunks: T[][] = [];
    for (let i = 0; i < arr.length; i += size) {
        chunks.push(arr.slice(i, i + size));
    }
    return chunks;
}

export async function shouldSummarizeFile(projectId: string, filePath: string): Promise<boolean> {
    const state = await websocketStateAdapter.getState();
    const s = state.settings;
    if (!s.summarizationEnabledProjectIds.includes(projectId)) return false;
    if (matchesAnyPattern(filePath, s.summarizationIgnorePatterns)) {
        // if ignore matched, only allow if it also matches an allow pattern
        if (!matchesAnyPattern(filePath, s.summarizationAllowPatterns)) {
            return false;
        }
    }
    return true;
}

/**
 * Exposed for unit testing. Summarizes a single file if it meets conditions.
 */
export async function summarizeSingleFile(file: ProjectFileType): Promise<void> {
    if (!(await shouldSummarizeFile(file.projectId, file.path))) return;
    const fileContent = file.content || "";
    if (!fileContent.trim()) return;
    if (fileContent.length > 50000) return;

    const systemPrompt = `
## You are a coding assistant that specializes in concise code summaries.
1) Provide a short overview of what the file does.
2) Outline main exports (functions/classes).
3) No suggestions or code blocks; strictly textual, minimal fluff.
`;

    const cfg = DEFAULT_MODEL_CONFIGS["summarize-file"];
    try {
        const stream = await unifiedProvider.processMessage({
            chatId: "fileSummaryChat",
            userMessage: fileContent.slice(0, 50000),
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
        if (!summaryText) return;

        await db.update(files)
            .set({
                summary: summaryText,
                summaryLastUpdatedAt: new Date(),
            })
            .where(eq(files.id, file.id))
            .run();

    } catch {
        // handle error quietly
    }
}

export async function getFileSummaries(
    projectId: string,
    fileIds?: string[]
): Promise<ProjectFileType[]> {
    const conditions = [eq(files.projectId, projectId)];
    if (fileIds && fileIds.length) {
        conditions.push(inArray(files.id, fileIds));
    }
    return db.select().from(files).where(and(...conditions)).all();
}

/**
 * Summarize multiple files, respecting concurrency.
 */
export async function summarizeFiles(
    projectId: string,
    filesToSummarize: ProjectFileType[],
    globalState: GlobalState
): Promise<{ included: number; skipped: number }> {
    const allowedProject = globalState.settings.summarizationEnabledProjectIds.includes(projectId);
    if (!allowedProject) return { included: 0, skipped: filesToSummarize.length };

    const chunks = chunkArray(filesToSummarize, concurrency);
    let includedCount = 0;
    let skippedCount = 0;

    for (const chunk of chunks) {
        const results = await Promise.all(
            chunk.map(async (f) => {
                const canSummarize = await shouldSummarizeFile(f.projectId, f.path);
                if (!canSummarize) return false;
                const fileUpdatedAt = new Date(f.updatedAt).getTime();
                const summaryAt = f.summaryLastUpdatedAt ? f.summaryLastUpdatedAt.getTime() : 0;
                const stale = fileUpdatedAt > summaryAt;
                if (!f.summary || stale) {
                    await summarizeSingleFile(f);
                }
                return true;
            })
        );
        includedCount += results.filter(Boolean).length;
        skippedCount += results.filter((val) => !val).length;
    }
    return { included: includedCount, skipped: skippedCount };
}

/**
 * Forces summarization of files regardless of existing summary.
 */
export async function forceSummarizeFiles(
    projectId: string,
    filesToSummarize: ProjectFileType[],
    globalState: GlobalState
) {
    const chunks = chunkArray(filesToSummarize, concurrency);
    for (const chunk of chunks) {
        await Promise.all(chunk.map((f) => summarizeSingleFile(f)));
    }
}

export async function forceResummarizeSelectedFiles(
    projectId: string,
    filesToSummarize: ProjectFileType[],
    globalState: GlobalState
): Promise<{ included: number; skipped: number }> {
    const chunks = chunkArray(filesToSummarize, concurrency);
    let included = 0;
    let skipped = 0;
    for (const c of chunks) {
        const results = await Promise.all(
            c.map(async (file) => {
                if (await shouldSummarizeFile(projectId, file.path)) {
                    await summarizeSingleFile(file);
                    return true;
                }
                return false;
            })
        );
        included += results.filter((r) => r).length;
        skipped += results.filter((r) => !r).length;
    }
    return { included, skipped };
}