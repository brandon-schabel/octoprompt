import { Button } from '@ui'
import { Plus } from 'lucide-react'

interface TicketEmptyStateProps {
  onCreateTicket: () => void
}

export function TicketEmptyState({ onCreateTicket }: TicketEmptyStateProps) {
  return (
    <div className='w-full flex flex-col items-center justify-center text-center py-16 space-y-4 border rounded bg-card'>
      <div className='text-muted-foreground'>
        {/* Icon or Illustration */}
        <Plus className='mx-auto h-8 w-8 mb-2 opacity-50' />
      </div>
      <h3 className='text-xl font-semibold'>No Tickets Yet</h3>
      <p className='max-w-md text-sm text-muted-foreground'>
        It looks like there aren’t any tickets for this project. Create the first one to get started!
      </p>
      <div>
        <Button onClick={onCreateTicket}>
          <Plus className='mr-2 h-4 w-4' />
          Create Ticket
        </Button>
      </div>
    </div>
  )
}
