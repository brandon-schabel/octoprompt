import React from 'react'
import { type Ticket } from '@promptliano/schemas'
import {
  ConfiguredDataTable,
  createDataTableColumns,
  type DataTableColumnsConfig
} from '@promptliano/ui'
import { Badge } from '@promptliano/ui'

interface TicketDataTableProps {
  tickets: Ticket[]
  selectedTicket: Ticket | null
  onSelectTicket: (ticket: Ticket) => void
  isLoading?: boolean
}

export function TicketDataTable({ 
  tickets, 
  selectedTicket, 
  onSelectTicket,
  isLoading = false 
}: TicketDataTableProps) {
  
  // Priority configuration
  const priorityConfig = {
    low: { label: 'Low', variant: 'secondary' as const, className: 'bg-green-100 text-green-900' },
    normal: { label: 'Medium', variant: 'secondary' as const, className: 'bg-yellow-100 text-yellow-900' },
    high: { label: 'High', variant: 'secondary' as const, className: 'bg-red-100 text-red-900' }
  }
  
  // Status configuration
  const statusConfig = {
    open: { label: 'Open', variant: 'secondary' as const, className: 'bg-blue-100 text-blue-900' },
    in_progress: { label: 'In Progress', variant: 'secondary' as const, className: 'bg-orange-100 text-orange-900' },
    closed: { label: 'Closed', variant: 'outline' as const, className: 'text-muted-foreground' }
  }

  // Define columns using the column factory
  const columnsConfig: DataTableColumnsConfig<Ticket> = {
    selectable: false,
    columns: [
      {
        type: 'text',
        config: {
          accessorKey: 'title',
          header: 'Title',
          enableSorting: true,
                    className: 'font-semibold'
        }
      },
      {
        type: 'text',
        config: {
          accessorKey: 'overview',
          header: 'Description',
          truncate: true,
          maxLength: 100,
          enableSorting: false,
                    className: 'text-muted-foreground'
        }
      },
      {
        type: 'status',
        config: {
          accessorKey: 'priority',
          header: 'Priority',
          statuses: priorityConfig,
          enableSorting: true,
                  }
      },
      {
        type: 'status',
        config: {
          accessorKey: 'status',
          header: 'Status',
          statuses: statusConfig,
          enableSorting: true,
                  }
      },
      {
        type: 'date',
        config: {
          accessorKey: 'created',
          header: 'Created',
          format: 'relative',
          enableSorting: true
        }
      }
    ]
  }

  const columns = createDataTableColumns(columnsConfig)

  return (
    <ConfiguredDataTable
      columns={columns}
      data={tickets}
      isLoading={isLoading}
      pagination={{
        enabled: true,
        pageSize: 15,
        pageSizeOptions: [10, 15, 25, 50]
      }}
      sorting={{
        enabled: true,
        defaultSort: [{ id: 'created', desc: true }]
      }}
      filtering={{
        enabled: true,
        searchPlaceholder: 'Search tickets...'
      }}
      selection={{
        enabled: false
      }}
      onRowClick={(row) => onSelectTicket(row.original)}
      getRowId={(ticket) => ticket.id.toString()}
      emptyMessage='No tickets found. Create a ticket to track your work.'
      className='h-full'
      showToolbar={true}
      showPagination={tickets.length > 15}
    />
  )
}