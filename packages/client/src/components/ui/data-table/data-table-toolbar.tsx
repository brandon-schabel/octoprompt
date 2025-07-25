import { X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { DataTableViewOptions } from './data-table-view-options'
import { DataTableFacetedFilter } from './data-table-faceted-filter'
import { DataTableColumnFilter } from './data-table-column-filter'
import type { DataTableToolbarProps } from './types'

export function DataTableToolbar<TData>({
  table,
  globalFilter,
  onGlobalFilterChange,
  children
}: DataTableToolbarProps<TData>) {
  const isFiltered = table.getState().columnFilters.length > 0

  return (
    <div className='flex items-center justify-between'>
      <div className='flex flex-1 items-center space-x-2'>
        <Input
          placeholder='Search...'
          value={globalFilter ?? ''}
          onChange={(event) => onGlobalFilterChange?.(event.target.value)}
          className='h-8 w-[150px] lg:w-[250px]'
        />

        {/* Column-specific filters can be added here based on column meta */}
        {table
          .getAllColumns()
          .filter((column) => column.getCanFilter())
          .map((column) => {
            const columnMeta = column.columnDef.meta as any

            // Use faceted filter for columns with predefined options
            if (columnMeta?.filterOptions) {
              return (
                <DataTableFacetedFilter
                  key={column.id}
                  column={column}
                  title={columnMeta.filterTitle || column.id}
                  options={columnMeta.filterOptions}
                />
              )
            }

            // Use text filter for columns marked for text filtering
            if (columnMeta?.filterType === 'text') {
              return (
                <DataTableColumnFilter
                  key={column.id}
                  column={column}
                  title={columnMeta.filterTitle || column.id}
                  placeholder={columnMeta.filterPlaceholder}
                />
              )
            }

            return null
          })}

        {isFiltered && (
          <Button variant='ghost' onClick={() => table.resetColumnFilters()} className='h-8 px-2 lg:px-3'>
            Reset
            <X className='ml-2 h-4 w-4' />
          </Button>
        )}

        {children}
      </div>

      <DataTableViewOptions table={table} />
    </div>
  )
}
