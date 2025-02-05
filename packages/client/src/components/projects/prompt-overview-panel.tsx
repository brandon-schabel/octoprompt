import { forwardRef, useState, useEffect, useRef, useImperativeHandle, useMemo } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useHotkeys } from 'react-hotkeys-hook'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'
import { Progress } from '@/components/ui/progress'
import { ExpandableTextarea } from '@/components/expandable-textarea'
import { PromptsList, type PromptsListRef } from '@/components/projects/prompts-list'
import { PromptDialog } from '@/components/projects/prompt-dialog'
import { useCreatePrompt, useUpdatePrompt, useDeletePrompt, useGetProjectPrompts } from '@/hooks/api/use-prompts-api'
import { buildPromptContent, calculateTotalTokens, promptSchema } from '@/components/projects/utils/projects-utils'
import { useFindSuggestedFiles, } from '@/hooks/api/use-projects-api'
import { useCopyClipboard } from '@/hooks/utility-hooks/use-copy-clipboard'
import { useUpdateActiveProjectTab } from '@/zustand/updaters'
import { ShortcutDisplay } from '@/components/app-shortcut-display'
import { InfoTooltip } from '@/components/info-tooltip'
import { useActiveProjectTab } from '@/zustand/selectors'
import { useProjectTabField } from '@/zustand/zustand-utility-hooks'
import { useSelectedFiles } from '@/hooks/utility-hooks/use-selected-files'
import { z } from 'zod'
import { SuggestedFilesDialog } from '../suggest-files-dialog'

export type PromptOverviewPanelRef = {
    focusPrompt: () => void
}

interface PromptOverviewPanelProps {
    className?: string
}

export const PromptOverviewPanel = forwardRef<PromptOverviewPanelRef, PromptOverviewPanelProps>(
    function PromptOverviewPanel({ className }, ref) {
        const { id: activeProjectTabId, selectedProjectId } = useActiveProjectTab()
        const updateActiveProjectTab = useUpdateActiveProjectTab()

        // read selected prompts & user prompt from store (optional)
        const { data: selectedPrompts = [] } = useProjectTabField('selectedPrompts', activeProjectTabId || '')
        const { data: globalUserPrompt = '' } = useProjectTabField('userPrompt', activeProjectTabId || '')
        const { data: contextLimit = 128000 } = useProjectTabField('contextLimit', activeProjectTabId || '')

        // local copy of user prompt
        const [localUserPrompt, setLocalUserPrompt] = useState(globalUserPrompt)
        useEffect(() => {
            if (globalUserPrompt !== localUserPrompt) {
                setLocalUserPrompt(globalUserPrompt)
            }
        }, [globalUserPrompt])

        // keep it in sync with the store (debounce or direct)
        useEffect(() => {
            const timer = setTimeout(() => {
                if (localUserPrompt !== globalUserPrompt) {
                    updateActiveProjectTab({ userPrompt: localUserPrompt })
                }
            }, 500)
            return () => clearTimeout(timer)
        }, [localUserPrompt, globalUserPrompt])

        // ephemeral
        const [promptDialogOpen, setPromptDialogOpen] = useState(false)
        const [editPromptId, setEditPromptId] = useState<string | null>(null)

        // load the project's prompts
        const { data: promptData } = useGetProjectPrompts(selectedProjectId || '')
        const createPromptMutation = useCreatePrompt()
        const updatePromptMutation = useUpdatePrompt()
        const deletePromptMutation = useDeletePrompt()

        // read selected files from our local undo/redo manager
        const { selectedFiles, projectFileMap } = useSelectedFiles()



        // calc tokens
        const totalTokens = useMemo(() => calculateTotalTokens(
            promptData,
            selectedPrompts,
            localUserPrompt,
            selectedFiles,
            projectFileMap
        ), [promptData, selectedPrompts, localUserPrompt, selectedFiles])

        const usagePercentage = contextLimit > 0
            ? (totalTokens / contextLimit) * 100
            : 0

        // copy entire prompt
        const { copyToClipboard } = useCopyClipboard()
        const handleCopyAll = () => {
            const finalPrompt = buildPromptContent({
                promptData,
                selectedPrompts,
                userPrompt: localUserPrompt,
                selectedFiles,
                fileMap: projectFileMap,
            })
            copyToClipboard(finalPrompt, {
                successMessage: 'All content copied',
                errorMessage: 'Copy failed',
            })
        }

        // "Find suggested files" example
        const findSuggestedFilesMutation = useFindSuggestedFiles(selectedProjectId || '')
        const [showSuggestions, setShowSuggestions] = useState(false)

        const handleFindSuggestions = () => {
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

        // form for creating/editing prompts
        const promptForm = useForm<z.infer<typeof promptSchema>>({
            resolver: zodResolver(promptSchema),
            defaultValues: { name: '', content: '' },
        })

        useEffect(() => {
            if (editPromptId && promptData?.prompts) {
                const p = promptData.prompts.find(x => x.id === editPromptId)
                if (p) {
                    promptForm.setValue('name', p.name)
                    promptForm.setValue('content', p.content)
                }
            } else {
                promptForm.reset()
            }
        }, [editPromptId, promptData?.prompts])

        async function handleCreatePrompt(values: z.infer<typeof promptSchema>) {
            if (!selectedProjectId) return
            const result = await createPromptMutation.mutateAsync({
                ...values,
                projectId: selectedProjectId,
            })
            if (result.success) {
                toast.success('Prompt created')
                setPromptDialogOpen(false)
            }
        }

        async function handleUpdatePromptContent(promptId: string, updates: { name: string; content: string }) {
            await updatePromptMutation.mutateAsync({ id: promptId, updates })
            toast.success('Prompt updated')
            setPromptDialogOpen(false)
        }

        // hotkeys
        useHotkeys('mod+shift+c', (e) => {
            e.preventDefault()
            handleCopyAll()
        })

        // expose focus
        const promptInputRef = useRef<HTMLTextAreaElement>(null)
        const promptsListRef = useRef<PromptsListRef>(null)

        useImperativeHandle(ref, () => ({
            focusPrompt() {
                promptInputRef.current?.focus()
            }
        }))

        return (
            <div className={`flex flex-col overflow-y-auto ${className}`}>
                <SuggestedFilesDialog
                    open={showSuggestions}
                    onClose={() => setShowSuggestions(false)}
                    suggestedFiles={[]} // pass your real suggested files
                />
                <div className="bg-background flex-1 flex flex-col overflow-hidden transition-all duration-300 p-4 border-l">
                    {/* 1) Token usage */}
                    <div className="space-y-2 mb-4 border-b">
                        <div className="space-y-1">
                            <div className="text-xs text-muted-foreground">
                                {totalTokens} of {contextLimit} tokens used ({usagePercentage.toFixed(0)}%)
                            </div>
                            <Progress value={usagePercentage} variant="danger" />
                        </div>
                    </div>

                    {/* 2) Prompts list */}
                    <div className="flex-1 min-h-0">
                        <PromptsList
                            ref={promptsListRef}
                            projectTabId={activeProjectTabId || 'default'}
                            className="h-full"
                        />
                    </div>

                    <hr className="my-2" />

                    {/* 3) user input */}
                    <div className="h-1/2">
                        <div className="flex flex-col h-full">
                            <div className="flex items-center gap-2 mb-2">
                                <span className="text-sm font-medium">User Input</span>
                                <InfoTooltip>
                                    <div className="space-y-2">
                                        <p>Shortcuts:</p>
                                        <ul>
                                            <li>- <span className="font-medium">Copy All:</span> <ShortcutDisplay shortcut={['mod', 'shift', 'c']} /></li>
                                        </ul>
                                    </div>
                                </InfoTooltip>
                            </div>
                            <ExpandableTextarea
                                ref={promptInputRef}
                                placeholder="Type your user prompt here..."
                                value={localUserPrompt}
                                onChange={(val) => setLocalUserPrompt(val)}
                                className="flex-1 bg-background"
                            />
                            <div className="flex gap-2 mt-2">
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
                </div>
                <PromptDialog
                    open={promptDialogOpen}
                    editPromptId={editPromptId}
                    promptForm={promptForm}
                    handleCreatePrompt={handleCreatePrompt}
                    handleUpdatePrompt={async (updates) => {
                        if (!editPromptId) return Promise.resolve();
                        return handleUpdatePromptContent(editPromptId, updates);
                    }}
                    createPromptPending={createPromptMutation.isPending}
                    updatePromptPending={updatePromptMutation.isPending}
                    onClose={() => setPromptDialogOpen(false)}
                />
            </div>
        )
    }
)