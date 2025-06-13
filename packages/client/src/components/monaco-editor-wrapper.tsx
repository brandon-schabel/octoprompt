import { useEffect, useRef, useState } from 'react'
import { useSelectSetting } from '@/hooks/use-kv-local-storage'

// Monaco Editor imports - will be available after installation
// @ts-ignore - Monaco types will be available after installation
import Editor, { Monaco } from '@monaco-editor/react'
// @ts-ignore - Monaco types will be available after installation
import type { editor } from 'monaco-editor'

interface MonacoEditorWrapperProps {
  value: string
  onChange: (value: string | undefined) => void
  language?: string
  height?: string
  readOnly?: boolean
  onMount?: (editor: editor.IStandaloneCodeEditor, monaco: Monaco) => void
  onSave?: () => void
}

export function MonacoEditorWrapper({
  value,
  onChange,
  language = 'plaintext',
  height = '100%',
  readOnly = false,
  onMount,
  onSave
}: MonacoEditorWrapperProps) {
  const editorRef = useRef<editor.IStandaloneCodeEditor | null>(null)
  const [monaco, setMonaco] = useState<Monaco | null>(null)
  const isDarkMode = useSelectSetting('theme') === 'dark'

  const handleEditorDidMount = (editor: editor.IStandaloneCodeEditor, monacoInstance: Monaco) => {
    editorRef.current = editor
    setMonaco(monacoInstance)

    // Add Ctrl+S keyboard shortcut for save
    if (onSave) {
      editor.addCommand(monacoInstance.KeyMod.CtrlCmd | monacoInstance.KeyCode.KeyS, () => {
        onSave()
      })
    }

    // Add format document shortcut
    editor.addCommand(monacoInstance.KeyMod.CtrlCmd | monacoInstance.KeyMod.Shift | monacoInstance.KeyCode.KeyF, () => {
      editor.getAction('editor.action.formatDocument')?.run()
    })

    onMount?.(editor, monacoInstance)
  }

  return (
    <Editor
      height={height}
      language={language}
      value={value}
      onChange={onChange}
      onMount={handleEditorDidMount}
      theme={isDarkMode ? 'vs-dark' : 'light'}
      options={{
        readOnly,
        minimap: { enabled: false },
        scrollBeyondLastLine: false,
        fontSize: 14,
        lineNumbers: 'on',
        glyphMargin: false,
        folding: true,
        lineDecorationsWidth: 0,
        lineNumbersMinChars: 3,
        renderValidationDecorations: 'on',
        wordWrap: 'on',
        automaticLayout: true,
        tabSize: 2,
        insertSpaces: true
      }}
    />
  )
}
