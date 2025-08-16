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
        searchTerm={searchTerm}
        actions={[
          ...(onClearFilters ? [{ label: 'Clear Filters', onClick: onClearFilters, variant: 'outline' as const }] : []),
          { label: 'Create Ticket', onClick: onCreateTicket }
        ]}
      />
    )
  }

  return (
    <ListEmptyState
      icon={ClipboardList}
      title="Start organizing your work"
      description="Create tickets to track features, bugs, and tasks. Break them down into smaller, actionable items to stay organized and productive."
      actions={
        <Button onClick={onCreateTicket} size='lg'>
          <Plus className='mr-2 h-4 w-4' />
          Create Your First Ticket
        </Button>
      }
      tip="Use tickets to organize features, bugs, or any work items. Break down tickets into smaller tasks for better tracking."
    />
  )
}
