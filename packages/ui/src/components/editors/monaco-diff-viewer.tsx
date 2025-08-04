// Monaco Editor imports
import { DiffEditor } from '@monaco-editor/react'

export interface MonacoDiffViewerProps {
  original: string
  modified: string
  language?: string
  height?: string
  theme?: 'vs-dark' | 'light' | 'vs'
}

export function MonacoDiffViewer({
  original,
  modified,
  language = 'plaintext',
  height = '300px',
  theme = 'vs'
}: MonacoDiffViewerProps) {
  return (
    <DiffEditor
      height={height}
      language={language}
      original={original}
      modified={modified}
      theme={theme}
      options={{
        readOnly: true,
        renderSideBySide: true,
        scrollBeyondLastLine: false,
        minimap: { enabled: false },
        fontSize: 14,
        lineNumbers: 'on',
        automaticLayout: true,
        wordWrap: 'on'
      }}
    />
  )
}
