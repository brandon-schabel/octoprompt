import React, { useState } from 'react'
import { useCommitLogEnhanced } from '@/hooks/api/use-git-api'
import type { GitCommitEnhanced } from '@promptliano/schemas'
import { ScrollArea } from '@promptliano/ui'
import { Button } from '@promptliano/ui'
import { Input } from '@promptliano/ui'
import { Skeleton } from '@promptliano/ui'
import { Card } from '@promptliano/ui'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@promptliano/ui'
import { ChevronLeft, ChevronRight, Search, History, GitCommit } from 'lucide-react'
import { CommitCard } from './commit-card'
import { CommitDetailModal } from './commit-detail-modal'
import { BranchSelectorSearchable } from './branch-selector-searchable'
import type { GitLogEnhancedRequest } from '@promptliano/schemas'
import { Route } from '@/routes/projects'

interface CommitListProps {
  projectId: number
}

export function CommitList({ projectId }: CommitListProps) {
  const search = Route.useSearch()

  const [page, setPage] = useState(1)
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedCommitHash, setSelectedCommitHash] = useState<string | null>(null)
  const [pageSize, setPageSize] = useState(20)
  const [selectedBranch, setSelectedBranch] = useState<string | undefined>(search.gitBranch || undefined)

  const params: GitLogEnhancedRequest = {
    page,
    perPage: pageSize,
    branch: selectedBranch,
    search: searchQuery || undefined,
    includeStats: true,
    includeFileDetails: false
  }

  const { data: response, isLoading, error } = useCommitLogEnhanced(projectId, params)

  const commits = response?.data?.commits || []
  const pagination = response?.data?.pagination
  const totalPages =
    pagination?.totalCount && pagination?.perPage ? Math.ceil(pagination.totalCount / pagination.perPage) : 1
  const totalCount = pagination?.totalCount || 0

  if (!projectId) {
    return (
      <div className='flex flex-col items-center justify-center h-64 text-muted-foreground'>
        <GitCommit className='h-12 w-12 mb-4 opacity-50' />
        <p>Select a project to view commit history</p>
      </div>
    )
  }

  if (error) {
    return (
      <div className='flex flex-col items-center justify-center h-64 text-destructive'>
        <History className='h-12 w-12 mb-4 opacity-50' />
        <p>Failed to load commit history</p>
        <p className='text-sm text-muted-foreground mt-2'>{error.message}</p>
      </div>
    )
  }

  return (
    <div className='flex flex-col h-full'>
      {/* Search and Filter Controls */}
      <div className='flex flex-col gap-3 p-4 border-b'>
        <div className='flex items-center gap-2'>
          <BranchSelectorSearchable
            projectId={projectId}
            selectedBranch={selectedBranch}
            onBranchChange={(branch) => {
              setSelectedBranch(branch)
              setPage(1) // Reset to first page on branch change
            }}
          />
          <div className='relative flex-1'>
            <Search className='absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground' />
            <Input
              placeholder='Search commits by message, author, or hash...'
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value)
                setPage(1) // Reset to first page on search
              }}
              className='pl-9'
            />
          </div>
          <Select value={pageSize.toString()} onValueChange={(value) => setPageSize(Number(value))}>
            <SelectTrigger className='w-[100px]'>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value='10'>10</SelectItem>
              <SelectItem value='20'>20</SelectItem>
              <SelectItem value='50'>50</SelectItem>
              <SelectItem value='100'>100</SelectItem>
            </SelectContent>
          </Select>
        </div>
        {totalCount > 0 && (
          <p className='text-sm text-muted-foreground'>
            Showing {(page - 1) * pageSize + 1}-{Math.min(page * pageSize, totalCount)} of {totalCount} commits
          </p>
        )}
      </div>

      {/* Commit List */}
      <ScrollArea className='flex-1'>
        <div className='p-4 space-y-3'>
          {isLoading ? (
            // Loading skeletons
            Array.from({ length: 5 }).map((_, i) => (
              <Card key={i} className='p-4'>
                <div className='space-y-2'>
                  <Skeleton className='h-4 w-1/3' />
                  <Skeleton className='h-4 w-full' />
                  <Skeleton className='h-3 w-1/4' />
                </div>
              </Card>
            ))
          ) : commits.length === 0 ? (
            <div className='flex flex-col items-center justify-center h-64 text-muted-foreground'>
              <GitCommit className='h-12 w-12 mb-4 opacity-50' />
              <p>No commits found</p>
              {searchQuery && <p className='text-sm mt-2'>Try adjusting your search criteria</p>}
            </div>
          ) : (
            commits.map((commit: GitCommitEnhanced) => (
              <CommitCard key={commit.hash} commit={commit} onClick={() => setSelectedCommitHash(commit.hash)} />
            ))
          )}
        </div>
      </ScrollArea>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className='flex items-center justify-between p-4 border-t'>
          <Button variant='outline' size='sm' onClick={() => setPage(Math.max(1, page - 1))} disabled={page === 1}>
            <ChevronLeft className='h-4 w-4 mr-1' />
            Previous
          </Button>
          <span className='text-sm text-muted-foreground'>
            Page {page} of {totalPages}
          </span>
          <Button
            variant='outline'
            size='sm'
            onClick={() => setPage(Math.min(totalPages, page + 1))}
            disabled={page === totalPages}
          >
            Next
            <ChevronRight className='h-4 w-4 ml-1' />
          </Button>
        </div>
      )}

      {/* Commit Detail Modal */}
      {selectedCommitHash && (
        <CommitDetailModal
          projectId={projectId}
          commitHash={selectedCommitHash}
          open={!!selectedCommitHash}
          onOpenChange={(open) => !open && setSelectedCommitHash(null)}
        />
      )}
    </div>
  )
}
