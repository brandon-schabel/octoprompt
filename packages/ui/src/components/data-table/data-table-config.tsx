import React from 'react'
import { DataTable } from './data-table'
import { type ColumnDef, type PaginationState, type SortingState, type ColumnFiltersState } from '@tanstack/react-table'

// Configuration for simplified DataTable usage
export interface DataTableConfig<TData> {
  // Column configuration
  columns: ColumnDef<TData>[]
  
  // Data
  data: TData[]
  isLoading?: boolean
  isFetching?: boolean
  
  // Pagination config
  pagination?: {
    enabled?: boolean
    pageSize?: number
    pageSizeOptions?: number[]
    serverSide?: boolean
    totalCount?: number
  }
  
  // Sorting config  
  sorting?: {
    enabled?: boolean
    serverSide?: boolean
    defaultSort?: { id: string; desc: boolean }[]
  }
  
  // Filtering config
  filtering?: {
    enabled?: boolean
    serverSide?: boolean
    searchPlaceholder?: string
  }
  
  // Selection config
  selection?: {
    enabled?: boolean
    multiple?: boolean
    onSelectionChange?: (selection: TData[]) => void
  }
  
  // Row actions
  onRowClick?: (row: TData) => void
  getRowId?: (row: TData) => string
  
  // UI config
  emptyMessage?: string
  className?: string
  showToolbar?: boolean
  showPagination?: boolean
  toolbarActions?: React.ReactNode
}

interface ConfiguredDataTableProps<TData> extends DataTableConfig<TData> {
  // Additional props for controlled state if needed
  onPaginationChange?: (pagination: PaginationState) => void
  onSortingChange?: (sorting: SortingState) => void  
  onFiltersChange?: (filters: ColumnFiltersState) => void
  onGlobalFilterChange?: (filter: string) => void
}

export function ConfiguredDataTable<TData>({
  columns,
  data,
  isLoading = false,
  isFetching = false,
  pagination = {},
  sorting = {},
  filtering = {},
  selection = {},
  onRowClick,
  getRowId,
  emptyMessage = 'No data found',
  className,
  showToolbar = true,
  showPagination = true,
  toolbarActions,
  onPaginationChange,
  onSortingChange,
  onFiltersChange,
  onGlobalFilterChange
}: ConfiguredDataTableProps<TData>) {
  // State management
  const [internalPagination, setInternalPagination] = React.useState<PaginationState>({
    pageIndex: 0,
    pageSize: pagination.pageSize || 10
  })
  
  const [internalSorting, setInternalSorting] = React.useState<SortingState>(
    sorting.defaultSort || []
  )
  
  const [internalFilters, setInternalFilters] = React.useState<ColumnFiltersState>([])
  const [internalGlobalFilter, setInternalGlobalFilter] = React.useState('')
  const [rowSelection, setRowSelection] = React.useState<Record<string, boolean>>({})

  // Calculate page count for server-side pagination
  const pageCount = pagination.serverSide && pagination.totalCount
    ? Math.ceil(pagination.totalCount / internalPagination.pageSize)
    : undefined

  // Handle selection changes
  React.useEffect(() => {
    if (selection.onSelectionChange) {
      const selectedRows = Object.keys(rowSelection)
        .filter(key => rowSelection[key])
        .map(index => data[parseInt(index)])
        .filter(Boolean)
      selection.onSelectionChange(selectedRows)
    }
  }, [rowSelection, data, selection])

  return (
    <DataTable
      columns={columns}
      data={data}
      isLoading={isLoading}
      isFetching={isFetching}
      
      // Pagination
      pageCount={pageCount}
      pagination={internalPagination}
      onPaginationChange={onPaginationChange || setInternalPagination}
      manualPagination={pagination.serverSide}
      showPagination={pagination.enabled !== false && showPagination}
      
      // Sorting
      sorting={internalSorting}
      onSortingChange={onSortingChange || setInternalSorting}
      manualSorting={sorting.serverSide}
      
      // Filtering
      columnFilters={internalFilters}
      onColumnFiltersChange={onFiltersChange || setInternalFilters}
      globalFilter={internalGlobalFilter}
      onGlobalFilterChange={onGlobalFilterChange || setInternalGlobalFilter}
      manualFiltering={filtering.serverSide}
      
      // Selection
      enableRowSelection={selection.enabled}
      enableMultiRowSelection={selection.multiple !== false}
      onRowSelectionChange={setRowSelection}
      
      // Row actions
      onRowClick={onRowClick}
      getRowId={getRowId}
      
      // UI
      emptyMessage={emptyMessage}
      className={className}
      showToolbar={filtering.enabled !== false && showToolbar}
      showPagination={showPagination}
    >
      {toolbarActions}
    </DataTable>
  )
}

// Preset configurations for common table patterns
export const dataTablePresets = {
  simple: {
    pagination: { enabled: true, pageSize: 10 },
    sorting: { enabled: true },
    filtering: { enabled: false },
    selection: { enabled: false },
    showToolbar: false
  },
  
  searchable: {
    pagination: { enabled: true, pageSize: 20 },
    sorting: { enabled: true },
    filtering: { enabled: true, searchPlaceholder: 'Search...' },
    selection: { enabled: false },
    showToolbar: true
  },
  
  selectable: {
    pagination: { enabled: true, pageSize: 20 },
    sorting: { enabled: true },
    filtering: { enabled: true },
    selection: { enabled: true, multiple: true },
    showToolbar: true
  },
  
  serverSide: {
    pagination: { enabled: true, pageSize: 20, serverSide: true },
    sorting: { enabled: true, serverSide: true },
    filtering: { enabled: true, serverSide: true },
    selection: { enabled: false },
    showToolbar: true
  }
} as const

// Helper hook for managing table state
export function useDataTableState<TData>(config?: {
  defaultPagination?: PaginationState
  defaultSorting?: SortingState
  defaultFilters?: ColumnFiltersState
}) {
  const [pagination, setPagination] = React.useState<PaginationState>(
    config?.defaultPagination || { pageIndex: 0, pageSize: 10 }
  )
  const [sorting, setSorting] = React.useState<SortingState>(
    config?.defaultSorting || []
  )
  const [filters, setFilters] = React.useState<ColumnFiltersState>(
    config?.defaultFilters || []
  )
  const [globalFilter, setGlobalFilter] = React.useState('')
  const [rowSelection, setRowSelection] = React.useState<Record<string, boolean>>({})

  return {
    pagination,
    setPagination,
    sorting,
    setSorting,
    filters,
    setFilters,
    globalFilter,
    setGlobalFilter,
    rowSelection,
    setRowSelection,
    // Helper to reset all state
    reset: () => {
      setPagination(config?.defaultPagination || { pageIndex: 0, pageSize: 10 })
      setSorting(config?.defaultSorting || [])
      setFilters(config?.defaultFilters || [])
      setGlobalFilter('')
      setRowSelection({})
    }
  }
}