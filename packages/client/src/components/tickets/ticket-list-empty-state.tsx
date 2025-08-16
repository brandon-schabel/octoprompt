import { Button } from '@promptliano/ui'
import { ListEmptyState, SearchEmptyState } from '@promptliano/ui'
import { Plus, Filter, ClipboardList } from 'lucide-react'

interface TicketListEmptyStateProps {
  hasFilters: boolean
  onCreateTicket: () => void
  filterStatus: string
  searchTerm: string
  onClearFilters?: () => void
}

export function TicketListEmptyState({
  hasFilters,
  onCreateTicket,
  filterStatus,
  searchTerm,
  onClearFilters
}: TicketListEmptyStateProps) {
  if (hasFilters) {
    return (
      <SearchEmptyState
        title="No tickets found"
        description={
          <>
            {searchTerm && <p>No tickets match "{searchTerm}"</p>}
            {filterStatus !== 'all' && (
              <p>No tickets with status "{filterStatus.replace('_', ' ')}"</p>
            )}
            <p>Try adjusting your search criteria or create a new ticket.</p>
          </>
        }
        action={
          <div className='flex gap-2'>
            {onClearFilters && (
              <Button variant='outline' onClick={onClearFilters}>
                <Filter className='mr-2 h-4 w-4' />
                Clear Filters
              </Button>
            )}
            <Button onClick={onCreateTicket}>
              <Plus className='mr-2 h-4 w-4' />
              Create Ticket
            </Button>
          </div>
        }
      />
    )
  }

  return (
    <ListEmptyState
      icon={ClipboardList}
      title="Start organizing your work"
      description="Create tickets to track features, bugs, and tasks. Break them down into smaller, actionable items to stay organized and productive."
      action={
        <Button onClick={onCreateTicket} size='lg'>
          <Plus className='mr-2 h-4 w-4' />
          Create Your First Ticket
        </Button>
      }
      tips={[
        'Use tickets to organize features, bugs, or any work items',
        'Break down tickets into smaller tasks for better tracking',
        'Set priorities and status to manage your workflow',
        'Attach relevant files to keep context in one place'
      ]}
    />
  )
}
