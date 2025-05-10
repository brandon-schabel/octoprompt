import { forwardRef, useState, useEffect, useRef, useImperativeHandle, useMemo } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useHotkeys } from 'react-hotkeys-hook'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import { useNavigate } from "@tanstack/react-router"
import { v4 as uuidv4 } from 'uuid'
import { Button } from '@ui'
import { Progress } from '@ui'
import { ExpandableTextarea } from '@/components/expandable-textarea'
import { PromptsList, type PromptsListRef } from '@/components/projects/prompts-list'
import { PromptDialog } from '@/components/projects/prompt-dialog'
import { useCreatePrompt, useUpdatePrompt, useDeletePrompt, useGetProjectPrompts } from '@/hooks/api/use-prompts-api'
import { buildPromptContent, calculateTotalTokens, promptSchema } from 'shared/src/utils/projects-utils'
import { useCopyClipboard } from '@/hooks/utility-hooks/use-copy-clipboard'
import { ShortcutDisplay } from '@/components/app-shortcut-display'
import { OctoTooltip } from '@/components/octo/octo-tooltip'
import { useActiveProjectTab, useUpdateActiveProjectTab, useProjectTabField, useActiveChatId } from '@/hooks/api/use-kv-api'
import { useSelectedFiles } from '@/hooks/utility-hooks/use-selected-files'
import { z } from 'zod'
import { SuggestedFilesDialog } from '../suggest-files-dialog'
import { VerticalResizablePanel } from '@ui'
import { ProjectFile } from '@/generated'
import { useCreateChat } from '@/hooks/api/use-chat-api'
import { useLocalStorage } from '@/hooks/utility-hooks/use-local-storage'
import { Binoculars, Bot, CheckCircle, Copy, MessageCircleCode, RefreshCw, Search, Trash2, Activity } from 'lucide-react'
import { useRunAgentCoder, useGetAgentCoderRunLogs, useListAgentCoderRuns, useGetAgentCoderRunData, useConfirmAgentRunChanges, type AgentRunData, useDeleteAgentCoderRun } from '@/hooks/api/use-agent-coder-api'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogClose } from '@/components/ui/dialog'
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { OctoCombobox } from '../octo/octo-combobox'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { type Prompt } from 'shared/src/schemas/prompt.schemas'
import { useSuggestFiles } from '@/hooks/api/use-projects-api'

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
        const [isLogDialogOpen, setIsLogDialogOpen] = useState(false);

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


        const { copyToClipboard } = useCopyClipboard()
        const promptInputRef = useRef<HTMLTextAreaElement>(null)
        const findSuggestedFilesMutation = useSuggestFiles(activeProjectTabState?.selectedProjectId || '')
        const [showSuggestions, setShowSuggestions] = useState(false)

        // Prompt creation/editing dialog states
        const [promptDialogOpen, setPromptDialogOpen] = useState(false)
        const [editPromptId] = useState<string | null>(null)

        // Load the project's prompts
        const { data: promptData } = useGetProjectPrompts(activeProjectTabState?.selectedProjectId || '')
        const createPromptMutation = useCreatePrompt(activeProjectTabState?.selectedProjectId || '')
        const updatePromptMutation = useUpdatePrompt(activeProjectTabState?.selectedProjectId || '')


        // React Hook Form for creating/editing prompts
        const promptForm = useForm<z.infer<typeof promptSchema>>({
            resolver: zodResolver(promptSchema),
            defaultValues: { name: '', content: '' },
        })

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
            findSuggestedFilesMutation.mutate({ userInput: `Please find the relevant files for the following prompt: ${localUserPrompt}` }, {
                onSuccess: (resp) => {
                    if (resp?.data?.success && resp.data?.recommendedFileIds) {
                        const files = resp.data.recommendedFileIds.map(id => {
                            const file = projectFileMap.get(id)
                            if (file) {
                                return file
                            }

                            return null
                        }).filter(Boolean) as ProjectFile[]

                        setSuggestedFiles(files)
                        setShowSuggestions(true)
                    }
                },
            })
        }


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

        // --- NEW: Handler to view the currently running agent's logs ---
        const handleViewAgentDialog = () => {
            setIsLogDialogOpen(true); // Open the dialog
        };



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
                                    <OctoTooltip>
                                        <div className="space-y-2">
                                            <p>Shortcuts:</p>
                                            <ul>
                                                <li>
                                                    - <span className="font-medium">Copy All:</span>
                                                    {' '}<ShortcutDisplay shortcut={['mod', 'shift', 'c']} />
                                                </li>
                                            </ul>
                                        </div>
                                    </OctoTooltip>
                                </div>
                                <div className="flex-1 min-h-0 flex flex-col">
                                    <ExpandableTextarea
                                        ref={promptInputRef}
                                        placeholder="Type your user prompt here..."
                                        value={localUserPrompt}
                                        onChange={(val) => setLocalUserPrompt(val)}
                                        className="flex-1 min-h-0 bg-background"
                                    />
                                    <div className="flex gap-2 mt-2 shrink-0 flex-wrap">
                                        <Button onClick={handleCopyAll} size="sm">
                                            <Copy className="h-3.5 w-3.5 mr-1" /> Copy All
                                        </Button>
                                        <Button
                                            onClick={handleFindSuggestions}
                                            disabled={findSuggestedFilesMutation.isPending}
                                            size="sm"
                                        >
                                            {findSuggestedFilesMutation.isPending ?
                                                <>
                                                    <Binoculars className="h-3.5 w-3.5 mr-1 animate-spin" />
                                                    Finding...
                                                </>
                                                : <> <Search className="h-3.5 w-3.5 mr-1" />Files</>}
                                        </Button>
                                        <Button onClick={handleChatWithContext} size="sm">
                                            <MessageCircleCode className="h-3.5 w-3.5 mr-1" /> Chat
                                        </Button>
                                        {/* --- Updated Agent Button Logic --- */}
                                        <Button
                                            onClick={handleViewAgentDialog}
                                            variant={"outline"} // Change variant when running
                                            size="sm"
                                            className={cn(
                                                "bg-gradient-to-r from-blue-500/10 via-purple-500/10 to-pink-500/10 border-purple-500/30 hover:border-purple-500/50", // Original style when not running
                                            )}
                                        >

                                            <Bot className="h-3.5 w-3.5 mr-1" /> Agent
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

                <AgentCoderControlDialog
                    open={isLogDialogOpen}
                    onOpenChange={setIsLogDialogOpen}
                    userInput={localUserPrompt}
                    selectedFiles={selectedFiles}
                    projectId={activeProjectTabState?.selectedProjectId || ''}
                    selectedPrompts={selectedPrompts}
                    promptData={promptData?.data}
                    totalTokens={totalTokens}
                />


            </div >
        )
    }
)


interface AgentCoderLogDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    userInput: string;
    selectedFiles: string[];
    projectId: string;
    selectedPrompts: string[];
    promptData: Prompt[] | undefined;
    totalTokens: number;
}

type UpdatedFileData = {
    meta: string | null;
    summary: string | null;
    path: string;
    id: string;
    content: string | null;
    projectId: string;
    name: string;
    extension: string;
    size: number;
    summaryLastUpdatedAt: string | null;
    checksum: string | null;
    createdAt: string;
    updatedAt: string;
};

type LogEntry = {
    timestamp?: string;
    level?: 'info' | 'warn' | 'error' | string;
    message?: string;
    data?: any;
    error?: string;
    raw?: any;
};

function AgentCoderControlDialog({
    open,
    onOpenChange,
    selectedFiles: selectedFileIdsFromProps,
    userInput,
    projectId,
    selectedPrompts,
    promptData,
    totalTokens
}: AgentCoderLogDialogProps) {
    const [selectedJobId, setSelectedJobId] = useLocalStorage<string>('selectedJobId', "NO_JOB_ID");
    const [activeTab, setActiveTab] = useState<'start-job' | 'logs' | 'data'>('start-job');
    const { data: agentRunData, isLoading: isDataLoading, isError: isDataError, error: dataError, refetch: refetchData } = useGetAgentCoderRunData({ agentJobId: selectedJobId ?? '', enabled: open && !!selectedJobId && selectedJobId !== "NO_JOB_ID" });
    const runAgentCoderMutation = useRunAgentCoder(projectId);

    const isAgentRunning = useMemo(() => {
        return runAgentCoderMutation.isPending
    }, [runAgentCoderMutation.isPending])


    const { data: logData, isLoading: isLogLoading, isError: isLogError, error: logError, refetch: refetchLogs } = useGetAgentCoderRunLogs(
        selectedJobId,
        { enabled: open && !!selectedJobId && selectedJobId !== "NO_JOB_ID", isAgentRunning }
    );

    const confirmChangesMutation = useConfirmAgentRunChanges();
    const deleteRunMutation = useDeleteAgentCoderRun();

    const { copyToClipboard } = useCopyClipboard();

    const logEntries = useMemo(() => {
        if (Array.isArray(logData)) {
            return logData as LogEntry[];
        }
        return [];
    }, [logData]);

    const handleRefresh = () => {
        refetchLogs();
        if (selectedJobId) {
            refetchData();
        }
    };



    const handleRunAgentCoder = () => {
        const selectedFileIds = selectedFileIdsFromProps;
        const newAgentJobId = uuidv4();

        if (!projectId) { toast.error("No project selected."); return; }
        if (!userInput.trim()) { toast.warning("Please enter a user prompt/instruction."); return; }
        if (selectedFileIds.length === 0) { toast.warning("Please select at least one file for context."); return; }

        setSelectedJobId(newAgentJobId);

        runAgentCoderMutation.mutate({
            userInput,
            selectedFileIds,
            agentJobId: newAgentJobId
        }, {
            onSuccess: () => {
                setActiveTab('logs');
                refetchLogs();
            },
            onError: (error) => {
                console.error("Agent run failed to start:", error);
                toast.error("Failed to start agent run.");
            }
        });
    };

    const handleConfirmChanges = () => {
        if (!setSelectedJobId) {
            toast.error("Agent Job ID is missing.");
            return;
        }
        confirmChangesMutation.mutate({ agentJobId: selectedJobId });
    };

    const handleDeleteRun = () => {
        if (!setSelectedJobId) {
            toast.error("Agent Job ID is missing.");
            return;
        }
        if (window.confirm(`Are you sure you want to permanently delete agent run "${selectedJobId}"? This cannot be undone.`)) {
            deleteRunMutation.mutate({ agentJobId: selectedJobId }, {
                onSuccess: () => {
                    toast.success(`Agent run ${selectedJobId} deleted.`);
                    onOpenChange(false);
                },
                onError: (error) => {
                    const errorAsUnknown = error as unknown;
                    const errorDetails = (errorAsUnknown as any)?.data?.message
                        || (errorAsUnknown instanceof Error ? errorAsUnknown.message : undefined)
                        || 'Unknown error';
                    toast.error(`Failed to delete run: ${errorDetails}`);
                }
            });
        }
    };

    const canConfirm = useMemo(() => {
        return agentRunData?.updatedFiles && Array.isArray(agentRunData.updatedFiles) && agentRunData.updatedFiles.length > 0;
    }, [agentRunData]);

    const canDelete = !!setSelectedJobId && !deleteRunMutation.isPending;
    const { data: listData, isLoading: isListLoading, isError: isListError, error: listError, refetch: refetchList } = useListAgentCoderRuns();

    const runOptions = useMemo(() => {
        const runs = listData?.data || [];
        if (!Array.isArray(runs)) return [];
        // Show the currently running agent Job ID from mutation state if it's not yet in the list
        const currentMutationJobId = runAgentCoderMutation.variables?.agentJobId;
        const allRuns = new Set(runs);
        if (currentMutationJobId) {
            allRuns.add(currentMutationJobId);
        }
        if (selectedJobId && selectedJobId !== "NO_JOB_ID") {
            allRuns.add(selectedJobId)
        }

        return Array.from(allRuns).sort().reverse().map((jobId: string) => ({
            value: jobId,
            label: `${jobId}${jobId === currentMutationJobId && runAgentCoderMutation.isPending ? ' (Running...)' : ''}`
        }));
    }, [listData, selectedJobId, runAgentCoderMutation.variables?.agentJobId, runAgentCoderMutation.isPending]);

    useEffect(() => {
        if (open) {
            if (selectedJobId && selectedJobId !== "NO_JOB_ID") {
                setActiveTab('logs');
            } else {
                setActiveTab('start-job');
            }
            refetchList();
        }
    }, [open, selectedJobId]);


    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-[85%] md:max-w-[80%] lg:max-w-[75%] xl:max-w-[70%] max-h-[85vh] flex flex-col">
                <DialogHeader className="shrink-0">
                    <DialogTitle className="flex items-center gap-4">
                        <span className="flex items-center gap-2">
                            {isAgentRunning && (
                                <RefreshCw className="h-4 w-4 animate-spin text-purple-500" />
                            )}
                            <span>Agent Coder Run</span>
                        </span>
                        <div className='flex items-center gap-2 bg-muted rounded'>
                            {selectedJobId && selectedJobId !== "NO_JOB_ID" && (
                                <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-8 w-8" // Made icon buttons slightly larger for easier clicking
                                    onClick={() => copyToClipboard(selectedJobId, { successMessage: 'Run ID copied!' })}
                                    title={`Copy Run ID: ${selectedJobId}`}
                                >
                                    <Copy className="h-4 w-4" />
                                    <span className="sr-only">Copy Run ID</span>
                                </Button>
                            )}
                            <Button
                                onClick={handleRefresh}
                                size="icon" variant="ghost"
                                className="h-8 w-8"
                                disabled={isLogLoading || isDataLoading || runAgentCoderMutation.isPending}
                                title="Refresh Logs & Data"
                            >
                                <RefreshCw className={cn("h-4 w-4", (isLogLoading || isDataLoading || runAgentCoderMutation.isPending) && "animate-spin")} />
                                <span className="sr-only">Refresh Logs and Data</span>
                            </Button>
                            <Button
                                onClick={handleDeleteRun}
                                size="icon"
                                variant="ghost"
                                className="h-8 w-8 text-destructive hover:bg-destructive/10"
                                disabled={!canDelete || confirmChangesMutation.isPending || runAgentCoderMutation.isPending}
                                title="Delete this run"
                            >
                                {deleteRunMutation.isPending ? (
                                    <RefreshCw className="h-4 w-4 animate-spin" />
                                ) : (
                                    <Trash2 className="h-4 w-4" />
                                )}
                            </Button>
                        </div>
                        {/* Agent Run Selector */}
                        <div className="flex-1">
                            <OctoCombobox
                                options={runOptions}
                                value={selectedJobId}
                                onValueChange={(id) => {
                                    const newId = id ?? "NO_JOB_ID";
                                    setSelectedJobId(newId);
                                    if (runAgentCoderMutation.variables?.agentJobId !== newId) {
                                        runAgentCoderMutation.reset();
                                    }
                                    if (newId !== "NO_JOB_ID") {
                                        setActiveTab('logs');
                                    } else {
                                        setActiveTab('start-job');
                                    }
                                }}
                                placeholder="Select a past run..."
                                searchPlaceholder="Search or select run..."
                                className="w-full min-w-[200px] text-xs h-8"
                                popoverClassName="w-[--trigger-width]"
                            />
                        </div>
                    </DialogTitle>
                </DialogHeader>

                {/* Use Tabs for Logs and Data, controlled by state */}
                <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as any)} className="flex-1 flex flex-col min-h-0">
                    <TabsList className="shrink-0 mb-2">
                        <TabsTrigger value="new-job" disabled={runAgentCoderMutation.isPending}>New Job</TabsTrigger>
                        <TabsTrigger value="logs" disabled={!selectedJobId || selectedJobId === "NO_JOB_ID"}>Logs</TabsTrigger>
                        <TabsTrigger value="data" disabled={!selectedJobId || selectedJobId === "NO_JOB_ID"}>Data</TabsTrigger>
                    </TabsList>

                    <TabsContent value="new-job" className="flex-1 min-h-0 flex flex-col gap-2">
                        <div className="flex-1 grid grid-cols-1 md:grid-cols-2 gap-2 overflow-hidden">
                            <Card className="flex flex-col overflow-hidden">
                                <CardHeader className="py-2 px-3 border-b">
                                    <CardTitle className="text-sm font-medium">Agent Instructions</CardTitle>
                                </CardHeader>
                                <CardContent className="flex-1 p-2 overflow-y-auto text-xs">
                                    <h3 className="font-semibold mb-1">User Input:</h3>
                                    <ScrollArea className="h-[100px] border rounded p-1 bg-background mb-2">
                                        <pre className="whitespace-pre-wrap break-words">{userInput || "(No user input provided)"}</pre>
                                    </ScrollArea>
                                    <h3 className="font-semibold mb-1">Selected Prompts:</h3>
                                    <ScrollArea className="h-[100px] border rounded p-1 bg-background">
                                        {selectedPrompts.length > 0 ? (
                                            <ul className="list-disc pl-4 space-y-1">
                                                {selectedPrompts.map(id => {
                                                    const prompt = promptData?.find(p => p.id === id);
                                                    return (
                                                        <li key={id} title={prompt?.content || 'Prompt content missing'}>
                                                            {prompt?.name || `ID: ${id.substring(0, 8)}...`}
                                                        </li>
                                                    );
                                                })}
                                            </ul>
                                        ) : (
                                            <p className="text-muted-foreground italic">(No prompts selected)</p>
                                        )}
                                    </ScrollArea>
                                </CardContent>
                            </Card>

                            {/* Right Side: Files & Tokens */}
                            <Card className="flex flex-col overflow-hidden">
                                <CardHeader className="py-2 px-3 border-b">
                                    <CardTitle className="text-sm font-medium">Context & Execution</CardTitle>
                                </CardHeader>
                                <CardContent className="flex-1 p-2 overflow-y-auto text-xs">
                                    <h3 className="font-semibold mb-1">Selected Files:</h3>
                                    <ScrollArea className="h-[100px] border rounded p-1 bg-background mb-2">
                                        {selectedFileIdsFromProps.length > 0 ? (
                                            <ul className="list-disc pl-4 space-y-1">
                                                {selectedFileIdsFromProps.map(fileId => (
                                                    <li key={fileId} className="truncate" title={fileId}>{fileId}</li>
                                                ))}
                                            </ul>
                                        ) : (
                                            <p className="text-muted-foreground italic">(No files selected)</p>
                                        )}
                                    </ScrollArea>
                                    <h3 className="font-semibold mb-1">Token Estimate:</h3>
                                    <p className="border rounded p-1 bg-background">{totalTokens} tokens</p>
                                </CardContent>
                            </Card>
                        </div>

                        {/* Start Button */}
                        <div className="shrink-0 mt-auto pt-2 border-t">
                            <Button
                                onClick={handleRunAgentCoder}
                                disabled={isAgentRunning || !projectId || !userInput.trim() || selectedFileIdsFromProps.length === 0}
                                size="sm"
                                className="w-full bg-gradient-to-r from-blue-500 via-purple-500 to-pink-500 text-white hover:opacity-90 transition-opacity"
                            >
                                {isAgentRunning ? (
                                    <><RefreshCw className="h-3.5 w-3.5 mr-1 animate-spin" /> Agent Running...</>
                                ) : (
                                    <><Bot className="h-3.5 w-3.5 mr-1" /> Start Agent Run</>
                                )}
                            </Button>
                            {(!userInput.trim() || selectedFileIdsFromProps.length === 0) && !isAgentRunning && (
                                <p className="text-xs text-destructive text-center mt-1">
                                    Please provide user input and select at least one file to start the agent.
                                </p>
                            )}
                        </div>
                    </TabsContent>

                    <TabsContent value="logs" className="flex-1 min-h-0 flex flex-col border rounded-md bg-muted/20 overflow-y-auto p-2">
                        {isLogLoading && <p className="text-center py-4 text-muted-foreground">Loading logs...</p>}
                        {isLogError && (
                            <div className="text-center py-4 text-destructive">
                                <p>Error loading logs:</p>
                                <pre className="text-xs whitespace-pre-wrap">{logError?.message || 'Unknown error'}</pre>
                            </div>
                        )}
                        {!isLogLoading && !isLogError && logEntries.length === 0 && selectedJobId && selectedJobId !== "NO_JOB_ID" && !isAgentRunning && (
                            <p className="text-center p-4 text-muted-foreground">No log entries found for run <code className='text-xs'>{selectedJobId.substring(0, 8)}</code>.</p>
                        )}
                        {!isLogLoading && !isLogError && logEntries.length === 0 && isAgentRunning && (
                            <p className="text-center p-4 text-muted-foreground flex items-center justify-center gap-2">
                                <RefreshCw className="h-4 w-4 animate-spin" /> Waiting for agent logs...
                            </p>
                        )}
                        {(!selectedJobId || selectedJobId === "NO_JOB_ID") && (
                            <p className="text-center p-4 text-muted-foreground">Select or start an agent run to view logs.</p>
                        )}
                        {!isLogLoading && !isLogError && logEntries.length > 0 && (
                            <div className="space-y-1 font-mono text-xs">
                                {logEntries.map((entry: LogEntry, index: number) => (
                                    <div key={index} className="whitespace-pre-wrap break-words border-b border-muted/50 pb-1 mb-1 last:border-b-0">
                                        {entry.timestamp && <span className="text-muted-foreground mr-2">[{new Date(entry.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}]</span>}
                                        <span className={cn(
                                            'font-medium',
                                            entry.level === 'error' && 'text-destructive',
                                            entry.level === 'warn' && 'text-yellow-500',
                                            entry.level === 'info' && 'text-blue-500', // Example for info
                                            entry.level === 'debug' && 'text-gray-500' // Example for debug
                                        )}>
                                            {entry.level?.toUpperCase() || 'LOG'}:
                                        </span>
                                        <span className="ml-1">{entry.message}</span>
                                        {entry.data && <pre className="mt-1 p-1 bg-background/50 rounded text-[11px] overflow-x-auto">{JSON.stringify(entry.data, null, 2)}</pre>}
                                        {entry.error && <pre className="mt-1 p-1 bg-destructive/10 rounded text-destructive text-[11px]">{entry.error}
                                            {entry.raw ? `\nRaw: ${JSON.stringify(entry.raw)}` : ''}</pre>}
                                    </div>
                                ))}
                            </div>
                        )}
                    </TabsContent>

                    <TabsContent value="data" className="flex-1 min-h-0 flex flex-col border rounded-md bg-muted/20 overflow-y-auto">
                        {isDataLoading && <p className="text-center p-4 text-muted-foreground">Loading data...</p>}
                        {isDataError && (
                            <div className="text-center p-4 text-destructive">
                                <p>Error loading data:</p>
                                <pre className="text-xs whitespace-pre-wrap">{dataError?.message || 'Unknown error'}</pre>
                            </div>
                        )}
                        {!isDataLoading && !isDataError && !agentRunData && selectedJobId && selectedJobId !== "NO_JOB_ID" && (
                            <p className="text-center p-4 text-muted-foreground">No data found for run <code className='text-xs'>{selectedJobId.substring(0, 8)}</code>.</p>
                        )}
                        {/* Show message if no run is selected */}
                        {(!selectedJobId || selectedJobId === "NO_JOB_ID") && (
                            <p className="text-center p-4 text-muted-foreground">Select or start an agent run to view data.</p>
                        )}
                        {!isDataLoading && !isDataError && agentRunData && (
                            <div className="flex flex-col flex-1 h-full p-2">
                                <div className="flex-1 overflow-y-auto">
                                    <pre className="font-mono text-xs whitespace-pre-wrap break-words">
                                        {JSON.stringify(agentRunData, null, 2)}
                                    </pre>
                                </div>
                                {canConfirm && (
                                    <div className="shrink-0 mt-auto p-2 border-t">
                                        <Button
                                            onClick={handleConfirmChanges}
                                            disabled={confirmChangesMutation.isPending || isDataLoading || isAgentRunning} // Disable if running
                                            variant="default"
                                            size="sm"
                                            className="w-full bg-green-600 hover:bg-green-700 text-white"
                                        >
                                            {confirmChangesMutation.isPending ? (
                                                <><RefreshCw className="h-3.5 w-3.5 mr-1 animate-spin" /> Applying...</>
                                            ) : (
                                                <><CheckCircle className="h-3.5 w-3.5 mr-1" /> Confirm & Apply Changes</>
                                            )}
                                        </Button>
                                        <div className="text-xs text-muted-foreground mt-1 truncate">
                                            Proposed changes ({agentRunData.updatedFiles.length} files): {(agentRunData.updatedFiles as UpdatedFileData[]).map((f) => f.path).join(', ')}
                                        </div>
                                    </div>
                                )}
                            </div>
                        )}
                    </TabsContent>
                </Tabs>

                <DialogFooter className="shrink-0 mt-2 pt-2 border-t">
                    <DialogClose asChild>
                        <Button type="button" variant="outline" size="sm">
                            Close
                        </Button>
                    </DialogClose>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}