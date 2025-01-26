import { useState, useMemo, useEffect, useRef, useImperativeHandle, forwardRef, useCallback } from 'react'
import { Button } from '@/components/ui/button'
import { Progress } from '@/components/ui/progress'
import { ExpandableTextarea } from '@/components/expandable-textarea'
import { PromptsList, type PromptsListRef } from '@/components/projects/prompts-list'
import { PromptDialog } from '@/components/projects/prompt-dialog'
import { PromptListResponse, useCreatePrompt, useUpdatePrompt, useDeletePrompt } from "@/hooks/api/use-prompts-api"
import { useForm } from 'react-hook-form'
import { z } from 'zod'
import { toast } from 'sonner'
import { buildPromptContent, calculateTotalTokens, promptSchema } from '@/components/projects/utils/projects-utils'
import { ProjectFile } from 'shared'
import { zodResolver } from '@hookform/resolvers/zod'
import { useHotkeys } from 'react-hotkeys-hook'
import { useDebounce } from '@/hooks/utility-hooks/use-debounce'
import { useFindSuggestedFiles, useGetProjectFiles } from '@/hooks/api/use-projects-api'
import { useCopyClipboard } from '@/hooks/utility-hooks/use-copy-clipboard'
import { 
    useGlobalStateCore,
    useUpdateActiveProjectTab,
    useActiveProjectTabState 
} from '@/components/global-state/global-helper-hooks'
import { SuggestedFilesDialog } from '../suggest-files-dialog'
import { formatShortcut } from '@/lib/shortcuts'
import { InfoTooltip } from '../info-tooltip'
import { ShortcutDisplay } from '../app-shortcut-display'
import { type UseSelectedFileReturn } from '@/hooks/utility-hooks/use-selected-files'

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
    ({ selectedProjectId, fileMap, promptData, className, selectedFilesState }, ref) => {
        const { state } = useGlobalStateCore()
        const updateActiveProjectTab = useUpdateActiveProjectTab()
        const { tabData: activeTabState } = useActiveProjectTabState()
        
        const selectedPrompts = activeTabState?.selectedPrompts || []
        const globalUserPrompt = activeTabState?.userPrompt || ''
        const contextLimit = activeTabState?.contextLimit || 128000
        const activeProjectTabId = state?.projectActiveTabId
        const [localUserPrompt, setLocalUserPrompt] = useState(globalUserPrompt)

        // 1) Grab the project files
        const { data: fileData } = useGetProjectFiles(selectedProjectId)
        const allProjectFiles: ProjectFile[] = fileData?.files || []

        // 2) We'll store the suggested files and open the dialog
        const suggestedFileIds = activeTabState?.suggestedFileIds || []
        const suggestedFiles = useMemo(
            () => allProjectFiles.filter(file => suggestedFileIds.includes(file.id)),
            [allProjectFiles, suggestedFileIds]
        )
        const [dialogOpen, setDialogOpen] = useState(false)

        // 3) Finding Suggested Files mutation
        const findSuggestedFilesMutation = useFindSuggestedFiles(selectedProjectId)
        
        function handleFindSuggestedFiles(userPrompt: string) {
            if (!userPrompt.trim()) {
                alert("Please enter a prompt!")
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
                        alert(resp.message || "No suggestions returned")
                    }
                },
            })
        }

        // Keep localUserPrompt in sync with globalUserPrompt
        useEffect(() => {
            if (globalUserPrompt !== localUserPrompt) {
                setLocalUserPrompt(globalUserPrompt)
            }
        }, [globalUserPrompt])

        const updateGlobalPrompt = useCallback((value: string) => {
            updateActiveProjectTab(prev => ({
                ...prev,
                userPrompt: value
            }))
        }, [updateActiveProjectTab])

        const debouncedUpdateGlobal = useDebounce(updateGlobalPrompt, 1000)

        const handleUserPromptChange = (value: string) => {
            setLocalUserPrompt(value)
            debouncedUpdateGlobal(value)
        }

        const { selectedFiles } = selectedFilesState
        const [promptDialogOpen, setPromptDialogOpen] = useState(false)
        const [editPromptId, setEditPromptId] = useState<string | null>(null)
        const promptInputRef = useRef<HTMLTextAreaElement>(null)
        const promptsListRef = useRef<PromptsListRef>(null)

        const promptForm = useForm<z.infer<typeof promptSchema>>({
            resolver: zodResolver(promptSchema),
            defaultValues: { name: '', content: '' },
        })

        const createPromptMutation = useCreatePrompt()
        const updatePromptMutation = useUpdatePrompt()
        const deletePromptMutation = useDeletePrompt()

        const { copyToClipboard } = useCopyClipboard()

        // Calculate total tokens used
        const totalTokens = useMemo(
            () => calculateTotalTokens(promptData, selectedPrompts, localUserPrompt, selectedFiles, fileMap),
            [promptData, selectedPrompts, localUserPrompt, selectedFiles, fileMap]
        )
        const usagePercentage = contextLimit > 0 ? (totalTokens / contextLimit) * 100 : 0

        function promptBuilder() {
            return buildPromptContent({
                promptData,
                selectedPrompts,
                userPrompt: localUserPrompt,
                selectedFiles,
                fileMap,
            })
        }

        const handleCopyToClipboard = async () => {
            if (!fileMap.size && !localUserPrompt.trim() && selectedPrompts.length === 0) return
            const finalPrompt = promptBuilder()
            copyToClipboard(finalPrompt, {
                successMessage: 'All Content Copied to clipboard',
                errorMessage: 'Failed to copy',
            })
        }

        const handleCreatePrompt = async (values: z.infer<typeof promptSchema>) => {
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

        const handleUpdatePromptContent = async (promptId: string, updates: { name: string; content: string }) => {
            await updatePromptMutation.mutateAsync({ id: promptId, updates })
            toast.success('Prompt updated successfully')
            setPromptDialogOpen(false)
        }

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

        // Hotkeys
        useHotkeys('mod+shift+c', (e) => {
            e.preventDefault()
            void handleCopyToClipboard()
        }, [handleCopyToClipboard])

        const copyButtonText = useMemo(() => {
            return `Copy All ${formatShortcut('mod+shift+c')}`
        }, [])

        useHotkeys('mod+p', (e) => {
            e.preventDefault()
            promptsListRef.current?.focusPrompts()
        }, [])

        useImperativeHandle(ref, () => ({
            focusPrompt: () => {
                promptInputRef.current?.focus()
            }
        }), [])

     
        return (
            <div className={`flex flex-col overflow-y-auto ${className}`}>
                {/* SUGGESTED FILES DIALOG */}
                <SuggestedFilesDialog
                    open={dialogOpen}
                    onClose={() => setDialogOpen(false)}
                    suggestedFiles={suggestedFiles}
                    selectedFilesState={selectedFilesState}
                />

                <div className="bg-background flex-1 flex flex-col overflow-hidden transition-all duration-300 p-4 border-l">
                    <div className="flex flex-col h-full overflow-hidden">


                        {/* Token usage info */}
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

                        {/* Prompts list */}
                        <div className="flex flex-col flex-1 overflow-hidden">
                            <div className="flex-1 min-h-0">
                                <PromptsList
                                    ref={promptsListRef}
                                    projectTabId={activeProjectTabId || 'defaultTab'}
                                    className="h-full"
                                />
                            </div>

                            <hr className="my-2" />

                            {/* Main user prompt & actions */}
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
                                                <p className="text-xs text-muted-foreground mt-2">Your prompt will be combined with selected files and prompts when sent to the AI.</p>
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
                                            {copyButtonText}
                                        </Button>
                                        <Button
                                            onClick={() => handleFindSuggestedFiles(localUserPrompt)}
                                            disabled={findSuggestedFilesMutation.isPending}
                                        >
                                            {findSuggestedFilesMutation.isPending ? "Finding..." : "Find Suggested Files"}
                                        </Button>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Prompt creation / editing dialog */}
                    <PromptDialog
                        open={promptDialogOpen}
                        editPromptId={null}
                        promptForm={promptForm}
                        handleCreatePrompt={handleCreatePrompt}
                        handleUpdatePrompt={(values) => handleUpdatePromptContent(editPromptId!, values)}
                        createPromptPending={createPromptMutation.isPending}
                        updatePromptPending={updatePromptMutation.isPending}
                        onClose={() => setPromptDialogOpen(false)}
                    />
                </div>
            </div>
        )
    }
)