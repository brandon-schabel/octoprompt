import { useState, useEffect, useRef, useImperativeHandle, forwardRef } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useHotkeys } from 'react-hotkeys-hook'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'
import { Progress } from '@/components/ui/progress'
import { ExpandableTextarea } from '@/components/expandable-textarea'
import { PromptsList, type PromptsListRef } from '@/components/projects/prompts-list'
import { PromptDialog } from '@/components/projects/prompt-dialog'
import { PromptListResponse, useCreatePrompt, useUpdatePrompt, useDeletePrompt } from '@/hooks/api/use-prompts-api'
import { buildPromptContent, calculateTotalTokens, promptSchema } from '@/components/projects/utils/projects-utils'
import { ProjectFile } from 'shared'
import { useDebounce } from '@/hooks/utility-hooks/use-debounce'
import { useFindSuggestedFiles, useGetProjectFiles } from '@/hooks/api/use-projects-api'
import { useCopyClipboard } from '@/hooks/utility-hooks/use-copy-clipboard'
import { useUpdateActiveProjectTab } from '@/zustand/updaters'
import { formatShortcut } from '@/lib/shortcuts'
import { InfoTooltip } from '@/components/info-tooltip'
import { ShortcutDisplay } from '@/components/app-shortcut-display'
import { type UseSelectedFileReturn } from '@/hooks/utility-hooks/use-selected-files'
import { useActiveProjectTab } from '@/zustand/selectors'
import { SuggestedFilesDialog } from '../suggest-files-dialog'
import { useProjectTabField } from '@/zustand/zustand-utility-hooks'

export type PromptOverviewPanelRef = {
    focusPrompt: () => void
}

interface PromptOverviewPanelProps {
    selectedProjectId: string
    fileMap: Map<string, ProjectFile>
    promptData?: PromptListResponse
    className?: string
    selectedFilesState: UseSelectedFileReturn
}

export const PromptOverviewPanel = forwardRef<PromptOverviewPanelRef, PromptOverviewPanelProps>(
    function PromptOverviewPanel(
        { selectedProjectId, fileMap, promptData, className, selectedFilesState },
        ref
    ) {
        const { tabData: activeTabState, id: activeProjectTabId } = useActiveProjectTab()
        const updateActiveProjectTab = useUpdateActiveProjectTab()

        const { data: selectedPrompts = [] } = useProjectTabField(activeProjectTabId ?? "", 'selectedPrompts')
        const { data: globalUserPrompt = '' } = useProjectTabField(activeProjectTabId ?? "", 'userPrompt')
        const { data: contextLimit = 128000 } = useProjectTabField(activeProjectTabId ?? "", 'contextLimit')


        // Local state
        const [localUserPrompt, setLocalUserPrompt] = useState(globalUserPrompt)
        const [dialogOpen, setDialogOpen] = useState(false)
        const [promptDialogOpen, setPromptDialogOpen] = useState(false)
        const [editPromptId, setEditPromptId] = useState<string | null>(null)

        // Refs
        const promptInputRef = useRef<HTMLTextAreaElement>(null)
        const promptsListRef = useRef<PromptsListRef>(null)

        // Project files
        const { data: fileData } = useGetProjectFiles(selectedProjectId)
        const allProjectFiles: ProjectFile[] = fileData?.files || []

        // Suggested files from activeTab
        const suggestedFileIds = activeTabState?.suggestedFileIds || []
        const suggestedFiles = allProjectFiles.filter(file => suggestedFileIds.includes(file.id))

        const findSuggestedFilesMutation = useFindSuggestedFiles(selectedProjectId)

        // Keep local and global userPrompt in sync
        useEffect(() => {
            if (globalUserPrompt !== localUserPrompt) {
                setLocalUserPrompt(globalUserPrompt)
            }
        }, [globalUserPrompt])

        // Debounce saving to global state
        const updateGlobalPrompt = (value: string) => {
            updateActiveProjectTab(prev => ({
                ...prev,
                userPrompt: value,
            }))
        }
        const debouncedUpdateGlobal = useDebounce(updateGlobalPrompt, 1000)

        // For “undo/redo” + selected files
        const { selectedFiles } = selectedFilesState

        // Prompt form
        const promptForm = useForm<z.infer<typeof promptSchema>>({
            resolver: zodResolver(promptSchema),
            defaultValues: { name: '', content: '' },
        })

        const createPromptMutation = useCreatePrompt()
        const updatePromptMutation = useUpdatePrompt()
        const deletePromptMutation = useDeletePrompt()
        const { copyToClipboard } = useCopyClipboard()

        // Calculate total tokens used
        const totalTokens = calculateTotalTokens(promptData, selectedPrompts, localUserPrompt, selectedFiles, fileMap)

        const usagePercentage = contextLimit > 0
            ? (totalTokens / contextLimit) * 100
            : 0

        // Build final prompt text
        const promptBuilder = () => {
            return buildPromptContent({
                promptData,
                selectedPrompts,
                userPrompt: localUserPrompt,
                selectedFiles,
                fileMap,
            })
        }

        // Copy entire prompt to clipboard
        const handleCopyToClipboard = () => {
            if (!fileMap.size && !localUserPrompt.trim() && selectedPrompts.length === 0) return
            const finalPrompt = promptBuilder()

            copyToClipboard(finalPrompt, {
                successMessage: 'All Content Copied to clipboard',
                errorMessage: 'Failed to copy',
            })
        }

        // Find suggested files
        function handleFindSuggestedFiles(userPrompt: string) {
            if (!userPrompt.trim()) {
                alert('Please enter a prompt!')
                return
            }
            findSuggestedFilesMutation.mutate(userPrompt, {
                onSuccess: (resp) => {
                    if (resp.success && resp.recommendedFileIds) {
                        updateActiveProjectTab(prev => ({
                            ...prev,
                            suggestedFileIds: resp.recommendedFileIds
                        }))
                        setDialogOpen(true)
                    } else {
                        alert(resp.message || 'No suggestions returned')
                    }
                }
            })
        }

        // Prompt creation/editing
        async function handleCreatePrompt(values: z.infer<typeof promptSchema>) {
            if (!selectedProjectId) return
            const result = await createPromptMutation.mutateAsync({
                ...values,
                projectId: selectedProjectId,
            })
            if (result.success && result.prompt) {
                promptForm.reset()
                setPromptDialogOpen(false)
            }
        }

        async function handleUpdatePromptContent(promptId: string, updates: { name: string; content: string }) {
            await updatePromptMutation.mutateAsync({ id: promptId, updates })
            toast.success('Prompt updated successfully')
            setPromptDialogOpen(false)
        }

        // Load prompt data into the form if editing
        useEffect(() => {
            if (editPromptId && promptData?.prompts) {
                const prompt = promptData.prompts.find(p => p.id === editPromptId)
                if (prompt) {
                    promptForm.setValue('name', prompt.name)
                    promptForm.setValue('content', prompt.content)
                }
            } else {
                promptForm.reset()
            }
        }, [editPromptId, promptData?.prompts])

        // Keyboard shortcuts
        useHotkeys('mod+shift+c', (e) => {
            e.preventDefault()
            handleCopyToClipboard()
        }, [handleCopyToClipboard])


        useHotkeys('mod+p', (e) => {
            e.preventDefault()
            promptsListRef.current?.focusPrompts()
        }, [])

        // Expose “focusPrompt” to the parent
        useImperativeHandle(ref, () => ({
            focusPrompt: () => {
                promptInputRef.current?.focus()
            }
        }), [])

        // Update local & global user prompt
        const handleUserPromptChange = (value: string) => {
            setLocalUserPrompt(value)
            debouncedUpdateGlobal(value)
        }

        return (
            <div className={`flex flex-col overflow-y-auto ${className}`}>
                <SuggestedFilesDialog
                    open={dialogOpen}
                    onClose={() => setDialogOpen(false)}
                    suggestedFiles={suggestedFiles}
                    selectedFilesState={selectedFilesState}
                />

                <div className="bg-background flex-1 flex flex-col overflow-hidden transition-all duration-300 p-4 border-l">
                    <div className="flex flex-col h-full overflow-hidden">

                        {/* 1) Token Usage Info */}
                        <div className="space-y-2 mb-4 border-b">
                            <div className="space-y-1">
                                <div className="text-xs text-muted-foreground">
                                    {totalTokens} of {contextLimit} tokens used ({usagePercentage.toFixed(0)}%)
                                </div>
                                <Progress
                                    value={usagePercentage}
                                    className="relative w-full h-2 bg-primary/20 rounded-full overflow-hidden"
                                    variant="danger"
                                />
                            </div>
                        </div>

                        {/* 2) Prompts List */}
                        <div className="flex flex-col flex-1 overflow-hidden">
                            <div className="flex-1 min-h-0">
                                <PromptsList
                                    ref={promptsListRef}
                                    projectTabId={activeProjectTabId || 'defaultTab'}
                                    className="h-full"
                                />
                            </div>

                            <hr className="my-2" />

                            {/* 3) User prompt area */}
                            <div className="h-1/2">
                                <div className="flex flex-col h-full">
                                    <div className="flex items-center gap-2 mb-2">
                                        <span className="text-sm font-medium">User Input</span>
                                        <InfoTooltip>
                                            <div className="space-y-2">
                                                <p>Input Features & Shortcuts:</p>
                                                <ul>
                                                    <li>- <span className="font-medium">Voice Input:</span> (if implemented)</li>
                                                    <li>- <span className="font-medium">Expand:</span> Use the expand icon for a bigger editing area</li>
                                                    <li>- <span className="font-medium">Copy All:</span> <ShortcutDisplay shortcut={['mod', 'shift', 'c']} /> Copy entire prompt</li>
                                                    <li>- <span className="font-medium">Focus Input:</span> <ShortcutDisplay shortcut={['mod', 'i']} /> Focus the input area</li>
                                                </ul>
                                            </div>
                                        </InfoTooltip>
                                    </div>

                                    <ExpandableTextarea
                                        ref={promptInputRef}
                                        placeholder="Type your user prompt here..."
                                        value={localUserPrompt}
                                        onChange={handleUserPromptChange}
                                        className="flex-1 bg-background"
                                    />

                                    <div className="flex gap-2 mt-2">
                                        <Button onClick={handleCopyToClipboard}>
                                            Copy All {formatShortcut('mod+shift+c')}
                                        </Button>
                                        <Button
                                            onClick={() => handleFindSuggestedFiles(localUserPrompt)}
                                            disabled={findSuggestedFilesMutation.isPending}
                                        >
                                            {findSuggestedFilesMutation.isPending ? 'Finding...' : 'Find Suggested Files'}
                                        </Button>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Prompt creation/editing dialog */}
                    <PromptDialog
                        open={promptDialogOpen}
                        editPromptId={editPromptId}
                        promptForm={promptForm}
                        handleCreatePrompt={handleCreatePrompt}
                        handleUpdatePrompt={(updates) =>
                            handleUpdatePromptContent(editPromptId!, updates)
                        }
                        createPromptPending={createPromptMutation.isPending}
                        updatePromptPending={updatePromptMutation.isPending}
                        onClose={() => setPromptDialogOpen(false)}
                    />
                </div>
            </div>
        )
    }
)