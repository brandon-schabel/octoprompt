import { ColumnDef } from '@tanstack/react-table'
import { Badge } from '@promptliano/ui'
import { Checkbox } from '@promptliano/ui'
import { DataTableColumnHeader } from '@promptliano/ui'
import { formatDistanceToNow } from 'date-fns'
import { CheckCircle, XCircle, Timer, AlertCircle } from 'lucide-react'
import type { MCPToolExecution } from '@promptliano/schemas'
import { cn } from '@/lib/utils'

// Helper function to extract action from input params
function getActionFromParams(inputParams: string | null | undefined): string | null {
  if (!inputParams) return null

  try {
    const params = JSON.parse(inputParams)
    return params?.action || null
  } catch (e) {
    return null
  }
}

// Helper function to format duration
function formatDuration(ms: number | null | undefined): string {
  if (!ms) return 'N/A'
  if (ms < 1000) return `${ms}ms`
  return `${(ms / 1000).toFixed(2)}s`
}

// Helper function to format bytes
function formatBytes(bytes: number | null | undefined): string {
  if (!bytes) return 'N/A'
  if (bytes < 1024) return `${bytes} B`
  return `${(bytes / 1024).toFixed(1)} KB`
}

export const mcpExecutionsColumns: ColumnDef<MCPToolExecution>[] = [
  {
    id: 'select',
    header: ({ table }) => (
      <Checkbox
        checked={table.getIsAllPageRowsSelected() || (table.getIsSomePageRowsSelected() && 'indeterminate')}
        onCheckedChange={(value) => table.toggleAllPageRowsSelected(!!value)}
        aria-label='Select all'
        className='translate-y-[2px]'
      />
    ),
    cell: ({ row }) => (
      <Checkbox
        checked={row.getIsSelected()}
        onCheckedChange={(value) => row.toggleSelected(!!value)}
        aria-label='Select row'
        className='translate-y-[2px]'
      />
    ),
    enableSorting: false,
    enableHiding: false,
    meta: {
      width: 40
    }
  },
  {
    accessorKey: 'status',
    header: ({ column }) => <DataTableColumnHeader column={column} title='Status' />,
    cell: ({ row }) => {
      const status = row.getValue('status') as string
      const StatusIcon =
        {
          success: CheckCircle,
          error: XCircle,
          timeout: Timer
        }[status] || AlertCircle

      const statusColor =
        {
          success: 'text-green-500',
          error: 'text-red-500',
          timeout: 'text-yellow-500'
        }[status] || 'text-gray-500'

      return (
        <div className='flex items-center'>
          <StatusIcon className={cn('h-4 w-4', statusColor)} />
        </div>
      )
    },
    filterFn: (row, id, value) => {
      return value.includes(row.getValue(id))
    },
    meta: {
      width: 60,
      align: 'center',
      filterOptions: [
        { label: 'Success', value: 'success', icon: CheckCircle },
        { label: 'Error', value: 'error', icon: XCircle },
        { label: 'Timeout', value: 'timeout', icon: Timer }
      ],
      filterTitle: 'Status'
    }
  },
  {
    accessorKey: 'toolName',
    header: ({ column }) => <DataTableColumnHeader column={column} title='Tool' />,
    cell: ({ row }) => {
      const toolName = row.getValue('toolName') as string
      return <span className='font-medium'>{toolName}</span>
    },
    filterFn: 'includesString',
    meta: {
      filterType: 'text',
      filterTitle: 'Tool',
      filterPlaceholder: 'Filter tools...'
    }
  },
  {
    id: 'action',
    accessorFn: (row) => getActionFromParams(row.inputParams) || '',
    header: ({ column }) => <DataTableColumnHeader column={column} title='Action' />,
    cell: ({ row }) => {
      const action = row.getValue('action') as string

      if (!action) {
        return <span className='text-muted-foreground'>-</span>
      }

      return (
        <Badge variant='secondary' className='font-mono text-xs'>
          {action}
        </Badge>
      )
    },
    filterFn: 'includesString',
    enableSorting: true,
    sortingFn: 'alphanumeric',
    meta: {
      filterType: 'text',
      filterTitle: 'Action',
      filterPlaceholder: 'Filter actions...',
      clientSideSort: true // Mark this for client-side sorting
    }
  },
  {
    accessorKey: 'startedAt',
    header: ({ column }) => <DataTableColumnHeader column={column} title='Started' />,
    cell: ({ row }) => {
      const timestamp = row.getValue('startedAt') as number
      return (
        <div className='flex flex-col'>
          <span className='text-sm'>{formatDistanceToNow(new Date(timestamp), { addSuffix: true })}</span>
          <span className='text-xs text-muted-foreground'>{new Date(timestamp).toLocaleString()}</span>
        </div>
      )
    }
  },
  {
    accessorKey: 'durationMs',
    header: ({ column }) => <DataTableColumnHeader column={column} title='Duration' />,
    cell: ({ row }) => {
      const duration = row.getValue('durationMs') as number | null
      return (
        <Badge variant='outline' className='font-mono'>
          {formatDuration(duration)}
        </Badge>
      )
    },
    meta: {
      align: 'right'
    }
  },
  {
    accessorKey: 'outputSize',
    header: ({ column }) => <DataTableColumnHeader column={column} title='Output' />,
    cell: ({ row }) => {
      const size = row.getValue('outputSize') as number | null
      return (
        <Badge variant='outline' className='font-mono'>
          {formatBytes(size)}
        </Badge>
      )
    },
    meta: {
      align: 'right'
    }
  },
  {
    accessorKey: 'errorMessage',
    header: ({ column }) => <DataTableColumnHeader column={column} title='Error' />,
    cell: ({ row }) => {
      const error = row.getValue('errorMessage') as string | null
      const errorCode = row.original.errorCode

      if (!error) return <span className='text-muted-foreground'>-</span>

      return (
        <div className='max-w-[300px]'>
          {errorCode && (
            <Badge variant='destructive' className='mb-1'>
              {errorCode}
            </Badge>
          )}
          <p className='text-sm text-muted-foreground truncate' title={error}>
            {error}
          </p>
        </div>
      )
    }
  }
]

// Export column visibility defaults
export const defaultColumnVisibility = {
  select: true,
  status: true,
  toolName: true,
  action: true,
  startedAt: true,
  durationMs: true,
  outputSize: true,
  errorMessage: true
}
