import React from 'react'
import { TicketDialog } from './ticket-dialog'
import { Button } from '../ui/button'
import { Plus } from 'lucide-react'
import { TicketListPanel } from './ticket-list-panel'
import { TicketWithTasks } from '@octoprompt/schemas'

interface TicketsTabViewProps {
  projectId: number
  projectName?: string
  projectTabId: number
}

export function TicketsTabView({ projectId, projectName, projectTabId }: TicketsTabViewProps) {
  const [isDialogOpen, setIsDialogOpen] = React.useState(false)
  const [selectedTicket, setSelectedTicket] = React.useState<TicketWithTasks | null>(null)

  const handleSelectTicket = (ticket: TicketWithTasks) => {
    setSelectedTicket(ticket)
    setIsDialogOpen(true)
  }

  const handleCloseDialog = () => {
    setIsDialogOpen(false)
    setSelectedTicket(null)
  }

  const handleCreateNewTicket = () => {
    setSelectedTicket(null)
    setIsDialogOpen(true)
  }

  return (
    <div className='p-4 space-y-4 h-full flex flex-col'>
      <div className='flex items-center justify-between'>
        <h3 className='text-lg font-semibold'>Tickets & Tasks{projectName ? ` for ${projectName}` : ''}</h3>
        <Button onClick={handleCreateNewTicket}>
          <Plus className='mr-2 h-4 w-4' />
          New Ticket
        </Button>
      </div>

      <div className='flex-1'>
        <TicketListPanel projectTabId={projectTabId.toString()} onSelectTicket={handleSelectTicket} />
      </div>

      <TicketDialog
        isOpen={isDialogOpen}
        onClose={handleCloseDialog}
        ticketWithTasks={selectedTicket}
        projectId={projectId.toString()}
      />
    </div>
  )
}
