import { estimateTokenCount } from './file-tree-utils/file-node-tree-utils'
import type { FileNode } from './file-tree-utils/file-node-tree-utils'
import type { ProjectFile, ProjectFileMap, Prompt } from '@promptliano/schemas'

export function buildPromptContent({
  fileMap,
  promptData,
  selectedFiles,
  selectedPrompts,
  userPrompt
}: {
  promptData: Prompt[]
  selectedPrompts: number[]
  userPrompt: string
  selectedFiles: number[]
  fileMap: ProjectFileMap
}): string {
  let contentToCopy = ''
  let promptCount = 1
  for (const prompt of promptData ?? []) {
    if (selectedPrompts.includes(prompt.id)) {
      // Using a more descriptive tag for clarity
      contentToCopy += `<system_prompt index="${promptCount}" name="${prompt.name}">\n<![CDATA[\n${prompt.content}\n]]>\n</system_prompt>\n\n`
      promptCount++
    }
  }

  const filesWithContent = selectedFiles
    .map((fileId) => fileMap.get(fileId))
    .filter((file): file is ProjectFile => !!file?.content)

  if (filesWithContent.length > 0) {
    contentToCopy += `<file_context>\n`
    for (const file of filesWithContent) {
      contentToCopy += `<file>\n  <path>${file.path}</path>\n  <content><![CDATA[\n${file.content}\n]]></content>\n</file>\n\n`
    }
    contentToCopy += `</file_context>\n`
  }

  const trimmedUserPrompt = userPrompt.trim()
  if (trimmedUserPrompt) {
    contentToCopy += `<user_instructions>\n<![CDATA[\n${trimmedUserPrompt}\n]]>\n</user_instructions>\n\n`
  }

  return contentToCopy.trimEnd() // Remove trailing newline
}

export function calculateTotalTokens(
  promptData: Prompt[] | null | undefined,
  selectedPrompts: number[],
  userPrompt: string,
  selectedFiles: number[],
  fileMap: ProjectFileMap
): number {
  let total = 0
  for (const prompt of promptData ?? []) {
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

export const buildFileTree = <T extends Pick<ProjectFile, 'path'>>(files: T[]): Record<string, any> => {
  const root: Record<string, any> = {}
  for (const f of files) {
    const parts = f.path.split('/').filter(Boolean) // Remove empty strings
    let current = root
    for (let i = 0; i < parts.length; i++) {
      const part = parts[i]
      if (!part) continue // Skip undefined or empty parts
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

export function buildNodeContent(node: FileNode, isFolder: boolean): string {
  let contentToCopy = ''

  if (isFolder) {
    contentToCopy += `<folder_context path="${node.file?.path ?? 'unknown'}">\n` // Add folder path if available
    const processNode = (currentNode: FileNode) => {
      if (!currentNode._folder && currentNode.file?.content) {
        contentToCopy += `  <file>\n    <path>${currentNode.file.path}</path>\n    <content><![CDATA[\n${currentNode.file.content}\n]]></content>\n  </file>\n`
      }
      if (currentNode.children) {
        Object.values(currentNode.children).forEach(processNode)
      }
    }
    processNode(node)
    contentToCopy += `</folder_context>\n`
  } else if (node.file?.content) {
    // Single file context uses file_context tag for consistency
    contentToCopy += `<file_context>\n`
    contentToCopy += `  <file>\n    <path>${node.file.path}</path>\n    <content><![CDATA[\n${node.file.content}\n]]></content>\n  </file>\n`
    contentToCopy += `</file_context>\n`
  }

  return contentToCopy.trimEnd() // Remove trailing newline
}

// --- New function ---
/**
 * Builds a string containing the path and summary of files within a node.
 * For folders, it recursively includes summaries from all files within.
 * For files, it includes only that file's summary.
 */
export function buildNodeSummaries(node: FileNode, isFolder: boolean): string {
  let summariesToCopy = ''

  if (isFolder) {
    const processNode = (currentNode: FileNode, indent = '') => {
      // Check if it's a file node and has a summary
      if (!currentNode._folder && currentNode.file?.summary) {
        summariesToCopy += `${indent}File: ${currentNode.file.path}\n${indent}Summary: ${currentNode.file.summary}\n\n`
      }
      // Recursively process children if they exist
      if (currentNode.children) {
        const sortedEntries = Object.entries(currentNode.children).sort(
          ([nameA], [nameB]) => nameA.localeCompare(nameB) // Sort children alphabetically
        )
        sortedEntries.forEach(([, childNode]) => processNode(childNode, indent)) // Keep same indent for files within a folder
      }
    }
    processNode(node) // Start processing from the given folder node
  } else if (node.file?.summary) {
    // It's a single file node with a summary
    summariesToCopy += `File: ${node.file.path}\nSummary: ${node.file.summary}\n`
  }

  return summariesToCopy.trim() // Trim trailing newlines if any
}

export const buildProjectFileMap = (files: ProjectFile[]): ProjectFileMap => {
  return new Map(files.map((file) => [file.id, file]))
}

export const buildProjectFileMapWithoutContent = <T extends Pick<ProjectFile, 'id'>>(files: T[]): Map<number, T> => {
  return new Map(files.map((file) => [file.id, file]))
}
