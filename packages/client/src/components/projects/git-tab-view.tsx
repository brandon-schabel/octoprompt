import React, { useState } from 'react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Textarea } from '@/components/ui/textarea'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import {
  GitBranch,
  GitCommit,
  ChevronRight,
  ChevronLeft,
  FileText,
  AlertCircle,
  GitPullRequest,
  GitMerge,
  Plus,
  Minus
} from 'lucide-react'
import { useProjectGitStatus, useStageFiles, useUnstageFiles, useCommitChanges } from '@/hooks/api/use-git-api'
import type { GitFileStatus } from '@octoprompt/schemas/git'
import { getFileName } from '@/lib/git-utils'

interface GitTabViewProps {
  projectId: number
}

// Enhanced color scheme matching file tree
const getGitStatusColor = (status: string, isStaged: boolean = false) => {
  // Use darker colors for unstaged, brighter for staged
  if (status === 'added' || status === 'untracked') {
    return isStaged ? 'text-green-500' : 'text-green-700'
  }
  if (status === 'modified') {
    return isStaged ? 'text-yellow-500' : 'text-yellow-700'
  }
  if (status === 'deleted') {
    return isStaged ? 'text-red-500' : 'text-red-700'
  }
  if (status === 'renamed' || status === 'copied') {
    return isStaged ? 'text-blue-500' : 'text-blue-700'
  }
  return 'text-gray-500'
}

export function GitTabView({ projectId }: GitTabViewProps) {
  const { data: gitStatus, isLoading } = useProjectGitStatus(projectId)
  const stageFiles = useStageFiles(projectId)
  const unstageFiles = useUnstageFiles(projectId)
  const commitChanges = useCommitChanges(projectId)
  const [commitMessage, setCommitMessage] = useState('')

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
          {gitStatus?.error && <p className='text-sm text-muted-foreground'>{gitStatus.error.message}</p>}
        </div>
      </div>
    )
  }

  const { data } = gitStatus
  const allFiles = data.files || []
  const stagedFiles = allFiles.filter((f) => f.staged)
  const unstagedFiles = allFiles.filter((f) => !f.staged && f.status !== 'unchanged' && f.status !== 'ignored')

  const handleStageAll = async () => {
    const filesToStage = unstagedFiles.map((f) => f.path)
    if (filesToStage.length > 0) {
      await stageFiles.mutateAsync(filesToStage)
    }
  }

  const handleUnstageAll = async () => {
    const filesToUnstage = stagedFiles.map((f) => f.path)
    if (filesToUnstage.length > 0) {
      await unstageFiles.mutateAsync(filesToUnstage)
    }
  }

  const handleCommit = async () => {
    if (commitMessage.trim() && stagedFiles.length > 0) {
      await commitChanges.mutateAsync(commitMessage.trim())
      setCommitMessage('')
    }
  }

  return (
    <div className='h-full flex flex-col p-4 md:p-6 overflow-hidden'>
      {/* Git Repository Info */}
      <Card>
        <CardHeader className='pb-3'>
          <div className='flex items-center justify-between'>
            <div className='flex items-center gap-3'>
              <GitBranch className='h-5 w-5' />
              <CardTitle className='text-xl'>{data.current || 'No branch'}</CardTitle>
              <div className='flex items-center gap-2'>
                {data.ahead > 0 && (
                  <Badge variant='secondary' className='text-xs'>
                    ↑{data.ahead} ahead
                  </Badge>
                )}
                {data.behind > 0 && (
                  <Badge variant='secondary' className='text-xs'>
                    ↓{data.behind} behind
                  </Badge>
                )}
              </div>
            </div>
            {data.tracking && <CardDescription>Tracking: {data.tracking}</CardDescription>}
          </div>
        </CardHeader>
      </Card>

      <div className='flex-1 grid grid-cols-1 lg:grid-cols-2 gap-4 overflow-hidden mt-4'>
        {/* Unstaged Changes - LEFT */}
        <Card className='flex flex-col h-full overflow-hidden'>
          <CardHeader className='pb-3'>
            <div className='flex items-center justify-between'>
              <CardTitle className='text-base flex items-center gap-2'>
                <div className='w-3 h-3 rounded-full bg-yellow-600' />
                Unstaged Changes ({unstagedFiles.length})
              </CardTitle>
              {unstagedFiles.length > 0 && (
                <Button size='sm' variant='outline' onClick={handleStageAll} disabled={stageFiles.isPending}>
                  <ChevronRight className='h-3 w-3 mr-1' />
                  Stage All
                </Button>
              )}
            </div>
          </CardHeader>
          <CardContent className='flex-1 min-h-0'>
            <ScrollArea className='h-full pr-3'>
              {unstagedFiles.length === 0 ? (
                <div className='text-center py-8 text-muted-foreground'>
                  <GitPullRequest className='h-8 w-8 mx-auto mb-2 opacity-50' />
                  <p>No unstaged changes</p>
                </div>
              ) : (
                <div className='space-y-1'>
                  {unstagedFiles.map((file) => (
                    <div key={file.path} className='flex items-center gap-2 p-2 hover:bg-accent rounded-md group'>
                      <FileText className={cn('h-3.5 w-3.5 flex-shrink-0', getGitStatusColor(file.status, false))} />
                      <Button
                        size='sm'
                        variant='ghost'
                        className='h-6 px-2 opacity-0 group-hover:opacity-100 transition-opacity'
                        onClick={() => stageFiles.mutate([file.path])}
                        disabled={stageFiles.isPending}
                        title='Stage file'
                      >
                        <ChevronRight className='h-4 w-4' />
                      </Button>
                      <div className='flex-1 min-w-0'>
                        <p
                          className={cn('text-sm font-medium truncate', getGitStatusColor(file.status, false))}
                          title={file.path}
                        >
                          {getFileName(file.path)}
                        </p>
                        <p className='text-xs text-muted-foreground truncate' title={file.path}>
                          {file.path}
                        </p>
                      </div>
                      <span className={cn('text-xs uppercase', getGitStatusColor(file.status, false))}>
                        {file.status}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </ScrollArea>
          </CardContent>
        </Card>

        {/* Staged Changes - RIGHT */}
        <Card className='flex flex-col h-full overflow-hidden'>
          <CardHeader className='pb-3'>
            <div className='flex items-center justify-between'>
              <CardTitle className='text-base flex items-center gap-2'>
                <div className='w-3 h-3 rounded-full bg-green-600' />
                Staged Changes ({stagedFiles.length})
              </CardTitle>
              {stagedFiles.length > 0 && (
                <Button size='sm' variant='outline' onClick={handleUnstageAll} disabled={unstageFiles.isPending}>
                  <ChevronLeft className='h-3 w-3 mr-1' />
                  Unstage All
                </Button>
              )}
            </div>
          </CardHeader>
          <CardContent className='flex-1 min-h-0'>
            <ScrollArea className='h-full pr-3'>
              {stagedFiles.length === 0 ? (
                <div className='text-center py-8 text-muted-foreground'>
                  <GitMerge className='h-8 w-8 mx-auto mb-2 opacity-50' />
                  <p>No staged changes</p>
                </div>
              ) : (
                <div className='space-y-1'>
                  {stagedFiles.map((file) => (
                    <div key={file.path} className='flex items-center gap-2 p-2 hover:bg-accent rounded-md group'>
                      <FileText className={cn('h-3.5 w-3.5 flex-shrink-0', getGitStatusColor(file.status, true))} />
                      <Button
                        size='sm'
                        variant='ghost'
                        className='h-6 px-2 opacity-0 group-hover:opacity-100 transition-opacity'
                        onClick={() => unstageFiles.mutate([file.path])}
                        disabled={unstageFiles.isPending}
                        title='Unstage file'
                      >
                        <ChevronLeft className='h-4 w-4' />
                      </Button>
                      <div className='flex-1 min-w-0'>
                        <p
                          className={cn('text-sm font-medium truncate', getGitStatusColor(file.status, true))}
                          title={file.path}
                        >
                          {getFileName(file.path)}
                        </p>
                        <p className='text-xs text-muted-foreground truncate' title={file.path}>
                          {file.path}
                        </p>
                      </div>
                      <span className={cn('text-xs uppercase', getGitStatusColor(file.status, true))}>staged</span>
                    </div>
                  ))}
                </div>
              )}
            </ScrollArea>
          </CardContent>
        </Card>
      </div>

      {/* Commit Section - BOTTOM */}
      <div className='mt-4 flex-shrink-0'>
        <Card>
          <CardContent className='p-4'>
            <div className='flex items-center gap-4'>
              <GitCommit className='h-5 w-5 text-muted-foreground flex-shrink-0' />
              <div className='flex-1 flex gap-3 items-center'>
                <Textarea
                  placeholder='Commit message...'
                  value={commitMessage}
                  onChange={(e) => setCommitMessage(e.target.value)}
                  className='min-h-[40px] resize-none py-2'
                  disabled={stagedFiles.length === 0}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && e.metaKey && commitMessage.trim() && stagedFiles.length > 0) {
                      e.preventDefault()
                      handleCommit()
                    }
                  }}
                />
                <div className='flex gap-2 items-center'>
                  <Button
                    onClick={handleCommit}
                    disabled={!commitMessage.trim() || commitChanges.isPending || stagedFiles.length === 0}
                    className='min-w-[100px]'
                  >
                    {commitChanges.isPending
                      ? 'Committing...'
                      : `Commit${stagedFiles.length > 0 ? ` (${stagedFiles.length})` : ''}`}
                  </Button>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
