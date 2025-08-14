import React, { useEffect, useState } from 'react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  Progress,
  Button,
  Badge,
  Card,
  CardContent
} from '@promptliano/ui'
import { Loader2, CheckCircle, XCircle, FolderSync, FileSearch, Database, Search } from 'lucide-react'
import type { SyncProgressEvent } from '@promptliano/schemas'

interface SyncProgressDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  projectName: string
  onCancel?: () => void
}

export const SyncProgressDialog = React.forwardRef<
  { updateProgress: (event: SyncProgressEvent) => void },
  SyncProgressDialogProps
>(({ open, onOpenChange, projectName, onCancel }, ref) => {
  const [progress, setProgress] = useState<SyncProgressEvent | null>(null)
  const [isComplete, setIsComplete] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Reset state when dialog opens
  useEffect(() => {
    if (open) {
      setProgress(null)
      setIsComplete(false)
      setError(null)
    }
  }, [open])

  // Method to update progress (will be called by parent component via ref)
  const updateProgress = (event: SyncProgressEvent) => {
    setProgress(event)
    if (event.phase === 'complete') {
      setIsComplete(true)
    } else if (event.phase === 'error') {
      setError(event.error?.message || 'An error occurred during sync')
    }
  }

  const getPhaseIcon = (phase: SyncProgressEvent['phase']) => {
    switch (phase) {
      case 'initializing':
        return <FolderSync className="h-5 w-5 animate-pulse" />
      case 'scanning':
        return <FileSearch className="h-5 w-5 animate-pulse" />
      case 'processing':
        return <Database className="h-5 w-5 animate-spin" />
      case 'indexing':
        return <Search className="h-5 w-5 animate-pulse" />
      case 'finalizing':
        return <Loader2 className="h-5 w-5 animate-spin" />
      case 'complete':
        return <CheckCircle className="h-5 w-5 text-green-500" />
      case 'error':
        return <XCircle className="h-5 w-5 text-red-500" />
      default:
        return <Loader2 className="h-5 w-5 animate-spin" />
    }
  }

  const getPhaseColor = (phase: SyncProgressEvent['phase']) => {
    switch (phase) {
      case 'complete':
        return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200'
      case 'error':
        return 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200'
      default:
        return 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200'
    }
  }

  const formatTime = (seconds?: number) => {
    if (!seconds) return ''
    if (seconds < 60) return `${seconds}s`
    const minutes = Math.floor(seconds / 60)
    const remainingSeconds = seconds % 60
    return `${minutes}m ${remainingSeconds}s`
  }

  const formatSpeed = (filesPerSecond?: number) => {
    if (!filesPerSecond) return ''
    return `${filesPerSecond.toFixed(1)} files/sec`
  }

  // Expose updateProgress method to parent
  React.useImperativeHandle(
    ref,
    () => ({
      updateProgress
    }),
    [updateProgress]
  )

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {getPhaseIcon(progress?.phase || 'initializing')}
            Syncing Project
          </DialogTitle>
          <DialogDescription>{projectName}</DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Phase Badge */}
          <div className="flex items-center justify-between">
            <Badge className={getPhaseColor(progress?.phase || 'initializing')}>
              {progress?.phase || 'Initializing'}
            </Badge>
            {progress?.speed && (
              <span className="text-sm text-muted-foreground">{formatSpeed(progress.speed)}</span>
            )}
          </div>

          {/* Progress Message */}
          <div className="text-sm text-muted-foreground">{progress?.message || 'Preparing to sync...'}</div>

          {/* Progress Bar */}
          {!error && (
            <div className="space-y-2">
              <Progress value={progress?.percentage || 0} className="h-2" />
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>
                  {progress?.processedFiles || 0} / {progress?.totalFiles || 0} files
                </span>
                {progress?.estimatedTimeRemaining && (
                  <span>~{formatTime(progress.estimatedTimeRemaining)} remaining</span>
                )}
              </div>
            </div>
          )}

          {/* Current File */}
          {progress?.currentFile && !error && !isComplete && (
            <Card className="bg-muted/50">
              <CardContent className="p-3">
                <div className="text-xs text-muted-foreground">Processing:</div>
                <div className="text-sm font-mono truncate">{progress.currentFile}</div>
              </CardContent>
            </Card>
          )}

          {/* Error Display */}
          {error && (
            <Card className="border-red-500 bg-red-50 dark:bg-red-950">
              <CardContent className="p-3">
                <div className="text-sm text-red-600 dark:text-red-400">{error}</div>
              </CardContent>
            </Card>
          )}

          {/* Success Message */}
          {isComplete && !error && (
            <Card className="border-green-500 bg-green-50 dark:bg-green-950">
              <CardContent className="p-3">
                <div className="text-sm text-green-600 dark:text-green-400">
                  Successfully synced {progress?.totalFiles || 0} files!
                </div>
              </CardContent>
            </Card>
          )}

          {/* Actions */}
          <div className="flex justify-end gap-2">
            {!isComplete && !error && onCancel && (
              <Button variant="outline" onClick={onCancel}>
                Cancel
              </Button>
            )}
            {(isComplete || error) && (
              <Button onClick={() => onOpenChange(false)}>
                {error ? 'Close' : 'Done'}
              </Button>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
})

SyncProgressDialog.displayName = 'SyncProgressDialog'

// Export a ref type for parent components
export interface SyncProgressDialogRef {
  updateProgress: (event: SyncProgressEvent) => void
}