import React from 'react'
import { useBranchesEnhanced } from '@/hooks/api/use-git-api'
import type { GitBranchEnhanced } from '@promptliano/schemas'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  SelectGroup,
  SelectLabel
} from '@promptliano/ui'
import { Badge } from '@promptliano/ui'
import { Skeleton } from '@promptliano/ui'
import { GitBranch, Star, Clock, User } from 'lucide-react'

interface BranchSelectorProps {
  projectId: number
  selectedBranch?: string
  onBranchChange: (branch: string) => void
}

export function BranchSelector({ projectId, selectedBranch, onBranchChange }: BranchSelectorProps) {
  const { data: response, isLoading, error } = useBranchesEnhanced(projectId)

  const branches = response?.data?.branches || []
  const currentBranch = response?.data?.current || ''

  if (isLoading) {
    return <Skeleton className='h-10 w-[200px]' />
  }

  if (error || !branches.length) {
    return (
      <div className='flex items-center gap-2 text-sm text-muted-foreground'>
        <GitBranch className='h-4 w-4' />
        <span>No branches available</span>
      </div>
    )
  }

  // Group branches into local and remote
  const localBranches = branches.filter((b: GitBranchEnhanced) => !b.isRemote)
  const remoteBranches = branches.filter((b: GitBranchEnhanced) => b.isRemote)

  return (
    <Select value={selectedBranch || currentBranch} onValueChange={onBranchChange}>
      <SelectTrigger className='w-[300px]'>
        <div className='flex items-center gap-2'>
          <GitBranch className='h-4 w-4' />
          <SelectValue placeholder='Select a branch' />
        </div>
      </SelectTrigger>
      <SelectContent className='max-h-[400px]'>
        {localBranches.length > 0 && (
          <SelectGroup>
            <SelectLabel>Local Branches</SelectLabel>
            {localBranches.map((branch: GitBranchEnhanced) => (
              <SelectItem key={branch.name} value={branch.name}>
                <div className='flex flex-col gap-1 py-1'>
                  <div className='flex items-center gap-2'>
                    <span className='font-medium'>{branch.name}</span>
                    {branch.name === currentBranch && <Star className='h-3 w-3 fill-yellow-500 text-yellow-500' />}
                    {branch.current && (
                      <Badge variant='secondary' className='text-xs px-1 py-0'>
                        HEAD
                      </Badge>
                    )}
                  </div>
                  {branch.latestCommit && (
                    <div className='flex items-center gap-3 text-xs text-muted-foreground'>
                      <div className='flex items-center gap-1'>
                        <Clock className='h-3 w-3' />
                        <span>{branch.latestCommit.relativeTime}</span>
                      </div>
                      <div className='flex items-center gap-1 max-w-[200px]'>
                        <User className='h-3 w-3' />
                        <span className='truncate'>{branch.latestCommit.author}</span>
                      </div>
                    </div>
                  )}
                  {branch.latestCommit?.subject && (
                    <p className='text-xs text-muted-foreground line-clamp-1'>{branch.latestCommit.subject}</p>
                  )}
                </div>
              </SelectItem>
            ))}
          </SelectGroup>
        )}

        {remoteBranches.length > 0 && (
          <SelectGroup>
            <SelectLabel>Remote Branches</SelectLabel>
            {remoteBranches.map((branch: GitBranchEnhanced) => (
              <SelectItem key={branch.name} value={branch.name}>
                <div className='flex flex-col gap-1 py-1'>
                  <div className='flex items-center gap-2'>
                    <span className='font-medium'>{branch.name}</span>
                    <Badge variant='outline' className='text-xs px-1 py-0'>
                      remote
                    </Badge>
                  </div>
                  {branch.latestCommit && (
                    <div className='flex items-center gap-3 text-xs text-muted-foreground'>
                      <div className='flex items-center gap-1'>
                        <Clock className='h-3 w-3' />
                        <span>{branch.latestCommit.relativeTime}</span>
                      </div>
                      <div className='flex items-center gap-1 max-w-[200px]'>
                        <User className='h-3 w-3' />
                        <span className='truncate'>{branch.latestCommit.author}</span>
                      </div>
                    </div>
                  )}
                  {branch.latestCommit?.subject && (
                    <p className='text-xs text-muted-foreground line-clamp-1'>{branch.latestCommit.subject}</p>
                  )}
                </div>
              </SelectItem>
            ))}
          </SelectGroup>
        )}
      </SelectContent>
    </Select>
  )
}
