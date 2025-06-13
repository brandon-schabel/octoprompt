import { lazy, Suspense, useState } from 'react'
import { Skeleton } from '@ui'
import { DiffViewer } from './file-changes/diff-viewer'

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

interface LazyMonacoDiffViewerProps {
  original: string
  modified: string
  language?: string
  height?: string
}

export function LazyMonacoDiffViewer(props: LazyMonacoDiffViewerProps) {
  const [hasError, setHasError] = useState(false)

  // Fallback to the existing DiffViewer if Monaco fails to load
  if (hasError) {
    return <DiffViewer oldValue={props.original} newValue={props.modified} />
  }

  return (
    <Suspense fallback={<Skeleton className='w-full h-full min-h-[300px]' />}>
      <MonacoDiffViewer {...props} />
    </Suspense>
  )
}
