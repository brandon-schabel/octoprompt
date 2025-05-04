import { db } from "@/utils/database";
import { LOW_MODEL_CONFIG } from "shared";
import { ProjectFile } from "shared/src/schemas/project.schemas";
import { APIProviders } from "shared/src/schemas/provider-key.schemas";
import { generateSingleText } from "@/services/gen-ai-services";
import { getProjectFiles } from "../project-service";


import { basename, extname, sep } from 'node:path'; // Added 'sep' for path splitting
import { ALLOWED_FILE_CONFIGS, DEFAULT_FILE_EXCLUSIONS } from "shared/src/constants/file-sync-options";
// --- End imports ---

let concurrency = 5;

function chunkArray<T>(arr: T[], size: number): T[][] {
    const chunks: T[][] = [];
    for (let i = 0; i < arr.length; i += size) {
        chunks.push(arr.slice(i, i + size));
    }
    return chunks;
}

/**
 * Checks if a given name or path segment matches any exclusion pattern.
 * Supports exact matches and simple wildcard '*' matching.
 * Handles cases where patterns might target directories explicitly (e.g., 'node_modules/').
 *
 * @param nameOrSegment The directory name, filename, or path segment to check.
 * @param exclusions An array of exclusion strings (exact names or patterns like '*.log', 'dist/').
 * @returns True if the segment matches an exclusion pattern, false otherwise.
 */
export function isExcluded(nameOrSegment: string, exclusions: ReadonlyArray<string>): boolean {
    // Basic validation
    if (!nameOrSegment || !exclusions || exclusions.length === 0) {
        return false;
    }

    return exclusions.some((pattern) => {
        if (typeof pattern !== 'string' || pattern === '') {
            return false; // Skip invalid patterns
        }

        // Trim potential trailing slash from pattern for segment matching
        const trimmedPattern = pattern.endsWith('/') ? pattern.slice(0, -1) : pattern;

        if (pattern.includes('*')) { // Check original pattern for wildcard presence
            try {
                // 1. Escape ALL potential regex special characters in the trimmed pattern.
                //    This ensures ., +, ?, etc. are treated literally, and * becomes \*
                const escapedPattern = trimmedPattern.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

                // 2. Replace the NOW ESCAPED wildcard '\\*' with the regex wildcard '.*'
                //    Use the global flag 'g' if multiple wildcards per pattern should be supported.
                const regexPattern = '^' + escapedPattern.replace(/\\\*/g, '.*') + '$';

                // 3. Create the RegExp object
                const regex = new RegExp(regexPattern);

                // 4. Test the segment against the created regex
                return regex.test(nameOrSegment);

            } catch (e) {
                // Log the original pattern and the potentially problematic generated regex string
                const generatedRegexString = '^' + (trimmedPattern.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).replace(/\\\*/g, '.*') + '$';
                console.error(`[isExcluded] Error creating/testing regex from pattern: '${pattern}'. Generated: '${generatedRegexString}'`, e);
                return false; // Treat invalid patterns as non-matching
            }
        } else {
            // Exact match: compare the segment directly with the trimmed pattern
            return nameOrSegment === trimmedPattern;
        }
    });
}

/**
 * Checks if a file should be summarized based on exclusion patterns (path and name)
 * and allowed extensions/filenames.
 *
 * @param filePath The full path to the file.
 * @param config An object containing allowed and ignored configurations.
 * @returns Promise<boolean> True if the file should be summarized, false otherwise.
 */
export async function shouldSummarizeFile(filePath: string, {
    allowedConfig,
    ignoredConfig,
}: {
    allowedConfig: string[],
    ignoredConfig: string[],
}): Promise<boolean> {
    // Basic validation
    if (!filePath) return false;

    // Normalize path separators for consistent splitting
    const normalizedPath = filePath.replace(/[\\/]/g, sep);
    // Filter out empty segments resulting from leading/trailing/double slashes
    const pathSegments = normalizedPath.split(sep).filter(segment => segment.length > 0);

    // Use the imported (or mocked during test) isExcluded function
    if (pathSegments.some(segment => isExcluded(segment, ignoredConfig))) {
        // console.debug(`[Summarize] File path excluded via segment: ${filePath}`);
        return false;
    }

    // --- If not excluded, proceed to check if it's allowed ---

    const fileName = basename(filePath); // Gets the last part (file or dir if path ends with /)
    const fileExtension = extname(filePath); // Gets '.ext' or ''

    // 2. Check if the file's extension is in the allowed list (case-insensitive),
    //    OR if the filename itself is explicitly allowed (e.g., 'Dockerfile').
    const lowerCaseExtension = fileExtension.toLowerCase();
    // Check if the exact lowercased extension is allowed (e.g., '.js')
    const isAllowedExtension = allowedConfig.includes(lowerCaseExtension);
    // Check if the exact filename is allowed (e.g., 'Dockerfile', '.gitignore')
    const isAllowedFilename = allowedConfig.includes(fileName);

    if (isAllowedExtension || isAllowedFilename) {
        // console.debug(`[Summarize] File allowed for summarization: ${filePath}`);
        return true; // File is not excluded AND has an allowed extension/filename
    } else {
        // console.debug(`[Summarize] File extension/name not in allowed list: ${filePath}`);
        return false; // File is not excluded, but its type is not allowed
    }
}


// --- Rest of the file remains the same ---

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
    // Check if the file should be summarized based on the new rules
    // This check is now more robust due to the shouldSummarizeFile refactoring
    if (!(await shouldSummarizeFile(file.path, {
        allowedConfig: ALLOWED_FILE_CONFIGS,
        ignoredConfig: DEFAULT_FILE_EXCLUSIONS,
    }))) {
        // console.debug(`[Summarize] Skipping single file summarization for ${file.path} due to rules.`);
        return;
    }

    const fileContent = file.content || "";
    if (!fileContent.trim()) {
        // console.debug(`[Summarize] Skipping empty file: ${file.path}`);
        return; // Don't summarize empty files
    }

    // Consider adjusting max length based on model context window
    const maxContentLength = 50000; // Example limit
    if (fileContent.length > maxContentLength) {
        console.warn(`File ${file.path} too long (${fileContent.length} chars), skipping summarization.`);
        // Optionally update DB to mark as skipped due to length?
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
        const summaryText = await generateSingleText({
            systemMessage: systemPrompt,
            // Use prompt for single input, or messages if more complex context needed
            prompt: fileContent.slice(0, maxContentLength), // Use potentially sliced content
            options: cfg
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

/**
 * Summarize multiple files, respecting concurrency and summarization rules.
 */
export async function summarizeFiles(
    projectId: string,
    fileIdsToSummarize: string[],
): Promise<{ included: number; skipped: number }> {
    const files = await getProjectFiles(projectId);

    // Filter the fetched files based on the provided IDs
    const filteredFiles = files?.filter((f) => fileIdsToSummarize.includes(f.id)) || [];

    const chunks = chunkArray(filteredFiles, concurrency);
    let includedCount = 0;
    let skippedCount = 0;

    for (const chunk of chunks) {
        const results = await Promise.all(
            chunk.map(async (f) => {
                try {
                    // 1. Check if file should be summarized based on rules (path, name, extension)
                    //    This check now correctly handles path exclusions and case-insensitive extensions.
                    const canSummarize = await shouldSummarizeFile(f.path, {
                        allowedConfig: ALLOWED_FILE_CONFIGS,
                        ignoredConfig: DEFAULT_FILE_EXCLUSIONS,
                    });
                    if (!canSummarize) {
                        // console.debug(`[BatchSummarize] Skipping ${f.path} due to rules.`);
                        return { success: false, skipped: true, reason: 'rules' };
                    }

                    // 2. Check if summarization is needed (stale or missing)
                    const fileUpdatedAt = new Date(f.updatedAt).getTime();
                    const summaryAt = f.summaryLastUpdatedAt ? new Date(f.summaryLastUpdatedAt).getTime() : 0;
                    const stale = fileUpdatedAt > summaryAt;

                    if (!f.summary || stale) {
                        // 3. Check content length *before* calling summarizeSingleFile
                        const maxContentLength = 50000; // Ensure consistency
                        if ((f.content || "").length > maxContentLength) {
                            console.warn(`[BatchSummarize] Skipping summarization for long file: ${f.path}`);
                            return { success: false, skipped: true, reason: 'length' };
                        }
                        if (!(f.content || "").trim()) {
                            // console.debug(`[BatchSummarize] Skipping empty file: ${f.path}`);
                            return { success: false, skipped: true, reason: 'empty' };
                        }

                        // 4. Attempt summarization
                        await summarizeSingleFile(f); // This internally re-checks rules, handles length/empty, and summarizes.
                        return { success: true, skipped: false, reason: 'summarized' };
                    } else {
                        // console.debug(`[BatchSummarize] Skipping ${f.path} because summary is fresh.`);
                        return { success: false, skipped: true, reason: 'fresh' }; // Skipped because summary is up-to-date
                    }
                } catch (error) {
                    console.error(`Error processing file ${f.path} in batch summarization:`, error);
                    return { success: false, skipped: false, reason: 'error' }; // Count as attempt but failed
                }
            })
        );
        // Adjust counting based on return object
        includedCount += results.filter(r => r.success).length; // Count files successfully summarized
        skippedCount += results.filter(r => r.skipped).length; // Count files skipped for any reason
    }
    console.log(`File summarization batch complete for project ${projectId}. Attempted/Included: ${includedCount}, Skipped: ${skippedCount}`);
    return { included: includedCount, skipped: skippedCount };
}

/**
 * Forces summarization of specific files, but still respects exclusion rules and content limits.
 */
export async function forceSummarizeFiles(
    filesToSummarize: ProjectFile[],
): Promise<{ included: number; skipped: number }> {
    const chunks = chunkArray(filesToSummarize, concurrency);
    let included = 0;
    let skipped = 0;

    for (const chunk of chunks) {
        const results = await Promise.all(chunk.map(async (f) => {
            // Even if forcing, check if the file *type* is summarizable (path, name, ext) and not too long/empty
            // The shouldSummarizeFile check handles path/name/extension rules correctly now.
            if (await shouldSummarizeFile(f.path, {
                allowedConfig: ALLOWED_FILE_CONFIGS,
                ignoredConfig: DEFAULT_FILE_EXCLUSIONS,
            })) {
                const maxContentLength = 50000;
                if ((f.content || "").length > maxContentLength) {
                    console.warn(`[ForceSummarize] Skipping summarization for long file: ${f.path}`);
                    return false; // Skipped due to length
                }
                if (!(f.content || "").trim()) {
                    // console.debug(`[ForceSummarize] Skipping empty file: ${f.path}`);
                    return false; // Skipped due to empty content
                }
                try {
                    await summarizeSingleFile(f); // summarizeSingleFile handles the summarization logic
                    return true; // Included in the forced run
                } catch (error) {
                    console.error(`[ForceSummarize] Error summarizing file ${f.path}:`, error);
                    return false; // Failed during summarization attempt
                }
            } else {
                console.log(`[ForceSummarize] Skipping excluded/disallowed file type: ${f.path}`);
                return false; // Skipped due to rules
            }
        }));
        included += results.filter(r => r).length;
        skipped += results.filter(r => !r).length;
    }
    console.log(`Forced file summarization complete. Included: ${included}, Skipped: ${skipped}`);
    return { included, skipped };
}


/**
 * Forces re-summarization of selected files by ID, respecting rules and limits.
 */
export async function forceResummarizeSelectedFiles(
    projectId: string,
    fileIdsToSummarize: string[],
): Promise<{ included: number; skipped: number }> {
    const files = await getProjectFiles(projectId);
    // Filter fetched files to only those selected by ID
    const filteredFiles = files?.filter((f) => fileIdsToSummarize.includes(f.id)) || [];

    // Use the forceSummarizeFiles logic which already handles filtering and processing correctly
    return await forceSummarizeFiles(filteredFiles);
}