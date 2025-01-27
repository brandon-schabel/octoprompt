import { useState, useMemo, useEffect, useRef, useImperativeHandle, forwardRef, useCallback, memo, RefObject } from 'react'
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
import { useUpdateActiveProjectTab } from '@/websocket-state/hooks/updaters/websocket-updater-hooks'
import { formatShortcut } from '@/lib/shortcuts'
import { InfoTooltip } from '@/components/info-tooltip'
import { ShortcutDisplay } from '@/components/app-shortcut-display'
import { type UseSelectedFileReturn } from '@/hooks/utility-hooks/use-selected-files'
import { useActiveProjectTab } from '@/websocket-state/hooks/selectors/websocket-selector-hoooks'
import { SuggestedFilesDialog } from '../suggest-files-dialog'

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



        // Active tab state slices
        const selectedPrompts = activeTabState?.selectedPrompts || []
        const globalUserPrompt = activeTabState?.userPrompt || ''
        const contextLimit = activeTabState?.contextLimit || 128000

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
        const suggestedFiles = useMemo(
            () => allProjectFiles.filter(file => suggestedFileIds.includes(file.id)),
            [allProjectFiles, suggestedFileIds]
        )

        const findSuggestedFilesMutation = useFindSuggestedFiles(selectedProjectId)

        // Keep local and global userPrompt in sync
        useEffect(() => {
            if (globalUserPrompt !== localUserPrompt) {
                setLocalUserPrompt(globalUserPrompt)
            }
        }, [globalUserPrompt])

        // Update global prompt with debounce
        const updateGlobalPrompt = useCallback((value: string) => {
            updateActiveProjectTab(prev => ({
                ...prev,
                userPrompt: value,
            }))
        }, [updateActiveProjectTab])
        const debouncedUpdateGlobal = useDebounce(updateGlobalPrompt, 1000)

        // For “undo/redo” + selected files, from parent
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
        const totalTokens = useMemo(() => {
            return calculateTotalTokens(promptData, selectedPrompts, localUserPrompt, selectedFiles, fileMap)
        }, [promptData, selectedPrompts, localUserPrompt, selectedFiles, fileMap])

        const usagePercentage = contextLimit > 0
            ? (totalTokens / contextLimit) * 100
            : 0

        // Build final prompt text
        const promptBuilder = useCallback(() => {
            return buildPromptContent({
                promptData,
                selectedPrompts,
                userPrompt: localUserPrompt,
                selectedFiles,
                fileMap,
            })
        }, [promptData, selectedPrompts, localUserPrompt, selectedFiles, fileMap])

        // Copy entire prompt to clipboard
        const handleCopyToClipboard = useCallback(() => {
            if (!fileMap.size && !localUserPrompt.trim() && selectedPrompts.length === 0) return
            const finalPrompt = promptBuilder()
            copyToClipboard(finalPrompt, {
                successMessage: 'All Content Copied to clipboard',
                errorMessage: 'Failed to copy',
            })
        }, [fileMap.size, localUserPrompt, selectedPrompts, promptBuilder, copyToClipboard])

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

        const copyButtonText = useMemo(() => {
            return `Copy All ${formatShortcut('mod+shift+c')}`
        }, [])

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
        const handleUserPromptChange = useCallback((value: string) => {
            setLocalUserPrompt(value)
            debouncedUpdateGlobal(value)
        }, [debouncedUpdateGlobal])

        return (
            <div className={`flex flex-col overflow-y-auto ${className}`}>
                {/* Dialog to suggest files */}
                <SuggestedFilesDialog
                    open={dialogOpen}
                    onClose={() => setDialogOpen(false)}
                    suggestedFiles={suggestedFiles}
                    selectedFilesState={selectedFilesState}
                />

                {/* Container */}
                <div className="bg-background flex-1 flex flex-col overflow-hidden transition-all duration-300 p-4 border-l">
                    <div className="flex flex-col h-full overflow-hidden">

                        {/* 1) Token Usage Info */}
                        <PromptTokenUsageInfo
                            totalTokens={totalTokens}
                            contextLimit={contextLimit}
                            usagePercentage={usagePercentage}
                        />

                        {/* 2) Prompts List (already a separate component) */}
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
                            <UserPromptSection
                                localUserPrompt={localUserPrompt}
                                onUserPromptChange={handleUserPromptChange}
                                promptInputRef={promptInputRef as RefObject<HTMLTextAreaElement>}
                                copyButtonText={copyButtonText}
                                onCopyAll={handleCopyToClipboard}
                                onFindSuggestedFiles={handleFindSuggestedFiles}
                                isFindingFiles={findSuggestedFilesMutation.isPending}
                            />
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

/* -------------------------------------------------------------------------
   Subcomponent: PromptTokenUsageInfo
   Renders the total token usage + progress bar
------------------------------------------------------------------------- */
type PromptTokenUsageInfoProps = {
    totalTokens: number
    contextLimit: number
    usagePercentage: number
}

const PromptTokenUsageInfo = memo(function PromptTokenUsageInfo({
    totalTokens,
    contextLimit,
    usagePercentage,
}: PromptTokenUsageInfoProps) {
    return (
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
    )
})

/* -------------------------------------------------------------------------
   Subcomponent: UserPromptSection
   Renders the main “User Input” textarea + “Copy All” + “Find Suggested Files” 
------------------------------------------------------------------------- */
type UserPromptSectionProps = {
    localUserPrompt: string
    onUserPromptChange: (val: string) => void
    promptInputRef: React.RefObject<HTMLTextAreaElement>
    copyButtonText: string
    onCopyAll: () => void
    onFindSuggestedFiles: (prompt: string) => void
    isFindingFiles: boolean
}

const UserPromptSection = memo(function UserPromptSection({
    localUserPrompt,
    onUserPromptChange,
    promptInputRef,
    copyButtonText,
    onCopyAll,
    onFindSuggestedFiles,
    isFindingFiles
}: UserPromptSectionProps) {
    return (
        <div className="h-1/2">
            <div className="flex flex-col h-full">
                <div className="flex items-center gap-2 mb-2">
                    <span className="text-sm font-medium">User Input</span>
                    <InfoTooltip>
                        <div className="space-y-2">
                            <p>Input Features & Shortcuts:</p>
                            <ul>
                                <li>- <span className="font-medium">Voice Input:</span> Click the microphone icon to record your prompt</li>
                                <li>- <span className="font-medium">Expand:</span> Use the expand icon for a larger editing area</li>
                                <li>- <span className="font-medium">Copy All:</span> <ShortcutDisplay shortcut={['mod', 'shift', 'c']} /> Copy entire prompt with context</li>
                                <li>- <span className="font-medium">Focus Input:</span> <ShortcutDisplay shortcut={['mod', 'i']} /> Focus the input area</li>
                            </ul>
                            <p className="font-medium mt-2">Promptimizer:</p>
                            <p className="text-sm text-muted-foreground">Click the magic wand to optimize your prompt. The Promptimizer will:</p>
                            <ul className="text-sm text-muted-foreground">
                                <li>- Make your prompt more specific and clear</li>
                                <li>- Add necessary context</li>
                                <li>- Improve structure for better AI understanding</li>
                                <li>- Suggest better phrasing and terminology</li>
                            </ul>
                            <p className="text-xs text-muted-foreground mt-2">
                                Your prompt will be combined with selected files and prompts when sent to the AI.
                            </p>
                        </div>
                    </InfoTooltip>
                </div>

                <ExpandableTextarea
                    ref={promptInputRef}
                    placeholder="Type your user prompt here..."
                    value={localUserPrompt}
                    onChange={onUserPromptChange}
                    className="flex-1 bg-background"
                />

                <div className="flex gap-2 mt-2">
                    <Button onClick={onCopyAll}>
                        {copyButtonText}
                    </Button>
                    <Button
                        onClick={() => onFindSuggestedFiles(localUserPrompt)}
                        disabled={isFindingFiles}
                    >
                        {isFindingFiles ? 'Finding...' : 'Find Suggested Files'}
                    </Button>
                </div>
            </div>
        </div>
    )
})