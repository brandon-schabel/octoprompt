import { createFileRoute } from '@tanstack/react-router'
import { useMemo, useState, useTransition } from 'react'
import { Button } from '@promptliano/ui'
import { Input } from '@promptliano/ui'
import { Switch } from '@promptliano/ui'
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '@promptliano/ui'
import { Checkbox } from '@promptliano/ui'
import { Badge } from '@promptliano/ui'
import { Info, FileText } from 'lucide-react'
import {
  useGetProjectFiles,
  useGetProjectSummary,
  useRemoveSummariesFromFiles,
  useSummarizeProjectFiles
} from '@/hooks/api/use-projects-api'
import { buildCombinedFileSummariesXml } from '@promptliano/shared'

import { FileViewerDialog } from '@/components/navigation/file-viewer-dialog'
import { SummaryDialog } from '@/components/projects/summary-dialog'
import { SummarizationStatsCard } from '@/components/projects/summarization-stats-card'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@promptliano/ui'
import { FormatTokenCount } from '@/components/format-token-count'
import { estimateTokenCount } from '@promptliano/shared'
import { categorizeFile } from '@/lib/file-categorization'

import { toast } from 'sonner'
import { ProjectFile } from '@promptliano/schemas'
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

function ResummarizeButton({ projectId, fileId, disabled }: { projectId: number; fileId: number; disabled: boolean }) {
  const summarizeMutation = useSummarizeProjectFiles()

  return (
    <button
      className='text-blue-600 hover:underline'
      onClick={() => {
        summarizeMutation.mutate(
          { projectId, fileIds: [fileId], force: true },
          {
            onSuccess: () => {
              toast.success('File has been successfully re-summarized')
            },
            onError: (error) => {
              toast.error(error?.message || 'Failed to re-summarize file')
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

  const [selectedFileIds, setSelectedFileIds] = useState<number[]>([])
  const [summaryDialogOpen, setSummaryDialogOpen] = useState(false)
  const [selectedFileRecord, setSelectedFileRecord] = useState<ProjectFile | null>(null)
  const [sortBy, setSortBy] = useState<SortOption>('nameAsc')
  const [minTokensFilter, setMinTokensFilter] = useState<number | null>(null)
  const [maxTokensFilter, setMaxTokensFilter] = useState<number | null>(null)
  const [combinedSummaryDialogOpen, setCombinedSummaryDialogOpen] = useState(false)
  const [categoryFilter, setCategoryFilter] = useState<string>('all')
  // TODO: Remove if not needed
  // const {
  //   data: summaryData,
  //   isLoading: summaryLoading,
  //   isError: summaryError
  // } = useGetProjectSummary(selectedProjectId ?? -1)

  const { data, isLoading, isError } = useGetProjectFiles(selectedProjectId ?? -1)

  // Memoize project files to prevent unnecessary recalculations
  const projectFiles = useMemo(() => (data || []) as ProjectFile[], [data])

  // Memoize summaries map creation
  const summariesMap = useMemo(() => {
    const map = new Map<number, ProjectFile>()
    for (const f of projectFiles) {
      if (f.summary) {
        map.set(f.id, f)
      }
    }
    return map
  }, [projectFiles])

  const summarizeMutation = useSummarizeProjectFiles()
  const removeSummariesMutation = useRemoveSummariesFromFiles()

  // Memoize tokens map calculation
  const tokensMap = useMemo(() => {
    const map = new Map<number, number>()
    for (const file of projectFiles) {
      if (file.content) {
        map.set(file.id, estimateTokenCount(file.content))
      } else {
        map.set(file.id, 0)
      }
    }
    return map
  }, [projectFiles])

  // Memoize summary tokens map calculation
  const summaryTokensMap = useMemo(() => {
    const map = new Map<number, number>()
    for (const file of projectFiles) {
      const fileSummary = summariesMap.get(file.id)?.summary
      if (fileSummary) {
        map.set(file.id, estimateTokenCount(fileSummary))
      } else {
        map.set(file.id, 0)
      }
    }
    return map
  }, [projectFiles, summariesMap])

  const filteredProjectFiles = useMemo(
    () =>
      projectFiles.filter((file) => {
        const tokenCount = tokensMap.get(file.id) ?? 0
        if (minTokensFilter !== null && tokenCount < minTokensFilter) return false
        if (maxTokensFilter !== null && tokenCount > maxTokensFilter) return false

        // Category filter
        if (categoryFilter !== 'all') {
          const fileCategory = categorizeFile(file)
          if (fileCategory.category !== categoryFilter) return false
        }

        return true
      }),
    [projectFiles, tokensMap, minTokensFilter, maxTokensFilter, categoryFilter]
  )

  // Memoize sorted project files to prevent re-sorting on every render
  const sortedProjectFiles = useMemo(() => {
    return [...filteredProjectFiles].sort((a, b) => {
      const fileAData = summariesMap.get(a.id)
      const fileBData = summariesMap.get(b.id)

      const nameA = a.path ?? ''
      const nameB = b.path ?? ''
      const updatedA = fileAData?.summaryLastUpdated ? new Date(fileAData.summaryLastUpdated).getTime() : 0
      const updatedB = fileBData?.summaryLastUpdated ? new Date(fileBData.summaryLastUpdated).getTime() : 0
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
  }, [filteredProjectFiles, summariesMap, tokensMap, summaryTokensMap, sortBy])

  // Memoize total calculations to prevent recalculation on every render
  const totalStats = useMemo(() => {
    let totalContentLength = 0
    let totalTokensInContent = 0
    let totalTokensInSummaries = 0

    for (const file of projectFiles) {
      if (file.content) {
        totalContentLength += file.content.length
        totalTokensInContent += estimateTokenCount(file.content)
      }
    }

    for (const fileWithSummary of summariesMap.values()) {
      if (fileWithSummary.summary) {
        totalTokensInSummaries += estimateTokenCount(fileWithSummary.summary)
      }
    }

    return {
      totalContentLength,
      totalTokensInContent,
      totalTokensInSummaries
    }
  }, [projectFiles, summariesMap])

  // Memoize combined summary calculations
  const combinedSummaryData = useMemo(() => {
    const includedFilesWithSummaries = Array.from(summariesMap.values())
    const combinedSummary = includedFilesWithSummaries.map((f) => f.summary).join('\n\n')
    const combinedSummaryTokens = estimateTokenCount(combinedSummary)
    const formattedCombinedSummary = buildCombinedFileSummariesXml(includedFilesWithSummaries, {
      includeEmptySummaries: false,
      emptySummaryText: 'NO_SUMMARY'
    })

    return {
      includedFilesWithSummaries,
      combinedSummary,
      combinedSummaryTokens,
      formattedCombinedSummary
    }
  }, [summariesMap])

  // Memoize counts to prevent recalculation
  const fileCounts = useMemo(() => {
    const includedFilesCount = sortedProjectFiles.length
    const includedWithSummariesCount = sortedProjectFiles.filter((f) => summariesMap.has(f.id)).length
    const allSummariesCount = summariesMap.size
    const selectedWithSummariesCount = selectedFileIds.filter((id) => summariesMap.has(id)).length

    return {
      includedFilesCount,
      includedWithSummariesCount,
      allSummariesCount,
      selectedWithSummariesCount
    }
  }, [sortedProjectFiles, summariesMap, selectedFileIds])

  function toggleFileSelection(fileId: number) {
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
        { fileIds: selectedFileIds, projectId: selectedProjectId ?? -1 },
        {
          onSuccess: () => {
            toast.success('Selected files have been summarized')
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
      { fileIds: selectedFileIds, force: true, projectId: selectedProjectId ?? -1 },
      {
        onSuccess: () => {
          toast.success('Selected files have been force re-summarized', {
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
    removeSummariesMutation.mutate(
      { fileIds: selectedFileIds, projectId: selectedProjectId ?? -1 },
      {
        onSuccess: () => {
          toast.success('Removed summaries', {
            description: 'Summaries have been removed'
          })
          // Deselect files whose summaries were removed if desired
          setSelectedFileIds((prev) => prev.filter((id) => !selectedFileIds.includes(id)))
        }
      }
    )
  }

  function handleToggleSummary(fileId: number) {
    const f = summariesMap.get(fileId)
    if (f) {
      setSelectedFileRecord(f)
      setSummaryDialogOpen(true)
    } else {
      console.warn('Attempted to view summary for file without one:', fileId)
    }
  }

  // Memoize unsummarized file selection to prevent recalculation
  const handleSelectUnsummarized = useMemo(() => {
    return () => {
      // Only select files that are pending summarization (not binary, too large, or empty)
      const pendingIds = sortedProjectFiles
        .filter((file) => {
          const category = categorizeFile(file)
          return category.category === 'pending'
        })
        .map((file) => file.id)

      setSelectedFileIds(pendingIds)
      if (pendingIds.length > 0) {
        toast.info(`Selected ${pendingIds.length} files pending summarization.`)
      } else {
        toast.info('No files pending summarization found.')
      }
    }
  }, [sortedProjectFiles])

  if (isLoading) {
    return <div className='p-4'>Loading files...</div>
  }
  if (isError) {
    return <div className='p-4'>Error fetching files</div>
  }

  return (
    <div className='p-4 space-y-6'>
      {/* Summarization Coverage Stats */}
      <SummarizationStatsCard projectFiles={projectFiles} isEnabled={isProjectSummarizationEnabled} />

      <Card>
        <CardHeader>
          <CardTitle className='flex justify-between items-center'>
            <span>Summary Memory</span>
            <Button
              variant='outline'
              size='sm'
              className='gap-2'
              onClick={() => setCombinedSummaryDialogOpen(true)}
              disabled={!isProjectSummarizationEnabled || combinedSummaryData.includedFilesWithSummaries.length === 0}
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
              <strong>Total files with summaries:</strong> {fileCounts.allSummariesCount}
              <span className='text-xs ml-2 text-muted-foreground'>(across the entire project)</span>
            </p>
            <p className='text-sm'>
              <strong>Included files with summaries:</strong> {fileCounts.includedWithSummariesCount} /{' '}
              {fileCounts.includedFilesCount}
            </p>
            <p className='text-sm flex items-center gap-1'>
              <strong>Total tokens in content (included files):</strong>
              <FormatTokenCount tokenContent={totalStats.totalTokensInContent} />
            </p>
            <p className='text-sm flex items-center gap-1'>
              <strong>Total tokens in summaries (included files):</strong>
              <FormatTokenCount tokenContent={totalStats.totalTokensInSummaries} />
            </p>
          </div>
        </CardContent>
      </Card>

      <Card className='w-full' id='project-summarization-settings-section'>
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
                      : (summarizationEnabledProjectIds ?? []).filter((id: number) => id !== selectedProjectId)
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

            {/* Category Filter */}
            <Select
              value={categoryFilter}
              onValueChange={(value) => setCategoryFilter(value)}
              disabled={!isProjectSummarizationEnabled || projectFiles.length === 0}
            >
              <SelectTrigger className='w-[180px]'>
                <SelectValue placeholder='Filter by category...' />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value='all'>All Files</SelectItem>
                <SelectItem value='summarized'>Summarized</SelectItem>
                <SelectItem value='pending'>Pending Summarization</SelectItem>
                <SelectItem value='binary'>Binary Files</SelectItem>
                <SelectItem value='too-large'>Too Large</SelectItem>
                <SelectItem value='empty'>Empty Files</SelectItem>
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
                  Select Pending
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
                  const lastSummarized = fileRecordWithSummary?.summaryLastUpdated
                    ? new Date(fileRecordWithSummary.summaryLastUpdated).toLocaleString()
                    : null
                  const tokenCount = tokensMap.get(file.id) ?? 0
                  const summaryTokenCount = summaryTokensMap.get(file.id) ?? 0 // From summaryTokensMap
                  const fileCategory = categorizeFile(file)

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
                          className={`flex-1 cursor-pointer truncate flex items-center gap-2 ${hasSummary ? 'font-medium' : ''}`}
                          title={file.path}
                        >
                          <span className='truncate'>{file.path}</span>
                          {/* Category Badge */}
                          {fileCategory.category !== 'summarized' && fileCategory.category !== 'pending' && (
                            <Badge variant='outline' className='text-[10px] px-1 py-0 h-4' title={fileCategory.reason}>
                              {fileCategory.category === 'binary' && 'Binary'}
                              {fileCategory.category === 'too-large' && 'Too Large'}
                              {fileCategory.category === 'empty' && 'Empty'}
                              {fileCategory.category === 'error' && 'Error'}
                            </Badge>
                          )}
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
                            projectId={selectedProjectId ?? -1}
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
                    fileCounts.selectedWithSummariesCount === 0
                  }
                  size='sm'
                >
                  {removeSummariesMutation.isPending ? 'Removing...' : 'Remove Summaries'} (
                  {fileCounts.selectedWithSummariesCount})
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
        projectId={selectedProjectId}
      />

      <SummaryDialog
        isOpen={combinedSummaryDialogOpen}
        onClose={() => setCombinedSummaryDialogOpen(false)}
        summaryContent={combinedSummaryData.formattedCombinedSummary || '*No included file summaries available.*'}
        tokenCount={combinedSummaryData.combinedSummaryTokens}
      />
    </div>
  )
}
