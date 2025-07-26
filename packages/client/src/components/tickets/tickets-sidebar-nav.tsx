import React from 'react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { List, CheckCircle2, BarChart3, Clock } from 'lucide-react'

export type TicketView = 'all' | 'active' | 'completed' | 'analytics'

interface TicketsSidebarNavProps {
  activeView: TicketView
  onViewChange: (view: TicketView) => void
  className?: string
}

export function TicketsSidebarNav({ activeView, onViewChange, className }: TicketsSidebarNavProps) {
  const navItems = [
    {
      id: 'all' as TicketView,
      label: 'All Tickets',
      icon: List,
      description: 'View all tickets and tasks'
    },
    {
      id: 'active' as TicketView,
      label: 'Active',
      icon: Clock,
      description: 'Open and in-progress tickets'
    },
    {
      id: 'completed' as TicketView,
      label: 'Completed',
      icon: CheckCircle2,
      description: 'Closed tickets'
    },
    {
      id: 'analytics' as TicketView,
      label: 'Analytics',
      icon: BarChart3,
      description: 'Ticket insights and metrics'
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
            activeView === item.id && 'bg-secondary'
          )}
          onClick={() => onViewChange(item.id)}
        >
          <item.icon className="h-4 w-4 shrink-0" />
          <div className="flex flex-col items-start text-left">
            <span className="text-sm font-medium whitespace-nowrap">{item.label}</span>
            <span className="text-xs text-muted-foreground whitespace-nowrap">{item.description}</span>
          </div>
        </Button>
      ))}
    </div>
  )
}