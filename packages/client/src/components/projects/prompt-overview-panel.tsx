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
import { useLocalStorage } from '@/hooks/use-local-storage'
import { buildPromptContent, calculateTotalTokens, promptSchema } from '@/components/projects/utils/projects-utils'
import { ProjectFile } from 'shared'
import { useNavigate } from '@tanstack/react-router'
import { zodResolver } from '@hookform/resolvers/zod'
import { useSelectedFiles } from '@/hooks/use-selected-files'
import { useHotkeys } from 'react-hotkeys-hook'
import { formatModShortcut } from '@/lib/platform'
import { useGlobalStateContext } from '../global-state-context'
import { useDebounce } from '@/hooks/use-debounce'

export type PromptOverviewPanelRef = {
    focusPrompt: () => void;
}

interface PromptOverviewPanelProps {
    selectedProjectId: string
    fileMap: Map<string, ProjectFile>
    promptData?: PromptListResponse
    className?: string
}

export const PromptOverviewPanel = forwardRef<PromptOverviewPanelRef, PromptOverviewPanelProps>(({
    selectedProjectId,
    fileMap,
    promptData,
    className,
}, ref) => {
    const { state, updateActiveProjectTab: updateActiveTab, activeProjectTabState: activeTabState } = useGlobalStateContext()
    const selectedPrompts = activeTabState?.selectedPrompts || []
    const globalUserPrompt = activeTabState?.userPrompt || ''
    const contextLimit = activeTabState?.contextLimit || 128000
    const activeProjectTabId = state?.projectActiveTabId

    const [localUserPrompt, setLocalUserPrompt] = useState(globalUserPrompt)

    // Sync local state with global state on initial load and when global state changes from other sources
    useEffect(() => {
        if (globalUserPrompt !== localUserPrompt) {
            setLocalUserPrompt(globalUserPrompt)
        }
    }, [globalUserPrompt])

    const updateGlobalPrompt = useCallback((value: string) => {
        updateActiveTab(prev => ({
            ...prev,
            userPrompt: value
        }))
    }, [updateActiveTab])

    const debouncedUpdateGlobal = useDebounce(updateGlobalPrompt, 1000)

    const handleUserPromptChange = (value: string) => {
        setLocalUserPrompt(value)
        debouncedUpdateGlobal(value)
    }

    const { selectedFiles } = useSelectedFiles()
    const [promptDialogOpen, setPromptDialogOpen] = useState(false)
    const [editPromptId, setEditPromptId] = useState<string | null>(null)
    const [, setTransferPrompt] = useLocalStorage<string>('transfer-prompt', '')
    const navigate = useNavigate()
    const promptInputRef = useRef<HTMLTextAreaElement>(null);
    const promptsListRef = useRef<PromptsListRef>(null);

    const promptForm = useForm<z.infer<typeof promptSchema>>({
        resolver: zodResolver(promptSchema),
        defaultValues: {
            name: '',
            content: '',
        },
    })

    const createPromptMutation = useCreatePrompt()
    const updatePromptMutation = useUpdatePrompt()
    const deletePromptMutation = useDeletePrompt()

    const totalTokens = useMemo(() => calculateTotalTokens(promptData, selectedPrompts, localUserPrompt, selectedFiles, fileMap), [promptData, selectedPrompts, localUserPrompt, selectedFiles, fileMap])
    const usagePercentage = contextLimit > 0 ? (totalTokens / contextLimit) * 100 : 0

    function promptBuilder() {
        return buildPromptContent({
            promptData, selectedPrompts, userPrompt: localUserPrompt, selectedFiles, fileMap
        })
    }

    const handleCopyToClipboard = async () => {
        if (!fileMap.size && !localUserPrompt.trim() && selectedPrompts.length === 0) return
        const finalPrompt = promptBuilder()
        try {
            await navigator.clipboard.writeText(finalPrompt)
            toast.success('All Content Copied to clipboard')
        } catch {
            toast.error('Failed to copy')
        }
    }

    const handleTransferToChat = () => {
        const finalPrompt = promptBuilder().trim()
        setTransferPrompt(finalPrompt)
        navigate({
            to: '/chat',
            search: { prefill: true }
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
        await updatePromptMutation.mutateAsync({
            id: promptId,
            updates
        })
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


    useHotkeys('mod+shift+c', (e) => {
        e.preventDefault()
        void handleCopyToClipboard()
    }, [handleCopyToClipboard])

    const copyButtonText = useMemo(() => {
        return `Copy All (${formatModShortcut('shift+c')})`
    }, [])

    useHotkeys('mod+p', (e) => {
        e.preventDefault();
        promptsListRef.current?.focusPrompts();
    }, []);

    useImperativeHandle(ref, () => ({
        focusPrompt: () => {
            promptInputRef.current?.focus();
        }
    }), []);

    return (
        <div className={`flex flex-col overflow-y-auto ${className}`}>
            <div className='rounded-r-lg lg:rounded-lg my-4 mr-4 lg:m-4 lg:ml-2 bg-background flex-1 flex flex-col overflow-hidden transition-all duration-300 p-4'>
                <div className="flex flex-col h-full overflow-hidden">
                    <div className="space-y-2 mb-4 border-b">
                        <div className="space-y-1">
                            <div className="text-xs text-muted-foreground">
                                {totalTokens} of {contextLimit} tokens used ({usagePercentage.toFixed(0)}%)
                            </div>
                            <Progress
                                value={usagePercentage}
                                className="relative w-full h-2 bg-primary/20 rounded-full overflow-hidden"
                                variant='danger'
                            />
                        </div>
                    </div>

                    <div className="flex flex-col flex-1 overflow-hidden">
                        <div className="flex-1 min-h-0" >
                            <PromptsList
                                ref={promptsListRef}
                                projectTabId={activeProjectTabId || 'defaultTab'}
                                className="h-full"
                            />
                        </div>

                        <hr className='my-2' />

                        <div className="h-1/2">
                            <div className="flex flex-col h-full">
                                <ExpandableTextarea
                                    ref={promptInputRef}
                                    placeholder="Type your user prompt here..."
                                    value={localUserPrompt}
                                    onChange={handleUserPromptChange}
                                    className="flex-1 bg-background"
                                />
                                <div className="flex gap-2 mt-2">
                                    <Button onClick={handleCopyToClipboard} size="sm">
                                        {copyButtonText}
                                    </Button>
                                    <Button
                                        onClick={handleTransferToChat}
                                        size="sm"
                                        variant="outline"
                                    >
                                        Transfer to Chat
                                    </Button>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                <PromptDialog
                    open={promptDialogOpen}
                    editPromptId={editPromptId}
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
})