import { lazy, Suspense, useState } from 'react'
import { Skeleton } from '../data/index'

// Lazy load Monaco Diff Viewer
const MonacoDiffViewer = lazy(() =>
  import('./monaco-diff-viewer')
    .then((module) => ({
      default: module.MonacoDiffViewer
    }))
    .catch(() => ({
      // Fallback to null component if Monaco fails to load
      default: () => <div>Monaco Diff Viewer failed to load</div>
    }))
)

export interface LazyMonacoDiffViewerProps {
  original: string
  modified: string
  language?: string
  height?: string
  theme?: 'vs-dark' | 'light' | 'vs'
}

export function LazyMonacoDiffViewer(props: LazyMonacoDiffViewerProps) {
  const [hasError, setHasError] = useState(false)

  // Simple fallback if Monaco fails to load
  if (hasError) {
    return (
      <div className='p-4 border rounded-md bg-muted'>
        <pre className='text-sm font-mono'>
          <div className='text-red-600'>--- Original</div>
          {props.original}
          <div className='text-green-600 mt-4'>+++ Modified</div>
          {props.modified}
        </pre>
      </div>
    )
  }

  return (
    <Suspense fallback={<Skeleton className='w-full h-full min-h-[300px]' />}>
      <MonacoDiffViewer {...props} />
    </Suspense>
  )
}
