import * as React from 'react'
import {
  useReactTable,
  getCoreRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  getFilteredRowModel,
  flexRender,
  getFacetedRowModel,
  getFacetedUniqueValues
} from '@tanstack/react-table'

import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../data/table.tsx'
import { DataTablePagination } from './data-table-pagination'
import { DataTableToolbar } from './data-table-toolbar'
import { cn } from '../../utils'
import type { DataTableProps } from './types'
import { Skeleton } from '../data/skeleton.tsx'

export function DataTable<TData, TValue>({
  columns,
  data,
  pageCount,
  pagination: controlledPagination,
  onPaginationChange,
  manualPagination = false,
  sorting: controlledSorting,
  onSortingChange,
  manualSorting = false,
  columnFilters: controlledColumnFilters,
  onColumnFiltersChange,
  globalFilter: controlledGlobalFilter,
  onGlobalFilterChange,
  manualFiltering = false,
  enableRowSelection = false,
  enableMultiRowSelection = true,
  onRowSelectionChange,
  columnVisibility: controlledColumnVisibility,
  onColumnVisibilityChange,
  isLoading = false,
  isFetching = false,
  emptyMessage = 'No results found.',
  className,
  showToolbar = true,
  showPagination = true,
  onRowClick,
  getRowId,
  renderSubComponent,
  children
}: DataTableProps<TData, TValue>) {
  // Internal state (used when not controlled)
  const [sorting, setSorting] = React.useState(controlledSorting || [])
  const [columnFilters, setColumnFilters] = React.useState(controlledColumnFilters || [])
  const [columnVisibility, setColumnVisibility] = React.useState(controlledColumnVisibility || {})
  const [rowSelection, setRowSelection] = React.useState({})
  const [globalFilter, setGlobalFilter] = React.useState(controlledGlobalFilter || '')
  const [pagination, setPagination] = React.useState(
    controlledPagination || {
      pageIndex: 0,
      pageSize: 100
    }
  )

  const table = useReactTable({
    data,
    columns,
    pageCount,
    getRowId,
    getCoreRowModel: getCoreRowModel(),
    // Pagination
    getPaginationRowModel: manualPagination ? undefined : getPaginationRowModel(),
    onPaginationChange: onPaginationChange || setPagination,
    manualPagination,
    // Sorting
    getSortedRowModel: manualSorting ? undefined : getSortedRowModel(),
    onSortingChange: onSortingChange || setSorting,
    manualSorting,
    // Filtering
    getFilteredRowModel: manualFiltering ? undefined : getFilteredRowModel(),
    onColumnFiltersChange: onColumnFiltersChange || setColumnFilters,
    onGlobalFilterChange: onGlobalFilterChange || setGlobalFilter,
    globalFilterFn: 'includesString',
    manualFiltering,
    // Faceting (for filter options)
    getFacetedRowModel: getFacetedRowModel(),
    getFacetedUniqueValues: getFacetedUniqueValues(),
    // Selection
    enableRowSelection,
    enableMultiRowSelection,
    onRowSelectionChange: onRowSelectionChange || setRowSelection,
    // Visibility
    onColumnVisibilityChange: onColumnVisibilityChange || setColumnVisibility,
    // State
    state: {
      sorting: controlledSorting || sorting,
      columnFilters: controlledColumnFilters || columnFilters,
      columnVisibility: controlledColumnVisibility || columnVisibility,
      rowSelection,
      globalFilter: controlledGlobalFilter || globalFilter,
      pagination: controlledPagination || pagination
    }
  })

  return (
    <div className={cn('flex flex-col h-full', className)}>
      {showToolbar && (
        <div className='flex-shrink-0 pb-4'>
          <DataTableToolbar
            table={table}
            globalFilter={controlledGlobalFilter || globalFilter}
            onGlobalFilterChange={onGlobalFilterChange || setGlobalFilter}
          >
            {children}
          </DataTableToolbar>
        </div>
      )}

      <div className='flex-1 min-h-0 rounded-md border overflow-hidden'>
        <Table>
          <TableHeader>
            {table.getHeaderGroups().map((headerGroup) => (
              <TableRow key={headerGroup.id}>
                {headerGroup.headers.map((header) => {
                  const meta = header.column.columnDef.meta as any
                  return (
                    <TableHead
                      key={header.id}
                      className={cn(meta?.className)}
                      style={{
                        width: meta?.width,
                        textAlign: meta?.align
                      }}
                    >
                      {header.isPlaceholder ? null : flexRender(header.column.columnDef.header, header.getContext())}
                    </TableHead>
                  )
                })}
              </TableRow>
            ))}
          </TableHeader>
          <TableBody>
            {isLoading ? (
              // Loading skeleton
              Array.from({ length: pagination?.pageSize || 10 }).map((_, index) => (
                <TableRow key={index}>
                  {columns.map((_, cellIndex) => (
                    <TableCell key={cellIndex}>
                      <Skeleton className='h-4 w-full' />
                    </TableCell>
                  ))}
                </TableRow>
              ))
            ) : table.getRowModel().rows?.length ? (
              table.getRowModel().rows.map((row) => (
                <React.Fragment key={row.id}>
                  <TableRow
                    data-state={row.getIsSelected() && 'selected'}
                    className={cn(onRowClick && 'cursor-pointer', 'hover:bg-muted/50')}
                    onClick={() => onRowClick?.(row)}
                  >
                    {row.getVisibleCells().map((cell) => {
                      const meta = cell.column.columnDef.meta as any
                      return (
                        <TableCell
                          key={cell.id}
                          className={cn(meta?.className)}
                          style={{
                            textAlign: meta?.align
                          }}
                        >
                          {flexRender(cell.column.columnDef.cell, cell.getContext())}
                        </TableCell>
                      )
                    })}
                  </TableRow>
                  {renderSubComponent && row.getIsExpanded() && (
                    <TableRow>
                      <TableCell colSpan={columns.length}>{renderSubComponent({ row })}</TableCell>
                    </TableRow>
                  )}
                </React.Fragment>
              ))
            ) : (
              <TableRow>
                <TableCell colSpan={columns.length} className='h-24 text-center'>
                  {emptyMessage}
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      {showPagination && (
        <div className='flex-shrink-0 pt-4'>
          <DataTablePagination table={table} />
        </div>
      )}

      {isFetching && !isLoading && <div className='text-sm text-muted-foreground text-center pt-2'>Refreshing...</div>}
    </div>
  )
}
