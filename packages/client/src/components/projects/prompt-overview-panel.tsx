import { forwardRef, useState, useEffect, useRef, useImperativeHandle, useMemo } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useHotkeys } from 'react-hotkeys-hook'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'

import { Button } from '@/components/ui/button'
import { Progress } from '@/components/ui/progress'
import { ExpandableTextarea } from '@/components/expandable-textarea'
import { PromptsList, type PromptsListRef } from '@/components/projects/prompts-list'
import { PromptDialog } from '@/components/projects/prompt-dialog'
import { useCreatePrompt, useUpdatePrompt, useDeletePrompt, useGetProjectPrompts } from '@/hooks/api/use-prompts-api'
import { buildPromptContent, calculateTotalTokens, promptSchema } from '@/components/projects/utils/projects-utils'
import { useFindSuggestedFiles } from '@/hooks/api/use-projects-api'
import { useCopyClipboard } from '@/hooks/utility-hooks/use-copy-clipboard'
import { useUpdateActiveProjectTab } from '@/hooks/api/global-state/updaters'
import { ShortcutDisplay } from '@/components/app-shortcut-display'
import { InfoTooltip } from '@/components/info-tooltip'
import { useProjectTabField } from '@/hooks/api/global-state/global-state-utility-hooks'
import { useSelectedFiles } from '@/hooks/utility-hooks/use-selected-files'
import { z } from 'zod'
import { SuggestedFilesDialog } from '../suggest-files-dialog'
import { VerticalResizablePanel } from '../../components/ui/vertical-resizable-panel'
import { useActiveProjectTab } from '@/hooks/api/use-state-api'

export type PromptOverviewPanelRef = {
    focusPrompt: () => void
}

interface PromptOverviewPanelProps {
    className?: string
}

export const PromptOverviewPanel = forwardRef<PromptOverviewPanelRef, PromptOverviewPanelProps>(
    function PromptOverviewPanel({ className }, ref) {
        const [activeProjectTabState, setActiveProjectTab, activeProjectTabId] = useActiveProjectTab()
        const updateActiveProjectTab = useUpdateActiveProjectTab()

        // Read selected prompts & user prompt from store
        const { data: selectedPrompts = [] } = useProjectTabField('selectedPrompts', activeProjectTabId || '')
        const { data: globalUserPrompt = '' } = useProjectTabField('userPrompt', activeProjectTabId || '')
        const { data: contextLimit = 128000 } = useProjectTabField('contextLimit', activeProjectTabId || '')

        // Keep a local copy of userPrompt so that typing is instantly reflected in the textarea
        const [localUserPrompt, setLocalUserPrompt] = useState(globalUserPrompt)

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

        // Prompt creation/editing dialog states
        const [promptDialogOpen, setPromptDialogOpen] = useState(false)
        const [editPromptId, setEditPromptId] = useState<string | null>(null)

        // Load the project's prompts
        const { data: promptData } = useGetProjectPrompts(activeProjectTabState?.selectedProjectId || '')
        const createPromptMutation = useCreatePrompt()
        const updatePromptMutation = useUpdatePrompt()
        const deletePromptMutation = useDeletePrompt()

        // Read selected files
        const { selectedFiles, projectFileMap } = useSelectedFiles()

        // Calculate total tokens
        const totalTokens = useMemo(() => {
            return calculateTotalTokens(
                promptData,
                selectedPrompts,
                localUserPrompt,
                selectedFiles,
                projectFileMap
            )
        }, [promptData, selectedPrompts, localUserPrompt, selectedFiles, projectFileMap])

        const usagePercentage = contextLimit > 0 ? (totalTokens / contextLimit) * 100 : 0

        // For copying to clipboard
        const { copyToClipboard } = useCopyClipboard()

        // IMPORTANT: We read from the textarea ref to guarantee we have the freshest user input.
        const promptInputRef = useRef<HTMLTextAreaElement>(null)
        const handleCopyAll = () => {
            // Fallback to localUserPrompt if the ref is unavailable for any reason
            const finalUserPrompt = promptInputRef.current?.value ?? localUserPrompt

            const finalPrompt = buildPromptContent({
                promptData,
                selectedPrompts,
                userPrompt: finalUserPrompt,
                selectedFiles,
                fileMap: projectFileMap,
            })

            copyToClipboard(finalPrompt, {
                successMessage: 'All content copied',
                errorMessage: 'Copy failed',
            })
        }

        // "Find suggested files" example
        const findSuggestedFilesMutation = useFindSuggestedFiles(activeProjectTabState?.selectedProjectId || '')
        const [showSuggestions, setShowSuggestions] = useState(false)

        const handleFindSuggestions = () => {
            // If localUserPrompt is empty, ask user to type something
            if (!localUserPrompt.trim()) {
                alert('Please enter a prompt!')
                return
            }
            findSuggestedFilesMutation.mutate(localUserPrompt, {
                onSuccess: (resp) => {
                    if (resp.success && resp.recommendedFileIds) {
                        updateActiveProjectTab({ suggestedFileIds: resp.recommendedFileIds })
                        setShowSuggestions(true)
                    }
                },
            })
        }

        // React Hook Form for creating/editing prompts
        const promptForm = useForm<z.infer<typeof promptSchema>>({
            resolver: zodResolver(promptSchema),
            defaultValues: { name: '', content: '' },
        })

        useEffect(() => {
            if (editPromptId && promptData?.data) {
                const p = promptData.data.find(x => x.id === editPromptId)
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
                    content: values.content,
                }
            })

            // @ts-ignore
            if (result.success) {
                toast.success('Prompt created')
                setPromptDialogOpen(false)
            }
        }

        async function handleUpdatePromptContent(promptId: string, updates: { name: string; content: string }) {
            await updatePromptMutation.mutateAsync({ promptId, data: updates })
            toast.success('Prompt updated')
            setPromptDialogOpen(false)
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
            },
        }))

        return (
            <div className={cn("flex flex-col h-full overflow-hidden", className)}>
                <SuggestedFilesDialog
                    open={showSuggestions}
                    onClose={() => setShowSuggestions(false)}
                    suggestedFiles={[]} // pass the actual suggested files here if needed
                />

                <div className="flex-1 flex flex-col min-h-0 p-4 overflow-hidden min-w-0">
                    {/* 1) Token usage */}
                    <div className="shrink-0 space-y-2 mb-4 ">
                        <div className="space-y-1">
                            <div className="text-xs text-muted-foreground">
                                {totalTokens} of {contextLimit} tokens used ({usagePercentage.toFixed(0)}%)
                            </div>
                            <Progress value={usagePercentage} variant="danger" />
                        </div>
                    </div>

                    {/* Resizable panels for Prompts List and User Input */}
                    <VerticalResizablePanel
                        topPanel={
                            <PromptsList
                                ref={promptsListRef}
                                projectTabId={activeProjectTabId || 'default'}
                                className="h-full w-full"
                            />
                        }
                        bottomPanel={
                            <div className="flex flex-col h-full w-full">
                                <div className="flex items-center gap-2 mb-2 shrink-0">
                                    <span className="text-sm font-medium">User Input</span>
                                    <InfoTooltip>
                                        <div className="space-y-2">
                                            <p>Shortcuts:</p>
                                            <ul>
                                                <li>
                                                    - <span className="font-medium">Copy All:</span>
                                                    {' '}<ShortcutDisplay shortcut={['mod', 'shift', 'c']} />
                                                </li>
                                            </ul>
                                        </div>
                                    </InfoTooltip>
                                </div>
                                <div className="flex-1 min-h-0 flex flex-col">
                                    <ExpandableTextarea
                                        ref={promptInputRef}
                                        placeholder="Type your user prompt here..."
                                        value={localUserPrompt}
                                        onChange={(val) => setLocalUserPrompt(val)}
                                        className="flex-1 min-h-0 bg-background"
                                    />
                                    <div className="flex gap-2 mt-2 shrink-0">
                                        <Button onClick={handleCopyAll}>
                                            Copy All
                                        </Button>
                                        <Button
                                            onClick={handleFindSuggestions}
                                            disabled={findSuggestedFilesMutation.isPending}
                                        >
                                            {findSuggestedFilesMutation.isPending ? 'Finding...' : 'Find Suggested Files'}
                                        </Button>
                                    </div>
                                </div>
                            </div>
                        }
                        initialTopPanelHeight={55}
                        minTopPanelHeight={15}
                        maxTopPanelHeight={85}
                        storageKey="prompt-panel-height"
                        className="flex-1 min-h-0"
                        resizerClassName="my-1"
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
            </div>
        )
    }
)