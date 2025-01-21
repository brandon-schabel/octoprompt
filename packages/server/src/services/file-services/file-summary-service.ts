import { db } from "shared/database";
import { files } from "shared/schema";
import { eq, and, inArray } from "drizzle-orm";
import { ProjectFile as ProjectFileType, GlobalState } from "shared";
import { matchesAnyPattern } from "shared/src/utils/pattern-matcher";
import { UnifiedProviderService } from "../model-providers/providers/unified-provider-service";
import { getState } from "@/websocket/websocket-config";

function chunkArray<T>(arr: T[], size: number): T[][] {
    const chunks: T[][] = [];
    for (let i = 0; i < arr.length; i += size) {
        chunks.push(arr.slice(i, i + size));
    }
    return chunks;
}

const shouldSummarizeFile = async (
    projectId: string,
    filePath: string
): Promise<boolean> => {
    const state = await getState();
    const settings = state.settings;

    // If the project is not enabled, skip.
    if (!settings.summarizationEnabledProjectIds.includes(projectId)) {
        return false;
    }

    // If any pattern in summarizationIgnorePatterns matches, skip.
    if (matchesAnyPattern(filePath, settings.summarizationIgnorePatterns)) {
        return false;
    }

    // If we have allow patterns, at least one must match.
    if (settings.summarizationAllowPatterns.length > 0) {
        if (!matchesAnyPattern(filePath, settings.summarizationAllowPatterns)) {
            return false;
        }
    }

    return true;
};

/**
 * This service now reads/writes file summaries directly in the `files` table.
 */
export class FileSummaryService {
    private concurrency = 5;
    private unifiedProviderService: UnifiedProviderService;

    constructor() {
        this.unifiedProviderService = new UnifiedProviderService();
    }

    /**
     * Fetch files (with their summary) for a project. Optionally filter by fileIds.
     */
    public async getFileSummaries(
        projectId: string,
        fileIds?: string[]
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
     * Return an array of objects: { summary: ProjectFile, filePath: string }.
     * The `summary` field is the entire file record with .summary.
     */
    public async getFileSummariesHandler(
        projectId: string,
        fileIds?: string[]
    ): Promise<Array<{ summary: ProjectFileType; filePath: string }>> {
        const summaries = await this.getFileSummaries(projectId, fileIds);
        return summaries.map((s) => ({
            summary: s,
            filePath: s.path,
        }));
    }

    /**
     * Summarize the given files, applying user-configured allow/ignore patterns.
     * If the file has changed or if the summary is blank, it is re-summarized.
     */
    public async summarizeFiles(
        projectId: string,
        filesToSummarize: ProjectFileType[],
        globalState: GlobalState
    ): Promise<{ included: number; skipped: number }> {
        const allowPatterns = globalState.settings.summarizationAllowPatterns || [];
        const ignorePatterns =
            globalState.settings.summarizationIgnorePatterns || [];
        const enabledProjectIds =
            globalState.settings.summarizationEnabledProjectIds || [];

        if (!enabledProjectIds.includes(projectId)) {
            console.log(
                `[FileSummaryService] Skipping summarization for project: ${projectId} (not enabled)`
            );
            return { included: 0, skipped: filesToSummarize.length };
        }

        console.log(
            `[FileSummaryService] Starting file summarization for project: ${projectId}`
        );
        console.log(
            `[FileSummaryService] Received ${filesToSummarize.length} file(s).`
        );
        console.log(
            `[FileSummaryService] allowPatterns: ${JSON.stringify(allowPatterns)}`
        );
        console.log(
            `[FileSummaryService] ignorePatterns: ${JSON.stringify(ignorePatterns)}`
        );

        const chunks = chunkArray(filesToSummarize, this.concurrency);
        const results: { included: boolean }[] = [];

        for (const chunk of chunks) {
            const chunkPromises = chunk.map(async (file) => {
                const isAllowed = matchesAnyPattern(file.path, allowPatterns);
                const isIgnored = matchesAnyPattern(file.path, ignorePatterns);

                if (isIgnored && !isAllowed) {
                    console.log(
                        `[FileSummaryService] Skipped file: ${file.path} (ignored, no allow override)`
                    );
                    return { included: false };
                }

                // Check if re-summarization is needed
                const fileUpdatedAt = new Date(file.updatedAt).getTime();
                const summaryUpdatedAt = file.summaryLastUpdatedAt
                    ? file.summaryLastUpdatedAt.getTime()
                    : 0;
                const summaryIsStale = fileUpdatedAt > summaryUpdatedAt;

                if (!file.summary || summaryIsStale) {
                    console.log(`[FileSummaryService] Summarizing file: ${file.path}`);
                    await this.summarizeFile(file);
                } else {
                    console.log(
                        `[FileSummaryService] Using existing summary for: ${file.path}`
                    );
                }
                return { included: true };
            });
            const chunkResults = await Promise.all(chunkPromises);
            results.push(...chunkResults);
        }

        const includedCount = results.filter((res) => res.included).length;
        const skippedCount = filesToSummarize.length - includedCount;

        console.log(
            `[FileSummaryService] Finished summarization for project: ${projectId}`
        );
        console.log(
            `[FileSummaryService] Included: ${includedCount}, Skipped: ${skippedCount}`
        );

        return { included: includedCount, skipped: skippedCount };
    }

    /**
     * Force re-summarize the given files, ignoring last update checks.
     */
    public async forceSummarizeFiles(
        projectId: string,
        filesToSummarize: ProjectFileType[],
        globalState: GlobalState
    ): Promise<void> {
        console.log(
            `[FileSummaryService] Force re-summarizing ${filesToSummarize.length} file(s) for project: ${projectId}`
        );

        const chunks = chunkArray(filesToSummarize, this.concurrency);

        for (const chunk of chunks) {
            const chunkPromises = chunk.map(async (file) => {
                await this.summarizeFile(file);
            });
            await Promise.all(chunkPromises);
        }
    }

    /**
     * Summarize a single file by calling the model provider with the file's content.
     * Then update the file record with the new summary and summaryLastUpdatedAt.
     */
    private async summarizeFile(file: ProjectFileType) {
        if (!(await shouldSummarizeFile(file.projectId, file.path))) {
            console.log(
                `[FileSummaryService] Skipping summarization for file: ${file.name}`
            );
            return;
        }

        try {
            const fileContent = file.content || "";
            if (!fileContent.trim()) {
                console.warn(
                    `[FileSummaryService] File content is empty for file: ${file.name}`
                );
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
- Avoid any filler words or phases, just get straight to the information, use abbreviations, use symbols instead of words when necessary
- Output the compressed prompt in a code-like format for clarity, ensuring each essential piece of information remains accessible.
`;
            const userMessage = fileContent.slice(0, 50000);

            if (fileContent.length > 50000) {
                console.warn(
                    `[FileSummaryService] File content is too long for file: ${file.name}`
                );
                return;
            }

            const stream = await this.unifiedProviderService.processMessage({
                chatId: "fileSummaryChat",
                userMessage,
                provider: "openrouter",
                options: {
                    model: "mistralai/codestral-2501",
                    max_tokens: 1024,
                    temperature: 0.2,
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
                console.warn(
                    `[FileSummaryService] Summarization returned empty for file: ${file.name}`
                );
                return;
            }

            // Update the `files` row
            await db
                .update(files)
                .set({
                    summary: summaryText,
                    summaryLastUpdatedAt: new Date(),
                })
                .where(eq(files.id, file.id))
                .run();

            console.log(
                `[FileSummaryService] Updated summary for file: ${file.name}`
            );
        } catch (error) {
            console.error(
                "[FileSummaryService] Error summarizing file:",
                file.name,
                error
            );
        }
    }

    /**
     * Force re-summarize specific files by ID, ignoring last update checks.
     */
    public async forceResummarizeSelectedFiles(
        projectId: string,
        filesToSummarize: ProjectFileType[],
        globalState: GlobalState
    ): Promise<{ included: number; skipped: number }> {
        console.log(
            `[FileSummaryService] Force re-summarizing ${filesToSummarize.length} selected file(s) for project: ${projectId}`
        );

        const chunks = chunkArray(filesToSummarize, this.concurrency);
        let included = 0;
        let skipped = 0;

        for (const chunk of chunks) {
            const chunkPromises = chunk.map(async (file) => {
                if (await shouldSummarizeFile(projectId, file.path)) {
                    await this.summarizeFile(file);
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
}
