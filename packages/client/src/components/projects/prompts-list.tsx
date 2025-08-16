import { forwardRef, useState, useRef, useEffect, KeyboardEvent, useImperativeHandle, useMemo } from 'react'
import { Button } from '@promptliano/ui'
import { Eye, Pencil, Trash, Plus, ArrowUpDown, ArrowDownAZ, Copy, ChevronRight, Upload, Download } from 'lucide-react'
import {
  AlertDialog,
  AlertDialogTrigger,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogFooter,
  AlertDialogTitle,
  AlertDialogCancel,
  AlertDialogAction
} from '@promptliano/ui'
import { Checkbox } from '@promptliano/ui'
import { FileViewerDialog } from '@/components/navigation/file-viewer-dialog'
import { ScrollArea } from '@promptliano/ui'
import { FormatTokenCount } from '../format-token-count'
import { cn } from '@/lib/utils'
import { useGetProjectPrompts, useDeletePrompt } from '@/hooks/api/use-prompts-api'
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@promptliano/ui'
import { PromptDialog } from '@/components/projects/prompt-dialog'
import { useForm } from 'react-hook-form'
import { z } from 'zod'
import { toast } from 'sonner'
import { zodResolver } from '@hookform/resolvers/zod'
import { PromptSchema } from '@promptliano/schemas'

import { PromptsDialogAll } from '../prompts/all-prompts-dialog'
import { MarkdownImportDialog } from '../prompts/markdown-import-dialog'
import { MarkdownExportMenuItem } from '../prompts/markdown-export-button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuSeparator,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSub,
  DropdownMenuSubTrigger,
  DropdownMenuSubContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem
} from '@promptliano/ui'
import { DotsHorizontalIcon } from '@radix-ui/react-icons'
import { Badge } from '@promptliano/ui'
import { PromptlianoTooltip } from '../promptliano/promptliano-tooltip'
import { ShortcutDisplay } from '../app-shortcut-display'
import { ProjectFile } from '@promptliano/schemas'
import { useGetProjectTabById, useUpdateProjectTabState } from '@/hooks/use-kv-local-storage'
import { useCopyClipboard } from '@/hooks/utility-hooks/use-copy-clipboard'

export type PromptsListRef = {
  focusPrompts: () => void
}

interface PromptsListProps {
  projectTabId: number
  className?: string
}

export const PromptsList = forwardRef<PromptsListRef, PromptsListProps>(({ projectTabId, className = '' }, ref) => {
  const updateProjectTabState = useUpdateProjectTabState(projectTabId)
  const [projectTab, setProjectTab] = useGetProjectTabById(projectTabId)
  const selectedPrompts = projectTab?.selectedPrompts || []
  const selectedProjectId = projectTab?.selectedProjectId || -1
  const { copyToClipboard } = useCopyClipboard()

  // Collapsible state - default to true (collapsed) to save space
  const isCollapsed = projectTab?.promptsPanelCollapsed ?? true

  const { data: promptData, isLoading, error, isError } = useGetProjectPrompts(selectedProjectId)

  const deletePromptMutation = useDeletePrompt()

  const [focusedIndex, setFocusedIndex] = useState<number>(-1)
  const promptRefs = useRef<(HTMLDivElement | null)[]>([])
  const [viewedPrompt, setViewedPrompt] = useState<ProjectFile | null>(null)

  const [promptDialogOpen, setPromptDialogOpen] = useState(false)
  const [editPromptId, setEditPromptId] = useState<number | null>(null)

  const [sortOrder, setSortOrder] = useState<'alphabetical' | 'default' | 'size_asc' | 'size_desc'>('alphabetical')

  const prompts = useMemo(() => {
    return (
      promptData?.data.map((prompt) => ({
        ...prompt,
        id: Number(prompt.id)
      })) || []
    )
  }, [promptData?.data])

  const sortedPrompts = useMemo(() => {
    let sortedPrompts = [...prompts]
    if (sortOrder === 'alphabetical') {
      sortedPrompts.sort((a, b) => a.name.localeCompare(b.name))
    } else if (sortOrder === 'size_desc') {
      sortedPrompts.sort((a, b) => (b.content?.length || 0) - (a.content?.length || 0))
    } else if (sortOrder === 'size_asc') {
      sortedPrompts.sort((a, b) => (a.content?.length || 0) - (b.content?.length || 0))
    }
    return sortedPrompts
  }, [sortOrder, prompts])

  const copySelectedPrompts = () => {
    if (!selectedPrompts.length) return
    const allPrompts = selectedPrompts
      .map((id) => {
        const p = promptData?.data?.find((x: { id: number }) => x.id === id)
        return p ? `# ${p.name}\n${p.content}\n` : ''
      })
      .join('\n')
    copyToClipboard(allPrompts, {
      successMessage: 'Copied all selected prompts.',
      errorMessage: 'Failed to copy prompts'
    })
  }

  const toggleCollapsed = () => {
    updateProjectTabState((prev) => ({
      ...prev,
      promptsPanelCollapsed: !isCollapsed
    }))
  }

  /** NEW: state for opening the all-prompts dialog */
  const [allPromptsDialogOpen, setAllPromptsDialogOpen] = useState(false)
  /** State for markdown import dialog */
  const [markdownImportDialogOpen, setMarkdownImportDialogOpen] = useState(false)

  // Our form for creating/updating
  const promptForm = useForm<z.infer<typeof PromptSchema>>({
    resolver: zodResolver(PromptSchema),
    defaultValues: {
      name: '',
      content: ''
    }
  })

  const handleDeletePrompt = async (promptId: number) => {
    if (!selectedProjectId) return
    await deletePromptMutation.mutateAsync(promptId)
    toast.success('Prompt deleted successfully')
  }

  const handleKeyDown = (e: KeyboardEvent<HTMLDivElement>, index: number, promptId: number) => {
    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault()
        if (index < prompts.length - 1) setFocusedIndex(index + 1)
        break
      case 'ArrowUp':
        e.preventDefault()
        if (index > 0) setFocusedIndex(index - 1)
        break
      case ' ':
        e.preventDefault()
        // Toggle selection
        updateProjectTabState((prev) => {
          const isSelected = prev.selectedPrompts.includes(promptId)
          const newSelected = isSelected
            ? prev.selectedPrompts.filter((p) => p !== promptId)
            : [...prev.selectedPrompts, promptId]
          return { selectedPrompts: newSelected }
        })
        break
      case 'Enter':
        e.preventDefault()
        handleOpenPromptViewer(prompts[index])
        break
      case 'Escape':
        e.preventDefault()
        e.currentTarget.blur()
        setFocusedIndex(-1)
        break
    }
  }

  useEffect(() => {
    if (focusedIndex >= 0 && promptRefs.current[focusedIndex]) {
      promptRefs.current[focusedIndex]?.focus()
    }
  }, [focusedIndex])

  const handleOpenPromptViewer = (prompt: {
    id: number
    name: string
    content: string
    created: number
    updated: number
    projectId?: number
  }) => {
    setViewedPrompt({
      id: prompt.id,
      name: prompt.name,
      content: prompt.content,
      path: prompt.name,
      extension: '.txt',
      projectId: prompt.projectId || selectedProjectId,
      created: new Date(prompt.created).getTime(),
      updated: new Date(prompt.updated).getTime(),
      size: prompt.content?.length || 0,
      meta: null,
      summary: null,
      summaryLastUpdated: null,
      checksum: null,
      imports: null,
      exports: null
    })
  }

  const handleClosePromptViewer = () => setViewedPrompt(null)

  const handleSavePrompt = (newContent: string) => {
    if (!viewedPrompt) return
    // TODO: IMPLEMENT SAVE Prompt
    console.log('TODO: handleSavePrompt, new content = ', newContent)
  }

  // // Expose a focus method
  // useImperativeHandle(
  //   ref,
  //   () => ({
  //     focusPrompts: () => {
  //       if (prompts.length > 0) setFocusedIndex(0)
  //     }
  //   }),
  //   [prompts]
  // )


  return (
    <>
      {/* NEW: All Prompts Import Dialog */}
      <PromptsDialogAll
        open={allPromptsDialogOpen}
        onClose={() => setAllPromptsDialogOpen(false)}
        selectedProjectId={selectedProjectId}
      />
      {/* Markdown Import Dialog */}
      <MarkdownImportDialog
        open={markdownImportDialogOpen}
        onOpenChange={setMarkdownImportDialogOpen}
        projectId={selectedProjectId}
        onSuccess={(importedCount) => {
          toast.success(`Successfully imported ${importedCount} prompt${importedCount > 1 ? 's' : ''}`)
        }}
      />
      <div
        className={cn(
          'border rounded-lg flex flex-col',
          isCollapsed ? 'flex-shrink-0' : 'h-full overflow-hidden',
          className
        )}
      >
        <Collapsible open={!isCollapsed} onOpenChange={() => toggleCollapsed()} className='h-full flex flex-col'>
          <CollapsibleTrigger asChild>
            <div className='flex-shrink-0 flex flex-row items-center justify-between p-2 border-b hover:bg-muted/50 cursor-pointer transition-colors'>
              <div className='flex items-center gap-2'>
                <ChevronRight className={cn('h-4 w-4 transition-transform', !isCollapsed && 'rotate-90')} />
                <div className='text-md font-medium flex items-center gap-2'>
                  <span>
                    <Badge variant={selectedPrompts.length > 0 && isCollapsed ? 'default' : 'default'}>
                      {selectedPrompts.length}
                    </Badge>{' '}
                    Project Prompts
                  </span>
                  {isCollapsed && selectedPrompts.length > 0 && (
                    <span className='text-xs text-muted-foreground'>({selectedPrompts.length} selected)</span>
                  )}
                  <PromptlianoTooltip>
                    <div className=''>
                      <p>
                        Prompts are reusable instructions that will be included with your chat. Each selected prompt
                        will be added to the final prompt sent to the AI.
                      </p>
                      <p>You can:</p>
                      <ul>
                        <li>- Create custom prompts for specific tasks</li>
                        <li>- Import prompts from other projects</li>
                        <li>- Select multiple prompts to combine instructions</li>
                      </ul>
                      <p className='font-medium mt-2'>Keyboard Shortcuts:</p>
                      <ul>
                        <li>
                          - <ShortcutDisplay shortcut={['up', 'down']} /> Navigate through prompts
                        </li>
                        <li>
                          - <ShortcutDisplay shortcut={['space']} /> Select/deselect prompt
                        </li>
                        <li>
                          - <ShortcutDisplay shortcut={['enter']} /> View prompt content
                        </li>
                        <li>
                          - <ShortcutDisplay shortcut={['mod', 'p']} /> Focus prompts list
                        </li>
                      </ul>
                    </div>
                  </PromptlianoTooltip>
                </div>
              </div>
              <div className='flex space-x-2' onClick={(e) => e.stopPropagation()}>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant='ghost' size='icon' className='h-8 w-8'>
                      <DotsHorizontalIcon className='h-4 w-4' />
                      <span className='sr-only'>Actions</span>
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align='end' className='w-48'>
                    <DropdownMenuItem
                      onClick={() => {
                        setEditPromptId(null)
                        promptForm.reset()
                        setPromptDialogOpen(true)
                      }}
                    >
                      <Plus className='mr-2 h-4 w-4' />
                      <span>New Prompt</span>
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => setAllPromptsDialogOpen(true)}>
                      <Eye className='mr-2 h-4 w-4' />
                      <span>Import Prompts</span>
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem onClick={() => setMarkdownImportDialogOpen(true)}>
                      <Upload className='mr-2 h-4 w-4' />
                      <span>Import MD Files</span>
                    </DropdownMenuItem>
                    <MarkdownExportMenuItem
                      projectId={selectedProjectId}
                      showOptions={true}
                      onExportComplete={() => {
                        toast.success('Prompts exported successfully')
                      }}
                    />
                    <DropdownMenuSeparator />
                    <DropdownMenuItem onClick={copySelectedPrompts}>
                      <Pencil className='mr-2 h-4 w-4' />
                      <span>Copy Selected Prompts</span>
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      onClick={() => {
                        updateProjectTabState((prev) => ({
                          ...prev,
                          selectedPrompts: []
                        }))
                        toast.success('Cleared all selected prompts')
                      }}
                      disabled={!selectedPrompts.length}
                    >
                      <Trash className='mr-2 h-4 w-4' />
                      <span>Clear Selected</span>
                    </DropdownMenuItem>
                    <DropdownMenuSub>
                      <DropdownMenuSubTrigger>
                        <ArrowUpDown className='mr-2 h-4 w-4' />
                        <span>Sort By</span>
                      </DropdownMenuSubTrigger>
                      <DropdownMenuSubContent>
                        <DropdownMenuRadioGroup
                          value={sortOrder}
                          onValueChange={(value) => {
                            setSortOrder(value as 'alphabetical' | 'default' | 'size_asc' | 'size_desc')
                          }}
                        >
                          <DropdownMenuRadioItem value='default'>
                            <ArrowUpDown className='mr-2 h-4 w-4' />
                            <span>Default</span>
                          </DropdownMenuRadioItem>
                          <DropdownMenuRadioItem value='alphabetical'>
                            <ArrowDownAZ className='mr-2 h-4 w-4' />
                            <span>Alphabetical</span>
                          </DropdownMenuRadioItem>
                          <DropdownMenuRadioItem value='size_desc'>
                            <ArrowDownAZ className='mr-2 h-4 w-4' />
                            <span>Size (Largest First)</span>
                          </DropdownMenuRadioItem>
                          <DropdownMenuRadioItem value='size_asc'>
                            <ArrowDownAZ className='mr-2 h-4 w-4' />
                            <span>Size (Smallest First)</span>
                          </DropdownMenuRadioItem>
                        </DropdownMenuRadioGroup>
                      </DropdownMenuSubContent>
                    </DropdownMenuSub>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </div>
          </CollapsibleTrigger>

          <CollapsibleContent className='flex-1 overflow-hidden'>
            <div className='h-full overflow-hidden'>
              {sortedPrompts.length > 0 ? (
                <ScrollArea className='h-full w-full'>
                  <div className='space-y-2 p-2 w-72 md:w-80 lg:w-full'>
                    {sortedPrompts.map((prompt, index) => (
                      <div
                        key={prompt.id}
                        // @ts-ignore
                        ref={(el) => (promptRefs.current[index] = el)}
                        className={cn(
                          'flex items-center justify-between rounded-md p-1 hover:bg-muted/50 group',
                          focusedIndex === index && 'bg-accent'
                        )}
                        tabIndex={0}
                        onFocus={() => setFocusedIndex(index)}
                        onKeyDown={(e) => handleKeyDown(e, index, prompt.id)}
                      >
                        <div className='flex items-center min-w-0'>
                          <Checkbox
                            className='mr-2'
                            checked={selectedPrompts.includes(prompt.id)}
                            onCheckedChange={(checked) => {
                              updateProjectTabState((prev) => {
                                const isSelected = prev.selectedPrompts.includes(prompt.id)
                                const newSelected = isSelected
                                  ? prev.selectedPrompts.filter((p) => p !== prompt.id)
                                  : [...prev.selectedPrompts, prompt.id]
                                return { selectedPrompts: newSelected }
                              })
                            }}
                          />
                          <div className='flex items-center space-x-2 min-w-0'>
                            <span className='font-medium'>
                              {prompt.name.length > 35 ? `${prompt.name.substring(0, 32)}...` : prompt.name}
                            </span>
                            <FormatTokenCount tokenContent={prompt.content ?? ''} />
                          </div>
                        </div>
                        <div className='flex items-center space-x-1 flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity'>
                          {/* Add Copy button */}
                          <Button
                            variant='ghost'
                            size='icon'
                            className='h-8 w-8'
                            onClick={async (e) => {
                              e.stopPropagation()
                              await copyToClipboard(prompt.content || '', {
                                successMessage: 'Prompt content copied to clipboard',
                                errorMessage: 'Failed to copy prompt content'
                              })
                            }}
                          >
                            <Copy className='h-4 w-4' />
                          </Button>

                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant='ghost' size='icon' className='h-8 w-8'>
                                <DotsHorizontalIcon className='h-4 w-4' />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align='end' className='w-48'>
                              <DropdownMenuItem onClick={() => handleOpenPromptViewer(prompt)}>
                                <Eye className='mr-2 h-4 w-4' />
                                <span>View Prompt</span>
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                onClick={() => {
                                  setEditPromptId(prompt.id)
                                  setPromptDialogOpen(true)
                                }}
                              >
                                <Pencil className='mr-2 h-4 w-4' />
                                <span>Edit Prompt</span>
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                onClick={async () => {
                                  await copyToClipboard(prompt.content || '', {
                                    successMessage: 'Prompt content copied to clipboard',
                                    errorMessage: 'Failed to copy prompt content'
                                  })
                                }}
                              >
                                <Copy className='mr-2 h-4 w-4' />
                                <span>Copy Content</span>
                              </DropdownMenuItem>
                              <DropdownMenuSeparator />
                              <AlertDialog>
                                <AlertDialogTrigger asChild>
                                  <DropdownMenuItem
                                    onSelect={(e) => e.preventDefault()}
                                    className='text-destructive focus:text-destructive'
                                  >
                                    <Trash className='mr-2 h-4 w-4' />
                                    <span>Delete Prompt</span>
                                  </DropdownMenuItem>
                                </AlertDialogTrigger>
                                <AlertDialogContent>
                                  <AlertDialogHeader>
                                    <AlertDialogTitle>Delete Prompt</AlertDialogTitle>
                                  </AlertDialogHeader>
                                  <p className='text-sm text-muted-foreground'>
                                    Are you sure you want to delete the prompt "{prompt.name}"?
                                  </p>
                                  <AlertDialogFooter>
                                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                                    <AlertDialogAction onClick={() => handleDeletePrompt(prompt.id)}>
                                      Delete
                                    </AlertDialogAction>
                                  </AlertDialogFooter>
                                </AlertDialogContent>
                              </AlertDialog>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </div>
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              ) : (
                <p className='text-sm text-muted-foreground p-4'>No prompts yet. Create one above.</p>
              )}
            </div>
          </CollapsibleContent>
        </Collapsible>
      </div>

      {/* A "viewer" dialog for prompts, if needed */}
      <FileViewerDialog
        open={!!viewedPrompt}
        viewedFile={viewedPrompt as ProjectFile}
        onClose={handleClosePromptViewer}
        onSave={handleSavePrompt}
        projectId={selectedProjectId}
      />

      {/* Prompt dialog for create/update */}
      <PromptDialog
        open={promptDialogOpen}
        editPromptId={editPromptId}
        promptForm={promptForm}
        projectId={selectedProjectId}
        onClose={() => {
          setPromptDialogOpen(false)
          setEditPromptId(null)
          promptForm.reset()
        }}
        onSuccess={() => {
          // THIS IS THE KEY FIX - Close the dialog on success
          setPromptDialogOpen(false)
          setEditPromptId(null)
          promptForm.reset()
        }}
      />
    </>
  )
})
