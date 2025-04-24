import { ProjectFile } from '@/hooks/generated'
import { TsconfigCache } from './import-resolver'

export type FileNode = {
    _folder: boolean
    file?: ProjectFile
    children?: Record<string, FileNode>
}

// take in raw string or number which would be an already estimated token count
export function formatTokenCount(content: string | number) {
    const count = typeof content === 'number' ? content : estimateTokenCount(content);

    // Format the count
    let formattedCount: string;
    if (count >= 1000) {
        formattedCount = (count / 1000).toFixed(2).replace(/\.?0+$/, '') + 'k';
    } else {
        formattedCount = count.toString();
    }


    return formattedCount
}

export function estimateTokenCount(text: string, charsPerToken: number = 4): number {
    const length = text.length
    if (length === 0 || charsPerToken <= 0) {
        return 0
    }
    return Math.ceil(length / charsPerToken)
}

export function countTotalFiles(root: Record<string, FileNode>): number {
    let count = 0
    function recurse(node: FileNode) {
        if (node._folder && node.children) {
            Object.values(node.children).forEach(recurse)
        } else if (node.file) {
            count++
        }
    }
    Object.values(root).forEach(recurse)
    return count
}

export function collectFiles(node: FileNode): string[] {
    let ids: string[] = []
    if (node._folder && node.children) {
        for (const key of Object.keys(node.children)) {
            ids = ids.concat(collectFiles(node.children[key]))
        }
    } else if (node.file?.id) {
        ids.push(node.file.id)
    }
    return ids
}

export function calculateFolderTokens(folderNode: FileNode, selectedFiles: string[]): { selectedTokens: number; totalTokens: number } {
    let total = 0
    let selected = 0

    if (folderNode._folder && folderNode.children) {
        for (const child of Object.values(folderNode.children)) {
            if (child._folder) {
                const childTokens = calculateFolderTokens(child, selectedFiles)
                total += childTokens.totalTokens
                selected += childTokens.selectedTokens
            } else if (child.file?.content) {
                const tokens = estimateTokenCount(child.file.content)
                total += tokens
                if (child.file.id && selectedFiles.includes(child.file.id)) {
                    selected += tokens
                }
            }
        }
    }
    return { selectedTokens: selected, totalTokens: total }
}

export function areAllFolderFilesSelected(folderNode: FileNode, selectedFiles: string[]): boolean {
    const allFiles = collectFiles(folderNode)
    return allFiles.length > 0 && allFiles.every(id => selectedFiles.includes(id))
}

export function isFolderPartiallySelected(folderNode: FileNode, selectedFiles: string[]): boolean {
    if (!folderNode._folder) return false
    const allFiles = collectFiles(folderNode)
    const selectedCount = allFiles.filter(id => selectedFiles.includes(id)).length
    return selectedCount > 0 && selectedCount < allFiles.length
}

export function toggleFile(
    fileId: string,
    selectedFiles: string[],
    resolveImports: boolean,
    fileMap: Map<string, ProjectFile>,
    getRecursiveImports: (fileId: string, allFiles: ProjectFile[], tsconfigCache: TsconfigCache) => string[],
    buildTsconfigAliasMap: (allFiles: ProjectFile[]) => TsconfigCache
): string[] {
    if (selectedFiles.includes(fileId)) {
        return selectedFiles.filter(id => id !== fileId)
    } else {
        if (resolveImports) {
            const allFiles = Array.from(fileMap.values())
            const tsconfigCache = buildTsconfigAliasMap(allFiles)
            const dependencies = getRecursiveImports(fileId, allFiles, tsconfigCache)
            return [...selectedFiles, fileId, ...dependencies]
        }
        return [...selectedFiles, fileId]
    }
}

export function toggleFolder(
    folderNode: FileNode,
    select: boolean,
    selectedFiles: string[]
): string[] {
    const allFiles = collectFiles(folderNode)
    const newSet = new Set(selectedFiles)
    if (select) {
        for (const id of allFiles) newSet.add(id)
    } else {
        for (const id of allFiles) newSet.delete(id)
    }
    return Array.from(newSet)
}