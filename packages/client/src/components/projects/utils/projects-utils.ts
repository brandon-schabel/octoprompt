import { estimateTokenCount } from "@/components/projects/file-panel/file-tree/file-tree-utils/file-node-tree-utils"
import { z } from 'zod'
import { FileNode } from "@/components/projects/file-panel/file-tree/file-tree-utils/file-node-tree-utils"
import { ProjectFile, PromptListResponse } from "@/hooks/generated/types.gen"

export const projectSchema = z.object({
    name: z.string().min(1, 'Project name is required'),
    description: z.string().optional(),
    path: z.string().min(1, 'Project path is required'),
})

export const promptSchema = z.object({
    name: z.string().min(1, 'Prompt name is required'),
    content: z.string().min(1, 'Prompt content is required'),
})

export function buildPromptContent(
    { fileMap, promptData, selectedFiles, selectedPrompts, userPrompt }: {
        promptData: PromptListResponse | null | undefined,
        selectedPrompts: string[],
        userPrompt: string,
        selectedFiles: string[],
        fileMap: Map<string, ProjectFile>
    }
): string {
    let contentToCopy = ''
    let promptCount = 1
    for (const prompt of promptData?.data ?? []) {
        if (selectedPrompts.includes(prompt.id)) {
            contentToCopy += `<meta prompt ${promptCount} = "${prompt.name}">\n${prompt.content}\n</meta prompt ${prompt.id}>\n\n`
            promptCount++
        }
    }


    // Only add file_contents section if there are files to include
    const filesWithContent = selectedFiles
        .map(fileId => fileMap.get(fileId))
        .filter((file): file is ProjectFile => !!file?.content)


    if (filesWithContent.length > 0) {
        contentToCopy += `<file_contents>\n`
        for (const file of filesWithContent) {
            contentToCopy += `File: ${file.path}\n\`\`\`tsx\n${file.content}\n\`\`\`\n\n`
        }
        contentToCopy += `</file_contents>\n`
    }

    const trimmedUserPrompt = userPrompt.trim()
    if (trimmedUserPrompt) {
        contentToCopy += `<user_instructions>\n${trimmedUserPrompt}\n</user_instructions>\n\n`
    }

    return contentToCopy
}

export function calculateTotalTokens(
    promptData: PromptListResponse | null | undefined,
    selectedPrompts: string[],
    userPrompt: string,
    selectedFiles: string[],
    fileMap: Map<string, ProjectFile>
): number {
    let total = 0
    for (const prompt of promptData?.data ?? []) {
        if (selectedPrompts.includes(prompt.id)) {
            total += estimateTokenCount(prompt.content)
        }
    }

    if (userPrompt.trim()) {
        total += estimateTokenCount(userPrompt)
    }

    for (const fileId of selectedFiles) {
        const file = fileMap.get(fileId)
        if (file?.content) {
            total += estimateTokenCount(file.content)
        }
    }

    return total
}


export const buildFileTree = (files: ProjectFile[]) => {
    const root: Record<string, any> = {}
    for (const f of files) {
        const parts = f.path.split('/')
        let current = root
        for (let i = 0; i < parts.length; i++) {
            const part = parts[i]
            if (!current[part]) {
                current[part] = {}
            }
            if (i === parts.length - 1) {
                current[part]._folder = false
                current[part].file = f
            } else {
                current[part]._folder = true
                if (!current[part].children) {
                    current[part].children = {}
                }
                current = current[part].children
            }
        }
    }
    return root
}

export function buildNodeContent(
    node: FileNode,
    isFolder: boolean
): string {
    let contentToCopy = ''

    if (isFolder) {
        contentToCopy += `<folder_contents>\n`
        const processNode = (node: FileNode) => {
            if (!node._folder && node.file?.content) {

                contentToCopy += `File: ${node.file.path}\n\`\`\`tsx\n${node.file.content}\n\`\`\`\n\n`
            }
            if (node.children) {
                Object.values(node.children).forEach(processNode)
            }
        }
        processNode(node)
        contentToCopy += `</folder_contents>\n`
    } else if (node.file?.content) {
        contentToCopy += `<file_contents>\n`
        contentToCopy += `File: ${node.file.path}\n\`\`\`tsx\n${node.file.content}\n\`\`\`\n`
        contentToCopy += `</file_contents>\n`
    }

    return contentToCopy
}

// --- New function ---
/**
 * Builds a string containing the path and summary of files within a node.
 * For folders, it recursively includes summaries from all files within.
 * For files, it includes only that file's summary.
 */
export function buildNodeSummaries(
    node: FileNode,
    isFolder: boolean
): string {
    let summariesToCopy = ''

    if (isFolder) {
        const processNode = (currentNode: FileNode, indent = "") => {
            // Check if it's a file node and has a summary
            if (!currentNode._folder && currentNode.file?.summary) {
                summariesToCopy += `${indent}File: ${currentNode.file.path}\n${indent}Summary: ${currentNode.file.summary}\n\n`
            }
            // Recursively process children if they exist
            if (currentNode.children) {
                const sortedEntries = Object.entries(currentNode.children).sort(([nameA], [nameB]) =>
                    nameA.localeCompare(nameB) // Sort children alphabetically
                );
                sortedEntries.forEach(([, childNode]) => processNode(childNode, indent)); // Keep same indent for files within a folder
            }
        }
        processNode(node) // Start processing from the given folder node
    } else if (node.file?.summary) { // It's a single file node with a summary
        summariesToCopy += `File: ${node.file.path}\nSummary: ${node.file.summary}\n`
    }

    return summariesToCopy.trim(); // Trim trailing newlines if any
}