import React from 'react'
import { cn } from '@/lib/utils'
import { Button } from '@promptliano/ui'
import { GitBranch, History, Package2, FileSignature, FolderTree } from 'lucide-react'

export type GitView = 'changes' | 'history' | 'branches' | 'stashes' | 'worktrees'

interface GitSidebarNavProps {
  activeView: GitView
  onViewChange: (view: GitView) => void
  className?: string
}

export function GitSidebarNav({ activeView, onViewChange, className }: GitSidebarNavProps) {
  const navItems = [
    {
      id: 'changes' as GitView,
      label: 'Changes',
      icon: FileSignature,
      description: 'Stage and commit changes'
    },
    {
      id: 'history' as GitView,
      label: 'History',
      icon: History,
      description: 'View commit history'
    },
    {
      id: 'branches' as GitView,
      label: 'Branches',
      icon: GitBranch,
      description: 'Manage branches'
    },
    {
      id: 'stashes' as GitView,
      label: 'Stashes',
      icon: Package2,
      description: 'Manage stashed changes'
    },
    {
      id: 'worktrees' as GitView,
      label: 'Worktrees',
      icon: FolderTree,
      description: 'Manage git worktrees'
    }
  ]

  return (
    <div className={cn('flex flex-col gap-1 p-2', className)}>
      {navItems.map((item) => (
        <Button
          key={item.id}
          variant={activeView === item.id ? 'secondary' : 'ghost'}
          className={cn('w-full justify-start gap-3 h-auto py-3 px-3', activeView === item.id && 'bg-secondary')}
          onClick={() => onViewChange(item.id)}
        >
          <item.icon className='h-4 w-4 shrink-0' />
          <div className='flex flex-col items-start text-left'>
            <span className='text-sm font-medium whitespace-nowrap'>{item.label}</span>
            <span className='text-xs text-muted-foreground whitespace-nowrap'>{item.description}</span>
          </div>
        </Button>
      ))}
    </div>
  )
}
