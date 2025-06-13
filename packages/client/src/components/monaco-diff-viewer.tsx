import { useSelectSetting } from '@/hooks/use-kv-local-storage'

// Monaco Editor imports - will be available after installation
// @ts-ignore - Monaco types will be available after installation
import { DiffEditor } from '@monaco-editor/react'

interface MonacoDiffViewerProps {
  original: string
  modified: string
  language?: string
  height?: string
}

export function MonacoDiffViewer({
  original,
  modified,
  language = 'plaintext',
  height = '300px'
}: MonacoDiffViewerProps) {
  const isDarkMode = useSelectSetting('theme') === 'dark'

  return (
    <DiffEditor
      height={height}
      language={language}
      original={original}
      modified={modified}
      theme={isDarkMode ? 'vs-dark' : 'light'}
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
