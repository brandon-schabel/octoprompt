import { Input } from '../core/input'
import { Button } from '../core/button'
import { X } from 'lucide-react'
import type { Column } from '@tanstack/react-table'

interface DataTableColumnFilterProps<TData, TValue> {
  column?: Column<TData, TValue>
  title?: string
  placeholder?: string
}

export function DataTableColumnFilter<TData, TValue>({
  column,
  title,
  placeholder
}: DataTableColumnFilterProps<TData, TValue>) {
  const value = (column?.getFilterValue() as string) ?? ''

  return (
    <div className='flex items-center space-x-2'>
      <Input
        placeholder={placeholder || `Filter ${title}...`}
        value={value}
        onChange={(event) => column?.setFilterValue(event.target.value)}
        className='h-8 w-[150px] lg:w-[200px]'
      />
      {value && (
        <Button variant='ghost' onClick={() => column?.setFilterValue('')} className='h-8 w-8 p-0'>
          <X className='h-4 w-4' />
        </Button>
      )}
    </div>
  )
}
