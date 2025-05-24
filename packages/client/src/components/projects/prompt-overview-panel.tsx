import { forwardRef, useState, useEffect, useRef, useImperativeHandle, useMemo } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useHotkeys } from 'react-hotkeys-hook'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import { useNavigate } from '@tanstack/react-router'
import { Button } from '@ui'
import { Progress } from '@ui'
import { ExpandableTextarea } from '@/components/expandable-textarea'
import { PromptsList, type PromptsListRef } from '@/components/projects/prompts-list'
import { PromptDialog } from '@/components/projects/prompt-dialog'
import { useCreatePrompt, useUpdatePrompt, useGetProjectPrompts } from '@/hooks/api/use-prompts-api'
import { buildPromptContent, calculateTotalTokens, promptSchema } from 'shared/src/utils/projects-utils'
import { useCopyClipboard } from '@/hooks/utility-hooks/use-copy-clipboard'
import { ShortcutDisplay } from '@/components/app-shortcut-display'
import { OctoTooltip } from '@/components/octo/octo-tooltip'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import {
  useActiveProjectTab,
  useUpdateActiveProjectTab,
  useProjectTabField,
  useActiveChatId
} from '@/hooks/use-kv-local-storage'
import { useSelectedFiles } from '@/hooks/utility-hooks/use-selected-files'
import { z } from 'zod'
import { SuggestedFilesDialog } from '../suggest-files-dialog'
import { VerticalResizablePanel } from '@ui'
import { ProjectFile } from '@/generated'
import { useCreateChat } from '@/hooks/api/use-chat-api'
import { useLocalStorage } from '@/hooks/utility-hooks/use-local-storage'
import { Binoculars, Bot, Copy, FileText, MessageCircleCode, Search } from 'lucide-react'
import { useGetProjectSummary, useSuggestFiles } from '@/hooks/api/use-projects-api'
import { AgentCoderControlDialog } from './agent-coding-dialog'
import { useProjectFileTree } from '@/hooks/use-project-file-tree'
import { buildTreeStructure } from './file-panel/file-tree/file-tree'
import { ErrorBoundary } from '@/components/error-boundary/error-boundary'

export type PromptOverviewPanelRef = {
  focusPrompt: () => void
}

interface PromptOverviewPanelProps {
  className?: string
}

export const PromptOverviewPanel = forwardRef<PromptOverviewPanelRef, PromptOverviewPanelProps>(
  function PromptOverviewPanel({ className }, ref) {
    const [activeProjectTabState, , activeProjectTabId] = useActiveProjectTab()
    const updateActiveProjectTab = useUpdateActiveProjectTab()
    const [isLogDialogOpen, setIsLogDialogOpen] = useState(false)

    const { data: selectedPrompts = [] } = useProjectTabField('selectedPrompts', activeProjectTabId ?? -1)
    const { data: globalUserPrompt = '' } = useProjectTabField('userPrompt', activeProjectTabId ?? -1)
    const { data: contextLimit = 128000 } = useProjectTabField('contextLimit', activeProjectTabId ?? -1)
    const [suggestedFiles, setSuggestedFiles] = useState<ProjectFile[]>([])

    // Keep a local copy of userPrompt so that typing is instantly reflected in the textarea
    const [localUserPrompt, setLocalUserPrompt] = useState(globalUserPrompt)
    const createChatMutation = useCreateChat()
    const [, setInitialChatContent] = useLocalStorage('initial-chat-content', '')
    const [, setActiveChatId] = useActiveChatId()
    const navigate = useNavigate()

    const { copyToClipboard } = useCopyClipboard()
    const promptInputRef = useRef<HTMLTextAreaElement>(null)
    const findSuggestedFilesMutation = useSuggestFiles(activeProjectTabState?.selectedProjectId ?? -1)
    const [showSuggestions, setShowSuggestions] = useState(false)

    // Prompt creation/editing dialog states
    const [promptDialogOpen, setPromptDialogOpen] = useState(false)
    const [editPromptId] = useState<number | null>(null)

    // Load the project's prompts
    const { data: promptData } = useGetProjectPrompts(activeProjectTabState?.selectedProjectId ?? -1)
    const createPromptMutation = useCreatePrompt(activeProjectTabState?.selectedProjectId ?? -1)
    const updatePromptMutation = useUpdatePrompt(activeProjectTabState?.selectedProjectId ?? -1)
    const { data: projectSummaryRes } = useGetProjectSummary(activeProjectTabState?.selectedProjectId ?? -1)

    // React Hook Form for creating/editing prompts
    const promptForm = useForm<z.infer<typeof promptSchema>>({
      resolver: zodResolver(promptSchema),
      defaultValues: { name: '', content: '' }
    })

    // Read selected files
    const { selectedFiles, projectFileMap } = useSelectedFiles()

    // Calculate total tokens
    const totalTokens = useMemo(() => {
      return calculateTotalTokens(promptData, selectedPrompts, localUserPrompt, selectedFiles, projectFileMap)
    }, [promptData, selectedPrompts, localUserPrompt, selectedFiles, projectFileMap])

    const usagePercentage = contextLimit > 0 ? (totalTokens / contextLimit) * 100 : 0

    // Update localUserPrompt if global changes externally
    useEffect(() => {
      if (globalUserPrompt !== localUserPrompt) {
        setLocalUserPrompt(globalUserPrompt)
      }
    }, [globalUserPrompt])

    // Sync localUserPrompt back to the global store after a short delay
    useEffect(() => {
      const timer = setTimeout(() => {
        if (localUserPrompt !== globalUserPrompt) {
          updateActiveProjectTab({ userPrompt: localUserPrompt })
        }
      }, 500)
      return () => clearTimeout(timer)
    }, [localUserPrompt, globalUserPrompt])

    const buildFullProjectContext = () => {
      const finalUserPrompt = promptInputRef.current?.value ?? localUserPrompt

      return buildPromptContent({
        promptData,
        selectedPrompts,
        userPrompt: finalUserPrompt,
        selectedFiles,
        fileMap: projectFileMap
      })
    }
    const handleCopyAll = () => {
      copyToClipboard(buildFullProjectContext(), {
        successMessage: 'All content copied',
        errorMessage: 'Copy failed'
      })
    }

    const handleFindSuggestions = () => {
      // If localUserPrompt is empty, ask user to type something
      if (!localUserPrompt.trim()) {
        alert('Please enter a prompt!')
        return
      }
      findSuggestedFilesMutation.mutate(
        { userInput: `Please find the relevant files for the following prompt: ${localUserPrompt}` },
        {
          onSuccess: (resp) => {
            if (resp?.data?.success && resp.data?.recommendedFileIds) {
              const files = resp.data.recommendedFileIds
                .map((id) => {
                  const file = projectFileMap.get(id)
                  if (file) {
                    return file
                  }

                  return null
                })
                .filter(Boolean) as ProjectFile[]

              setSuggestedFiles(files)
              setShowSuggestions(true)
            }
          }
        }
      )
    }

    useEffect(() => {
      if (editPromptId && promptData?.data) {
        const p = promptData.data.find((x) => x.id === editPromptId)
        if (p) {
          promptForm.setValue('name', p.name)
          promptForm.setValue('content', p.content)
        }
      } else {
        promptForm.reset()
      }
    }, [editPromptId, promptData?.data])

    async function handleCreatePrompt(values: z.infer<typeof promptSchema>) {
      if (!activeProjectTabState?.selectedProjectId) return
      const result = await createPromptMutation.mutateAsync({
        body: {
          projectId: activeProjectTabState.selectedProjectId,
          name: values.name,
          content: values.content
        }
      })

      // @ts-ignore
      if (result.success) {
        toast.success('Prompt created')
        setPromptDialogOpen(false)
      }
    }

    async function handleUpdatePromptContent(promptId: number, updates: { name: string; content: string }) {
      if (!activeProjectTabState?.selectedProjectId) return
      await updatePromptMutation.mutateAsync({ promptId, data: updates })
      toast.success('Prompt updated')
      setPromptDialogOpen(false)
    }

    async function handleChatWithContext() {
      const defaultTitle = `New Chat ${new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`
      setInitialChatContent(buildFullProjectContext())

      // without the timeout, the intial content doesn't get set before the navigation to the chat page
      setTimeout(async () => {
        try {
          const newChat = await createChatMutation.mutateAsync({
            title: defaultTitle
          })
          // Ensure newChat has an ID (adjust based on actual return type)
          const newChatId = newChat?.data.id // Type assertion might be needed
          if (newChatId) {
            setActiveChatId(newChatId)
            // navigate to the chat, where the chat page will load the initial content from local storage
            navigate({ to: '/chat' })

            toast.success('New chat created')
          } else {
            throw new Error('Created chat did not return an ID.')
          }
        } catch (error) {
          console.error('Error creating chat:', error)
          toast.error('Failed to create chat')
        }
      }, 10)
    }

    // Hotkey for copy
    useHotkeys('mod+shift+c', (e) => {
      e.preventDefault()
      handleCopyAll()
    })

    // Expose focus to parent
    const promptsListRef = useRef<PromptsListRef>(null)
    useImperativeHandle(ref, () => ({
      focusPrompt() {
        promptInputRef.current?.focus()
      }
    }))

    // --- NEW: Handler to view the currently running agent's logs ---
    const handleViewAgentDialog = () => {
      setIsLogDialogOpen(true) // Open the dialog
    }
    const fileTree = useProjectFileTree()

    const tree = useMemo(() => {
      if (!fileTree || typeof fileTree !== 'object' || Object.keys(fileTree).length === 0) {
        return 'File tree structure not available.'
      }
      const outputLines: string[] = []
      const rootEntries = Object.entries(fileTree)

      for (const [name, nodeValue] of rootEntries) {
        outputLines.push(name)
        const node = nodeValue as any // Assuming nodeValue is FileNode-like
        if (node && typeof node === 'object' && node._folder && node.children) {
          const childrenTree = buildTreeStructure(node, '  ')
          if (childrenTree) {
            outputLines.push(childrenTree)
          }
        }
      }
      return outputLines.join('\n')
    }, [fileTree])

    const handleCopyProjectSummary = () => {
      const summaryText = projectSummaryRes?.summary ?? 'No project summary available.'
      const combinedContent = `Project Summary:\n${summaryText}\n\nFile Tree:\n${tree}`
      copyToClipboard(combinedContent, {
        successMessage: 'Project summary and file tree copied to clipboard',
        errorMessage: 'Failed to copy project summary and file tree'
      })
    }

    return (
      <ErrorBoundary>
        <TooltipProvider>
          <div className={cn('flex flex-col h-full overflow-hidden', className)}>
            <SuggestedFilesDialog
              open={showSuggestions}
              onClose={() => setShowSuggestions(false)}
              suggestedFiles={suggestedFiles}
            />

            <div className='flex-1 flex flex-col min-h-0 p-4 overflow-hidden min-w-0'>
              {/* 1) Token usage */}
              <div className='shrink-0 space-y-2 mb-4 '>
                <div className='space-y-1'>
                  <div className='text-xs text-muted-foreground'>
                    {totalTokens} of {contextLimit} tokens used ({usagePercentage.toFixed(0)}%)
                  </div>
                  <Progress value={usagePercentage} variant='danger' />
                </div>
              </div>

              {/* Resizable panels for Prompts List and User Input */}
              <VerticalResizablePanel
                topPanel={
                  <PromptsList ref={promptsListRef} projectTabId={activeProjectTabId || -1} className='h-full w-full' />
                }
                bottomPanel={
                  <div className='flex flex-col h-full w-full'>
                    <div className='flex items-center gap-2 mb-2 shrink-0'>
                      <span className='text-sm font-medium'>User Input</span>
                      <OctoTooltip>
                        <div className='space-y-2'>
                          <p>Shortcuts:</p>
                          <ul>
                            <li>
                              - <span className='font-medium'>Copy All:</span>{' '}
                              <ShortcutDisplay shortcut={['mod', 'shift', 'c']} />
                            </li>
                          </ul>
                        </div>
                      </OctoTooltip>
                    </div>
                    <div className='flex-1 min-h-0 flex flex-col'>
                      <ExpandableTextarea
                        ref={promptInputRef}
                        placeholder='Type your user prompt here...'
                        value={localUserPrompt}
                        onChange={(val) => setLocalUserPrompt(val)}
                        className='flex-1 min-h-0 bg-background'
                      />
                      <div className='flex gap-2 mt-2 shrink-0 flex-wrap'>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button onClick={handleCopyAll} size='sm'>
                              <Copy className='h-3.5 w-3.5 mr-1' />
                              Copy
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent>
                            <p>
                              Copy all context (User Input + Selected Prompts + Selected Files) to clipboard.
                              <ShortcutDisplay shortcut={['mod', 'shift', 'c']} variant='secondary' />
                            </p>
                          </TooltipContent>
                        </Tooltip>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button
                              onClick={handleFindSuggestions}
                              disabled={findSuggestedFilesMutation.isPending}
                              size='sm'
                            >
                              {findSuggestedFilesMutation.isPending ? (
                                <>
                                  <Binoculars className='h-3.5 w-3.5 mr-1 animate-spin' />
                                  Finding...
                                </>
                              ) : (
                                <>
                                  <Search className='h-3.5 w-3.5 mr-1' />
                                  Files
                                </>
                              )}
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent>
                            <p>
                              Suggest relevant files based on your user input as well as your project summary context.
                            </p>
                          </TooltipContent>
                        </Tooltip>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button onClick={handleChatWithContext} size='sm'>
                              <MessageCircleCode className='h-3.5 w-3.5 mr-1' /> Chat
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent>
                            <p>
                              Start a new chat session with the current context. This includes user input, selected
                              prompts, and selected files.
                            </p>
                          </TooltipContent>
                        </Tooltip>

                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button onClick={handleCopyProjectSummary} size='sm'>
                              <FileText className='h-3.5 w-3.5 mr-1' /> Summary
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent>
                            <p>Copy the project summary and file tree to clipboard.</p>
                          </TooltipContent>
                        </Tooltip>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button
                              onClick={handleViewAgentDialog}
                              variant={'outline'}
                              size='sm'
                              className={cn(
                                'bg-gradient-to-r from-blue-500/10 via-purple-500/10 to-pink-500/10 border-purple-500/30 hover:border-purple-500/50'
                              )}
                            >
                              <Bot className='h-3.5 w-3.5 mr-1' /> Agent
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent>
                            <p>Open the Agent Coder control panel to run AI tasks.</p>
                          </TooltipContent>
                        </Tooltip>
                      </div>
                    </div>
                  </div>
                }
                initialTopPanelHeight={55}
                minTopPanelHeight={15}
                maxTopPanelHeight={85}
                storageKey='prompt-panel-height'
                className='flex-1 min-h-0'
                resizerClassName='my-1'
              />
            </div>

            <PromptDialog
              open={promptDialogOpen}
              editPromptId={editPromptId}
              promptForm={promptForm}
              handleCreatePrompt={handleCreatePrompt}
              handleUpdatePrompt={async (updates) => {
                if (!editPromptId) return
                return handleUpdatePromptContent(editPromptId, updates)
              }}
              createPromptPending={createPromptMutation.isPending}
              updatePromptPending={updatePromptMutation.isPending}
              onClose={() => setPromptDialogOpen(false)}
            />

            <AgentCoderControlDialog
              open={isLogDialogOpen}
              onOpenChange={setIsLogDialogOpen}
              userInput={localUserPrompt}
              selectedFiles={selectedFiles}
              projectId={activeProjectTabState?.selectedProjectId || -1}
              selectedPrompts={selectedPrompts}
              promptData={promptData?.data}
              totalTokens={totalTokens}
              projectFileMap={projectFileMap}
            />
          </div>
        </TooltipProvider>
      </ErrorBoundary>
    )
  }
)
