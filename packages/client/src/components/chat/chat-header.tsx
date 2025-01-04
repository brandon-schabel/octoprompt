import { useMemo, useState } from "react";
import { ArrowLeft, FolderOpen, Settings2, Copy, LinkIcon } from "lucide-react";
import { Link } from "@tanstack/react-router"
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { toast } from "sonner";
import { useChatControl } from "./hooks/use-chat-state";
import { useGlobalStateContext } from "@/components/global-state-context";
import { useNavigate } from "@tanstack/react-router"
import { buildPromptContent } from "@/components/projects/utils/projects-utils";
import { useGetProjectPrompts } from "@/hooks/api/use-prompts-api";
import { ProjectFile } from "shared/schema";
import { useGetProjectFiles } from "@/hooks/api/use-projects-api";
import { useGetChats } from "@/hooks/api/use-chat-ai-api";
import { Input } from "../ui/input";
import { useChatModelControl } from "@/components/chat/hooks/use-chat-model-control";
import { ModelSelector } from "./components/model-selector";
import { Separator } from "@/components/ui/separator";

interface ChatHeaderProps {
    onForkChat: () => void;
    chatControl: ReturnType<typeof useChatControl>;
    modelControl: ReturnType<typeof useChatModelControl>;
}

export function ChatHeader({
    onForkChat,
    chatControl,
    modelControl,
}: ChatHeaderProps) {
    const navigate = useNavigate();
    const [showLinkSettings, setShowLinkSettings] = useState(false);
    const [showChatSettings, setShowChatSettings] = useState(false);
    const [projectSearch, setProjectSearch] = useState("");

    const {
        data: chats
    } = useGetChats();

    const {
        activeChatTabState,
        clearExcludedMessages,
    } = chatControl;

    const activeChatId = activeChatTabState?.activeChatId;

    const {
        state,
        linkChatTabToProjectTab,
        setActiveProjectTab,
        unlinkChatTab,
    } = useGlobalStateContext();

    const {
        provider,
        setProvider,
        currentModel,
        setCurrentModel,
    } = modelControl;

    const activeChatTabId = state?.chatActiveTabId;
    const linkedProjectTabId = activeChatTabState?.linkedProjectTabId ?? '';
    const linkedProjectState = state?.projectTabs[linkedProjectTabId];
    const linkedProjectId = linkedProjectState?.selectedProjectId ?? '';
    const activeChatData = chats?.data?.find(c => c.id === activeChatId);

    const excludedMessageCount = activeChatTabState?.excludedMessageIds?.length || 0;
    const projectTabs = Object.entries(state?.projectTabs ?? {});
    const filteredProjectTabs = projectTabs.filter(([_, tabState]) =>
        tabState.displayName?.toLowerCase().includes(projectSearch.toLowerCase()) ||
        tabState.userPrompt?.toLowerCase().includes(projectSearch.toLowerCase())
    );

    const { data: promptData } = useGetProjectPrompts(linkedProjectId ?? '');
    const { data: fileData } = useGetProjectFiles(linkedProjectId ?? '');

    const fileMap = useMemo(() => {
        const map = new Map<string, ProjectFile>();
        if (fileData?.files) {
            fileData.files.forEach(f => map.set(f.id, f));
        }
        return map;
    }, [fileData?.files]);

    async function handleCopyAllLinkedContent() {
        if (!activeChatTabState?.linkedProjectTabId) {
            toast.error("This chat is not linked to a project tab.");
            return;
        }
        const linkSettings = activeChatTabState.linkSettings;
        if (!linkSettings) {
            toast.error("No link settings found for this chat.");
            return;
        }
        if (!linkedProjectState) {
            toast.error("Linked project tab not found.");
            return;
        }

        try {
            const content = buildPromptContent({
                fileMap,
                promptData,
                selectedFiles: linkSettings.includeSelectedFiles ? linkedProjectState.selectedFiles : [],
                selectedPrompts: linkSettings.includePrompts ? linkedProjectState.selectedPrompts : [],
                userPrompt: linkSettings.includeUserPrompt ? linkedProjectState.userPrompt : '',
            });

            await navigator.clipboard.writeText(content);
            toast.success("Linked content copied to clipboard!");
        } catch (err) {
            console.error(err);
            toast.error("Failed to copy linked content.");
        }
    }

    // Helpers
    const truncateText = (text: string, maxLength = 24) => {
        return text.length > maxLength ? `${text.slice(0, maxLength - 3)}...` : text;
    };

    function handleBackToProject() {
        if (!activeChatTabState?.linkedProjectTabId) return;
        setActiveProjectTab(activeChatTabState.linkedProjectTabId);
        navigate({ to: '/projects' });
    }

    function handleLinkProjectTab(projectTabId: string) {
        if (!activeChatTabId) return;
        linkChatTabToProjectTab(activeChatTabId, projectTabId, {
            includeSelectedFiles: true,
            includePrompts: true,
            includeUserPrompt: true,
        });
        setShowLinkSettings(false);
    }

    return (
        <div className="flex justify-between items-center bg-background px-4 pt-2">
            {/* Left side */}
            <div className="flex items-center gap-4">
                <div className="flex items-center space-x-4 gap-2">
                    <div>
                        <span className="font-bold text-xl">
                            {activeChatData?.title}
                        </span>
                    </div>

                    <div className="flex items-center space-x-2 text-muted-foreground">
                        <span>
                            {activeChatTabState?.displayName || 'No Chat Selected'}
                        </span>
                        {linkedProjectTabId && <>
                            <LinkIcon className="h-4 w-4" />

                            <Link to={'/projects'}>
                                <div className="flex items-center space-x-2">
                                    <span>{linkedProjectState?.displayName || linkedProjectTabId}</span>
                                    <FolderOpen className="h-4 w-4" />
                                </div>
                            </Link></>}
                    </div>
                </div>
            </div>

            {/* Right side */}
            {activeChatTabState && (
                <div className="flex items-center gap-2">

                    {excludedMessageCount > 0 && (
                        <>
                            <Badge variant="secondary">
                                {excludedMessageCount} message{excludedMessageCount !== 1 ? "s" : ""} excluded
                            </Badge>
                            <Button variant="outline" size="sm" onClick={clearExcludedMessages}>
                                Clear Excluded
                            </Button>
                        </>
                    )}

                    {/* Only show "Copy All" if chat is linked */}
                    {activeChatTabState?.linkedProjectTabId && (
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={handleCopyAllLinkedContent}
                            className="gap-2"
                        >
                            <Copy className="h-4 w-4" />
                            Copy All
                        </Button>
                    )}

                    {/* Link Project Button & Dialog */}
                    {!activeChatTabState?.linkedProjectTabId && (
                        <>
                            <Dialog open={showLinkSettings} onOpenChange={setShowLinkSettings}>
                                <DialogContent className="max-w-2xl max-h-[90vh] flex flex-col">
                                    <DialogHeader>
                                        <DialogTitle>Link a Project</DialogTitle>
                                    </DialogHeader>

                                    <div className="flex gap-8 min-h-0 flex-1 overflow-hidden">
                                        <div className="flex-1 pr-8 overflow-hidden flex flex-col">
                                            <h4 className="font-semibold mb-4">Select a Project</h4>
                                            <div className="flex flex-col gap-4 min-h-0">
                                                <input
                                                    type="text"
                                                    placeholder="Search projects..."
                                                    className="w-full px-3 py-2 border rounded-md"
                                                    value={projectSearch}
                                                    onChange={(e) => setProjectSearch(e.target.value)}
                                                />
                                                <div className="overflow-y-auto flex-1">
                                                    <div className="space-y-2">
                                                        {filteredProjectTabs.map(([tabId, tabState]) => {
                                                            return (
                                                                <div
                                                                    key={tabId}
                                                                    className="p-3 rounded-md cursor-pointer hover:bg-accent"
                                                                    onClick={() => handleLinkProjectTab(tabId)}
                                                                >
                                                                    <div className="font-semibold">
                                                                        {tabState.displayName || tabId}
                                                                    </div>
                                                                    <div className="text-xs text-muted-foreground">
                                                                        {tabState.selectedFiles.length} selected files
                                                                    </div>
                                                                    {tabState.userPrompt && (
                                                                        <div className="text-xs text-muted-foreground truncate">
                                                                            {tabState.userPrompt}
                                                                        </div>
                                                                    )}
                                                                </div>
                                                            );
                                                        })}
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </DialogContent>
                            </Dialog>

                            <Button
                                variant="outline"
                                onClick={() => setShowLinkSettings(true)}
                                className="gap-2"
                                size="sm"
                            >
                                <LinkIcon className="h-4 w-4" />
                                Link Project
                            </Button>
                        </>
                    )}

                    {/* Chat Settings button & dialog */}
                    <ModelSelector className="flex-row" provider={provider} currentModel={currentModel} onProviderChange={setProvider} onModelChange={setCurrentModel} />
                    {/* <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setShowChatSettings(true)}
                    >
                        <Settings2 className="h-4 w-4" />
                    </Button> */}
                    {/* <Dialog open={showChatSettings} onOpenChange={setShowChatSettings}>
                        <DialogContent className="max-w-sm">
                            <DialogHeader>
                                <DialogTitle>Chat Settings</DialogTitle>
                            </DialogHeader>

                            <div className="flex flex-col gap-4 mt-2">
                                <ModelSelector
                                    provider={provider}
                                    currentModel={currentModel}
                                    onProviderChange={setProvider}
                                    onModelChange={setCurrentModel}
                                />

                                <div className="flex justify-end gap-2 pt-2">
                                    <Button variant="outline" onClick={() => setShowChatSettings(false)}>
                                        Close
                                    </Button>
                                </div>
                            </div>
                        </DialogContent>
                    </Dialog> */}

                    {/* Fork Chat button always */}
                    <Button variant="outline" onClick={onForkChat} size="sm">
                        Fork Chat
                    </Button>
                </div>
            )}
        </div>
    );
}