import { useMemo, useState } from "react";
import { FolderOpen, Copy, LinkIcon } from "lucide-react";
import { Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import { toast } from "sonner";

import { useGetChats } from "@/hooks/api/use-chat-ai-api";
import { useChatModelControl } from "@/components/chat/hooks/use-chat-model-control";
import { ModelSelector } from "./components/model-selector";
import { useCopyClipboard } from "@/hooks/utility-hooks/use-copy-clipboard";
import { useLinkChatTabToProjectTab } from "@/zustand/updaters";
import {
    useChatTabField,
} from "@/zustand/zustand-utility-hooks";
import { useActiveChatTab, useAllProjectTabs } from "@/zustand/selectors";
import { useForkChatHandler } from "./hooks/chat-hooks";
import { ModelSettingsPopover } from "./components/model-settings-popover";

interface ChatHeaderProps {
    chatId?: string;
    excludedMessageIds?: string[];
}

export function ChatHeader({ chatId, excludedMessageIds = [], }: ChatHeaderProps) {
    const [showLinkSettings, setShowLinkSettings] = useState(false);
    const [projectSearch, setProjectSearch] = useState("");
    const { id: chatActiveTabId } = useActiveChatTab();
    const { mutate: setExcludedMessageIds } = useChatTabField(
        "excludedMessageIds",
    );
    const { data: linkedProjectTabId } = useChatTabField(
        "linkedProjectTabId",
    );
    const { data: displayName } = useChatTabField(
        "displayName",
    );
    const { data: chats } = useGetChats();
    const activeChatData = chats?.data?.find((c) => c.id === chatId);
    const linkChatTabToProjectTab = useLinkChatTabToProjectTab();
    const modelControl = useChatModelControl();
    const { provider, setProvider, currentModel, setCurrentModel } = modelControl;
    const excludedMessageCount = excludedMessageIds.length;

    const projectTabsRecord = useAllProjectTabs();

    const projectTabs = Object.entries(projectTabsRecord);
    const filteredProjectTabs = useMemo(
        () =>
            projectTabs.filter(([_, tabState]) =>
                tabState.displayName
                    ?.toLowerCase()
                    .includes(projectSearch.toLowerCase())
            ),
        [projectTabs, projectSearch]
    );

    const { copyToClipboard } = useCopyClipboard();

    const { handleForkChat } = useForkChatHandler({
        chatId: chatId ?? "",
        excludedMessageIds,
    });

    function clearExcludedMessages() {
        setExcludedMessageIds([]);
    }

    async function handleCopyAllLinkedContent() {
        if (!linkedProjectTabId) {
            toast.error("This chat is not linked to a project tab.");
            return;
        }
        // Do your custom copy logic here
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

    return (
        <div className="flex justify-between items-center bg-background px-4 pt-2">
            {/* Left side */}
            <div className="flex items-center gap-4">
                <div className="flex items-center space-x-4 gap-2">
                    <div>
                        <span className="font-bold text-xl">
                            {activeChatData?.title || "No Chat Selected"}
                        </span>
                    </div>
                    <div className="flex items-center space-x-2 text-muted-foreground">
                        <span>{displayName || "No Tab Name"}</span>
                        {linkedProjectTabId && (
                            <>
                                <LinkIcon className="h-4 w-4" />
                                <Link to={"/projects"}>
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
                            {excludedMessageCount} message
                            {excludedMessageCount !== 1 ? "s" : ""} excluded
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
                                                    {filteredProjectTabs.map(([tabId, tabState]) => (
                                                        <div
                                                            key={tabId}
                                                            className="p-3 rounded-md cursor-pointer hover:bg-accent"
                                                            onClick={() => handleLinkProjectTab(tabId)}
                                                        >
                                                            <div className="font-semibold">
                                                                {tabState.displayName || tabId}
                                                            </div>
                                                            <div className="text-xs text-muted-foreground">
                                                                {tabState.selectedFiles?.length || 0} selected
                                                                files
                                                            </div>
                                                            {tabState.userPrompt && (
                                                                <div className="text-xs text-muted-foreground truncate">
                                                                    {tabState.userPrompt}
                                                                </div>
                                                            )}
                                                        </div>
                                                    ))}
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
                    provider={provider ?? 'openai'}
                    currentModel={currentModel ?? 'gpt-4o'}
                    onProviderChange={setProvider}
                    onModelChange={setCurrentModel}
                />

                {/* Model Settings Popover */}
                <ModelSettingsPopover />

                {/* Fork Chat Button */}
                <Button variant="outline" onClick={handleForkChat} size="sm">
                    Fork Chat
                </Button>
            </div>
        </div>
    );
}