import { type ColumnDef } from '@tanstack/react-table'
import { DataTableColumnHeader } from './data-table-column-header'
import { Badge } from '../core/badge'
import { Button } from '../core/button'
import { Checkbox } from '../core/checkbox'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger
} from '../core/dropdown-menu'
import { DotsHorizontalIcon } from '@radix-ui/react-icons'
import { formatDistanceToNow, format } from 'date-fns'
import { cn } from '../../utils'

// Column factory configuration types
export interface ColumnFactoryConfig<TData> {
  accessorKey?: keyof TData
  accessorFn?: (row: TData) => any
  header?: string
  enableSorting?: boolean
  align?: 'left' | 'center' | 'right'
  width?: string | number
  className?: string
}

export interface TextColumnConfig<TData> extends ColumnFactoryConfig<TData> {
  truncate?: boolean
  maxLength?: number
  formatFn?: (value: any) => string
}

export interface DateColumnConfig<TData> extends ColumnFactoryConfig<TData> {
  format?: 'relative' | 'absolute' | 'both'
  dateFormat?: string
}

export interface StatusColumnConfig<TData> extends ColumnFactoryConfig<TData> {
  statuses?: Record<string, { label: string; variant?: 'default' | 'secondary' | 'destructive' | 'outline'; className?: string }>
}

export interface ActionsColumnConfig<TData> {
  actions: Array<{
    label: string
    icon?: React.ComponentType<{ className?: string }>
    onClick: (row: TData) => void
    variant?: 'default' | 'destructive'
    show?: (row: TData) => boolean
  }>
  align?: 'left' | 'center' | 'right'
}

// Column factory functions
export function createTextColumn<TData>(config: TextColumnConfig<TData>): ColumnDef<TData> {
  const {
    accessorKey,
    accessorFn,
    header = 'Text',
    enableSorting = true,
    truncate = false,
    maxLength = 50,
    formatFn,
    align = 'left',
    width,
    className
  } = config

  // Ensure we have either accessorKey or accessorFn, or provide an id
  const baseColumn: Partial<ColumnDef<TData>> = accessorFn 
    ? { accessorFn }
    : accessorKey 
    ? { accessorKey: accessorKey as string }
    : { id: header }

  return {
    ...baseColumn,
    header: ({ column }) => <DataTableColumnHeader column={column} title={header} />,
    cell: ({ getValue }) => {
      let value = getValue()
      if (formatFn) {
        value = formatFn(value)
      }
      const text = String(value || '')
      const displayText = truncate && text.length > maxLength 
        ? `${text.substring(0, maxLength)}...` 
        : text

      return (
        <div 
          className={cn('text-sm', className)} 
          title={truncate && text.length > maxLength ? text : undefined}
        >
          {displayText}
        </div>
      )
    },
    enableSorting,
    meta: {
      align,
      width,
      className
    }
  } as ColumnDef<TData>
}

export function createDateColumn<TData>(config: DateColumnConfig<TData>): ColumnDef<TData> {
  const {
    accessorKey,
    accessorFn,
    header = 'Date',
    format: dateDisplayFormat = 'relative',
    dateFormat = 'PPpp',
    enableSorting = true,
    align = 'left',
    width,
    className
  } = config

  // Ensure we have either accessorKey or accessorFn, or provide an id
  const baseColumn: Partial<ColumnDef<TData>> = accessorFn 
    ? { accessorFn }
    : accessorKey 
    ? { accessorKey: accessorKey as string }
    : { id: header }

  return {
    ...baseColumn,
    header: ({ column }) => <DataTableColumnHeader column={column} title={header} />,
    cell: ({ getValue }) => {
      const value = getValue()
      if (!value) return <span className='text-muted-foreground'>-</span>

      const date = new Date(value as string | number)
      let displayText = ''

      switch (dateDisplayFormat) {
        case 'relative':
          displayText = formatDistanceToNow(date, { addSuffix: true })
          break
        case 'absolute':
          displayText = format(date, dateFormat)
          break
        case 'both':
          displayText = `${format(date, 'PP')} (${formatDistanceToNow(date, { addSuffix: true })})`
          break
      }

      return (
        <div className={cn('text-sm', className)} title={format(date, dateFormat)}>
          {displayText}
        </div>
      )
    },
    enableSorting,
    meta: {
      align,
      width,
      className
    }
  } as ColumnDef<TData>
}

export function createStatusColumn<TData>(config: StatusColumnConfig<TData>): ColumnDef<TData> {
  const {
    accessorKey,
    accessorFn,
    header = 'Status',
    statuses = {},
    enableSorting = true,
    align = 'left',
    width,
    className
  } = config

  // Ensure we have either accessorKey or accessorFn, or provide an id
  const baseColumn: Partial<ColumnDef<TData>> = accessorFn 
    ? { accessorFn }
    : accessorKey 
    ? { accessorKey: accessorKey as string }
    : { id: header }

  return {
    ...baseColumn,
    header: ({ column }) => <DataTableColumnHeader column={column} title={header} />,
    cell: ({ getValue }) => {
      const value = String(getValue() || '')
      const statusConfig = statuses[value] || { label: value, variant: 'default' as const }

      return (
        <Badge 
          variant={statusConfig.variant} 
          className={cn(statusConfig.className, className)}
        >
          {statusConfig.label}
        </Badge>
      )
    },
    enableSorting,
    filterFn: (row, id, value) => {
      return value.includes(row.getValue(id))
    },
    meta: {
      align,
      width,
      className
    }
  } as ColumnDef<TData>
}

export function createActionsColumn<TData>(config: ActionsColumnConfig<TData>): ColumnDef<TData> {
  const { actions, align = 'right' } = config

  return {
    id: 'actions',
    header: () => <span className='sr-only'>Actions</span>,
    cell: ({ row }) => {
      const visibleActions = actions.filter(action => 
        action.show ? action.show(row.original) : true
      )

      if (visibleActions.length === 0) return null

      return (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant='ghost' className='h-8 w-8 p-0'>
              <span className='sr-only'>Open menu</span>
              <DotsHorizontalIcon className='h-4 w-4' />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align='end'>
            {visibleActions.map((action, index) => (
              <React.Fragment key={index}>
                {index > 0 && action.variant === 'destructive' && <DropdownMenuSeparator />}
                <DropdownMenuItem
                  onClick={() => action.onClick(row.original)}
                  className={action.variant === 'destructive' ? 'text-destructive' : ''}
                >
                  {action.icon && <action.icon className='mr-2 h-4 w-4' />}
                  {action.label}
                </DropdownMenuItem>
              </React.Fragment>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      )
    },
    enableSorting: false,
    meta: {
      align,
      width: '50px'
    }
  }
}

export function createSelectionColumn<TData>(): ColumnDef<TData> {
  return {
    id: 'select',
    header: ({ table }) => (
      <Checkbox
        checked={
          table.getIsAllPageRowsSelected() ||
          (table.getIsSomePageRowsSelected() && 'indeterminate')
        }
        onCheckedChange={(value) => table.toggleAllPageRowsSelected(!!value)}
        aria-label='Select all'
      />
    ),
    cell: ({ row }) => (
      <Checkbox
        checked={row.getIsSelected()}
        onCheckedChange={(value) => row.toggleSelected(!!value)}
        aria-label='Select row'
      />
    ),
    enableSorting: false,
    meta: {
      width: '40px'
    }
  }
}

// Helper function to create a full set of columns with common patterns
export interface DataTableColumnsConfig<TData> {
  selectable?: boolean
  columns: Array<
    | { type: 'text'; config: TextColumnConfig<TData> }
    | { type: 'date'; config: DateColumnConfig<TData> }
    | { type: 'status'; config: StatusColumnConfig<TData> }
    | { type: 'custom'; column: ColumnDef<TData> }
  >
  actions?: ActionsColumnConfig<TData>
}

export function createDataTableColumns<TData>(
  config: DataTableColumnsConfig<TData>
): ColumnDef<TData>[] {
  const columns: ColumnDef<TData>[] = []

  if (config.selectable) {
    columns.push(createSelectionColumn<TData>())
  }

  config.columns.forEach(col => {
    switch (col.type) {
      case 'text':
        columns.push(createTextColumn(col.config))
        break
      case 'date':
        columns.push(createDateColumn(col.config))
        break
      case 'status':
        columns.push(createStatusColumn(col.config))
        break
      case 'custom':
        columns.push(col.column)
        break
    }
  })

  if (config.actions) {
    columns.push(createActionsColumn(config.actions))
  }

  return columns
}

// Export React for JSX usage in cell renderers
import React from 'react'