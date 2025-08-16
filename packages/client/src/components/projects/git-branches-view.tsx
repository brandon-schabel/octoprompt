import React, { useState } from 'react'
import { useBranchesEnhanced, useCreateBranch, useSwitchBranch, useDeleteBranch } from '@/hooks/api/use-git-api'
import { Button } from '@promptliano/ui'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@promptliano/ui'
import { Skeleton } from '@promptliano/ui'
import { Badge } from '@promptliano/ui'
import { ScrollArea } from '@promptliano/ui'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@promptliano/ui'
import { useNavigate } from '@tanstack/react-router'
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
import { GitBranch, Trash2, Plus, ArrowRightLeft, Clock, User, AlertCircle } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { GitBranchEnhanced } from '@promptliano/schemas'
import { Separator } from '@promptliano/ui'
import { formatDistanceToNow, format } from 'date-fns'

interface GitBranchesViewProps {
  projectId: number
  className?: string
}

export function GitBranchesView({ projectId, className }: GitBranchesViewProps) {
  const navigate = useNavigate()
  const { data: branchesResponse, isLoading, error } = useBranchesEnhanced(projectId)
  const switchBranch = useSwitchBranch(projectId)
  const deleteBranch = useDeleteBranch(projectId)
  const createBranch = useCreateBranch(projectId)

  const [deletingBranch, setDeletingBranch] = useState<string | null>(null)
  const [createDialogOpen, setCreateDialogOpen] = useState(false)
  const [newBranchName, setNewBranchName] = useState('')
  const [baseBranch, setBaseBranch] = useState<string>('')

  const branches = branchesResponse?.data?.branches || []
  const currentBranch = branchesResponse?.data?.current || ''
  const defaultBranch = branchesResponse?.data?.defaultBranch || 'main'

  // Sort branches by last activity (newest first)
  const sortedBranches = [...branches].sort((a, b) => {
    // Current branch always first
    if (a.current) return -1
    if (b.current) return 1

    // Then sort by last activity date
    const aDate = a.lastActivity ? new Date(a.lastActivity).getTime() : 0
    const bDate = b.lastActivity ? new Date(b.lastActivity).getTime() : 0
    return bDate - aDate // Newest first
  })

  // Separate local and remote branches
  const localBranches = sortedBranches.filter((b) => !b.isRemote)
  const remoteBranches = sortedBranches.filter((b) => b.isRemote)

  const handleCheckout = async (branchName: string) => {
    try {
      await switchBranch.mutateAsync(branchName)
    } catch (error) {
      // Error is handled by the hook
    }
  }

  const handleDelete = async (branchName: string, force: boolean = false) => {
    try {
      await deleteBranch.mutateAsync({ branchName, force })
      setDeletingBranch(null)
    } catch (error) {
      // Error is handled by the hook
    }
  }

  const handleCreateBranch = async () => {
    if (!newBranchName.trim()) return

    try {
      await createBranch.mutateAsync({
        name: newBranchName.trim(),
        startPoint: baseBranch || undefined
      })
      setCreateDialogOpen(false)
      setNewBranchName('')
      setBaseBranch('')
    } catch (error) {
      // Error is handled by the hook
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
              <p>Failed to load branches: {error.message}</p>
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  const BranchCard = ({ branch }: { branch: GitBranchEnhanced }) => {
    const handleCardClick = () => {
      navigate({
        to: '/projects',
        search: (prev) => ({
          ...prev,
          activeView: 'git',
          gitView: 'history',
          gitBranch: branch.name
        })
      })
    }

    return (
      <Card
        className={cn('transition-colors cursor-pointer hover:bg-accent/50', branch.current && 'border-primary')}
        onClick={handleCardClick}
      >
        <CardHeader className='pb-3'>
          <div className='flex items-start justify-between'>
            <div className='flex-1 min-w-0'>
              <CardTitle className='text-base flex items-center gap-2'>
                <GitBranch className='h-4 w-4 flex-shrink-0' />
                <span className='truncate'>{branch.name}</span>
                {branch.current && (
                  <Badge variant='default' className='ml-2'>
                    Current
                  </Badge>
                )}
                {branch.name === defaultBranch && (
                  <Badge variant='secondary' className='ml-2'>
                    Default
                  </Badge>
                )}
              </CardTitle>
              {branch.latestCommit && (
                <CardDescription className='mt-1 space-y-1'>
                  <div className='flex items-center gap-2 text-xs'>
                    <Clock className='h-3 w-3' />
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <span className='cursor-help'>
                          {branch.lastActivity
                            ? formatDistanceToNow(new Date(branch.lastActivity), { addSuffix: true })
                            : branch.latestCommit.relativeTime}
                        </span>
                      </TooltipTrigger>
                      <TooltipContent>
                        {branch.lastActivity ? format(new Date(branch.lastActivity), 'PPpp') : 'Date not available'}
                      </TooltipContent>
                    </Tooltip>
                    <span className='text-muted-foreground'>•</span>
                    <User className='h-3 w-3' />
                    <span className='truncate'>{branch.latestCommit.author}</span>
                  </div>
                  <p className='text-xs line-clamp-1'>{branch.latestCommit.subject}</p>
                </CardDescription>
              )}
            </div>
            <div className='flex items-center gap-1 ml-2'>
              {!branch.current && (
                <Button
                  size='sm'
                  variant='outline'
                  onClick={(e) => {
                    e.stopPropagation()
                    handleCheckout(branch.name)
                  }}
                  disabled={switchBranch.isPending}
                >
                  <ArrowRightLeft className='h-3 w-3 mr-1' />
                  Checkout
                </Button>
              )}
              {!branch.current && branch.name !== defaultBranch && !branch.isProtected && (
                <Button
                  size='sm'
                  variant='ghost'
                  onClick={(e) => {
                    e.stopPropagation()
                    setDeletingBranch(branch.name)
                  }}
                  disabled={deleteBranch.isPending}
                >
                  <Trash2 className='h-3 w-3' />
                </Button>
              )}
            </div>
          </div>
        </CardHeader>
        {(branch.ahead > 0 || branch.behind > 0) && branch.tracking && (
          <CardContent className='pt-0'>
            <div className='flex items-center gap-4 text-xs text-muted-foreground'>
              {branch.ahead > 0 && (
                <span className='flex items-center gap-1'>
                  <span className='text-green-600'>↑</span>
                  {branch.ahead} ahead
                </span>
              )}
              {branch.behind > 0 && (
                <span className='flex items-center gap-1'>
                  <span className='text-orange-600'>↓</span>
                  {branch.behind} behind
                </span>
              )}
              <span className='text-muted-foreground'>of {branch.tracking}</span>
            </div>
          </CardContent>
        )}
      </Card>
    )
  }

  return (
    <TooltipProvider>
      <div className={cn('flex flex-col h-full', className)}>
        <div className='flex items-center justify-between p-4 pb-0'>
          <h2 className='text-lg font-semibold'>Branches</h2>
          <Button onClick={() => setCreateDialogOpen(true)} size='sm'>
            <Plus className='h-4 w-4 mr-1' />
            New Branch
          </Button>
        </div>

        <ScrollArea className='flex-1 p-4'>
          <div className='space-y-4'>
            {localBranches.length > 0 && (
              <div className='space-y-3'>
                <h3 className='text-sm font-medium text-muted-foreground'>Local Branches</h3>
                <div className='space-y-2'>
                  {localBranches.map((branch) => (
                    <BranchCard key={branch.name} branch={branch} />
                  ))}
                </div>
              </div>
            )}

            {remoteBranches.length > 0 && (
              <>
                {localBranches.length > 0 && <Separator />}
                <div className='space-y-3'>
                  <h3 className='text-sm font-medium text-muted-foreground'>Remote Branches</h3>
                  <div className='space-y-2'>
                    {remoteBranches.map((branch) => (
                      <BranchCard key={branch.name} branch={branch} />
                    ))}
                  </div>
                </div>
              </>
            )}
          </div>
        </ScrollArea>

        {/* Delete Confirmation Dialog */}
        <AlertDialog open={!!deletingBranch} onOpenChange={() => setDeletingBranch(null)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Delete Branch</AlertDialogTitle>
              <AlertDialogDescription>
                Are you sure you want to delete the branch "{deletingBranch}"? This action cannot be undone.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction
                onClick={() => deletingBranch && handleDelete(deletingBranch)}
                className='bg-destructive text-destructive-foreground hover:bg-destructive/90'
              >
                Delete
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        {/* Create Branch Dialog */}
        <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Create New Branch</DialogTitle>
              <DialogDescription>
                Create a new branch from an existing branch or commit.
                {!baseBranch && currentBranch && (
                  <span className='block mt-1 text-sm'>
                    Base branch: <span className='font-medium'>{currentBranch}</span> (current)
                  </span>
                )}
              </DialogDescription>
            </DialogHeader>
            <div className='space-y-4 py-4'>
              <div className='space-y-2'>
                <Label htmlFor='branch-name'>Branch Name</Label>
                <Input
                  id='branch-name'
                  value={newBranchName}
                  onChange={(e) => setNewBranchName(e.target.value)}
                  placeholder='feature/new-feature'
                />
              </div>
              <div className='space-y-2'>
                <Label htmlFor='base-branch'>Base Branch (optional)</Label>
                <Select value={baseBranch} onValueChange={setBaseBranch}>
                  <SelectTrigger id='base-branch'>
                    <SelectValue placeholder={`Default: ${currentBranch || 'current branch'}`} />
                  </SelectTrigger>
                  <SelectContent>
                    {branches.map((branch: GitBranchEnhanced) => (
                      <SelectItem key={branch.name} value={branch.name}>
                        {branch.name}
                        {branch.current && ' (current)'}
                        {branch.isRemote && ' (remote)'}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <DialogFooter>
              <Button variant='outline' onClick={() => setCreateDialogOpen(false)}>
                Cancel
              </Button>
              <Button onClick={handleCreateBranch} disabled={!newBranchName.trim() || createBranch.isPending}>
                Create Branch
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </TooltipProvider>
  )
}
