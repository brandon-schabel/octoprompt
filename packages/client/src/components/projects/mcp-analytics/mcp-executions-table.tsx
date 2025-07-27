import React from 'react'
import { DataTable } from '@/components/ui/data-table'
import { mcpExecutionsColumns, defaultColumnVisibility } from './mcp-executions-columns'
import { useGetMCPExecutions } from '@/hooks/api/use-mcp-analytics-api'
import type { MCPExecutionQuery } from '@promptliano/schemas'
import type { PaginationState, SortingState, ColumnFiltersState } from '@tanstack/react-table'
import { RefreshCw, Download, FileJson } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'

interface MCPExecutionsTableProps {
  projectId: number
  defaultPageSize?: number
}

export function MCPExecutionsTable({ projectId, defaultPageSize = 20 }: MCPExecutionsTableProps) {
  // Table state
  const [pagination, setPagination] = React.useState<PaginationState>({
    pageIndex: 0,
    pageSize: defaultPageSize
  })
  const [sorting, setSorting] = React.useState<SortingState>([{ id: 'startedAt', desc: true }])
  const [columnFilters, setColumnFilters] = React.useState<ColumnFiltersState>([])
  const [globalFilter, setGlobalFilter] = React.useState('')
  const [rowSelection, setRowSelection] = React.useState<Record<string, boolean>>({})
  const [columnVisibility, setColumnVisibility] = React.useState<Record<string, boolean>>(defaultColumnVisibility)

  // Build query for API
  const query: MCPExecutionQuery = React.useMemo(() => {
    const baseQuery: MCPExecutionQuery = {
      projectId,
      limit: pagination.pageSize,
      offset: pagination.pageIndex * pagination.pageSize,
      sortBy: 'startedAt',
      sortOrder: 'desc'
    }

    // Apply sorting (only for server-side sortable columns)
    if (sorting.length > 0) {
      const sort = sorting[0]
      // Only apply server-side sorting for columns that support it
      if (sort.id === 'startedAt' || sort.id === 'durationMs' || sort.id === 'toolName') {
        baseQuery.sortBy = sort.id === 'durationMs' ? 'duration' : sort.id
        baseQuery.sortOrder = sort.desc ? 'desc' : 'asc'
      }
    }

    // Apply filters (only server-side filters)
    const statusFilter = columnFilters.find((f) => f.id === 'status')
    if (statusFilter && Array.isArray(statusFilter.value)) {
      // Since API expects single status, take first one
      baseQuery.status = statusFilter.value[0] as any
    }

    // Note: toolName and action filters are now handled client-side
    // so we don't include them in the server query

    return baseQuery
  }, [projectId, pagination, sorting, columnFilters])

  // Fetch data
  const { data, isLoading, isFetching, refetch } = useGetMCPExecutions(projectId, query)

  // Check if we're sorting by a client-side column
  const isClientSideSort = sorting.length > 0 && sorting[0].id === 'action'

  // Check if we have client-side filters
  const hasClientSideFilters = columnFilters.some((filter) => filter.id === 'toolName' || filter.id === 'action')

  // Handle export
  const handleExport = (format: 'csv' | 'json') => {
    if (!data?.executions) return

    const selectedRows = Object.keys(rowSelection)
      .filter((key) => rowSelection[key])
      .map((index) => data.executions[parseInt(index)])

    const dataToExport = selectedRows.length > 0 ? selectedRows : data.executions

    if (format === 'json') {
      const blob = new Blob([JSON.stringify(dataToExport, null, 2)], {
        type: 'application/json'
      })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `mcp-executions-${new Date().toISOString()}.json`
      a.click()
    } else {
      // CSV export
      const headers = ['Tool', 'Action', 'Status', 'Started At', 'Duration (ms)', 'Output Size', 'Error']
      const rows = dataToExport.map((exec) => {
        const action = exec.inputParams
          ? (() => {
              try {
                const params = JSON.parse(exec.inputParams)
                return params?.action || ''
              } catch {
                return ''
              }
            })()
          : ''

        return [
          exec.toolName,
          action,
          exec.status,
          new Date(exec.startedAt).toISOString(),
          exec.durationMs || '',
          exec.outputSize || '',
          exec.errorMessage || ''
        ]
      })

      const csv = [headers.join(','), ...rows.map((row) => row.map((cell) => `"${cell}"`).join(','))].join('\n')

      const blob = new Blob([csv], { type: 'text/csv' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `mcp-executions-${new Date().toISOString()}.csv`
      a.click()
    }
  }

  console.log({
    pageSize: pagination.pageSize
  })

  return (
    <div className='h-full flex flex-col'>
      <DataTable
        columns={mcpExecutionsColumns}
        data={data?.executions || []}
        pageCount={Math.ceil((data?.total || 0) / pagination.pageSize)}
        // Pagination
        pagination={pagination}
        onPaginationChange={setPagination}
        manualPagination
        // Sorting
        sorting={sorting}
        onSortingChange={setSorting}
        manualSorting={!isClientSideSort} // Use client-side sorting for action column
        // Filtering
        columnFilters={columnFilters}
        onColumnFiltersChange={setColumnFilters}
        globalFilter={globalFilter}
        onGlobalFilterChange={setGlobalFilter}
        manualFiltering={!hasClientSideFilters} // Use client-side filtering for tool/action columns
        // Selection
        enableRowSelection
        onRowSelectionChange={setRowSelection}
        // Visibility
        columnVisibility={columnVisibility}
        onColumnVisibilityChange={setColumnVisibility}
        // Loading
        isLoading={isLoading}
        isFetching={isFetching}
        emptyMessage='No MCP executions found'
        // Custom toolbar
        showToolbar
        // Add class to constrain height properly
        className='flex-1 overflow-hidden'
      >
        <div className='flex items-center gap-2'>
          <Button size='sm' variant='outline' onClick={() => refetch()} disabled={isFetching}>
            <RefreshCw className={cn('h-4 w-4', isFetching && 'animate-spin')} />
          </Button>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button size='sm' variant='outline'>
                <Download className='h-4 w-4 mr-2' />
                Export
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent>
              <DropdownMenuItem onClick={() => handleExport('csv')}>Export as CSV</DropdownMenuItem>
              <DropdownMenuItem onClick={() => handleExport('json')}>
                <FileJson className='h-4 w-4 mr-2' />
                Export as JSON
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </DataTable>
    </div>
  )
}

function cn(...inputs: any[]) {
  return inputs.filter(Boolean).join(' ')
}
