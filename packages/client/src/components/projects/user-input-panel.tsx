import { forwardRef, useState, useEffect, useRef, useImperativeHandle, useMemo } from 'react'
import { useHotkeys } from 'react-hotkeys-hook'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import { useNavigate } from '@tanstack/react-router'
import { Button } from '@promptliano/ui'
import { ExpandableTextarea } from '@/components/expandable-textarea'
import { useCopyClipboard } from '@/hooks/utility-hooks/use-copy-clipboard'
import { ShortcutDisplay } from '@/components/app-shortcut-display'
import { PromptlianoTooltip } from '@/components/promptliano/promptliano-tooltip'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@promptliano/ui'
import {
  useActiveProjectTab,
  useUpdateActiveProjectTab,
  useProjectTabField,
  useActiveChatId
} from '@/hooks/use-kv-local-storage'
import { useSelectedFiles } from '@/hooks/utility-hooks/use-selected-files'
import { SuggestedFilesDialog } from '../suggest-files-dialog'
import { SuggestedPromptsDialog } from '../suggest-prompts-dialog'
import { useCreateChat } from '@/hooks/api/use-chat-api'
import { useLocalStorage } from '@/hooks/utility-hooks/use-local-storage'
import { Binoculars, Bot, Copy, Check, FileText, MessageCircleCode, Search, Lightbulb } from 'lucide-react'
import { useGetProjectSummary, useSuggestFiles } from '@/hooks/api/use-projects-api'
import { useGetProjectPrompts, useSuggestPrompts } from '@/hooks/api/use-prompts-api'
import { Prompt } from '@promptliano/schemas'
import { useProjectFileTree } from '@/hooks/use-project-file-tree'
import { buildTreeStructure } from './file-panel/file-tree/file-tree'
import { ErrorBoundary } from '@/components/error-boundary/error-boundary'
import { ProjectFile } from '@promptliano/schemas'
import { buildPromptContent, calculateTotalTokens } from '@promptliano/shared/src/utils/projects-utils'

export type UserInputPanelRef = {
  focusPrompt: () => void
}

interface UserInputPanelProps {
  className?: string
}

// Utility function to format token count with abbreviations
function formatCompactTokenCount(count: number): string {
  if (count >= 1000000) {
    const millions = count / 1000000
    return millions >= 10 ? `${Math.floor(millions)}m` : `${millions.toFixed(1).replace(/\.0$/, '')}m`
  } else if (count >= 1000) {
    const thousands = count / 1000
    return thousands >= 10 ? `${Math.floor(thousands)}k` : `${thousands.toFixed(1).replace(/\.0$/, '')}k`
  }
  return count.toString()
}

export const UserInputPanel = forwardRef<UserInputPanelRef, UserInputPanelProps>(function UserInputPanel(
  { className },
  ref
) {
  const [activeProjectTabState, , activeProjectTabId] = useActiveProjectTab()
  const updateActiveProjectTab = useUpdateActiveProjectTab()

  const { data: selectedPrompts = [] } = useProjectTabField('selectedPrompts', activeProjectTabId ?? -1)
  const { data: globalUserPrompt = '' } = useProjectTabField('userPrompt', activeProjectTabId ?? -1)
  const [suggestedFiles, setSuggestedFiles] = useState<ProjectFile[]>([])
  const [suggestedPrompts, setSuggestedPrompts] = useState<Prompt[]>([])

  // Keep a local copy of userPrompt so that typing is instantly reflected in the textarea
  const [localUserPrompt, setLocalUserPrompt] = useState(globalUserPrompt)
  const createChatMutation = useCreateChat()
  const [, setInitialChatContent] = useLocalStorage('initial-chat-content', '')
  const [, setActiveChatId] = useActiveChatId()
  const navigate = useNavigate()

  const { copyToClipboard } = useCopyClipboard()
  const promptInputRef = useRef<HTMLTextAreaElement>(null)
  const findSuggestedFilesMutation = useSuggestFiles()
  const findSuggestedPromptsMutation = useSuggestPrompts()
  const [showSuggestions, setShowSuggestions] = useState(false)
  const [showPromptSuggestions, setShowPromptSuggestions] = useState(false)
  const [copyAllStatus, setCopyAllStatus] = useState<'idle' | 'copying' | 'success'>('idle')

  // Load the project's prompts
  const { data: promptData } = useGetProjectPrompts(activeProjectTabState?.selectedProjectId ?? -1)
  const { data: projectSummaryRes } = useGetProjectSummary(activeProjectTabState?.selectedProjectId ?? -1)

  // Read selected files
  const { selectedFiles, projectFileMap } = useSelectedFiles()

  // Calculate total tokens
  const totalTokens = useMemo(() => {
    return calculateTotalTokens(promptData?.data, selectedPrompts, localUserPrompt, selectedFiles, projectFileMap)
  }, [promptData, selectedPrompts, localUserPrompt, selectedFiles, projectFileMap])

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

    if (!promptData?.data) {
      return
    }

    return buildPromptContent({
      promptData: promptData?.data,
      selectedPrompts,
      userPrompt: finalUserPrompt,
      selectedFiles,
      fileMap: projectFileMap
    })
  }

  const handleCopyAll = async () => {
    if (copyAllStatus === 'copying') return

    setCopyAllStatus('copying')

    try {
      await navigator.clipboard.writeText(buildFullProjectContext() ?? '')
      setCopyAllStatus('success')

      // Reset to idle after 2 seconds
      setTimeout(() => setCopyAllStatus('idle'), 2000)
    } catch (error) {
      console.error('Failed to copy:', error)
      setCopyAllStatus('idle')
      // Still use the toast for errors
      toast.error('Failed to copy to clipboard')
    }
  }

  const handleFindSuggestions = () => {
    // If localUserPrompt is empty, ask user to type something
    if (!localUserPrompt.trim()) {
      alert('Please enter a prompt!')
      return
    }
    findSuggestedFilesMutation.mutate(
      {
        projectId: activeProjectTabState?.selectedProjectId ?? -1,
        params: { userInput: `Please find the relevant files for the following prompt: ${localUserPrompt}` }
      },
      {
        onSuccess: (recommendedFiles) => {
          if (recommendedFiles && recommendedFiles.length > 0) {
            // recommendedFiles is already an array of ProjectFile objects
            setSuggestedFiles(recommendedFiles)
            setShowSuggestions(true)
          }
        }
      }
    )
  }

  const handleFindPromptSuggestions = () => {
    // If localUserPrompt is empty, ask user to type something
    if (!localUserPrompt.trim()) {
      alert('Please enter a prompt!')
      return
    }
    findSuggestedPromptsMutation.mutate(
      {
        projectId: activeProjectTabState?.selectedProjectId ?? -1,
        params: {
          userInput: localUserPrompt,
          limit: 5
        }
      },
      {
        onSuccess: (recommendedPrompts) => {
          if (recommendedPrompts?.prompts && recommendedPrompts.prompts.length > 0) {
            setSuggestedPrompts(recommendedPrompts.prompts)
            setShowPromptSuggestions(true)
          } else {
            toast.info('No relevant prompts found for your input')
          }
        }
      }
    )
  }

  async function handleChatWithContext() {
    const defaultTitle = `New Chat ${new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`
    setInitialChatContent(buildFullProjectContext() ?? '')

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
  useImperativeHandle(ref, () => ({
    focusPrompt() {
      promptInputRef.current?.focus()
    }
  }))

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
        <div className={cn('flex flex-col h-full overflow-hidden p-4', className)}>
          <SuggestedFilesDialog
            open={showSuggestions}
            onClose={() => setShowSuggestions(false)}
            suggestedFiles={suggestedFiles}
          />
          <SuggestedPromptsDialog
            open={showPromptSuggestions}
            onClose={() => setShowPromptSuggestions(false)}
            suggestedPrompts={suggestedPrompts}
          />

          <div className='flex-1 flex flex-col min-h-0'>
            <div className='flex items-center gap-2 mb-2 shrink-0'>
              <span className='text-sm font-medium'>User Input</span>
              <PromptlianoTooltip>
                <div className='space-y-2'>
                  <p>Shortcuts:</p>
                  <ul>
                    <li>
                      - <span className='font-medium'>Copy All:</span>{' '}
                      <ShortcutDisplay shortcut={['mod', 'shift', 'c']} />
                    </li>
                  </ul>
                </div>
              </PromptlianoTooltip>
              <div className='ml-auto text-xs text-muted-foreground'>
                {formatCompactTokenCount(totalTokens)} tokens in context
              </div>
            </div>

            <div className='flex-1 min-h-0 flex flex-col'>
              <ExpandableTextarea
                ref={promptInputRef}
                placeholder='Type your user prompt here...'
                value={localUserPrompt}
                onChange={(val) => setLocalUserPrompt(val)}
                className='flex-1 min-h-0 bg-background'
              />

              <div className='flex gap-2 mt-3 shrink-0 flex-wrap'>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      onClick={handleCopyAll}
                      size='sm'
                      disabled={copyAllStatus === 'copying'}
                      className='transition-colors duration-200 w-[100px]'
                    >
                      <div className='flex items-center justify-center w-full'>
                        {copyAllStatus === 'success' ? (
                          <>
                            <Check className='h-3.5 w-3.5 mr-1 text-green-500 animate-in zoom-in-50 duration-200' />
                            <span className='text-green-600 dark:text-green-400'>Copied!</span>
                          </>
                        ) : (
                          <>
                            <Copy className='h-3.5 w-3.5 mr-1 transition-all duration-200' />
                            <span>Copy All</span>
                          </>
                        )}
                      </div>
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
                    <Button onClick={handleFindSuggestions} disabled={findSuggestedFilesMutation.isPending} size='sm'>
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
                    <p>Suggest relevant files based on your user input as well as your project summary context.</p>
                  </TooltipContent>
                </Tooltip>

                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      onClick={handleFindPromptSuggestions}
                      disabled={findSuggestedPromptsMutation.isPending}
                      size='sm'
                    >
                      {findSuggestedPromptsMutation.isPending ? (
                        <>
                          <Lightbulb className='h-3.5 w-3.5 mr-1 animate-pulse' />
                          Finding...
                        </>
                      ) : (
                        <>
                          <Lightbulb className='h-3.5 w-3.5 mr-1' />
                          Prompts
                        </>
                      )}
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>Suggest relevant saved prompts based on your user input and project context.</p>
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
                      Start a new chat session with the current context. This includes user input, selected prompts, and
                      selected files.
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
              </div>
            </div>
          </div>
        </div>
      </TooltipProvider>
    </ErrorBoundary>
  )
})
