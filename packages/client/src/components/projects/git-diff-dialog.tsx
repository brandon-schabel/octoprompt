import React, { useState } from 'react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  Button,
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
  Skeleton
} from '@ui'
import { LazyMonacoDiffViewer } from '../lazy-monaco-diff-viewer'
import { DiffViewer } from '../file-changes/diff-viewer'
import { useFileDiff } from '@/hooks/api/use-git-api'
import { getFileLanguage } from '@/lib/file-utils'
import { Copy, X } from 'lucide-react'
import { toast } from 'sonner'

interface GitDiffDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  projectId: number
  filePath: string
  hasStaged?: boolean
  hasUnstaged?: boolean
}

export function GitDiffDialog({
  open,
  onOpenChange,
  projectId,
  filePath,
  hasStaged = false,
  hasUnstaged = true
}: GitDiffDialogProps) {
  const [viewMode, setViewMode] = useState<'unstaged' | 'staged'>(hasUnstaged ? 'unstaged' : 'staged')
  const [diffViewType, setDiffViewType] = useState<'monaco' | 'simple'>('monaco')

  // Get the appropriate diff based on view mode
  const { data: diffData, isLoading, error } = useFileDiff(
    projectId,
    filePath,
    { staged: viewMode === 'staged' },
    open
  )

  const handleCopyDiff = async () => {
    if (!diffData?.diff) return
    
    try {
      await navigator.clipboard.writeText(diffData.diff)
      toast.success('Diff copied to clipboard')
    } catch (error) {
      toast.error('Failed to copy diff')
    }
  }

  const language = getFileLanguage(filePath)

  // Parse the diff to extract original and modified content
  const parseDiff = (diff: string) => {
    const lines = diff.split('\n')
    const original: string[] = []
    const modified: string[] = []
    
    let inDiffSection = false
    
    for (const line of lines) {
      if (line.startsWith('@@')) {
        inDiffSection = true
        continue
      }
      
      if (!inDiffSection) continue
      
      if (line.startsWith('-') && !line.startsWith('---')) {
        original.push(line.substring(1))
      } else if (line.startsWith('+') && !line.startsWith('+++')) {
        modified.push(line.substring(1))
      } else if (line.startsWith(' ')) {
        original.push(line.substring(1))
        modified.push(line.substring(1))
      }
    }
    
    return {
      original: original.join('\n'),
      modified: modified.join('\n')
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[80vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center justify-between">
            <span className="text-sm truncate">{filePath}</span>
            <div className="flex items-center gap-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={handleCopyDiff}
                disabled={!diffData?.diff}
              >
                <Copy className="h-4 w-4" />
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => onOpenChange(false)}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          </DialogTitle>
        </DialogHeader>

        <div className="flex-1 overflow-hidden">
          {(hasStaged && hasUnstaged) && (
            <Tabs value={viewMode} onValueChange={(v) => setViewMode(v as 'unstaged' | 'staged')} className="mb-2">
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="unstaged">Unstaged Changes</TabsTrigger>
                <TabsTrigger value="staged">Staged Changes</TabsTrigger>
              </TabsList>
            </Tabs>
          )}

          <div className="mb-2">
            <Tabs value={diffViewType} onValueChange={(v) => setDiffViewType(v as 'monaco' | 'simple')}>
              <TabsList>
                <TabsTrigger value="monaco">Side-by-side</TabsTrigger>
                <TabsTrigger value="simple">Unified</TabsTrigger>
              </TabsList>
            </Tabs>
          </div>

          <div className="flex-1 overflow-auto">
            {isLoading && (
              <Skeleton className="w-full h-[400px]" />
            )}
            
            {error && (
              <div className="text-red-500 p-4">
                Failed to load diff: {error.message}
              </div>
            )}
            
            {diffData?.diff && !isLoading && !error && (
              <>
                {diffViewType === 'monaco' ? (
                  <div className="h-[400px]">
                    {(() => {
                      const { original, modified } = parseDiff(diffData.diff)
                      return (
                        <LazyMonacoDiffViewer
                          original={original}
                          modified={modified}
                          language={language}
                          height="100%"
                        />
                      )
                    })()}
                  </div>
                ) : (
                  <div className="max-h-[400px] overflow-auto">
                    <pre className="text-xs p-2 bg-muted rounded font-mono">{diffData.diff}</pre>
                  </div>
                )}
              </>
            )}
            
            {diffData?.diff === '' && !isLoading && !error && (
              <div className="text-muted-foreground p-4 text-center">
                No changes in {viewMode} area
              </div>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}