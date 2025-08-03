import * as React from 'react'
import type { Table } from '@tanstack/react-table'
import { Input } from '../core/input'
import { Button } from '../core/button'
import { Cross2Icon } from '@radix-ui/react-icons'
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
          placeholder='Filter...'
          value={globalFilter ?? ''}
          onChange={(event) => onGlobalFilterChange?.(event.target.value)}
          className='h-8 w-[150px] lg:w-[250px]'
        />
        {children}
        {isFiltered && (
          <Button variant='ghost' onClick={() => table.resetColumnFilters()} className='h-8 px-2 lg:px-3'>
            Reset
            <Cross2Icon className='ml-2 h-4 w-4' />
          </Button>
        )}
      </div>
    </div>
  )
}
