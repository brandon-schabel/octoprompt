import React, { useState } from 'react'
import {
  useGitWorktrees,
  useAddGitWorktree,
  useRemoveGitWorktree,
  useLockGitWorktree,
  useUnlockGitWorktree,
  usePruneGitWorktrees,
  useGitBranches
} from '@/hooks/api/use-git-api'
import { Button } from '@promptliano/ui'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@promptliano/ui'
import { Skeleton } from '@promptliano/ui'
import { Badge } from '@promptliano/ui'
import { ScrollArea } from '@promptliano/ui'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@promptliano/ui'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle
} from '@promptliano/ui'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@promptliano/ui'
import { Input } from '@promptliano/ui'
import { Label } from '@promptliano/ui'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@promptliano/ui'
import { FolderTree, Trash2, Plus, Lock, Unlock, Copy, GitBranch, AlertCircle, Sparkles } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { GitWorktree } from '@promptliano/schemas'
import { toast } from 'sonner'
import { Checkbox } from '@promptliano/ui'

interface GitWorktreeViewProps {
  projectId: number
  className?: string
}

export function GitWorktreeView({ projectId, className }: GitWorktreeViewProps) {
  const { data: worktreesResponse, isLoading, error } = useGitWorktrees(projectId)
  const { data: branchesResponse } = useGitBranches(projectId)
  const addWorktree = useAddGitWorktree(projectId)
  const removeWorktree = useRemoveGitWorktree(projectId)
  const lockWorktree = useLockGitWorktree(projectId)
  const unlockWorktree = useUnlockGitWorktree(projectId)
  const pruneWorktrees = usePruneGitWorktrees(projectId)

  const [deletingWorktree, setDeletingWorktree] = useState<GitWorktree | null>(null)
  const [lockingWorktree, setLockingWorktree] = useState<GitWorktree | null>(null)
  const [addDialogOpen, setAddDialogOpen] = useState(false)
  const [pruneDialogOpen, setPruneDialogOpen] = useState(false)
  const [path, setPath] = useState('')
  const [selectedBranch, setSelectedBranch] = useState('')
  const [newBranchName, setNewBranchName] = useState('')
  const [createNewBranch, setCreateNewBranch] = useState(false)
  const [lockReason, setLockReason] = useState('')

  const worktrees = worktreesResponse || []
  const branches = branchesResponse || []

  const handleAddWorktree = async () => {
    if (!path.trim()) {
      toast.error('Please enter a path for the worktree')
      return
    }

    try {
      // Use async API for long operations
      const response = await fetch(`/api/projects/${projectId}/git/worktrees?async=true`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          path: path.trim(),
          branch: createNewBranch ? undefined : selectedBranch || undefined,
          newBranch: createNewBranch && newBranchName.trim() ? newBranchName.trim() : undefined
        })
      })

      if (!response.ok) throw new Error('Failed to create worktree')

      const result = await response.json()

      if (result.jobId) {
        toast.success('Worktree creation started', {
          description: `Job ID: ${result.jobId}`
        })
      }

      setAddDialogOpen(false)
      setPath('')
      setSelectedBranch('')
      setNewBranchName('')
      setCreateNewBranch(false)
    } catch (error) {
      toast.error('Failed to create worktree', {
        description: error instanceof Error ? error.message : 'Unknown error'
      })
    }
  }

  const handleRemoveWorktree = async (worktree: GitWorktree, force: boolean = false) => {
    try {
      // Use async API for long operations
      const response = await fetch(`/api/projects/${projectId}/git/worktrees?async=true`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ path: worktree.path, force })
      })

      if (!response.ok) throw new Error('Failed to remove worktree')

      const result = await response.json()

      if (result.jobId) {
        toast.success('Worktree removal started', {
          description: `Job ID: ${result.jobId}`
        })
      }

      setDeletingWorktree(null)
    } catch (error) {
      toast.error('Failed to remove worktree', {
        description: error instanceof Error ? error.message : 'Unknown error'
      })
    }
  }

  const handleLockWorktree = async (worktree: GitWorktree) => {
    try {
      await lockWorktree.mutateAsync({
        path: worktree.path,
        reason: lockReason || undefined
      })
      setLockingWorktree(null)
      setLockReason('')
    } catch (error) {
      // Error is handled by the hook
    }
  }

  const handleUnlockWorktree = async (worktree: GitWorktree) => {
    try {
      await unlockWorktree.mutateAsync({ path: worktree.path })
    } catch (error) {
      // Error is handled by the hook
    }
  }

  const copyToClipboard = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text)
      toast.success('Copied to clipboard')
    } catch (error) {
      toast.error('Failed to copy to clipboard')
    }
  }

  if (isLoading) {
    return (
      <div className={cn('p-4 space-y-4', className)}>
        <Skeleton className='h-10 w-full' />
        <Skeleton className='h-32 w-full' />
        <Skeleton className='h-32 w-full' />
      </div>
    )
  }

  if (error) {
    return (
      <div className={cn('p-4', className)}>
        <Card>
          <CardContent className='pt-6'>
            <div className='flex items-center gap-2 text-destructive'>
              <AlertCircle className='h-4 w-4' />
              <p>Failed to load worktrees: {error.message}</p>
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  const WorktreeCard = ({ worktree }: { worktree: GitWorktree }) => (
    <Card className={cn('transition-colors', worktree.isMain && 'border-primary')}>
      <CardHeader className='pb-3'>
        <div className='flex items-start justify-between'>
          <div className='flex-1 min-w-0'>
            <CardTitle className='text-base flex items-center gap-2'>
              <FolderTree className='h-4 w-4 flex-shrink-0' />
              <span className='truncate'>{worktree.path}</span>
              {worktree.isMain && (
                <Badge variant='default' className='ml-2'>
                  Main
                </Badge>
              )}
              {worktree.isLocked && (
                <Badge variant='secondary' className='ml-2'>
                  <Lock className='h-3 w-3 mr-1' />
                  Locked
                </Badge>
              )}
              {worktree.prunable && (
                <Badge variant='destructive' className='ml-2'>
                  <AlertCircle className='h-3 w-3 mr-1' />
                  Prunable
                </Badge>
              )}
            </CardTitle>
            <CardDescription className='mt-1 space-y-1'>
              <div className='flex items-center gap-2 text-xs'>
                <GitBranch className='h-3 w-3' />
                <span className='font-medium'>{worktree.branch}</span>
                <span className='text-muted-foreground'>•</span>
                <span className='font-mono text-muted-foreground'>{worktree.commit.substring(0, 7)}</span>
              </div>
              {worktree.isLocked && worktree.lockReason && (
                <p className='text-xs text-muted-foreground'>Lock reason: {worktree.lockReason}</p>
              )}
            </CardDescription>
          </div>
          <div className='flex items-center gap-1 ml-2'>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button size='sm' variant='ghost' onClick={() => copyToClipboard(worktree.path)}>
                  <Copy className='h-3 w-3' />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Copy path</TooltipContent>
            </Tooltip>
            {worktree.isLocked ? (
              <Button
                size='sm'
                variant='ghost'
                onClick={() => handleUnlockWorktree(worktree)}
                disabled={unlockWorktree.isPending}
              >
                <Unlock className='h-3 w-3' />
              </Button>
            ) : (
              <Button
                size='sm'
                variant='ghost'
                onClick={() => setLockingWorktree(worktree)}
                disabled={lockWorktree.isPending}
              >
                <Lock className='h-3 w-3' />
              </Button>
            )}
            {!worktree.isMain && (
              <Button
                size='sm'
                variant='ghost'
                onClick={() => setDeletingWorktree(worktree)}
                disabled={removeWorktree.isPending}
              >
                <Trash2 className='h-3 w-3' />
              </Button>
            )}
          </div>
        </div>
      </CardHeader>
    </Card>
  )

  return (
    <TooltipProvider>
      <div className={cn('flex flex-col h-full', className)}>
        <div className='flex items-center justify-between p-4 pb-0'>
          <h2 className='text-lg font-semibold'>Worktrees</h2>
          <div className='flex items-center gap-2'>
            <Button onClick={() => setPruneDialogOpen(true)} size='sm' variant='outline'>
              <Sparkles className='h-4 w-4 mr-1' />
              Prune
            </Button>
            <Button onClick={() => setAddDialogOpen(true)} size='sm'>
              <Plus className='h-4 w-4 mr-1' />
              Add Worktree
            </Button>
          </div>
        </div>

        <ScrollArea className='flex-1 p-4'>
          <div className='space-y-2'>
            {worktrees.length === 0 ? (
              <Card>
                <CardContent className='pt-6'>
                  <p className='text-center text-muted-foreground'>No worktrees found</p>
                </CardContent>
              </Card>
            ) : (
              worktrees.map((worktree: GitWorktree) => <WorktreeCard key={worktree.path} worktree={worktree} />)
            )}
          </div>
        </ScrollArea>

        {/* Delete Confirmation Dialog */}
        <AlertDialog open={!!deletingWorktree} onOpenChange={() => setDeletingWorktree(null)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Remove Worktree</AlertDialogTitle>
              <AlertDialogDescription>
                Are you sure you want to remove the worktree at "{deletingWorktree?.path}"?
                {deletingWorktree?.isLocked && (
                  <span className='block mt-2 text-yellow-600'>
                    Warning: This worktree is locked. You may need to force remove it.
                  </span>
                )}
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction
                onClick={() => deletingWorktree && handleRemoveWorktree(deletingWorktree)}
                className='bg-destructive text-destructive-foreground hover:bg-destructive/90'
              >
                Remove
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        {/* Lock Worktree Dialog */}
        <Dialog
          open={!!lockingWorktree}
          onOpenChange={() => {
            setLockingWorktree(null)
            setLockReason('')
          }}
        >
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Lock Worktree</DialogTitle>
              <DialogDescription>
                Lock the worktree at "{lockingWorktree?.path}" to prevent accidental removal.
              </DialogDescription>
            </DialogHeader>
            <div className='space-y-4 py-4'>
              <div className='space-y-2'>
                <Label htmlFor='lock-reason'>Lock Reason (optional)</Label>
                <Input
                  id='lock-reason'
                  value={lockReason}
                  onChange={(e) => setLockReason(e.target.value)}
                  placeholder='e.g., Active development'
                />
              </div>
            </div>
            <DialogFooter>
              <Button
                variant='outline'
                onClick={() => {
                  setLockingWorktree(null)
                  setLockReason('')
                }}
              >
                Cancel
              </Button>
              <Button
                onClick={() => lockingWorktree && handleLockWorktree(lockingWorktree)}
                disabled={lockWorktree.isPending}
              >
                Lock Worktree
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Add Worktree Dialog */}
        <Dialog open={addDialogOpen} onOpenChange={setAddDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Add New Worktree</DialogTitle>
              <DialogDescription>Create a new worktree to work on multiple branches simultaneously.</DialogDescription>
            </DialogHeader>
            <div className='space-y-4 py-4'>
              <div className='space-y-2'>
                <Label htmlFor='worktree-path'>Path</Label>
                <Input
                  id='worktree-path'
                  value={path}
                  onChange={(e) => setPath(e.target.value)}
                  placeholder='../my-feature-worktree'
                />
              </div>

              <div className='flex items-center space-x-2'>
                <Checkbox
                  id='create-new-branch'
                  checked={createNewBranch}
                  onCheckedChange={(checked) => setCreateNewBranch(checked as boolean)}
                />
                <Label htmlFor='create-new-branch' className='cursor-pointer'>
                  Create new branch
                </Label>
              </div>

              {createNewBranch ? (
                <div className='space-y-2'>
                  <Label htmlFor='new-branch-name'>New Branch Name</Label>
                  <Input
                    id='new-branch-name'
                    value={newBranchName}
                    onChange={(e) => setNewBranchName(e.target.value)}
                    placeholder='feature/new-feature'
                  />
                </div>
              ) : (
                <div className='space-y-2'>
                  <Label htmlFor='branch'>Branch</Label>
                  <Select value={selectedBranch} onValueChange={setSelectedBranch}>
                    <SelectTrigger id='branch'>
                      <SelectValue placeholder='Select a branch' />
                    </SelectTrigger>
                    <SelectContent>
                      {branches.map((branch: any) => (
                        <SelectItem key={branch.name} value={branch.name}>
                          {branch.name}
                          {branch.current && ' (current)'}
                          {branch.isRemote && ' (remote)'}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
            </div>
            <DialogFooter>
              <Button variant='outline' onClick={() => setAddDialogOpen(false)}>
                Cancel
              </Button>
              <Button onClick={handleAddWorktree} disabled={!path.trim() || addWorktree.isPending}>
                Add Worktree
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Prune Worktrees Dialog */}
        <AlertDialog open={pruneDialogOpen} onOpenChange={setPruneDialogOpen}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Prune Worktrees</AlertDialogTitle>
              <AlertDialogDescription>
                This will remove references to worktrees that no longer exist on disk. Would you like to do a dry run
                first to see what would be pruned?
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction
                onClick={async () => {
                  try {
                    await pruneWorktrees.mutateAsync({ dryRun: true })
                  } catch (error) {
                    // Error handled by hook
                  }
                  setPruneDialogOpen(false)
                }}
              >
                Dry Run
              </AlertDialogAction>
              <AlertDialogAction
                onClick={async () => {
                  try {
                    await pruneWorktrees.mutateAsync({ dryRun: false })
                  } catch (error) {
                    // Error handled by hook
                  }
                  setPruneDialogOpen(false)
                }}
              >
                Prune
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </TooltipProvider>
  )
}
