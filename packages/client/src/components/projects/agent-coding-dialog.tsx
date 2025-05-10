import { Prompt, ProjectFile } from "@/generated";
import { useGetAgentCoderRunData, useRunAgentCoder, useGetAgentCoderRunLogs, useConfirmAgentRunChanges, useDeleteAgentCoderRun, useListAgentCoderRuns } from "@/hooks/api/use-agent-coder-api";
import { useCopyClipboard } from "@/hooks/utility-hooks/use-copy-clipboard";
import { useLocalStorage } from "@/hooks/utility-hooks/use-local-storage";
import { cn } from "@/lib/utils";
import { Dialog, DialogContent, DialogHeader, DialogTitle, Button, Tabs, TabsList, TabsTrigger, TabsContent, Card, CardHeader, CardTitle, CardContent, ScrollArea, DialogFooter, DialogClose, Switch } from "@ui"; // Added Switch
import { RefreshCw, Copy, Trash2, Bot, CheckCircle, FileEdit, FilePlus, FileMinus, Eye } from "lucide-react";
import { useState, useMemo, useEffect } from "react";
import { ProjectFileMap } from "shared/src/schemas/project.schemas";
import { toast } from "sonner";
import { OctoCombobox } from "../octo/octo-combobox";
import { v4 as uuidv4 } from 'uuid'
import { DiffViewer } from "../file-changes/diff-viewer";
import { FileViewerDialog } from "../navigation/file-viewer-dialog";

interface AgentCoderLogDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    userInput: string;
    selectedFiles: string[];
    projectId: string;
    selectedPrompts: string[];
    promptData: Prompt[] | undefined;
    totalTokens: number;
    projectFileMap: ProjectFileMap
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

function FileChangePreview({ file, projectFileMap }: { file: UpdatedFileData, projectFileMap: ProjectFileMap }) {
    const [showPreview, setShowPreview] = useState(false);
    const existingFile = projectFileMap.get(file.id);
    const isNewFile = !existingFile;
    const isDeleted = file.content === null && existingFile;

    const prepareFileForViewer = (fileData: UpdatedFileData | ProjectFile) => ({
        ...fileData,
        content: fileData.content || '',
        summary: fileData.summary || '',
        meta: fileData.meta || '',
        checksum: fileData.checksum || '',
        summaryLastUpdatedAt: fileData.summaryLastUpdatedAt || new Date().toISOString()
    });

    // Calculate line changes
    const lineChanges = useMemo(() => {
        if (isNewFile) {
            const newLines = (file.content || '').split('\n').length;
            return { added: newLines, removed: 0 };
        }
        if (isDeleted) {
            const oldLines = (existingFile?.content || '').split('\n').length;
            return { added: 0, removed: oldLines };
        }
        const oldLines = (existingFile?.content || '').split('\n');
        const newLines = (file.content || '').split('\n');
        // This is a simplified diff, for more accurate line counts, a proper diff library would be needed
        const added = newLines.filter(line => !oldLines.includes(line)).length;
        const removed = oldLines.filter(line => !newLines.includes(line)).length;
        return { added, removed };
    }, [file.content, existingFile?.content, isNewFile, isDeleted]);

    return (
        <div className="flex items-center justify-between p-2 border rounded-md mb-2">
            <div className="flex items-center gap-2">
                {isNewFile ? (
                    <FilePlus className="h-4 w-4 text-green-500" />
                ) : isDeleted ? (
                    <FileMinus className="h-4 w-4 text-red-500" />
                ) : (
                    <FileEdit className="h-4 w-4 text-blue-500" />
                )}
                <span className="text-sm font-medium">{file.path}</span>
                {!isNewFile && !isDeleted && (
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        <span className="text-green-500">+{lineChanges.added}</span>
                        <span className="text-red-500">-{lineChanges.removed}</span>
                    </div>
                )}
                {isNewFile && (
                    <span className="text-xs text-green-500">+{lineChanges.added} lines</span>
                )}
                {isDeleted && (
                    <span className="text-xs text-red-500">-{lineChanges.removed} lines</span>
                )}
            </div>
            <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowPreview(true)}
                className="h-8"
            >
                <Eye className="h-4 w-4 mr-1" />
                Preview
            </Button>

            {showPreview && (
                isNewFile || isDeleted ? (
                    <FileViewerDialog
                        open={showPreview}
                        onClose={() => setShowPreview(false)}
                        viewedFile={isNewFile ? prepareFileForViewer(file) : existingFile ? prepareFileForViewer(existingFile) : undefined}
                    />
                ) : (
                    <Dialog open={showPreview} onOpenChange={setShowPreview}>
                        <DialogContent className="max-w-4xl">
                            <DialogHeader>
                                <DialogTitle>Changes to {file.path}</DialogTitle>
                            </DialogHeader>
                            <div className="mt-4">
                                <DiffViewer
                                    oldValue={existingFile?.content || ''}
                                    newValue={file.content || ''}
                                />
                            </div>
                        </DialogContent>
                    </Dialog>
                )
            )}
        </div>
    );
}

export function AgentCoderControlDialog({
    open,
    onOpenChange,
    selectedFiles: selectedFileIdsFromProps,
    userInput,
    projectId,
    selectedPrompts,
    promptData,
    totalTokens,
    projectFileMap
}: AgentCoderLogDialogProps) {
    const [selectedJobId, setSelectedJobId] = useLocalStorage<string>('selectedJobId', "NO_JOB_ID");
    const [activeTab, setActiveTab] = useState<'new-job' | 'logs' | 'confirm'>('new-job');
    const [showDataInLogsTab, setShowDataInLogsTab] = useState(false); 

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
        setShowDataInLogsTab(false); // Default to logs view for new run

        runAgentCoderMutation.mutate({
            userInput,
            selectedFileIds,
            agentJobId: newAgentJobId,
            selectedPromptIds: selectedPrompts

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
        if (!selectedJobId || selectedJobId === "NO_JOB_ID") { // check selectedJobId directly
            toast.error("Agent Job ID is missing.");
            return;
        }
        confirmChangesMutation.mutate({ agentJobId: selectedJobId });
    };

    const handleDeleteRun = () => {
        if (!selectedJobId || selectedJobId === "NO_JOB_ID") { // check selectedJobId directly
            toast.error("Agent Job ID is missing.");
            return;
        }
        if (window.confirm(`Are you sure you want to permanently delete agent run "${selectedJobId}"? This cannot be undone.`)) {
            deleteRunMutation.mutate({ agentJobId: selectedJobId }, {
                onSuccess: () => {
                    toast.success(`Agent run ${selectedJobId} deleted.`);
                    setSelectedJobId("NO_JOB_ID"); // Reset selected job ID
                    setActiveTab('new-job'); // Switch to new job tab
                    onOpenChange(false); // Optionally close dialog, or let user decide
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

    const canDelete = !!selectedJobId && selectedJobId !== "NO_JOB_ID" && !deleteRunMutation.isPending; // Ensure job ID is valid
    const { data: listData, isLoading: isListLoading, refetch: refetchList } = useListAgentCoderRuns();

    const runOptions = useMemo(() => {
        const runs = listData?.data || [];
        if (!Array.isArray(runs)) return [];
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
            label: `${jobId.substring(0, 8)}... ${jobId === currentMutationJobId && runAgentCoderMutation.isPending ? ' (Running...)' : ''}`
        }));
    }, [listData, selectedJobId, runAgentCoderMutation.variables?.agentJobId, runAgentCoderMutation.isPending]);

    useEffect(() => {
        if (open) {
            const isRunForSelectedJobPending = runAgentCoderMutation.isPending &&
                                              runAgentCoderMutation.variables?.agentJobId === selectedJobId &&
                                              selectedJobId !== "NO_JOB_ID";

            if (isRunForSelectedJobPending) {
                // If a relevant job is actively running, go to logs.
                setActiveTab('logs');
            } else {
                // Default to 'new-job' if no relevant job is actively running when the dialog opens.
                // This covers cases where selectedJobId is "NO_JOB_ID" or an old job from localStorage.
                setActiveTab('new-job');
            }
            refetchList();
        }
    }, [open, selectedJobId, runAgentCoderMutation.isPending, runAgentCoderMutation.variables?.agentJobId]);


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
                        {activeTab !== 'new-job' && (
                            <>
                                <div className='flex items-center gap-2 bg-muted rounded'>
                                    {selectedJobId && selectedJobId !== "NO_JOB_ID" && (
                                        <Button
                                            variant="ghost"
                                            size="icon"
                                            className="h-8 w-8"
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
                                                setShowDataInLogsTab(false); // Default to logs view
                                            } else {
                                                setActiveTab('new-job');
                                            }
                                        }}
                                        placeholder="Select a past run..."
                                        searchPlaceholder="Search or select run..."
                                        className="w-full min-w-[200px] text-xs h-8"
                                        popoverClassName="w-[--trigger-width]"
                                    />
                                </div>
                            </>
                        )}
                    </DialogTitle>
                </DialogHeader>

                <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as 'new-job' | 'logs' | 'confirm')} className="flex-1 flex flex-col min-h-0">
                    <TabsList className="shrink-0 mb-2">
                        <TabsTrigger value="new-job" >New Job</TabsTrigger>
                        <TabsTrigger value="logs" >Logs & Data</TabsTrigger>
                        <TabsTrigger value="confirm" >Confirm</TabsTrigger>
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

                            <Card className="flex flex-col overflow-hidden">
                                <CardHeader className="py-2 px-3 border-b">
                                    <CardTitle className="text-sm font-medium">Context & Execution</CardTitle>
                                </CardHeader>
                                <CardContent className="flex-1 p-2 overflow-y-auto text-xs">
                                    <h3 className="font-semibold mb-1">Selected Files:</h3>
                                    <ScrollArea className="h-[100px] border rounded p-1 bg-background mb-2">
                                        {selectedFileIdsFromProps.length > 0 ? (
                                            <ul className="list-disc pl-4 space-y-1">
                                                {selectedFileIdsFromProps.map(fileId => {
                                                    const file = projectFileMap.get(fileId);
                                                    return (
                                                        <li key={fileId} className="truncate" title={file?.path || fileId}>
                                                            {file?.name}
                                                        </li>
                                                    )
                                                })}
                                            </ul>
                                        ) : (
                                            <p className="text-muted-foreground italic">(No files selected)</p>
                                        )}
                                    </ScrollArea>
                                    <h3 className="font-semibold mb-1">Token Input Estimate:</h3>
                                    <p className="border rounded p-1 bg-background">{totalTokens} tokens</p>
                                </CardContent>
                            </Card>
                        </div>

                        <div className="shrink-0 mt-auto pt-2 border-t">
                            <p className="text-xs text-muted-foreground text-center mb-2">
                                Note: Agent runs may propose file modifications. You can review and apply these changes from the 'Confirm' tab after the run completes.
                            </p>
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

                    <TabsContent value="logs" className="flex-1 min-h-0 flex flex-col border rounded-md bg-muted/20 p-2">
                        {(!selectedJobId || selectedJobId === "NO_JOB_ID") ? (
                            <p className="text-center p-4 text-muted-foreground">Select or start an agent run to view logs or data.</p>
                        ) : (
                            <>
                                <div className="flex items-center justify-end space-x-2 pb-2 border-b mb-2">
                                    <label htmlFor="logs-data-switch" className="text-sm font-medium">
                                        {showDataInLogsTab ? "Viewing Raw Data" : "Viewing Logs"}
                                    </label>
                                    <Switch
                                        id="logs-data-switch"
                                        checked={showDataInLogsTab}
                                        onCheckedChange={setShowDataInLogsTab}
                                        aria-label={showDataInLogsTab ? "Switch to logs view" : "Switch to raw data view"}
                                    />
                                </div>

                                <div className="flex-1 min-h-0 overflow-y-auto">
                                    {showDataInLogsTab ? (
                                        // Data View
                                        <>
                                            {isDataLoading && <p className="text-center pt-2 text-muted-foreground">Loading data...</p>}
                                            {isDataError && (
                                                <div className="text-center pt-2 text-destructive">
                                                    <p>Error loading data:</p>
                                                    <pre className="text-xs whitespace-pre-wrap">{dataError?.message || 'Unknown error'}</pre>
                                                </div>
                                            )}
                                            {!isDataLoading && !isDataError && !agentRunData && (
                                                <p className="text-center pt-2 text-muted-foreground">No data found for run <code className='text-xs'>{selectedJobId.substring(0, 8)}</code>.</p>
                                            )}
                                            {!isDataLoading && !isDataError && agentRunData && (
                                                <pre className="font-mono text-xs whitespace-pre-wrap break-words">
                                                    {JSON.stringify(agentRunData, null, 2)}
                                                </pre>
                                            )}
                                        </>
                                    ) : (
                                        // Logs View
                                        <>
                                            {isLogLoading && <p className="text-center pt-2 text-muted-foreground">Loading logs...</p>}
                                            {isLogError && (
                                                <div className="text-center pt-2 text-destructive">
                                                    <p>Error loading logs:</p>
                                                    <pre className="text-xs whitespace-pre-wrap">{logError?.message || 'Unknown error'}</pre>
                                                </div>
                                            )}
                                            {!isLogLoading && !isLogError && logEntries.length === 0 && !isAgentRunning && (
                                                <p className="text-center pt-2 text-muted-foreground">No log entries found for run <code className='text-xs'>{selectedJobId.substring(0, 8)}</code>.</p>
                                            )}
                                            {!isLogLoading && !isLogError && logEntries.length === 0 && isAgentRunning && (
                                                <p className="text-center pt-2 text-muted-foreground flex items-center justify-center gap-2">
                                                    <RefreshCw className="h-4 w-4 animate-spin" /> Waiting for agent logs...
                                                </p>
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
                                                                entry.level === 'info' && 'text-blue-500',
                                                                entry.level === 'debug' && 'text-gray-500'
                                                            )}>
                                                                {(entry.level || 'LOG').toUpperCase()}:
                                                            </span>
                                                            <span className="ml-1">{entry.message}</span>
                                                            {entry.data && <pre className="mt-1 p-1 bg-background/50 rounded text-[11px] overflow-x-auto">{JSON.stringify(entry.data, null, 2)}</pre>}
                                                            {entry.error && <pre className="mt-1 p-1 bg-destructive/10 rounded text-destructive text-[11px]">{entry.error}
                                                                {entry.raw ? `\nRaw: ${JSON.stringify(entry.raw)}` : ''}</pre>}
                                                        </div>
                                                    ))}
                                                </div>
                                            )}
                                        </>
                                    )}
                                </div>
                            </>
                        )}
                    </TabsContent>

                    {/* Removed TabsContent for value="data" */}

                    <TabsContent value="confirm" className="flex-1 min-h-0 flex flex-col border rounded-md bg-muted/20 overflow-y-auto">
                        {isDataLoading && <p className="text-center p-4 text-muted-foreground">Loading changes...</p>}
                        {isDataError && (
                            <div className="text-center p-4 text-destructive">
                                <p>Error loading changes:</p>
                                <pre className="text-xs whitespace-pre-wrap">{dataError?.message || 'Unknown error'}</pre>
                            </div>
                        )}
                        {!isDataLoading && !isDataError && (!agentRunData?.updatedFiles || agentRunData.updatedFiles.length === 0) && selectedJobId && selectedJobId !== "NO_JOB_ID" && (
                            <p className="text-center p-4 text-muted-foreground">No proposed changes found for this run, or changes have already been confirmed.</p>
                        )}
                        {(!selectedJobId || selectedJobId === "NO_JOB_ID") && (
                            <p className="text-center p-4 text-muted-foreground">Select an agent run to view proposed changes.</p>
                        )}
                        {!isDataLoading && !isDataError && agentRunData?.updatedFiles && agentRunData.updatedFiles.length > 0 && (
                            <div className="flex flex-col flex-1 h-full p-4">
                                <div className="flex-1 overflow-y-auto">
                                    <h3 className="text-sm font-medium mb-4">Proposed Changes</h3>
                                    {(agentRunData.updatedFiles as UpdatedFileData[]).map((file) => (
                                        <FileChangePreview
                                            key={file.id}
                                            file={file}
                                            projectFileMap={projectFileMap}
                                        />
                                    ))}
                                </div>
                                <div className="shrink-0 mt-auto pt-4 border-t"> {/* Ensure padding consistency, changed from p-4 */}
                                    <Button
                                        onClick={handleConfirmChanges}
                                        disabled={confirmChangesMutation.isPending || isDataLoading || isAgentRunning || !canConfirm}
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
                                </div>
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