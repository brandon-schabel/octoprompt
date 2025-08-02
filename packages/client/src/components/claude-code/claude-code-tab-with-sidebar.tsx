import React from 'react'
import { ClaudeCodeSidebarNav, type ClaudeCodeView } from './claude-code-sidebar-nav'
import { AgentsView, CommandsView, MCPView, SessionsView, ChatsView } from './views'
import { cn } from '@/lib/utils'

interface ClaudeCodeTabWithSidebarProps {
  projectId: number
  projectName?: string
  claudeCodeView?: ClaudeCodeView
  onClaudeCodeViewChange: (view: ClaudeCodeView) => void
  sessionId?: string
  onSessionIdChange: (sessionId: string | undefined) => void
  className?: string
}

export function ClaudeCodeTabWithSidebar({
  projectId,
  projectName,
  claudeCodeView = 'agents',
  onClaudeCodeViewChange,
  sessionId,
  onSessionIdChange,
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
        {claudeCodeView === 'commands' && <CommandsView projectId={projectId} projectName={projectName} />}
        {claudeCodeView === 'mcp' && <MCPView projectId={projectId} projectName={projectName} />}
        {claudeCodeView === 'sessions' && (
          <SessionsView 
            projectId={projectId} 
            projectName={projectName}
            onSelectSession={(sessionId) => {
              onSessionIdChange(sessionId)
              onClaudeCodeViewChange('chats')
            }}
          />
        )}
        {claudeCodeView === 'chats' && (
          <ChatsView 
            projectId={projectId} 
            projectName={projectName}
            sessionId={sessionId}
            onBack={() => {
              onSessionIdChange(undefined)
              onClaudeCodeViewChange('sessions')
            }}
          />
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
