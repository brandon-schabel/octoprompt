import { Button } from '@promptliano/ui'
import { Plus, Search, Filter, Sparkles, ClipboardList } from 'lucide-react'

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
      <div className='flex flex-col items-center justify-center h-full min-h-[400px] p-8 text-center space-y-4'>
        <div className='text-muted-foreground'>
          <Search className='mx-auto h-12 w-12 mb-4 opacity-50' />
        </div>
        <h3 className='text-lg font-semibold'>No tickets found</h3>
        <div className='max-w-md space-y-2'>
          {searchTerm && <p className='text-sm text-muted-foreground'>No tickets match "{searchTerm}"</p>}
          {filterStatus !== 'all' && (
            <p className='text-sm text-muted-foreground'>No tickets with status "{filterStatus.replace('_', ' ')}"</p>
          )}
          <p className='text-sm text-muted-foreground'>Try adjusting your search criteria or create a new ticket.</p>
        </div>
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
      </div>
    )
  }

  return (
    <div className='flex flex-col items-center justify-center h-full min-h-[400px] p-8 text-center space-y-6'>
      <div className='text-muted-foreground'>
        <div className='relative'>
          <ClipboardList className='mx-auto h-16 w-16 mb-4 opacity-20' />
          <Sparkles className='absolute top-0 right-0 h-6 w-6 text-primary opacity-60' />
        </div>
      </div>
      <div className='space-y-2'>
        <h3 className='text-xl font-semibold'>Start organizing your work</h3>
        <p className='max-w-md text-sm text-muted-foreground'>
          Create tickets to track features, bugs, and tasks. Break them down into smaller, actionable items to stay
          organized and productive.
        </p>
      </div>
      <Button onClick={onCreateTicket} size='lg'>
        <Plus className='mr-2 h-4 w-4' />
        Create Your First Ticket
      </Button>
      <div className='mt-8 p-4 bg-muted/30 rounded-lg max-w-md'>
        <h4 className='text-sm font-medium mb-2'>💡 Quick Tips</h4>
        <ul className='text-xs text-muted-foreground space-y-1 text-left'>
          <li>• Use tickets to organize features, bugs, or any work items</li>
          <li>• Break down tickets into smaller tasks for better tracking</li>
          <li>• Set priorities and status to manage your workflow</li>
          <li>• Attach relevant files to keep context in one place</li>
        </ul>
      </div>
    </div>
  )
}
