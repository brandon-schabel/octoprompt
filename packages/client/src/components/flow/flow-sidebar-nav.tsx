import React from 'react'
import { cn } from '@/lib/utils'
import { Button, Tooltip, TooltipContent, TooltipTrigger } from '@promptliano/ui'
import { ListOrdered, ListTodo, LayoutGrid, BarChart3 } from 'lucide-react'
import { useMediaQuery } from '@/hooks/use-media-query'
import type { FlowView } from '@/lib/search-schemas'

interface FlowSidebarNavProps {
  activeView: FlowView
  onViewChange: (view: FlowView) => void
  className?: string
}

export function FlowSidebarNav({ activeView, onViewChange, className }: FlowSidebarNavProps) {
  // Progressive responsive breakpoints
  const hideSubtitle = useMediaQuery('(max-width: 1024px)') // First hide subtitle at medium screens
  const hideTitle = useMediaQuery('(max-width: 768px)') // Then hide title at smaller screens

  const navItems = [
    {
      id: 'queues' as FlowView,
      label: 'Task Queues',
      icon: ListOrdered,
      description: 'AI task processing queues'
    },
    {
      id: 'tickets' as FlowView,
      label: 'Tickets & Tasks',
      icon: ListTodo,
      description: 'View all tickets and tasks'
    },
    {
      id: 'kanban' as FlowView,
      label: 'Kanban Queues',
      icon: LayoutGrid,
      description: 'Visual task management'
    },
    {
      id: 'analytics' as FlowView,
      label: 'Analytics',
      icon: BarChart3,
      description: 'Flow insights and metrics'
    }
  ]

  const renderNavButton = (item: (typeof navItems)[0]) => {
    const button = (
      <Button
        key={item.id}
        variant={activeView === item.id ? 'secondary' : 'ghost'}
        className={cn(
          'w-full justify-start h-auto',
          hideTitle ? 'p-3' : 'gap-3 py-3 px-3',
          activeView === item.id && 'bg-secondary'
        )}
        onClick={() => onViewChange(item.id)}
      >
        <item.icon className={cn('shrink-0', hideTitle ? 'h-5 w-5' : 'h-4 w-4')} />
        {!hideTitle && (
          <div className='flex flex-col items-start text-left'>
            <span className='text-sm font-medium whitespace-nowrap'>{item.label}</span>
            {!hideSubtitle && (
              <span className='text-xs text-muted-foreground whitespace-nowrap'>{item.description}</span>
            )}
          </div>
        )}
      </Button>
    )

    // Add tooltip when only showing icon
    if (hideTitle) {
      return (
        <Tooltip key={item.id}>
          <TooltipTrigger asChild>{button}</TooltipTrigger>
          <TooltipContent side='right'>
            <div className='flex flex-col'>
              <span className='font-medium'>{item.label}</span>
              <span className='text-xs text-muted-foreground'>{item.description}</span>
            </div>
          </TooltipContent>
        </Tooltip>
      )
    }

    return button
  }

  return <div className={cn('flex flex-col gap-1 p-2', className)}>{navItems.map(renderNavButton)}</div>
}
