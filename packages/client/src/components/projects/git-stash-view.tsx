import React, { useState } from 'react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle
} from '@/components/ui/alert-dialog'
import { Package2, Plus, ChevronRight, Trash2, GitBranch, Clock, AlertCircle, FileText, Info } from 'lucide-react'
import {
  useGitStashList,
  useGitStash,
  useGitStashApply,
  useGitStashPop,
  useGitStashDrop,
  useProjectGitStatus
} from '@/hooks/api/use-git-api'
import type { GitStash } from '@octoprompt/schemas'

interface GitStashViewProps {
  projectId: number
}

export function GitStashView({ projectId }: GitStashViewProps) {
  const { data: stashResponse, isLoading } = useGitStashList(projectId)
  const { data: gitStatus } = useProjectGitStatus(projectId)
  const createStash = useGitStash(projectId)
  const applyStash = useGitStashApply(projectId)
  const popStash = useGitStashPop(projectId)
  const dropStash = useGitStashDrop(projectId)

  const [stashMessage, setStashMessage] = useState('')
  const [selectedStash, setSelectedStash] = useState<GitStash | null>(null)
  const [dropConfirmOpen, setDropConfirmOpen] = useState(false)

  const stashList = stashResponse?.data || []
  const hasChanges =
    gitStatus?.success && gitStatus.data.files.some((f) => f.status !== 'unchanged' && f.status !== 'ignored')
  
  // Calculate stash statistics
  const trackedChanges = gitStatus?.success 
    ? gitStatus.data.files.filter(f => f.status !== 'unchanged' && f.status !== 'ignored' && f.status !== 'untracked')
    : []
  const stagedCount = trackedChanges.filter(f => f.staged).length
  const unstagedCount = trackedChanges.filter(f => !f.staged).length
  const untrackedCount = gitStatus?.success
    ? gitStatus.data.files.filter(f => f.status === 'untracked').length
    : 0

  const handleCreateStash = async () => {
    await createStash.mutateAsync(stashMessage || undefined)
    setStashMessage('')
  }

  const handleApplyStash = async (stash: GitStash) => {
    await applyStash.mutateAsync(`stash@{${stash.index}}`)
  }

  const handlePopStash = async (stash: GitStash) => {
    await popStash.mutateAsync(`stash@{${stash.index}}`)
  }

  const handleDropStash = async (stash: GitStash) => {
    setSelectedStash(stash)
    setDropConfirmOpen(true)
  }

  const confirmDropStash = async () => {
    if (selectedStash) {
      await dropStash.mutateAsync(`stash@{${selectedStash.index}}`)
      setSelectedStash(null)
      setDropConfirmOpen(false)
    }
  }

  if (isLoading) {
    return (
      <div className='h-full p-4 md:p-6 space-y-4'>
        <Card>
          <CardHeader>
            <CardTitle className='flex items-center gap-2'>
              <Package2 className='h-5 w-5' />
              Stash Management
            </CardTitle>
            <CardDescription>Save and manage uncommitted changes</CardDescription>
          </CardHeader>
        </Card>
        <div className='space-y-2'>
          {[1, 2, 3].map((i) => (
            <Card key={i}>
              <CardContent className='p-4'>
                <Skeleton className='h-4 w-1/2 mb-2' />
                <Skeleton className='h-3 w-1/3' />
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className='h-full flex flex-col p-4 md:p-6 overflow-hidden'>
      {/* Header and Create Stash */}
      <Card className='mb-4'>
        <CardHeader className='pb-3'>
          <CardTitle className='flex items-center gap-2'>
            <Package2 className='h-5 w-5' />
            Stash Management
          </CardTitle>
          <CardDescription>Save and manage uncommitted changes</CardDescription>
        </CardHeader>
        <CardContent>
          <div className='flex gap-2'>
            <Input
              placeholder='Optional stash message...'
              value={stashMessage}
              onChange={(e) => setStashMessage(e.target.value)}
              disabled={!hasChanges || createStash.isPending}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && hasChanges) {
                  handleCreateStash()
                }
              }}
            />
            <Button onClick={handleCreateStash} disabled={!hasChanges || createStash.isPending} className='shrink-0'>
              {createStash.isPending ? (
                'Stashing...'
              ) : (
                <>
                  <Plus className='h-4 w-4 mr-2' />
                  Create Stash
                </>
              )}
            </Button>
          </div>
          
          {/* Stash Information */}
          {hasChanges ? (
            <div className='mt-3 space-y-2'>
              <div className='flex items-start gap-2 text-sm text-muted-foreground'>
                <Info className='h-4 w-4 mt-0.5 shrink-0' />
                <div className='space-y-1'>
                  <p>Git stash will save all tracked changes (both staged and unstaged).</p>
                  {untrackedCount > 0 && (
                    <p className='text-amber-600 dark:text-amber-500'>
                      Note: {untrackedCount} untracked file{untrackedCount !== 1 ? 's' : ''} will not be included in the stash.
                    </p>
                  )}
                </div>
              </div>
              
              <div className='flex flex-wrap gap-3 text-sm'>
                <div className='flex items-center gap-1.5'>
                  <FileText className='h-3.5 w-3.5' />
                  <span className='font-medium'>{trackedChanges.length}</span>
                  <span className='text-muted-foreground'>file{trackedChanges.length !== 1 ? 's' : ''} will be stashed</span>
                </div>
                {stagedCount > 0 && (
                  <Badge variant='secondary' className='text-xs'>
                    {stagedCount} staged
                  </Badge>
                )}
                {unstagedCount > 0 && (
                  <Badge variant='outline' className='text-xs'>
                    {unstagedCount} unstaged
                  </Badge>
                )}
              </div>
            </div>
          ) : (
            <p className='text-sm text-muted-foreground mt-2'>
              No changes to stash. Make some modifications to your files first.
            </p>
          )}
        </CardContent>
      </Card>

      {/* Stash List */}
      <div className='flex-1 min-h-0'>
        <ScrollArea className='h-full pr-3'>
          {stashList.length === 0 ? (
            <Card>
              <CardContent className='flex flex-col items-center justify-center py-12 text-center'>
                <Package2 className='h-12 w-12 text-muted-foreground mb-4 opacity-50' />
                <p className='text-lg font-medium mb-1'>No stashes found</p>
                <p className='text-sm text-muted-foreground'>Create a stash to save your current changes for later</p>
              </CardContent>
            </Card>
          ) : (
            <div className='space-y-2'>
              {stashList.map((stash) => (
                <Card key={stash.index} className='hover:bg-accent/50 transition-colors'>
                  <CardContent className='p-4'>
                    <div className='flex items-start justify-between gap-4'>
                      <div className='flex-1 min-w-0'>
                        <div className='flex items-center gap-2 mb-1'>
                          <Badge variant='secondary' className='text-xs'>
                            stash@{'{' + stash.index + '}'}
                          </Badge>
                          <span className='text-sm font-medium truncate'>
                            {stash.message || 'WIP on ' + stash.branch}
                          </span>
                        </div>
                        <div className='flex items-center gap-4 text-xs text-muted-foreground'>
                          <span className='flex items-center gap-1'>
                            <GitBranch className='h-3 w-3' />
                            {stash.branch}
                          </span>
                          <span className='flex items-center gap-1'>
                            <Clock className='h-3 w-3' />
                            {new Date(stash.date).toLocaleString()}
                          </span>
                        </div>
                      </div>
                      <div className='flex items-center gap-1'>
                        <Button
                          size='sm'
                          variant='ghost'
                          onClick={() => handleApplyStash(stash)}
                          disabled={applyStash.isPending || popStash.isPending}
                          title='Apply stash (keep in stash list)'
                        >
                          Apply
                        </Button>
                        <Button
                          size='sm'
                          variant='ghost'
                          onClick={() => handlePopStash(stash)}
                          disabled={applyStash.isPending || popStash.isPending}
                          title='Pop stash (apply and remove)'
                        >
                          <ChevronRight className='h-4 w-4 mr-1' />
                          Pop
                        </Button>
                        <Button
                          size='sm'
                          variant='ghost'
                          onClick={() => handleDropStash(stash)}
                          disabled={dropStash.isPending}
                          className='text-destructive hover:text-destructive'
                          title='Delete stash'
                        >
                          <Trash2 className='h-4 w-4' />
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </ScrollArea>
      </div>

      {/* Drop Confirmation Dialog */}
      <AlertDialog open={dropConfirmOpen} onOpenChange={setDropConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className='flex items-center gap-2'>
              <AlertCircle className='h-5 w-5 text-destructive' />
              Delete Stash
            </AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this stash? This action cannot be undone.
              {selectedStash && (
                <div className='mt-2 p-2 bg-muted rounded-md'>
                  <p className='font-medium'>{selectedStash.message || `WIP on ${selectedStash.branch}`}</p>
                  <p className='text-xs text-muted-foreground'>stash@{'{' + selectedStash.index + '}'}</p>
                </div>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmDropStash}
              className='bg-destructive text-destructive-foreground hover:bg-destructive/90'
            >
              Delete Stash
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
