import type { GlobalStateEditorType as EditorType } from '@promptliano/schemas'

export function getEditorUrl(editor: EditorType, filePath: string): string {
  const normalizedPath = filePath.replace(/\\/g, '/')

  switch (editor) {
    case 'vscode':
      return `vscode://file/${normalizedPath}`
    case 'cursor':
      return `cursor://file/${normalizedPath}`
    case 'webstorm':
      return `webstorm://open?file=${normalizedPath}`
    case 'vim':
      // For vim, we'll use terminal URL scheme or default to vscode
      return `vscode://file/${normalizedPath}`
    case 'emacs':
      // For emacs, we'll use emacsclient URL scheme if available
      return `emacs://open?file=${normalizedPath}`
    case 'sublime':
      return `subl://open?file=${normalizedPath}`
    case 'atom':
      return `atom://open?file=${normalizedPath}`
    case 'idea':
      return `idea://open?file=${normalizedPath}`
    case 'phpstorm':
      return `phpstorm://open?file=${normalizedPath}`
    case 'pycharm':
      return `pycharm://open?file=${normalizedPath}`
    case 'rubymine':
      return `rubymine://open?file=${normalizedPath}`
    case 'goland':
      return `goland://open?file=${normalizedPath}`
    case 'fleet':
      return `fleet://open?file=${normalizedPath}`
    case 'zed':
      return `zed://file/${normalizedPath}`
    case 'neovim':
      // For neovim, default to vscode since there's no standard URL scheme
      return `vscode://file/${normalizedPath}`
    case 'xcode':
      return `xcode://open?file=${normalizedPath}`
    case 'androidstudio':
      return `studio://open?file=${normalizedPath}`
    case 'rider':
      return `rider://open?file=${normalizedPath}`
    default:
      return `vscode://file/${normalizedPath}`
  }
}
