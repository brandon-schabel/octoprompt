import { forwardRef, useState, useEffect, useRef, useImperativeHandle, useMemo } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useHotkeys } from 'react-hotkeys-hook'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import { useNavigate } from "@tanstack/react-router"

import { Button } from '@ui'
import { Progress } from '@ui'
import { ExpandableTextarea } from '@/components/expandable-textarea'
import { PromptsList, type PromptsListRef } from '@/components/projects/prompts-list'
import { PromptDialog } from '@/components/projects/prompt-dialog'
import { useCreatePrompt, useUpdatePrompt, useDeletePrompt, useGetProjectPrompts } from '@/hooks/api/use-prompts-api'
import { buildPromptContent, calculateTotalTokens, promptSchema } from 'shared/src/utils/projects-utils'
import { useCopyClipboard } from '@/hooks/utility-hooks/use-copy-clipboard'
import { useUpdateActiveProjectTab } from '@/hooks/api/global-state/updaters'
import { ShortcutDisplay } from '@/components/app-shortcut-display'
import { InfoTooltip } from '@/components/info-tooltip'
import { useProjectTabField } from '@/hooks/api/global-state/global-state-utility-hooks'
import { useSelectedFiles } from '@/hooks/utility-hooks/use-selected-files'
import { z } from 'zod'
import { SuggestedFilesDialog } from '../suggest-files-dialog'
import { VerticalResizablePanel } from '@ui'
import { useActiveChatId, useActiveProjectTab } from '@/hooks/api/use-state-api'
import { useSuggestFiles } from '@/hooks/api/use-gen-ai-api'
import { Chat, ProjectFile } from '@/hooks/generated'
import { useCreateChat } from '@/hooks/api/use-chat-api'
import { useLocalStorage } from '@/hooks/utility-hooks/use-local-storage'
import { Binoculars, Bot, Copy, MessageCircleCode, Search } from 'lucide-react'
import { useRunAgentCoder } from '@/hooks/api/use-agent-coder-api'

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
        const [suggestedFiles, setSuggestedFiles] = useState<ProjectFile[]>([])

        // Keep a local copy of userPrompt so that typing is instantly reflected in the textarea
        const [localUserPrompt, setLocalUserPrompt] = useState(globalUserPrompt)
        const createChatMutation = useCreateChat();
        const [, setInitialChatContent] = useLocalStorage('initial-chat-content', '')
        const [, setActiveChatId] = useActiveChatId()
        const navigate = useNavigate()


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
        const createPromptMutation = useCreatePrompt(activeProjectTabState?.selectedProjectId || '')
        const updatePromptMutation = useUpdatePrompt(activeProjectTabState?.selectedProjectId || '')

        // Read selected files
        const { selectedFiles, projectFileMap, } = useSelectedFiles()


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

        // "Find suggested files" example
        const findSuggestedFilesMutation = useSuggestFiles(activeProjectTabState?.selectedProjectId || '')
        const [showSuggestions, setShowSuggestions] = useState(false)

        const runAgentCoderMutation = useRunAgentCoder(activeProjectTabState?.selectedProjectId || '');

        const buildFullProjectContext = () => {
            const finalUserPrompt = promptInputRef.current?.value ?? localUserPrompt

            return buildPromptContent({
                promptData,
                selectedPrompts,
                userPrompt: finalUserPrompt,
                selectedFiles,
                fileMap: projectFileMap,
            })

        }
        const handleCopyAll = () => {
            copyToClipboard(buildFullProjectContext(), {
                successMessage: 'All content copied',
                errorMessage: 'Copy failed',
            })
        }

        const handleFindSuggestions = () => {
            // If localUserPrompt is empty, ask user to type something
            if (!localUserPrompt.trim()) {
                alert('Please enter a prompt!')
                return
            }
            findSuggestedFilesMutation.mutate({ userInput: `Please suggest files for the following prompt: ${localUserPrompt}` }, {
                onSuccess: (resp) => {
                    console.log('resp', resp)
                    if (resp?.data?.success && resp.data?.recommendedFileIds) {
                        const files = resp.data.recommendedFileIds.map(id => {
                            const file = projectFileMap.get(id)
                            console.log('file', file)
                            console.log('projectFileMap', projectFileMap)
                            if (file) {
                                return file
                            }

                            return null
                        }).filter(Boolean) as ProjectFile[]

                        console.log('files', files)
                        console.log('suggestedFiles', suggestedFiles)
                        setSuggestedFiles(files)
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
            if (!activeProjectTabState?.selectedProjectId) return
            await updatePromptMutation.mutateAsync({ promptId, data: updates })
            toast.success('Prompt updated')
            setPromptDialogOpen(false)
        }

        async function handleChatWithContext() {
            const defaultTitle = `New Chat ${new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
            setInitialChatContent(buildFullProjectContext())

            // without the timeout, the intial content doesn't get set before the navigation to the chat page
            setTimeout(async () => {

                try {
                    const newChat = await createChatMutation.mutateAsync({
                        title: defaultTitle,
                    });
                    // Ensure newChat has an ID (adjust based on actual return type)
                    const newChatId = (newChat)?.data.id; // Type assertion might be needed
                    if (newChatId) {
                        setActiveChatId(newChatId);
                        // navigate to the chat, where the chat page will load the initial content from local storage
                        navigate({ to: '/chat' })

                        toast.success('New chat created');
                    } else {
                        throw new Error("Created chat did not return an ID.");
                    }
                } catch (error) {
                    console.error('Error creating chat:', error);
                    toast.error('Failed to create chat');
                }
                console.log('chat with context')
                // create a new chat with the context as the input
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
            },
        }))

        // --- NEW: Agent Coder Handler ---
        const handleRunAgentCoder = () => {
            const finalUserPrompt = promptInputRef.current?.value ?? localUserPrompt;
            const selectedFileIds = selectedFiles

            if (!activeProjectTabState?.selectedProjectId) { toast.error("No project selected."); return; }
            if (!finalUserPrompt.trim()) { toast.warning("Please enter a user prompt/instruction."); promptInputRef.current?.focus(); return; }
            if (selectedFileIds.length === 0) { toast.warning("Please select at least one file for context."); return; }

            console.log("Running Agent Coder with:", { projectId: activeProjectTabState.selectedProjectId, userInput: finalUserPrompt, selectedFileIds, runTests: false });
            runAgentCoderMutation.mutate({ userInput: finalUserPrompt, selectedFileIds, runTests: false });
        };
        // --- End Agent Coder Handler ---

        return (
            <div className={cn("flex flex-col h-full overflow-hidden", className)}>
                <SuggestedFilesDialog
                    open={showSuggestions}
                    onClose={() => setShowSuggestions(false)}
                    suggestedFiles={suggestedFiles}
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
                                            <Copy /> Copy All
                                        </Button>
                                        <Button
                                            onClick={handleFindSuggestions}
                                            disabled={findSuggestedFilesMutation.isPending}
                                        >
                                            {findSuggestedFilesMutation.isPending ?
                                                <>
                                                    <Binoculars />
                                                    'Finding...'
                                                </>
                                                : <> <Search />Suggest Files</>}
                                        </Button>
                                        <Button onClick={handleChatWithContext}>
                                            <MessageCircleCode /> Chat
                                        </Button>
                                        <Button onClick={handleRunAgentCoder} disabled={runAgentCoderMutation.isPending} variant="outline" size="sm" className="bg-gradient-to-r from-blue-500/10 via-purple-500/10 to-pink-500/10 border-purple-500/30 hover:border-purple-500/50">
                                            {runAgentCoderMutation.isPending ? <><Bot className="h-3.5 w-3.5 mr-1 animate-spin" /> Running...</> : <> <Bot className="h-3.5 w-3.5 mr-1" />Run Agent</>}
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