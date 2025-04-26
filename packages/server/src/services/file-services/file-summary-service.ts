import { db } from "@/utils/database";
import { GlobalState, LOW_MODEL_CONFIG, } from "shared";
import { aiProviderInterface } from "@/services/model-providers/providers/ai-provider-interface-services";
import { ProjectFile } from "shared/src/schemas/project.schemas";
import { APIProviders } from "shared/src/schemas/provider-key.schemas";
let concurrency = 5;

function chunkArray<T>(arr: T[], size: number): T[][] {
    const chunks: T[][] = [];
    for (let i = 0; i < arr.length; i += size) {
        chunks.push(arr.slice(i, i + size));
    }
    return chunks;
}

export async function shouldSummarizeFile(projectId: string, filePath: string): Promise<boolean> {
    // const state = await getCurrentState();
    // const s = state.settings;
    // if (!s.summarizationEnabledProjectIds.includes(projectId)) return false;
    // if (matchesAnyPattern(filePath, s.summarizationIgnorePatterns)) {
    //     // if ignore matched, only allow if it also matches an allow pattern
    //     if (!matchesAnyPattern(filePath, s.summarizationAllowPatterns)) {
    //         return false;
    //     }
    // }
    return true;
}


export async function getFileSummaries(
    projectId: string,
    fileIds?: string[]
): Promise<ProjectFile[]> {
    let query = "SELECT * FROM files WHERE project_id = ?";
    const params: any[] = [projectId];
    if (fileIds && fileIds.length > 0) {
        const placeholders = fileIds.map(() => '?').join(', ');
        query += ` AND id IN (${placeholders})`;
        params.push(...fileIds);
    }
    const stmt = db.prepare(query);
    return stmt.all(...params) as ProjectFile[];
}

/**
 * Exposed for unit testing. Summarizes a single file if it meets conditions.
 */
export async function summarizeSingleFile(file: ProjectFile): Promise<void> {
    if (!(await shouldSummarizeFile(file.projectId, file.path))) return;
    const fileContent = file.content || "";
    if (!fileContent.trim()) return;
    // Consider adjusting max length based on model context window
    const maxContentLength = 50000; // Example limit
    if (fileContent.length > maxContentLength) {
        console.warn(`File ${file.path} too long (${fileContent.length} chars), skipping summarization.`);
        return;
    }

    const systemPrompt = `
  ## You are a coding assistant specializing in concise code summaries.
  1. Provide a short overview of what the file does.
  2. Outline main exports (functions/classes).
  3. Respond with only the textual summary, minimal fluff, no suggestions or code blocks.
  `;

    // Determine provider and model from config (ensure config keys match APIProviders enum)
    const cfg = LOW_MODEL_CONFIG;
    const provider = cfg.provider as APIProviders || 'openai'; // Default if not specified
    const modelId = cfg.model;

    if (!modelId) {
        console.error(`Model not configured for summarize-file task.`);
        return;
    }

    try {
        // Use generateSingleText for non-streaming summarization
        const summaryText = await aiProviderInterface.generateSingleText({
            provider: provider,
            systemMessage: systemPrompt,
            // Use prompt for single input, or messages if more complex context needed
            prompt: fileContent.slice(0, maxContentLength),
            options: {
                model: modelId,
                // Use maxTokens from Vercel AI SDK options type
                maxTokens: cfg.max_tokens, // Map max_tokens to maxTokens
                temperature: cfg.temperature,
            }
        });

        const trimmedSummary = summaryText.trim();
        if (!trimmedSummary) {
            console.warn(`Summarization resulted in empty output for ${file.path}`);
            return;
        }

        // Database update logic remains the same
        const updateStmt = db.prepare("UPDATE files SET summary = ?, summary_last_updated_at = ? WHERE id = ?");
        updateStmt.run(trimmedSummary, new Date().toISOString(), file.id);
        console.log(`Successfully summarized file: ${file.path}`);

    } catch (error) {
        console.error(`Error summarizing file ${file.path} using ${provider}/${modelId}:`, error);
        // handle error quietly or rethrow/log based on desired behavior
    }
}

// getFileSummaries remains the same

/**
 * Summarize multiple files, respecting concurrency.
 */
export async function summarizeFiles(
    projectId: string,
    filesToSummarize: ProjectFile[],
): Promise<{ included: number; skipped: number }> {
    // const allowedProject = globalState.settings.summarizationEnabledProjectIds.includes(projectId);
    // if (!allowedProject) return { included: 0, skipped: filesToSummarize.length };

    const chunks = chunkArray(filesToSummarize, concurrency);
    let includedCount = 0;
    let skippedCount = 0;

    for (const chunk of chunks) {
        const results = await Promise.all(
            chunk.map(async (f) => {
                try {
                    const canSummarize = await shouldSummarizeFile(f.projectId, f.path);
                    if (!canSummarize) return { success: false, skipped: true }; // Skipped by filter

                    const fileUpdatedAt = new Date(f.updatedAt).getTime();
                    const summaryAt = f.summaryLastUpdatedAt ? new Date(f.summaryLastUpdatedAt).getTime() : 0;
                    const stale = fileUpdatedAt > summaryAt;

                    if (!f.summary || stale) {
                        // Check content length *before* calling summarizeSingleFile
                        if ((f.content || "").length > 50000) { // Use same limit as single file
                            console.warn(`Skipping summarization for long file in batch: ${f.path}`);
                            return { success: false, skipped: true };
                        }
                        await summarizeSingleFile(f); // This now handles errors internally
                        return { success: true, skipped: false }; // Assume success if no error thrown, or modify summarizeSingleFile to return status
                    } else {
                        return { success: false, skipped: true }; // Skipped because summary is fresh
                    }
                } catch (error) {
                    console.error(`Error in batch summarization for file ${f.path}:`, error);
                    return { success: false, skipped: false }; // Count as attempt but failed
                }
            })
        );
        // Adjust counting based on return object
        includedCount += results.filter(r => r.success).length;
        skippedCount += results.filter(r => r.skipped).length;
    }
    console.log(`File summarization batch complete for project ${projectId}. Included: ${includedCount}, Skipped: ${skippedCount}`);
    return { included: includedCount, skipped: skippedCount };
}
/**
 * Forces summarization of files regardless of existing summary.
 */
export async function forceSummarizeFiles(
    filesToSummarize: ProjectFile[],
) {
    const chunks = chunkArray(filesToSummarize, concurrency);
    for (const chunk of chunks) {
        await Promise.all(chunk.map((f) => summarizeSingleFile(f)));
    }
}

export async function forceResummarizeSelectedFiles(
    projectId: string,
    filesToSummarize: ProjectFile[],
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