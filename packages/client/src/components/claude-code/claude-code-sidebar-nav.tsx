import React from 'react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Bot, MessageSquare, Clock, Settings, Code, Users } from 'lucide-react'

export type ClaudeCodeView = 'agents' | 'sessions' | 'chats' | 'settings'

interface ClaudeCodeSidebarNavProps {
  activeView: ClaudeCodeView
  onViewChange: (view: ClaudeCodeView) => void
  className?: string
}

export function ClaudeCodeSidebarNav({ activeView, onViewChange, className }: ClaudeCodeSidebarNavProps) {
  const navItems = [
    {
      id: 'agents' as ClaudeCodeView,
      label: 'Agents',
      icon: Bot,
      description: 'Manage AI agents',
      enabled: true
    },
    {
      id: 'sessions' as ClaudeCodeView,
      label: 'Sessions',
      icon: Clock,
      description: 'Active sessions',
      enabled: false
    },
    {
      id: 'chats' as ClaudeCodeView,
      label: 'Chats',
      icon: MessageSquare,
      description: 'Chat history',
      enabled: false
    },
    {
      id: 'settings' as ClaudeCodeView,
      label: 'Settings',
      icon: Settings,
      description: 'Claude Code settings',
      enabled: false
    }
  ]

  return (
    <div className={cn('flex flex-col gap-1 p-2', className)}>
      {navItems.map((item) => (
        <Button
          key={item.id}
          variant={activeView === item.id ? 'secondary' : 'ghost'}
          className={cn(
            'w-full justify-start gap-3 h-auto py-3 px-3',
            activeView === item.id && 'bg-secondary',
            !item.enabled && 'opacity-50 cursor-not-allowed'
          )}
          onClick={() => item.enabled && onViewChange(item.id)}
          disabled={!item.enabled}
        >
          <item.icon className='h-4 w-4 shrink-0' />
          <div className='flex flex-col items-start text-left'>
            <span className='text-sm font-medium'>{item.label}</span>
            <span className='text-xs text-muted-foreground'>{item.description}</span>
          </div>
        </Button>
      ))}
    </div>
  )
}
