import type {
  ColumnDef,
  ColumnFiltersState,
  SortingState,
  VisibilityState,
  PaginationState,
  Table,
  Row,
  Column
} from '@tanstack/react-table'

export interface DataTableProps<TData, TValue = unknown> {
  columns: ColumnDef<TData, TValue>[]
  data: TData[]

  // Pagination
  pageCount?: number
  pagination?: PaginationState
  onPaginationChange?: (pagination: PaginationState) => void
  manualPagination?: boolean

  // Sorting
  sorting?: SortingState
  onSortingChange?: (sorting: SortingState) => void
  manualSorting?: boolean

  // Filtering
  columnFilters?: ColumnFiltersState
  onColumnFiltersChange?: (filters: ColumnFiltersState) => void
  globalFilter?: string
  onGlobalFilterChange?: (filter: string) => void
  manualFiltering?: boolean

  // Selection
  enableRowSelection?: boolean
  enableMultiRowSelection?: boolean
  onRowSelectionChange?: (selection: Record<string, boolean>) => void

  // Visibility
  columnVisibility?: VisibilityState
  onColumnVisibilityChange?: (visibility: VisibilityState) => void

  // Loading & Empty states
  isLoading?: boolean
  isFetching?: boolean
  emptyMessage?: string

  // Styling
  className?: string
  showToolbar?: boolean
  showPagination?: boolean

  // Children passed to toolbar
  children?: React.ReactNode

  // Row actions
  onRowClick?: (row: Row<TData>) => void
  getRowId?: (row: TData) => string

  // Custom components
  renderSubComponent?: (props: { row: Row<TData> }) => React.ReactElement
}

export interface DataTablePaginationProps<TData> {
  table: Table<TData>
  pageSizeOptions?: number[]
}

export interface DataTableColumnHeaderProps<TData, TValue> {
  column: Column<TData, TValue>
  title: string
}

export interface DataTableToolbarProps<TData> {
  table: Table<TData>
  globalFilter?: string
  onGlobalFilterChange?: (value: string) => void
  children?: React.ReactNode
}

export interface DataTableFilterProps {
  column: Column<any, unknown>
  placeholder?: string
  options?: Array<{
    label: string
    value: string
    icon?: React.ComponentType<{ className?: string }>
  }>
}

export interface DataTableViewOptions {
  table: Table<any>
}

// Utility types for common column configurations
export interface DataTableColumnConfig<TData> {
  accessorKey?: keyof TData
  accessorFn?: (row: TData) => any
  header: string | ((props: any) => React.ReactNode)
  cell?: (props: any) => React.ReactNode
  enableSorting?: boolean
  enableFiltering?: boolean
  filterFn?: 'auto' | 'equals' | 'contains' | 'fuzzy' | ((row: any, columnId: string, filterValue: any) => boolean)
  meta?: {
    align?: 'left' | 'center' | 'right'
    width?: string | number
    className?: string
  }
}

// Common filter types
export type FilterType = 'text' | 'select' | 'multi-select' | 'date' | 'date-range' | 'number' | 'number-range'

export interface ColumnFilter {
  type: FilterType
  placeholder?: string
  options?: Array<{ label: string; value: string }>
  min?: number
  max?: number
}

// Export common interfaces from TanStack Table for convenience
export type {
  ColumnDef,
  ColumnFiltersState,
  SortingState,
  VisibilityState,
  PaginationState,
  Table,
  Row,
  Column
} from '@tanstack/react-table'
