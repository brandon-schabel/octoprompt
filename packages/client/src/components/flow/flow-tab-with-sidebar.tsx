import React, { useState } from 'react'
import { cn } from '@/lib/utils'
import { FlowSidebarNav } from './flow-sidebar-nav'
import { useMediaQuery } from '@/hooks/use-media-query'
import { QueueOverviewView } from '@/components/queues/views/queue-overview-view'
import { QueueTimelineView } from '@/components/queues/views/queue-timeline-view'
import { QueueAnalyticsView } from '@/components/queues/views/queue-analytics-view'
import { QueueCreateDialog } from '@/components/queues/queue-create-dialog'
import { SimpleTicketList } from './simple-ticket-list'
import { TicketDetailView } from '@/components/tickets/ticket-detail-view'
import { KanbanBoard } from '@/components/queues/kanban-board'
import { TicketDialog } from '@/components/tickets/ticket-dialog'
import { useGetTicketsWithTasks } from '@/hooks/api/use-tickets-api'
import { TicketWithTasks } from '@promptliano/schemas'
import { Button } from '@promptliano/ui'
import { Plus } from 'lucide-react'
import { type FlowView } from '@/lib/search-schemas'

interface FlowTabWithSidebarProps {
  projectId: number
  projectName?: string
  projectTabId: number
  flowView?: FlowView
  selectedTicketId?: number
  selectedQueueId?: number
  onFlowViewChange: (view: FlowView) => void
  onTicketSelect: (ticketId: number | undefined) => void
  onQueueSelect: (queueId: number | undefined) => void
  className?: string
}

export function FlowTabWithSidebar({
  projectId,
  projectName,
  projectTabId,
  flowView = 'queues',
  selectedTicketId,
  selectedQueueId,
  onFlowViewChange,
  onTicketSelect,
  onQueueSelect,
  className
}: FlowTabWithSidebarProps) {
  const [isCreateQueueDialogOpen, setIsCreateQueueDialogOpen] = useState(false)
  const [isCreateTicketDialogOpen, setIsCreateTicketDialogOpen] = useState(false)
  const [selectedTicket, setSelectedTicket] = useState<TicketWithTasks | null>(null)

  // Responsive sidebar width
  const isCompact = useMediaQuery('(max-width: 768px)')

  // Fetch tickets for the tickets view
  const { data: tickets, isLoading, refetch, error } = useGetTicketsWithTasks(projectId)

  // Handle ticket selection
  const handleSelectTicket = (ticket: TicketWithTasks) => {
    setSelectedTicket(ticket)
    onTicketSelect(ticket.ticket.id)
  }

  const renderContent = () => {
    switch (flowView) {
      case 'queues':
        return (
          <QueueOverviewView
            projectId={projectId}
            selectedQueueId={selectedQueueId}
            onQueueSelect={onQueueSelect}
            onCreateQueue={() => setIsCreateQueueDialogOpen(true)}
          />
        )

      case 'tickets':
        return (
          <div className='flex h-full'>
            <div className='w-1/3 min-w-[300px] max-w-[400px] border-r'>
              <div className='h-full flex flex-col'>
                <div className='p-4 border-b flex items-center justify-between'>
                  <h3 className='font-semibold'>Tickets</h3>
                  <Button size='sm' onClick={() => setIsCreateTicketDialogOpen(true)} className='gap-1'>
                    <Plus className='h-4 w-4' />
                    New Ticket
                  </Button>
                </div>
                <div className='flex-1 overflow-y-auto'>
                  {error ? (
                    <div className='p-4 text-red-500'>
                      <p className='font-semibold'>Error loading tickets</p>
                      <p className='text-sm mt-1'>{(error as any)?.message || 'Please try refreshing the page'}</p>
                      <Button size='sm' onClick={() => refetch()} className='mt-2'>
                        Retry
                      </Button>
                    </div>
                  ) : (
                    <SimpleTicketList
                      tickets={tickets || []}
                      selectedTicket={selectedTicket}
                      onSelectTicket={handleSelectTicket}
                      loading={isLoading}
                    />
                  )}
                </div>
              </div>
            </div>
            <div className='flex-1'>
              {selectedTicket ? (
                <TicketDetailView ticket={selectedTicket} projectId={projectId} onTicketUpdate={refetch} />
              ) : (
                <div className='flex items-center justify-center h-full text-muted-foreground'>
                  <p>Select a ticket to view details</p>
                </div>
              )}
            </div>
          </div>
        )

      case 'kanban':
        return <KanbanBoard projectId={projectId} onCreateTicket={() => setIsCreateTicketDialogOpen(true)} />

      case 'analytics':
        return (
          <div className='p-6'>
            <div className='grid grid-cols-1 lg:grid-cols-2 gap-6'>
              <div>
                <h3 className='text-lg font-semibold mb-4'>Queue Analytics</h3>
                <QueueAnalyticsView projectId={projectId} selectedQueueId={selectedQueueId} />
              </div>
              <div>
                <h3 className='text-lg font-semibold mb-4'>Ticket Analytics</h3>
                <div className='flex items-center justify-center h-64 text-muted-foreground border rounded-lg'>
                  <p>Ticket analytics coming soon...</p>
                </div>
              </div>
            </div>
          </div>
        )

      default:
        return null
    }
  }

  return (
    <div className={cn('flex h-full', className)}>
      {/* Left Sidebar - responsive width */}
      <div className={cn('border-r flex-shrink-0 transition-all duration-200', isCompact ? 'w-16' : 'w-64')}>
        <FlowSidebarNav activeView={flowView} onViewChange={onFlowViewChange} className='h-full' />
      </div>

      {/* Content Area */}
      <div className='flex-1 overflow-hidden'>{renderContent()}</div>

      {/* Dialogs */}
      <QueueCreateDialog
        projectId={projectId}
        open={isCreateQueueDialogOpen}
        onOpenChange={setIsCreateQueueDialogOpen}
      />

      <TicketDialog
        isOpen={isCreateTicketDialogOpen}
        onClose={() => {
          setIsCreateTicketDialogOpen(false)
          refetch()
        }}
        ticketWithTasks={null}
        projectId={projectId.toString()}
      />
    </div>
  )
}
