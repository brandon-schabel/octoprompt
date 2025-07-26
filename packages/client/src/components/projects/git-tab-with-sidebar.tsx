import React from 'react'
import { GitSidebarNav, type GitView } from './git-sidebar-nav'
import { GitTabView } from './git-tab-view'
import { CommitList } from './git-commit-history/commit-list'
import { GitStashView } from './git-stash-view'
import { GitBranchesView } from './git-branches-view'
import { GitWorktreeView } from './git-worktree-view'
import { cn } from '@/lib/utils'

interface GitTabWithSidebarProps {
  projectId: number
  gitView?: GitView
  onGitViewChange: (view: GitView) => void
  className?: string
}

export function GitTabWithSidebar({ projectId, gitView = 'changes', onGitViewChange, className }: GitTabWithSidebarProps) {
  return (
    <div className={cn('flex h-full', className)}>
      {/* Left Sidebar - increased width from w-48 to w-56 */}
      <div className="w-56 border-r bg-muted/30 flex-shrink-0">
        <GitSidebarNav
          activeView={gitView}
          onViewChange={onGitViewChange}
          className="h-full"
        />
      </div>
      
      {/* Content Area */}
      <div className="flex-1 overflow-hidden">
        {gitView === 'changes' && <GitTabView projectId={projectId} />}
        {gitView === 'history' && <CommitList projectId={projectId} />}
        {gitView === 'branches' && <GitBranchesView projectId={projectId} />}
        {gitView === 'stashes' && <GitStashView projectId={projectId} />}
        {gitView === 'worktrees' && <GitWorktreeView projectId={projectId} />}
      </div>
    </div>
  )
}