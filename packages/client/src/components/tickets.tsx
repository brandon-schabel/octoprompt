import React from 'react'
import { TicketDialog } from './tickets/ticket-dialog'
import { Button } from './ui/button'
import { Plus } from 'lucide-react'
import { useGetProject } from '@/hooks/api/use-projects-api'
import { TicketListPanel } from '@/components/tickets/ticket-list-panel'
import { TicketWithTasks } from '@/generated'
import { useActiveProjectTab } from '@/hooks/use-kv-local-storage'

export function TicketsPage() {
  const [isDialogOpen, setIsDialogOpen] = React.useState(false)

  // We store a ticket with tasks in local state so it matches
  // what TicketListPanel provides via onSelectTicket.
  const [selectedTicket, setSelectedTicket] = React.useState<TicketWithTasks | null>(null)

  const [projectTabState, , projectActiveTabId] = useActiveProjectTab()
  // const projectActiveTabId = projectTabState?.id ?? null;
  const projectId = projectTabState?.selectedProjectId ?? null

  const { data: projectData, isPending: isProjectLoading, error: projectError } = useGetProject(projectId ?? '')

  // Because TicketListPanel calls onSelectTicket with a TicketWithTasks,
  // this callback must accept a TicketWithTasks too.
  const handleSelectTicket = (ticket: TicketWithTasks) => {
    setSelectedTicket(ticket)
    setIsDialogOpen(true)
  }

  const handleCloseDialog = () => {
    setIsDialogOpen(false)
    setSelectedTicket(null)
  }

  if (!projectId) {
    return (
      <div className='p-4'>
        <h2 className='text-xl font- pbold'>No project selected</h2>
        <p>Select a project to view tickets.</p>
      </div>
    )
  }

  if (isProjectLoading) {
    return <div className='p-4'>Loading project info...</div>
  }
  if (projectError) {
    return <div className='p-4 text-red-500'>Error loading project</div>
  }

  return (
    <div className='p-4 space-y-4 h-full flex flex-col'>
      <div className='flex items-center justify-between'>
        <h2 className='text-2xl font-bold'>Tickets for {projectData?.data?.name}</h2>
        <Button onClick={() => setIsDialogOpen(true)}>
          <Plus className='mr-2 h-4 w-4' />
          New Ticket
        </Button>
      </div>

      <div className='flex-1'>
        <TicketListPanel projectTabId={projectActiveTabId || 'defaultTab'} onSelectTicket={handleSelectTicket} />
      </div>

      <TicketDialog
        isOpen={isDialogOpen}
        onClose={handleCloseDialog}
        ticketWithTasks={selectedTicket}
        projectId={projectId}
      />
    </div>
  )
}
