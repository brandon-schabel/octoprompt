import React, { useState, useEffect } from 'react'
import { TicketsSidebarNav, type TicketView } from './tickets-sidebar-nav'
import { TicketListPanel } from './ticket-list-panel'
import { TicketDetailView } from './ticket-detail-view'
import { TicketWithTasks } from '@promptliano/schemas'
import { cn } from '@/lib/utils'
import { useGetTicketsWithTasks } from '@/hooks/api/use-tickets-api'
import { Skeleton } from '@promptliano/ui'
import { Button } from '@promptliano/ui'
import { Plus } from 'lucide-react'
import { TicketDialog } from './ticket-dialog'
import { QueueManagementPanel } from '@/components/queues/queue-management-panel'
import { KanbanBoard } from '@/components/queues/kanban-board'

interface TicketsTabWithSidebarProps {
  projectId: number
  projectName?: string
  projectTabId: number
  ticketView?: TicketView
  selectedTicketId?: number
  onTicketViewChange: (view: TicketView) => void
  onTicketSelect: (ticketId: number | undefined) => void
  className?: string
}

export function TicketsTabWithSidebar({
  projectId,
  projectName,
  projectTabId,
  ticketView = 'all',
  selectedTicketId,
  onTicketViewChange,
  onTicketSelect,
  className
}: TicketsTabWithSidebarProps) {
  const [selectedTicket, setSelectedTicket] = useState<TicketWithTasks | null>(null)
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false)

  // Fetch tickets based on view
  const statusFilter = ticketView === 'active' ? 'open' : ticketView === 'completed' ? 'closed' : undefined

  const { data: tickets, isLoading, refetch } = useGetTicketsWithTasks(projectId, statusFilter)

  // Update selected ticket when selectedTicketId changes
  useEffect(() => {
    if (selectedTicketId && tickets) {
      const ticket = tickets.find((t) => t.ticket.id === selectedTicketId)
      setSelectedTicket(ticket || null)
    } else {
      setSelectedTicket(null)
    }
  }, [selectedTicketId, tickets])

  const handleSelectTicket = (ticket: TicketWithTasks) => {
    setSelectedTicket(ticket)
    onTicketSelect(ticket.ticket.id)
  }

  const handleCreateNewTicket = () => {
    setIsCreateDialogOpen(true)
  }

  const renderContent = () => {
    switch (ticketView) {
      case 'analytics':
        return (
          <div className='flex items-center justify-center h-full text-muted-foreground'>
            <div className='text-center'>
              <h3 className='text-lg font-semibold mb-2'>Ticket Analytics</h3>
              <p>Analytics view coming soon...</p>
            </div>
          </div>
        )

      case 'queues':
        return <QueueManagementPanel projectId={projectId} />

      case 'all':
      case 'active':
      case 'completed':
        return <KanbanBoard projectId={projectId} onCreateTicket={handleCreateNewTicket} />
    }
  }

  return (
    <div className={cn('flex h-full', className)}>
      {/* Left Sidebar */}
      <div className='w-56 border-r bg-muted/30 flex-shrink-0'>
        <TicketsSidebarNav activeView={ticketView} onViewChange={onTicketViewChange} className='h-full' />
      </div>

      {/* Content Area */}
      <div className='flex-1 overflow-hidden'>{renderContent()}</div>

      <TicketDialog
        isOpen={isCreateDialogOpen}
        onClose={() => {
          setIsCreateDialogOpen(false)
          refetch()
        }}
        ticketWithTasks={null}
        projectId={projectId.toString()}
      />
    </div>
  )
}
