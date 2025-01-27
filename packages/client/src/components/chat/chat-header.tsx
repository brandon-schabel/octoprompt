import { useMemo, useState } from "react";
import { FolderOpen, Copy, LinkIcon } from "lucide-react";
import { Link } from "@tanstack/react-router"
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { toast } from "sonner";
import { useChatControl } from "./hooks/use-chat-state";
import { useGetChats } from "@/hooks/api/use-chat-ai-api";
import { useChatModelControl } from "@/components/chat/hooks/use-chat-model-control";
import { ModelSelector } from "./components/model-selector";
import { useCopyClipboard } from "@/hooks/utility-hooks/use-copy-clipboard";
import { useLinkChatTabToProjectTab } from "@/websocket-state/hooks/updaters/websocket-updater-hooks";
import { useChatTabField, useChatTabFieldUpdater } from "@/websocket-state/chat-tab-hooks";
import { useGlobalState } from "@/websocket-state/hooks/selectors/use-global-state";
import { useActiveChatTab } from "@/websocket-state/hooks/selectors/websocket-selector-hoooks";

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
    const [showLinkSettings, setShowLinkSettings] = useState(false);
    const [projectSearch, setProjectSearch] = useState("");
    const { id: chatActiveTabId } = useActiveChatTab()

    // 2) From that tab, read single fields
    const { data: activeChatId } = useChatTabField(chatActiveTabId ?? "", "activeChatId");
    const { data: linkedProjectTabId } = useChatTabField(chatActiveTabId ?? "", "linkedProjectTabId");
    const { data: excludedMessageIds = [] } =
        useChatTabField(chatActiveTabId ?? "", "excludedMessageIds");

    // For clearing excluded messages, we can call the single-field updater:
    const { mutate: setExcludedMessageIds } = useChatTabFieldUpdater(
        chatActiveTabId ?? "",
        "excludedMessageIds"
    );

    // If we also want the chat's displayName or provider/model, we can do so:
    const { data: displayName } = useChatTabField(chatActiveTabId ?? "", "displayName");

    const {
        data: chats
    } = useGetChats();

    const linkChatTabToProjectTab = useLinkChatTabToProjectTab();

    // Model logic from the custom hook
    const { provider, setProvider, currentModel, setCurrentModel } = modelControl;

    // For referencing the actual chat DB row:
    const activeChatData = chats?.data?.find(c => c.id === activeChatId);

    const excludedMessageCount = excludedMessageIds.length;

    // If we have a bunch of project tabs, we might list them for linking:
    const { data: globalState } = useGlobalState()
    const projectTabsRecord = globalState?.projectTabs || {};
    const projectTabs = Object.entries(projectTabsRecord);
    const filteredProjectTabs = useMemo(() => projectTabs.filter(([_, tabState]) =>
        tabState.displayName?.toLowerCase().includes(projectSearch.toLowerCase()) ||
        tabState.userPrompt?.toLowerCase().includes(projectSearch.toLowerCase())
    ), [projectTabs, projectSearch]);

    const { copyToClipboard } = useCopyClipboard()

    // We won't do an actual linkedProject fetch if we only have the ID. The logic is similar to chat-project-sidebar:
    async function handleCopyAllLinkedContent() {
        if (!linkedProjectTabId) {
            toast.error("This chat is not linked to a project tab.");
            return;
        }
        // ... build content with buildPromptContent if desired ...
        // Implementation omitted for brevity
        copyToClipboard("some content");
    }

    function handleLinkProjectTab(projectTabId: string) {
        if (!chatActiveTabId) return;
        linkChatTabToProjectTab(chatActiveTabId, projectTabId, {
            includeSelectedFiles: true,
            includePrompts: true,
            includeUserPrompt: true,
        });
        setShowLinkSettings(false);
    }

    function clearExcludedMessages() {
        setExcludedMessageIds([]);
    }

    return (
        <div className="flex justify-between items-center bg-background px-4 pt-2">
            {/* Left side */}
            <div className="flex items-center gap-4">
                <div className="flex items-center space-x-4 gap-2">
                    <div>
                        <span className="font-bold text-xl">
                            {activeChatData?.title || 'No Chat Selected'}
                        </span>
                    </div>
                    <div className="flex items-center space-x-2 text-muted-foreground">
                        <span>
                            {displayName || 'No Tab Name'}
                        </span>
                        {linkedProjectTabId && (
                            <>
                                <LinkIcon className="h-4 w-4" />
                                <Link to={'/projects'}>
                                    <div className="flex items-center space-x-2">
                                        <span>{linkedProjectTabId}</span>
                                        <FolderOpen className="h-4 w-4" />
                                    </div>
                                </Link>
                            </>
                        )}
                    </div>
                </div>
            </div>

            {/* Right side */}
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

                {linkedProjectTabId && (
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
                {!linkedProjectTabId && (
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
                                                                    {tabState.selectedFiles?.length || 0} selected files
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

                {/* Model Selector */}
                <ModelSelector
                    className="flex-row"
                    provider={provider}
                    currentModel={currentModel}
                    onProviderChange={setProvider}
                    onModelChange={setCurrentModel}
                />

                {/* Fork Chat Button */}
                <Button variant="outline" onClick={onForkChat} size="sm">
                    Fork Chat
                </Button>
            </div>
        </div>
    );
}