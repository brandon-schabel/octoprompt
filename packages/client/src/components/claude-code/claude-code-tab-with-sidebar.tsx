import React from 'react'
import { ClaudeCodeSidebarNav, type ClaudeCodeView } from './claude-code-sidebar-nav'
import { AgentsView } from './views'
import { cn } from '@/lib/utils'

interface ClaudeCodeTabWithSidebarProps {
  projectId: number
  projectName?: string
  claudeCodeView?: ClaudeCodeView
  onClaudeCodeViewChange: (view: ClaudeCodeView) => void
  className?: string
}

export function ClaudeCodeTabWithSidebar({
  projectId,
  projectName,
  claudeCodeView = 'agents',
  onClaudeCodeViewChange,
  className
}: ClaudeCodeTabWithSidebarProps) {
  return (
    <div className={cn('flex h-full', className)}>
      {/* Left Sidebar */}
      <div className='w-56 border-r bg-muted/30 flex-shrink-0'>
        <ClaudeCodeSidebarNav activeView={claudeCodeView} onViewChange={onClaudeCodeViewChange} className='h-full' />
      </div>

      {/* Content Area */}
      <div className='flex-1 overflow-auto'>
        {claudeCodeView === 'agents' && <AgentsView projectId={projectId} projectName={projectName} />}
        {claudeCodeView === 'sessions' && (
          <div className='p-6 text-center text-muted-foreground'>
            <p>Sessions feature coming soon...</p>
          </div>
        )}
        {claudeCodeView === 'chats' && (
          <div className='p-6 text-center text-muted-foreground'>
            <p>Chats feature coming soon...</p>
          </div>
        )}
        {claudeCodeView === 'settings' && (
          <div className='p-6 text-center text-muted-foreground'>
            <p>Claude Code settings coming soon...</p>
          </div>
        )}
      </div>
    </div>
  )
}
