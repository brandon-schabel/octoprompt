import React, { useState, useMemo } from 'react'
import { useBranchesEnhanced } from '@/hooks/api/use-git-api'
import type { GitBranchEnhanced } from '@promptliano/schemas'
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator
} from '@promptliano/ui'
import { Popover, PopoverContent, PopoverTrigger } from '@promptliano/ui'
import { Button } from '@promptliano/ui'
import { Badge } from '@promptliano/ui'
import { Skeleton } from '@promptliano/ui'
import { GitBranch, Star, Check, ChevronsUpDown } from 'lucide-react'
import { cn } from '@/lib/utils'

interface BranchSelectorSearchableProps {
  projectId: number
  selectedBranch?: string
  onBranchChange: (branch: string) => void
}

export function BranchSelectorSearchable({ projectId, selectedBranch, onBranchChange }: BranchSelectorSearchableProps) {
  const [open, setOpen] = useState(false)
  const [search, setSearch] = useState('')
  const { data: response, isLoading, error } = useBranchesEnhanced(projectId)

  const branches = response?.data?.branches || []
  const currentBranch = response?.data?.current || ''
  const activeBranch = selectedBranch || currentBranch

  // Sort and filter branches
  const { localBranches, remoteBranches } = useMemo(() => {
    const filtered = branches.filter((branch: GitBranchEnhanced) => branch.name.toLowerCase().includes(search.toLowerCase()))

    // Sort: current branch first, then by last activity
    const sorted = filtered.sort((a: GitBranchEnhanced, b: GitBranchEnhanced) => {
      if (a.name === currentBranch) return -1
      if (b.name === currentBranch) return 1
      // TODO: Sort by actual date when relative time is fixed
      return a.name.localeCompare(b.name)
    })

    return {
      localBranches: sorted.filter((b: GitBranchEnhanced) => !b.isRemote),
      remoteBranches: sorted.filter((b: GitBranchEnhanced) => b.isRemote)
    }
  }, [branches, currentBranch, search])

  const handleSelect = (branchName: string) => {
    onBranchChange(branchName)
    setOpen(false)
    setSearch('')
  }

  if (isLoading) {
    return <Skeleton className='h-10 w-[280px]' />
  }

  if (error || !branches.length) {
    return (
      <div className='flex items-center gap-2 text-sm text-muted-foreground'>
        <GitBranch className='h-4 w-4' />
        <span>No branches available</span>
      </div>
    )
  }

  // Find the display branch info
  const displayBranch = branches.find((b: GitBranchEnhanced) => b.name === activeBranch)

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant='outline' role='combobox' aria-expanded={open} className='w-[280px] justify-between'>
          <div className='flex items-center gap-2 truncate'>
            <GitBranch className='h-4 w-4 shrink-0' />
            <span className='truncate'>{activeBranch}</span>
            {activeBranch === currentBranch && <Star className='h-3 w-3 fill-yellow-500 text-yellow-500 shrink-0' />}
          </div>
          <ChevronsUpDown className='ml-2 h-4 w-4 shrink-0 opacity-50' />
        </Button>
      </PopoverTrigger>
      <PopoverContent className='w-[320px] p-0' align='start'>
        <Command>
          <CommandInput placeholder='Search branches...' value={search} onValueChange={setSearch} />
          <CommandList>
            <CommandEmpty>No branches found</CommandEmpty>

            {localBranches.length > 0 && (
              <CommandGroup heading='Local Branches'>
                {localBranches.map((branch: GitBranchEnhanced) => (
                  <CommandItem
                    key={branch.name}
                    value={branch.name}
                    onSelect={() => handleSelect(branch.name)}
                    className='flex items-center justify-between py-2'
                  >
                    <div className='flex items-center gap-2 flex-1 min-w-0'>
                      <GitBranch className='h-4 w-4 shrink-0' />
                      <span className='truncate font-medium'>{branch.name}</span>
                      {branch.name === currentBranch && (
                        <Star className='h-3 w-3 fill-yellow-500 text-yellow-500 shrink-0' />
                      )}
                      {branch.current && (
                        <Badge variant='secondary' className='text-xs px-1 py-0 shrink-0'>
                          HEAD
                        </Badge>
                      )}
                    </div>
                    {branch.name === activeBranch && <Check className='h-4 w-4 shrink-0' />}
                  </CommandItem>
                ))}
              </CommandGroup>
            )}

            {localBranches.length > 0 && remoteBranches.length > 0 && <CommandSeparator />}

            {remoteBranches.length > 0 && (
              <CommandGroup heading='Remote Branches'>
                {remoteBranches.map((branch: GitBranchEnhanced) => (
                  <CommandItem
                    key={branch.name}
                    value={branch.name}
                    onSelect={() => handleSelect(branch.name)}
                    className='flex items-center justify-between py-2'
                  >
                    <div className='flex items-center gap-2 flex-1 min-w-0'>
                      <GitBranch className='h-4 w-4 shrink-0' />
                      <span className='truncate font-medium'>{branch.name}</span>
                      <Badge variant='outline' className='text-xs px-1 py-0 shrink-0'>
                        remote
                      </Badge>
                    </div>
                    {branch.name === activeBranch && <Check className='h-4 w-4 shrink-0' />}
                  </CommandItem>
                ))}
              </CommandGroup>
            )}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  )
}
