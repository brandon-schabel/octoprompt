import React, { useState } from 'react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { GitBranch, GitCommit, Plus, Minus, FileText, AlertCircle } from 'lucide-react'
import { useProjectGitStatus, useStageFiles, useUnstageFiles, useStageAll, useUnstageAll, useCommitChanges } from '@/hooks/api/use-git-api'
import type { GitFileStatus } from '@octoprompt/schemas'
import { getGitStatusColor, getGitStatusLabel, getFileName } from '@/lib/git-utils'

interface GitOperationsPanelProps {
  projectId: number
  className?: string
}

export function GitOperationsPanel({ projectId, className }: GitOperationsPanelProps) {
  const { data: gitStatus, isLoading } = useProjectGitStatus(projectId)
  const stageFiles = useStageFiles(projectId)
  const unstageFiles = useUnstageFiles(projectId)
  const stageAll = useStageAll(projectId)
  const unstageAll = useUnstageAll(projectId)
  const commitChanges = useCommitChanges(projectId)
  const [selectedFiles, setSelectedFiles] = useState<Set<string>>(new Set())
  const [commitMessage, setCommitMessage] = useState('')
  const [showCommitForm, setShowCommitForm] = useState(false)

  if (isLoading) {
    return (
      <div className='flex items-center justify-center h-full'>
        <p className='text-muted-foreground'>Loading git status...</p>
      </div>
    )
  }

  if (!gitStatus || !gitStatus.success) {
    return (
      <div className='flex items-center justify-center h-full'>
        <div className='text-center space-y-2'>
          <AlertCircle className='h-8 w-8 text-muted-foreground mx-auto' />
          <p className='text-muted-foreground'>Unable to load git status</p>
        </div>
      </div>
    )
  }

  const { data } = gitStatus
  const allFiles = data.files || []
  const uniqueFiles = Array.from(new Map(allFiles.map((f) => [f.path, f])).values())

  const handleToggleFile = (path: string) => {
    const newSelected = new Set(selectedFiles)
    if (newSelected.has(path)) {
      newSelected.delete(path)
    } else {
      newSelected.add(path)
    }
    setSelectedFiles(newSelected)
  }

  const handleSelectAll = () => {
    if (selectedFiles.size === uniqueFiles.length) {
      setSelectedFiles(new Set())
    } else {
      setSelectedFiles(new Set(uniqueFiles.map((f) => f.path)))
    }
  }

  const handleStageSelected = async () => {
    const filesToStage = Array.from(selectedFiles)
    if (filesToStage.length > 0) {
      await stageFiles.mutateAsync(filesToStage)
      setSelectedFiles(new Set())
    }
  }

  const handleUnstageSelected = async () => {
    const filesToUnstage = Array.from(selectedFiles)
    if (filesToUnstage.length > 0) {
      await unstageFiles.mutateAsync(filesToUnstage)
      setSelectedFiles(new Set())
    }
  }

  const handleStageAll = async () => {
    await stageAll.mutateAsync()
    setSelectedFiles(new Set())
  }

  const handleUnstageAll = async () => {
    await unstageAll.mutateAsync()
    setSelectedFiles(new Set())
  }

  const handleCommit = async () => {
    if (commitMessage.trim()) {
      await commitChanges.mutateAsync(commitMessage.trim())
      setCommitMessage('')
      setShowCommitForm(false)
    }
  }

  return (
    <div className={cn('flex flex-col h-full', className)}>
      {/* Git Status Summary */}
      <div className='p-4 border-b space-y-3'>
        <div className='flex items-center justify-between'>
          <div className='flex items-center gap-2'>
            <GitBranch className='h-4 w-4' />
            <span className='font-medium'>{data.current || 'No branch'}</span>
            {data.ahead > 0 && <span className='text-sm text-muted-foreground'>↑{data.ahead}</span>}
            {data.behind > 0 && <span className='text-sm text-muted-foreground'>↓{data.behind}</span>}
          </div>
          {data.files?.some(f => f.staged) && (
            <Button size='sm' onClick={() => setShowCommitForm(!showCommitForm)} disabled={commitChanges.isPending}>
              <GitCommit className='h-3 w-3 mr-1' />
              Commit
            </Button>
          )}
        </div>

        <div className='flex flex-wrap gap-4 text-sm'>
          <div className='flex items-center gap-1'>
            <span className='text-green-600'>{data.files?.filter(f => f.staged).length || 0} staged</span>
          </div>
          <div className='flex items-center gap-1'>
            <span className='text-yellow-600'>{data.files?.filter(f => !f.staged && f.status !== 'unchanged' && f.status !== 'ignored').length || 0} unstaged</span>
          </div>
        </div>

        {/* Action Buttons */}
        <div className='flex gap-2 flex-wrap'>
          <Button
            size='sm'
            variant='outline'
            onClick={handleStageAll}
            disabled={!data.files?.some(f => !f.staged && f.status !== 'unchanged' && f.status !== 'ignored') || stageFiles.isPending}
          >
            <Plus className='h-3 w-3 mr-1' />
            Stage All
          </Button>
          <Button
            size='sm'
            variant='outline'
            onClick={handleUnstageAll}
            disabled={!data.files?.some(f => f.staged) || unstageFiles.isPending}
          >
            <Minus className='h-3 w-3 mr-1' />
            Unstage All
          </Button>
          {selectedFiles.size > 0 && (
            <>
              <Button size='sm' variant='outline' onClick={handleStageSelected} disabled={stageFiles.isPending}>
                <Plus className='h-3 w-3 mr-1' />
                Stage Selected ({selectedFiles.size})
              </Button>
              <Button size='sm' variant='outline' onClick={handleUnstageSelected} disabled={unstageFiles.isPending}>
                <Minus className='h-3 w-3 mr-1' />
                Unstage Selected ({selectedFiles.size})
              </Button>
            </>
          )}
        </div>

        {/* Commit Form */}
        {showCommitForm && data.files?.some(f => f.staged) && (
          <div className='space-y-2 pt-2 border-t'>
            <Textarea
              placeholder='Enter commit message...'
              value={commitMessage}
              onChange={(e) => setCommitMessage(e.target.value)}
              className='min-h-[80px] resize-none'
              onKeyDown={(e) => {
                if (e.key === 'Enter' && e.metaKey && commitMessage.trim()) {
                  e.preventDefault()
                  handleCommit()
                }
              }}
            />
            <div className='flex gap-2'>
              <Button size='sm' onClick={handleCommit} disabled={!commitMessage.trim() || commitChanges.isPending}>
                {commitChanges.isPending ? 'Committing...' : 'Commit'}
              </Button>
              <Button
                size='sm'
                variant='outline'
                onClick={() => {
                  setShowCommitForm(false)
                  setCommitMessage('')
                }}
              >
                Cancel
              </Button>
            </div>
            <p className='text-xs text-muted-foreground'>
              {data.files.filter(f => f.staged).length} file{data.files.filter(f => f.staged).length !== 1 ? 's' : ''} will be committed
            </p>
          </div>
        )}
      </div>

      {/* File List */}
      <ScrollArea className='flex-1'>
        <div className='p-4 space-y-1'>
          {uniqueFiles.length === 0 ? (
            <div className='text-center py-8'>
              <GitCommit className='h-8 w-8 text-muted-foreground mx-auto mb-2' />
              <p className='text-muted-foreground'>No changes to commit</p>
            </div>
          ) : (
            <>
              <div className='flex items-center gap-2 mb-2'>
                <Checkbox
                  checked={selectedFiles.size === uniqueFiles.length && uniqueFiles.length > 0}
                  onCheckedChange={handleSelectAll}
                />
                <span className='text-sm text-muted-foreground'>Select all ({uniqueFiles.length} files)</span>
              </div>

              {uniqueFiles.map((file) => {
                const isStaged = file.staged
                return (
                  <div key={file.path} className='flex items-center gap-2 py-1.5 px-2 hover:bg-accent rounded-md'>
                    <Checkbox
                      checked={selectedFiles.has(file.path)}
                      onCheckedChange={() => handleToggleFile(file.path)}
                    />
                    <FileText className='h-3.5 w-3.5 flex-shrink-0' />
                    <div className='flex-1 min-w-0'>
                      <span className='text-sm truncate block' title={file.path}>
                        {getFileName(file.path)}
                      </span>
                      <span className='text-xs text-muted-foreground truncate block' title={file.path}>
                        {file.path}
                      </span>
                    </div>
                    <span
                      className={cn(
                        'text-xs uppercase',
                        getGitStatusColor(
                          file.status,
                          file.staged
                        )
                      )}
                    >
                      {getGitStatusLabel(
                        file.status,
                        file.staged
                      )}
                    </span>
                    <div className='flex gap-1'>
                      {!isStaged && (
                        <Button
                          size='sm'
                          variant='ghost'
                          className='h-6 px-2'
                          onClick={() => stageFiles.mutate([file.path])}
                          disabled={stageFiles.isPending}
                        >
                          <Plus className='h-3 w-3' />
                        </Button>
                      )}
                      {isStaged && (
                        <Button
                          size='sm'
                          variant='ghost'
                          className='h-6 px-2'
                          onClick={() => unstageFiles.mutate([file.path])}
                          disabled={unstageFiles.isPending}
                        >
                          <Minus className='h-3 w-3' />
                        </Button>
                      )}
                    </div>
                  </div>
                )
              })}
            </>
          )}
        </div>
      </ScrollArea>
    </div>
  )
}
