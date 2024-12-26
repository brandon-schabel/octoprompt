import { EditorType } from "shared/src/global-state/global-state-schema"

export function getEditorUrl(editor: EditorType, filePath: string): string {
    const normalizedPath = filePath.replace(/\\/g, '/')

    switch (editor) {
        case 'vscode':
            return `vscode://file/${normalizedPath}`
        case 'cursor':
            return `cursor://file/${normalizedPath}`
        case 'webstorm':
            return `webstorm://open?file=${normalizedPath}`
        default:
            return `vscode://file/${normalizedPath}`
    }
} 