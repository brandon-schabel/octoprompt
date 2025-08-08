import type {
  ColumnDef,
  ColumnFiltersState,
  SortingState,
  VisibilityState,
  PaginationState,
  Table as TanstackTable,
  Row,
  Column,
  OnChangeFn,
  RowSelectionState
} from '@tanstack/react-table'

export interface DataTableProps<TData, TValue = unknown> {
  columns: ColumnDef<TData, TValue>[]
  data: TData[]

  // Pagination
  pageCount?: number
  pagination?: PaginationState
  onPaginationChange?: OnChangeFn<PaginationState>
  manualPagination?: boolean

  // Sorting
  sorting?: SortingState
  onSortingChange?: OnChangeFn<SortingState>
  manualSorting?: boolean

  // Filtering
  columnFilters?: ColumnFiltersState
  onColumnFiltersChange?: OnChangeFn<ColumnFiltersState>
  globalFilter?: string
  onGlobalFilterChange?: OnChangeFn<string>
  manualFiltering?: boolean

  // Selection
  enableRowSelection?: boolean
  enableMultiRowSelection?: boolean
  onRowSelectionChange?: OnChangeFn<RowSelectionState>

  // Visibility
  columnVisibility?: VisibilityState
  onColumnVisibilityChange?: OnChangeFn<VisibilityState>

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
  table: TanstackTable<TData>
  pageSizeOptions?: number[]
}

export interface DataTableColumnHeaderProps<TData, TValue> {
  column: Column<TData, TValue>
  title: string
}

export interface DataTableToolbarProps<TData> {
  table: TanstackTable<TData>
  globalFilter?: string
  onGlobalFilterChange?: OnChangeFn<string>
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

export interface DataTableViewOptionsProps {
  table: TanstackTable<any>
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
  Table as TanstackTable,
  Row,
  Column,
  OnChangeFn,
  RowSelectionState
} from '@tanstack/react-table'
