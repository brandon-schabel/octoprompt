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

      case 'all':
      case 'active':
      case 'completed':
        return (
          <div className='flex h-full'>
            {/* Ticket List */}
            <div className='w-96 border-r flex-shrink-0'>
              <div className='h-full flex flex-col'>
                <div className='flex items-center justify-between p-4 border-b'>
                  <h3 className='font-semibold'>
                    {ticketView === 'active'
                      ? 'Active Tickets'
                      : ticketView === 'completed'
                        ? 'Completed Tickets'
                        : 'All Tickets'}
                  </h3>
                  <Button size='sm' onClick={handleCreateNewTicket}>
                    <Plus className='h-4 w-4 mr-1' />
                    New
                  </Button>
                </div>
                <div className='flex-1 overflow-hidden'>
                  {isLoading ? (
                    <div className='p-4 space-y-3'>
                      <Skeleton className='h-24 w-full' />
                      <Skeleton className='h-24 w-full' />
                      <Skeleton className='h-24 w-full' />
                    </div>
                  ) : (
                    <div className='h-full overflow-y-auto'>
                      {tickets &&
                        tickets.map((ticket) => (
                          <div
                            key={ticket.ticket.id}
                            className={cn(
                              'p-4 border-b cursor-pointer hover:bg-muted/50 transition-colors',
                              selectedTicketId === ticket.ticket.id && 'bg-muted'
                            )}
                            onClick={() => handleSelectTicket(ticket)}
                          >
                            <h4 className='font-medium line-clamp-1'>{ticket.ticket.title}</h4>
                            <p className='text-sm text-muted-foreground line-clamp-2 mt-1'>{ticket.ticket.overview}</p>
                            <div className='flex items-center gap-2 mt-2'>
                              <span className='text-xs text-muted-foreground'>
                                {ticket.tasks.filter((t) => t.done).length}/{ticket.tasks.length} tasks
                              </span>
                            </div>
                          </div>
                        ))}
                      {tickets && tickets.length === 0 && (
                        <div className='p-4 text-center text-muted-foreground'>
                          <p>No tickets found</p>
                          <Button variant='link' size='sm' onClick={handleCreateNewTicket} className='mt-2'>
                            Create your first ticket
                          </Button>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Ticket Detail */}
            <div className='flex-1 overflow-hidden'>
              <TicketDetailView ticket={selectedTicket} projectId={projectId} onTicketUpdate={refetch} />
            </div>
          </div>
        )
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
