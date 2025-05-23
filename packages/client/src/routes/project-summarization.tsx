import { createFileRoute } from '@tanstack/react-router'
import { useMemo, useState, useTransition } from 'react'
import { Button } from '@ui'
import { Input } from '@ui'
import { Switch } from '@ui'
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '@ui'
import { Checkbox } from '@ui'
import { Info, FileText } from 'lucide-react'
import {
  useGetProjectFiles,
  useGetProjectSummary,
  useRemoveSummariesFromFiles,
  useSummarizeProjectFiles
} from '@/hooks/api/use-projects-api'
import { buildCombinedFileSummariesXml } from 'shared/src/utils/summary-formatter'

import { FileViewerDialog } from '@/components/navigation/file-viewer-dialog'
import { SummaryDialog } from '@/components/projects/summary-dialog'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@ui'
import { FormatTokenCount } from '@/components/format-token-count'
import { estimateTokenCount } from 'shared/src/utils/file-tree-utils/file-node-tree-utils'

import { toast } from 'sonner'
import { ProjectFile } from '@/generated'
import { useActiveProjectTab, useAppSettings } from '@/hooks/use-kv-local-storage'

export const Route = createFileRoute('/project-summarization')({
  component: ProjectSummarizationSettingsPage
})

type SortOption =
  | 'nameAsc'
  | 'nameDesc'
  | 'lastSummarizedAsc'
  | 'lastSummarizedDesc'
  | 'fileTokenAsc'
  | 'fileTokenDesc'
  | 'summaryTokenAsc'
  | 'summaryTokenDesc'
  | 'sizeAsc'
  | 'sizeDesc'

function ResummarizeButton({ projectId, fileId, disabled }: { projectId: string; fileId: string; disabled: boolean }) {
  const summarizeMutation = useSummarizeProjectFiles(projectId)

  return (
    <button
      className='text-blue-600 hover:underline'
      onClick={() => {
        summarizeMutation.mutate(
          { fileIds: [fileId], force: true },
          {
            onSuccess: (resp) => {
              toast.success(resp.message || 'File has been successfully re-summarized')
            },
            onError: (error) => {
              toast.error(error?.error?.message || 'Failed to re-summarize file')
            }
          }
        )
      }}
      disabled={disabled || summarizeMutation.isPending}
    >
      {summarizeMutation.isPending ? 'Summarizing...' : 'Re-summarize'}
    </button>
  )
}

export function ProjectSummarizationSettingsPage() {
  const [{ summarizationEnabledProjectIds = [] }, updateSettings] = useAppSettings()

  const [activeProjectTabState] = useActiveProjectTab()

  const selectedProjectId = activeProjectTabState?.selectedProjectId
  const isProjectSummarizationEnabled = selectedProjectId
    ? summarizationEnabledProjectIds?.includes(selectedProjectId)
    : false

  const [isPending, startTransition] = useTransition()

  const [selectedFileIds, setSelectedFileIds] = useState<string[]>([])
  const [summaryDialogOpen, setSummaryDialogOpen] = useState(false)
  const [selectedFileRecord, setSelectedFileRecord] = useState<ProjectFile | null>(null)
  const [sortBy, setSortBy] = useState<SortOption>('nameAsc')
  const [minTokensFilter, setMinTokensFilter] = useState<number | null>(null)
  const [maxTokensFilter, setMaxTokensFilter] = useState<number | null>(null)
  const [combinedSummaryDialogOpen, setCombinedSummaryDialogOpen] = useState(false)
  const {
    data: summaryData,
    isLoading: summaryLoading,
    isError: summaryError
  } = useGetProjectSummary(selectedProjectId ?? '')

  const { data, isLoading, isError } = useGetProjectFiles(selectedProjectId ?? '')
  const projectFiles = (data?.data || []) as ProjectFile[]

  const summariesMap = new Map<string, ProjectFile>()

  for (const f of data?.data || []) {
    // Only add files that actually have a summary string to the map
    // This ensures !summariesMap.get(id)?.summary correctly identifies unsummarized files
    if (f.summary) {
      summariesMap.set(f.id, f)
    }
  }

  const summarizeMutation = useSummarizeProjectFiles(selectedProjectId ?? '')
  const removeSummariesMutation = useRemoveSummariesFromFiles(selectedProjectId ?? '')

  const tokensMap = new Map<string, number>()
  for (const file of projectFiles) {
    if (file.content) {
      tokensMap.set(file.id, estimateTokenCount(file.content))
    } else {
      tokensMap.set(file.id, 0)
    }
  }

  const summaryTokensMap = new Map<string, number>()
  for (const file of projectFiles) {
    // Use summariesMap to get the summary for included files
    const fileSummary = summariesMap.get(file.id)?.summary
    if (fileSummary) {
      summaryTokensMap.set(file.id, estimateTokenCount(fileSummary))
    } else {
      summaryTokensMap.set(file.id, 0)
    }
  }

  const filteredProjectFiles = useMemo(
    () =>
      projectFiles.filter((file) => {
        const tokenCount = tokensMap.get(file.id) ?? 0
        if (minTokensFilter !== null && tokenCount < minTokensFilter) return false
        if (maxTokensFilter !== null && tokenCount > maxTokensFilter) return false
        return true
      }),
    [projectFiles, tokensMap, minTokensFilter, maxTokensFilter]
  )

  const sortedProjectFiles = [...filteredProjectFiles].sort((a, b) => {
    const fileAData = summariesMap.get(a.id)
    const fileBData = summariesMap.get(b.id)

    const nameA = a.path ?? ''
    const nameB = b.path ?? ''
    const updatedA = fileAData?.summaryLastUpdatedAt ? new Date(fileAData.summaryLastUpdatedAt).getTime() : 0
    const updatedB = fileBData?.summaryLastUpdatedAt ? new Date(fileBData.summaryLastUpdatedAt).getTime() : 0
    const fileTokensA = tokensMap.get(a.id) ?? 0
    const fileTokensB = tokensMap.get(b.id) ?? 0
    const summaryTokensA = summaryTokensMap.get(a.id) ?? 0
    const summaryTokensB = summaryTokensMap.get(b.id) ?? 0
    const sizeA = a.size ?? 0
    const sizeB = b.size ?? 0

    switch (sortBy) {
      case 'nameAsc':
        return nameA.localeCompare(nameB)
      case 'nameDesc':
        return nameB.localeCompare(nameA)

      case 'lastSummarizedAsc':
        if (updatedA === 0 && updatedB !== 0) return -1
        if (updatedA !== 0 && updatedB === 0) return 1
        return updatedA - updatedB
      case 'lastSummarizedDesc':
        if (updatedA === 0 && updatedB !== 0) return 1
        if (updatedA !== 0 && updatedB === 0) return -1
        return updatedB - updatedA

      case 'fileTokenAsc':
        return fileTokensA - fileTokensB
      case 'fileTokenDesc':
        return fileTokensB - fileTokensA

      case 'summaryTokenAsc':
        return summaryTokensA - summaryTokensB
      case 'summaryTokenDesc':
        return summaryTokensB - summaryTokensA

      case 'sizeAsc':
        return sizeA - sizeB
      case 'sizeDesc':
        return sizeB - sizeA

      default:
        return 0
    }
  })

  function toggleFileSelection(fileId: string) {
    setSelectedFileIds((prev) => (prev.includes(fileId) ? prev.filter((id) => id !== fileId) : [...prev, fileId]))
  }

  async function handleSummarizeOptimistic() {
    if (!selectedFileIds.length) {
      toast.error('No Files Selected', {
        description: 'Please select at least one file to summarize'
      })
      return
    }

    startTransition(() => {
      summarizeMutation.mutate(
        { fileIds: selectedFileIds },
        {
          onSuccess: (resp) => {
            toast.success(resp.message || 'Selected files have been summarized')
          },
          onError: () => {}
        }
      )
    })
  }

  function handleForceSummarize() {
    if (!selectedFileIds.length) {
      toast.error('No Files Selected', {
        description: 'Please select at least one file to re-summarize'
      })
      return
    }
    summarizeMutation.mutate(
      { fileIds: selectedFileIds, force: true },
      {
        onSuccess: (resp) => {
          toast.success(resp.message || 'Selected files have been force re-summarized', {
            description: 'Selected files have been force re-summarized'
          })
        }
      }
    )
  }

  function handleRemoveSummaries() {
    if (!selectedFileIds.length) {
      toast.error('No Files Selected', {
        description: 'Please select at least one file to remove summaries from'
      })
      return
    }
    removeSummariesMutation.mutate(selectedFileIds, {
      onSuccess: (resp) => {
        toast.success(resp.message || `Removed ${resp.removedCount} summaries`, {
          description: 'Summaries have been removed'
        })
        // Deselect files whose summaries were removed if desired
        setSelectedFileIds((prev) => prev.filter((id) => !selectedFileIds.includes(id)))
      }
    })
  }

  function handleToggleSummary(fileId: string) {
    const f = summariesMap.get(fileId)
    if (f) {
      setSelectedFileRecord(f)
      setSummaryDialogOpen(true)
    } else {
      console.warn('Attempted to view summary for file without one:', fileId)
    }
  }

  function handleSelectUnsummarized() {
    const unsummarizedIds = sortedProjectFiles
      .filter((file) => !summariesMap.has(file.id)) // Check existence in the map is enough
      .map((file) => file.id)
    setSelectedFileIds(unsummarizedIds)
    if (unsummarizedIds.length > 0) {
      toast.info(`Selected ${unsummarizedIds.length} unsummarized files.`)
    } else {
      toast.info('No unsummarized files found to select.')
    }
  }

  let totalContentLength = 0
  for (const file of projectFiles) {
    if (file.content) {
      totalContentLength += file.content.length
    }
  }

  let totalTokensInSummaries = 0
  // Iterate over the *values* in summariesMap to count tokens only for actual summaries
  for (const fileWithSummary of summariesMap.values()) {
    if (fileWithSummary.summary) {
      totalTokensInSummaries += estimateTokenCount(fileWithSummary.summary)
    }
  }

  // Calculate combined summary based on files that *actually* have summaries
  const includedFilesWithSummaries = Array.from(summariesMap.values()) // No pattern filtering needed

  const combinedSummary = includedFilesWithSummaries
    .map((f) => f.summary) // We know summary exists here
    .join('\n\n')

  const combinedSummaryTokens = estimateTokenCount(combinedSummary)

  let totalTokensInContent = 0
  for (const file of projectFiles) {
    if (file.content) {
      totalTokensInContent += estimateTokenCount(file.content)
    }
  }

  // Use the filtered list for formatted summary generation
  const formattedCombinedSummary = buildCombinedFileSummariesXml(
    includedFilesWithSummaries, // Pass the pre-filtered list (now all files with summaries)
    {
      includeEmptySummaries: false, // Already filtered, but good practice
      emptySummaryText: 'NO_SUMMARY'
    }
  )

  if (isLoading) {
    return <div className='p-4'>Loading files...</div>
  }
  if (isError) {
    return <div className='p-4'>Error fetching files</div>
  }

  // Calculate counts based on the final sorted/filtered list and summariesMap
  const includedFilesCount = sortedProjectFiles.length // Now just the total filtered files
  const includedWithSummariesCount = sortedProjectFiles.filter((f) => summariesMap.has(f.id)).length
  const allSummariesCount = summariesMap.size

  return (
    <div className='p-4 space-y-6'>
      <Card>
        <CardHeader>
          <CardTitle className='flex justify-between items-center'>
            <span>Summary Memory</span>
            <Button
              variant='outline'
              size='sm'
              className='gap-2'
              onClick={() => setCombinedSummaryDialogOpen(true)}
              disabled={!isProjectSummarizationEnabled || includedFilesWithSummaries.length === 0}
            >
              <FileText className='h-4 w-4' />
              View Combined Summary
            </Button>
          </CardTitle>
          <CardDescription>A combined view of summaries for all files with summaries in the project.</CardDescription>
        </CardHeader>
        <CardContent className='space-y-4'>
          <div>
            <p className='text-sm'>
              <strong>Total files with summaries:</strong> {allSummariesCount}
              <span className='text-xs ml-2 text-muted-foreground'>(across the entire project)</span>
            </p>
            <p className='text-sm'>
              <strong>Included files with summaries:</strong> {includedWithSummariesCount} / {includedFilesCount}
            </p>
            <p className='text-sm flex items-center gap-1'>
              <strong>Total tokens in content (included files):</strong>
              <FormatTokenCount tokenContent={totalTokensInContent} />
            </p>
            <p className='text-sm flex items-center gap-1'>
              <strong>Total tokens in summaries (included files):</strong>
              <FormatTokenCount tokenContent={totalTokensInSummaries} />
            </p>
          </div>
        </CardContent>
      </Card>

      <Card className='w-full'>
        <CardHeader>
          <CardTitle>Project Summarization Settings</CardTitle>
          <CardDescription>View file summaries and manage summarization tasks.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className='space-y-2 mb-6'>
            <div className='flex items-center justify-between'>
              <div>
                <span className='text-sm font-medium'>Enable File Summarization</span>
              </div>
              <Switch
                checked={isProjectSummarizationEnabled}
                onCheckedChange={(check) => {
                  if (!selectedProjectId) return
                  updateSettings({
                    summarizationEnabledProjectIds: check
                      ? [...(summarizationEnabledProjectIds ?? []), selectedProjectId]
                      : (summarizationEnabledProjectIds ?? []).filter((id: string) => id !== selectedProjectId)
                  })
                }}
              />
            </div>
          </div>

          <div className='mb-4 text-sm'>
            <p>
              Found <strong>{projectFiles.length}</strong> total files in the project.
            </p>
          </div>

          <div className='my-4 flex flex-wrap items-center gap-2'>
            <label className='text-sm font-medium'>Sort Files By:</label>
            <Select
              value={sortBy}
              onValueChange={(value) => setSortBy(value as SortOption)}
              disabled={!isProjectSummarizationEnabled || sortedProjectFiles.length === 0}
            >
              <SelectTrigger className='w-[180px]'>
                <SelectValue placeholder='Sort by...' />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value='nameAsc'>Name (A→Z)</SelectItem>
                <SelectItem value='nameDesc'>Name (Z→A)</SelectItem>
                <SelectItem value='lastSummarizedDesc'>Last Summarized (Newest)</SelectItem>
                <SelectItem value='lastSummarizedAsc'>Last Summarized (Oldest)</SelectItem>
                <SelectItem value='fileTokenDesc'>File Tokens (desc)</SelectItem>
                <SelectItem value='fileTokenAsc'>File Tokens (asc)</SelectItem>
                <SelectItem value='summaryTokenDesc'>Summary Tokens (desc)</SelectItem>
                <SelectItem value='summaryTokenAsc'>Summary Tokens (asc)</SelectItem>
                <SelectItem value='sizeDesc'>File Size (largest)</SelectItem>
                <SelectItem value='sizeAsc'>File Size (smallest)</SelectItem>
              </SelectContent>
            </Select>

            {/* Optional: Filter by token range */}
            <div className='flex items-center gap-2'>
              <label htmlFor='minTokens' className='text-sm font-medium'>
                Filter Tokens:
              </label>
              <Input
                id='minTokens'
                type='number'
                placeholder='Min'
                className='w-20'
                value={minTokensFilter ?? ''}
                disabled={!isProjectSummarizationEnabled || projectFiles.length === 0}
                onChange={(e) => setMinTokensFilter(e.target.value ? Math.max(0, Number(e.target.value)) : null)}
              />
              <span>-</span>
              <Input
                id='maxTokens'
                type='number'
                placeholder='Max'
                className='w-20'
                value={maxTokensFilter ?? ''}
                disabled={!isProjectSummarizationEnabled || projectFiles.length === 0}
                onChange={(e) => setMaxTokensFilter(e.target.value ? Math.max(0, Number(e.target.value)) : null)}
              />
            </div>
          </div>

          <div className='mt-6 grid grid-cols-1 gap-6'>
            <div className={!isProjectSummarizationEnabled ? 'opacity-60 pointer-events-none' : ''}>
              <h3 className='text-base font-semibold mb-2'>Project Files ({sortedProjectFiles.length})</h3>
              <div className='flex items-center gap-2 mb-2 flex-wrap'>
                <div className='flex items-center gap-1'>
                  <Checkbox
                    id='select-all'
                    checked={sortedProjectFiles.length > 0 && selectedFileIds.length === sortedProjectFiles.length}
                    disabled={!isProjectSummarizationEnabled || sortedProjectFiles.length === 0}
                    onCheckedChange={(checked) => {
                      if (checked) {
                        setSelectedFileIds(sortedProjectFiles.map((f) => f.id))
                      } else {
                        setSelectedFileIds([])
                      }
                    }}
                  />
                  <label htmlFor='select-all' className='text-xs cursor-pointer select-none'>
                    Select All
                  </label>
                </div>
                <Button
                  variant='link'
                  size='sm'
                  className='text-xs h-auto p-0'
                  onClick={handleSelectUnsummarized}
                  disabled={!isProjectSummarizationEnabled || sortedProjectFiles.length === 0}
                >
                  Select Unsummarized
                </Button>
                {selectedFileIds.length > 0 && (
                  <span className='text-xs text-muted-foreground ml-auto'>({selectedFileIds.length} selected)</span>
                )}
              </div>

              <ul
                className={`mt-2 space-y-1 border rounded p-2 h-72 overflow-y-auto bg-background ${!isProjectSummarizationEnabled ? 'opacity-50' : ''}`}
              >
                {sortedProjectFiles.length === 0 && (
                  <li className='text-sm text-muted-foreground text-center py-4'>
                    No files match the current filters.
                  </li>
                )}
                {sortedProjectFiles.map((file) => {
                  const fileRecordWithSummary = summariesMap.get(file.id) // Check if summary exists
                  const hasSummary = !!fileRecordWithSummary
                  const lastSummarized = fileRecordWithSummary?.summaryLastUpdatedAt
                    ? new Date(fileRecordWithSummary.summaryLastUpdatedAt).toLocaleString()
                    : null
                  const tokenCount = tokensMap.get(file.id) ?? 0
                  const summaryTokenCount = summaryTokensMap.get(file.id) ?? 0 // From summaryTokensMap

                  return (
                    <li
                      key={file.id}
                      className={`group flex flex-col gap-1 text-xs rounded hover:bg-accent/50 transition-colors duration-150 p-1.5 border-b last:border-b-0 ${
                        hasSummary ? 'bg-green-50 dark:bg-green-900/30' : '' // Highlight summarized files
                      }`}
                    >
                      <div className='flex items-center gap-2'>
                        <Checkbox
                          id={`check-${file.id}`}
                          checked={selectedFileIds.includes(file.id)}
                          disabled={!isProjectSummarizationEnabled}
                          onCheckedChange={() => toggleFileSelection(file.id)}
                          className='mt-0.5'
                        />
                        <label
                          htmlFor={`check-${file.id}`}
                          className={`flex-1 cursor-pointer truncate ${hasSummary ? 'font-medium' : ''}`}
                          title={file.path}
                        >
                          {file.path}
                        </label>

                        {/* File/Summary Token counts */}
                        <div className='flex items-center gap-1.5 ml-2 flex-shrink-0'>
                          <span className='text-[10px] text-muted-foreground'>File:</span>
                          <FormatTokenCount tokenContent={tokenCount} />
                          {hasSummary && (
                            <>
                              <span className='text-[10px] text-muted-foreground'>Summ:</span>
                              <FormatTokenCount tokenContent={summaryTokenCount} />
                            </>
                          )}
                        </div>

                        {/* Action Icons/Buttons on Hover */}
                        <div className='flex items-center ml-auto opacity-0 group-hover:opacity-100 transition-opacity gap-1 flex-shrink-0'>
                          {lastSummarized && (
                            <span
                              className='text-muted-foreground text-[10px] hidden lg:inline'
                              title={`Last Summarized: ${lastSummarized}`}
                            >
                              {/* Shorten date display? */}
                              {new Date(lastSummarized).toLocaleDateString()}
                            </span>
                          )}
                          {hasSummary && (
                            <Button
                              variant='ghost'
                              size='icon'
                              className='h-5 w-5'
                              title='View Summary'
                              onClick={() => handleToggleSummary(file.id)}
                              disabled={!isProjectSummarizationEnabled}
                            >
                              <Info className='h-3.5 w-3.5 text-blue-600' />
                            </Button>
                          )}
                          <ResummarizeButton
                            projectId={selectedProjectId ?? ''}
                            fileId={file.id}
                            disabled={!isProjectSummarizationEnabled || summarizeMutation.isPending}
                          />
                        </div>
                      </div>
                    </li>
                  )
                })}
              </ul>

              {/* Bulk Action Buttons */}
              <div className='mt-4 flex flex-wrap gap-2'>
                <Button
                  onClick={handleSummarizeOptimistic}
                  disabled={
                    selectedFileIds.length === 0 ||
                    isPending ||
                    summarizeMutation.isPending ||
                    !isProjectSummarizationEnabled
                  }
                  size='sm'
                >
                  {isPending ? 'Queuing...' : 'Summarize Selected'} ({selectedFileIds.length})
                </Button>
                <Button
                  variant='outline'
                  onClick={handleForceSummarize}
                  disabled={
                    selectedFileIds.length === 0 || summarizeMutation.isPending || !isProjectSummarizationEnabled
                  }
                  size='sm'
                >
                  {summarizeMutation.isPending &&
                  selectedFileIds.some((id) => summarizeMutation.variables?.fileIds.includes(id)) &&
                  summarizeMutation.variables?.force
                    ? 'Re-summarizing...'
                    : 'Force Re-summarize'}
                  ({selectedFileIds.length})
                </Button>
                <Button
                  variant='destructive'
                  onClick={handleRemoveSummaries}
                  disabled={
                    selectedFileIds.length === 0 ||
                    removeSummariesMutation.isPending ||
                    !isProjectSummarizationEnabled ||
                    // Also disable if none of the selected files actually have summaries
                    selectedFileIds.filter((id) => summariesMap.has(id)).length === 0
                  }
                  size='sm'
                >
                  {removeSummariesMutation.isPending ? 'Removing...' : 'Remove Summaries'} (
                  {selectedFileIds.filter((id) => summariesMap.has(id)).length})
                </Button>
              </div>
            </div>
          </div>
        </CardContent>
        <CardFooter className='text-sm text-muted-foreground'>
          <p>Manage which files are summarized and view aggregate statistics.</p>
        </CardFooter>
      </Card>

      <FileViewerDialog
        open={summaryDialogOpen}
        markdownText={selectedFileRecord?.summary ?? '*No summary available*'}
        filePath={selectedFileRecord?.path}
        onClose={() => {
          setSummaryDialogOpen(false)
          setSelectedFileRecord(null)
        }}
      />

      <SummaryDialog
        isOpen={combinedSummaryDialogOpen}
        onClose={() => setCombinedSummaryDialogOpen(false)}
        summaryContent={formattedCombinedSummary || '*No included file summaries available.*'}
        tokenCount={combinedSummaryTokens}
      />
    </div>
  )
}
