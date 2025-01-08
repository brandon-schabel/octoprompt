console.log(import.meta.dir)
const contemplativePrompt = Bun.file(import.meta.dir + '/contemplative-prompt.md').text()
const summarizationSteps = Bun.file(import.meta.dir+ '/summarization-prompt.md').text()

export const promptsMap = {
    contemplativePrompt,
    summarizationSteps,
}