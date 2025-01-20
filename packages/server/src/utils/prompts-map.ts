// @ts-ignore
const cwd = Bun.cwd

const contemplativePrompt = Bun.file(cwd + '/prompts/contemplative-prompt.md').text()
const summarizationSteps = Bun.file(cwd + '/prompts/summarization-prompt.md').text()



export const promptsMap = {
    contemplativePrompt,
    summarizationSteps,
}