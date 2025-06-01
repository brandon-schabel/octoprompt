import { lazy, Suspense, useState, useEffect } from 'react'
import { Skeleton } from '@ui'
import { Textarea } from '@ui'

// Lazy load Monaco Editor wrapper
const MonacoEditorWrapper = lazy(() => 
  import('./monaco-editor-wrapper').then(module => ({
    default: module.MonacoEditorWrapper
  })).catch(() => ({
    // Fallback to null if Monaco fails to load
    default: () => null
  }))
)

interface LazyMonacoEditorProps {
  value: string
  onChange: (value: string | undefined) => void
  language?: string
  height?: string
  readOnly?: boolean
  onSave?: () => void
}

export function LazyMonacoEditor(props: LazyMonacoEditorProps) {
  const [hasError, setHasError] = useState(false)

  const handleError = () => {
    setHasError(true)
  }

  // Fallback to textarea if Monaco fails to load
  if (hasError) {
    return (
      <Textarea
        value={props.value}
        onChange={(e) => props.onChange(e.target.value)}
        className="w-full h-full min-h-[300px] font-mono text-sm"
        readOnly={props.readOnly}
      />
    )
  }

  return (
    <Suspense 
      fallback={<Skeleton className="w-full h-full min-h-[300px]" />}
    >
      <MonacoEditorWrapper {...props} />
    </Suspense>
  )
}