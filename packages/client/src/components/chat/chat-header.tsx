import { useMemo, useState, useEffect } from "react";
import { FolderOpen, Copy, LinkIcon, Pencil, Trash2, Icon } from "lucide-react";
import { tab } from '@lucide/lab';
import { Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
} from "@/components/ui/dialog";
import { toast } from "sonner";

import { useGetChats } from "@/hooks/api/use-chat-ai-api";
import { useChatModelControl } from "@/components/chat/hooks/use-chat-model-control";
import { ModelSelector } from "./components/model-selector";
import { useCopyClipboard } from "@/hooks/utility-hooks/use-copy-clipboard";
import { useLinkChatTabToProjectTab, useDeleteChatTab, useSetActiveChatTab } from "@/zustand/updaters";
import {
    useChatTabField,
} from "@/zustand/zustand-utility-hooks";
import { useActiveChatTab, useAllProjectTabs, useAllChatTabs } from "@/zustand/selectors";
import { useForkChatHandler } from "./hooks/chat-hooks";
import { ModelSettingsPopover } from "./components/model-settings-popover";
import { APIProviders, DEFAULT_MODEL_CONFIGS } from "shared/index";

interface ChatHeaderProps {
    chatId?: string;
    excludedMessageIds?: string[];
}

const defaultModelConfigs = DEFAULT_MODEL_CONFIGS['default']

export function ChatHeader({ chatId, excludedMessageIds = [], }: ChatHeaderProps) {
    if (!chatId) {
        return null;
    }

    const [showLinkSettings, setShowLinkSettings] = useState(false);
    const [projectSearch, setProjectSearch] = useState("");
    const [isEditing, setIsEditing] = useState(false);
    const [newTabName, setNewTabName] = useState("");
    const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);

    const { id: chatActiveTabId } = useActiveChatTab();
    const { mutate: setExcludedMessageIds } = useChatTabField(
        "excludedMessageIds",
    );
    const { data: linkedProjectTabId } = useChatTabField(
        "linkedProjectTabId",
    );
    const { data: displayName, mutate: setDisplayName } = useChatTabField(
        "displayName",
    );
    const { data: chats } = useGetChats();
    const activeChatData = chats?.data?.find((c) => c.id === chatId);
    const linkChatTabToProjectTab = useLinkChatTabToProjectTab();
    const modelControl = useChatModelControl();
    const { provider, setProvider, currentModel, setCurrentModel } = modelControl;
    const excludedMessageCount = excludedMessageIds.length;
    const deleteChatTab = useDeleteChatTab();
    const setActiveChatTab = useSetActiveChatTab();
    const allChatTabs = useAllChatTabs();

    const projectTabsRecord = useAllProjectTabs();

    useEffect(() => {
        setNewTabName(displayName || "");
    }, [displayName]);

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

    function handleRenameTab(newName: string) {
        setDisplayName(newName);
        setIsEditing(false);
    }

    function handleDeleteTab() {
        if (chatActiveTabId) {
            // Get all tab IDs except the one being deleted
            const remainingTabIds = Object.keys(allChatTabs).filter(id => id !== chatActiveTabId);
            
            // Delete the current tab
            deleteChatTab(chatActiveTabId);
            
            // If there are remaining tabs, switch to the first one
            if (remainingTabIds.length > 0) {
                setActiveChatTab(remainingTabIds[0]);
            }
            
            toast.success("Tab deleted successfully");
        }
        setIsDeleteDialogOpen(false);
    }

    return (
        <div className="flex justify-between items-center bg-background px-4 pt-2">
            {/* Left side */}
            <div className="flex items-center gap-4">
                <div className="flex flex-col">
                    <div className="flex items-center space-x-4 gap-2">
                        <div className="flex items-center gap-2">
                            <span className="font-bold text-xl">
                                {activeChatData?.title || "No Chat Selected"}
                            </span>
                            {/* Tab name with edit/delete functionality */}
                            <div className="mt-1 text-[0.8rem] text-muted-foreground group inline-block">
                                {isEditing ? (
                                    <input
                                        type="text"
                                        value={newTabName}
                                        onChange={(e) => setNewTabName(e.target.value)}
                                        onBlur={() => handleRenameTab(newTabName)}
                                        onKeyDown={(e) => {
                                            if (e.key === "Enter") {
                                                handleRenameTab(newTabName);
                                            }
                                            if (e.key === "Escape") {
                                                setNewTabName(displayName || "");
                                                setIsEditing(false);
                                            }
                                        }}
                                        className="text-[0.8rem] border-b border-dotted bg-transparent focus:outline-none"
                                    />
                                ) : (
                                    <div className="flex items-center space-x-1">
                                        <Icon iconNode={tab} className="w-3 h-3 text-gray-500" aria-label="Tab Name" />
                                        <span
                                            onClick={() => setIsEditing(true)}
                                            className="cursor-pointer"
                                            title="Click to rename tab"
                                        >
                                            {displayName || "Unnamed Tab"}
                                        </span>
                                        <Pencil
                                            className="invisible group-hover:visible w-3 h-3 text-gray-500 cursor-pointer"
                                            onClick={() => setIsEditing(true)}
                                        />
                                        <button
                                            onClick={() => setIsDeleteDialogOpen(true)}
                                            className="invisible group-hover:visible text-red-500"
                                            title="Delete tab"
                                        >
                                            <Trash2 className="w-3 h-3" />
                                        </button>
                                    </div>
                                )}
                            </div>
                        </div>
                        <div className="flex items-center space-x-2 text-muted-foreground">
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
                    provider={provider as APIProviders ?? defaultModelConfigs.provider as APIProviders}
                    currentModel={currentModel ?? defaultModelConfigs.model}
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

            {/* Delete confirmation dialog */}
            <Dialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Confirm Tab Deletion</DialogTitle>
                    </DialogHeader>
                    <DialogDescription>
                        Are you sure you want to delete this tab? This action cannot be undone.
                    </DialogDescription>
                    <div className="mt-4 flex justify-end space-x-2">
                        <Button variant="outline" onClick={() => setIsDeleteDialogOpen(false)}>Cancel</Button>
                        <Button variant="destructive" onClick={handleDeleteTab}>Delete</Button>
                    </div>
                </DialogContent>
            </Dialog>
        </div>
    );
}