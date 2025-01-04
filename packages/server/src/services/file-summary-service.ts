import { db } from 'shared/database'
import { fileSummaries, FileSummary, NewFileSummary } from 'shared/schema'
import { eq, and } from 'drizzle-orm'
import { ProjectFile, GlobalState, inArray } from 'shared'
import { ProviderChatService } from '@/services/model-providers/chat/provider-chat-service'
import { matchesAnyPattern } from 'shared/src/utils/pattern-matcher'

// Utility to split an array into chunks
function chunkArray<T>(arr: T[], size: number): T[][] {
    const chunks: T[][] = []
    for (let i = 0; i < arr.length; i += size) {
        chunks.push(arr.slice(i, i + size))
    }
    return chunks
}

export class FileSummaryService {
    private providerChatService: ProviderChatService
    // control how many files you want to summarize in parallel
    private concurrency = 5

    constructor() {
        this.providerChatService = new ProviderChatService()
    }

    public async getFileSummaries(
        projectId: string,
        fileIds?: string[],
    ): Promise<FileSummary[]> {
        const conditions = [eq(fileSummaries.projectId, projectId)]

        if (fileIds && fileIds.length > 0) {
            conditions.push(inArray(fileSummaries.fileId, fileIds))
        }

        return db
            .select()
            .from(fileSummaries)
            .where(and(...conditions))
            .all()
    }


    /**
     * Summarize the given files, applying user-configured allow/ignore patterns.
     * Returns how many files we actually summarized (and how many were skipped).
     */
    async summarizeFiles(
        projectId: string,
        files: ProjectFile[],
        globalState: GlobalState
    ): Promise<{ included: number; skipped: number }> {
        const allowPatterns = globalState.settings.summarizationAllowPatterns || []
        const ignorePatterns = globalState.settings.summarizationIgnorePatterns || []

        console.log(`[FileSummaryService] Starting file summarization for project: ${projectId}`)
        console.log(`[FileSummaryService] Received ${files.length} file(s).`)
        console.log(`[FileSummaryService] allowPatterns: ${JSON.stringify(allowPatterns)}`)
        console.log(`[FileSummaryService] ignorePatterns: ${JSON.stringify(ignorePatterns)}`)

        // Split into chunks so each chunk can be processed in parallel
        const chunks = chunkArray(files, this.concurrency)
        const results: { included: boolean }[] = []

        for (const chunk of chunks) {
            // Summarize each file in the chunk in parallel
            const chunkPromises = chunk.map(async (file) => {
                const isAllowed = matchesAnyPattern(file.path, allowPatterns)
                const isIgnored = matchesAnyPattern(file.path, ignorePatterns)
                // Skip if "ignored" but not explicitly "allowed"
                if (isIgnored && !isAllowed) {
                    console.log(`[FileSummaryService] Skipped file: ${file.path} (ignored, no allow override)`)
                    return { included: false }
                }
                console.log(`[FileSummaryService] Summarizing file: ${file.path}`)
                await this.maybeSummarizeFile(projectId, file)
                return { included: true }
            })

            // Wait for all files in this chunk to finish
            const chunkResults = await Promise.all(chunkPromises)
            results.push(...chunkResults)
        }

        // Tally results
        const includedCount = results.filter((res) => res.included).length
        const skippedCount = files.length - includedCount

        console.log(`[FileSummaryService] Finished summarization for project: ${projectId}`)
        console.log(`[FileSummaryService] Included: ${includedCount}, Skipped: ${skippedCount}`)

        return { included: includedCount, skipped: skippedCount }
    }

    private async maybeSummarizeFile(projectId: string, file: ProjectFile) {
        const existingSummary = await db
            .select()
            .from(fileSummaries)
            .where(eq(fileSummaries.fileId, file.id))
            .get()

        const fileUpdatedAt = new Date(file.updatedAt).getTime()
        const summaryUpdatedAt = existingSummary ? new Date(existingSummary.updatedAt).getTime() : 0
        const summaryExpired = existingSummary
            ? Date.now() > new Date(existingSummary.expiresAt).getTime()
            : false

        const fileModified = fileUpdatedAt > summaryUpdatedAt

        if (!existingSummary) {
            console.log(`[FileSummaryService] No existing summary, will create new one.`)
        } else if (fileModified) {
            console.log(`[FileSummaryService] File changed since last summary, re-summarizing.`)
        } else if (summaryExpired) {
            console.log(`[FileSummaryService] Summary expired, re-summarizing.`)
        } else {
            console.log(`[FileSummaryService] Using existing summary, no update needed.`)
        }

        if (!existingSummary || fileModified || summaryExpired) {
            const summaryText = await this.generateFileSummary(file)
            if (!summaryText) {
                console.warn(`[FileSummaryService] Summarization returned empty for file: ${file.name}`)
                return
            }

            const newData: NewFileSummary = {
                fileId: file.id,
                projectId,
                summary: summaryText,
                updatedAt: new Date(),
                expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000), // 1 day
            }

            if (!existingSummary) {
                await db.insert(fileSummaries).values(newData).run()
                console.log(`[FileSummaryService] Created summary for file: ${file.name}`)
            } else {
                await db
                    .update(fileSummaries)
                    .set(newData)
                    .where(eq(fileSummaries.id, existingSummary.id))
                    .run()
                console.log(`[FileSummaryService] Updated summary for file: ${file.name}`)
            }
        }
    }

    private async generateFileSummary(file: ProjectFile): Promise<string | null> {
        try {
            const fileContent = file.content || ''
            const systemPrompt = `
You are a coding assistant that summarizes code. Summarize the content below in a concise bullet-list,
highlight any exported or important functions, and mention how they might be used.
`
            // Truncate to 10k chars for safety
            const userMessage = fileContent.slice(0, 10000)

            const stream = await this.providerChatService.processMessage({
                chatId: 'fileSummaryChat',
                userMessage,
                provider: 'openrouter',
                options: {
                    model: 'deepseek/deepseek-chat',
                    max_tokens: 1024,
                    temperature: 0.2,
                    debug: true
                },
                systemMessage: systemPrompt,
            })

            const reader = stream.getReader()
            let text = ''
            const decoder = new TextDecoder()

            while (true) {
                const { done, value } = await reader.read()
                if (done) break
                text += decoder.decode(value)
            }

            return text.trim()
        } catch (error) {
            console.error('[FileSummaryService] Error summarizing file:', file.name, error)
            return null
        }
    }
}