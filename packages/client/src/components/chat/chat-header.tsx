import { useMemo, useState } from "react";
import { ArrowLeft, FolderOpen, Settings2, Copy } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "sonner";
import { useChatControl } from "./hooks/use-chat-state";
import { useGlobalStateContext } from "@/components/global-state-context";
import { useNavigate } from "@tanstack/react-router"
import { buildPromptContent } from "@/components/projects/utils/projects-utils";
import { useGetProjectPrompts } from "@/hooks/api/use-prompts-api";
import { ProjectFile } from "shared/schema";
import { useGetProjectFiles } from "@/hooks/api/use-projects-api";
import { useGetChats } from "@/hooks/api/use-chat-ai-api";

interface ChatHeaderProps {
    onForkChat: () => void;
    chatControl: ReturnType<typeof useChatControl>;
}

export function ChatHeader({
    onForkChat,
    chatControl
}: ChatHeaderProps) {
    const navigate = useNavigate()
    const [showLinkSettings, setShowLinkSettings] = useState(false);
    const [projectSearch, setProjectSearch] = useState("");
    const {
        data: chats
    } = useGetChats();

    const {
        activeChatTabState,
        clearExcludedMessages,

    } = chatControl;

    const activeChatId = activeChatTabState?.activeChatId

    // Pull in global state + linking helpers
    const {
        state,
        linkChatTabToProjectTab,
        updateChatLinkSettings,
        setActiveProjectTab,
        unlinkChatTab
    } = useGlobalStateContext();



    // Right now we just use the activeChatTabId from the global state
    const activeChatTabId = state?.chatActiveTabId;
    const linkedProjectTabId = activeChatTabState?.linkedProjectTabId ?? '';
    const linkedProjectState = state?.projectTabs[linkedProjectTabId]
    // the selectedProjectId is the id of the project that the linked project tab has open
    const linkedProjectId = linkedProjectState?.selectedProjectId ?? '';
    const activeChatData = chats?.data?.find(c => c.id === activeChatId)

    const linkSettings = activeChatTabState?.linkSettings


    console.log({ linkedProjectTabId, linkedProjectId })
    console.log({
        state,
        projects: state?.projectTabs,
        activeChatData
    })
    const excludedMessageCount = activeChatTabState?.excludedMessageIds?.length || 0;
    const projectTabs = Object.entries(state?.projectTabs ?? {});
    const filteredProjectTabs = projectTabs.filter(([_, tabState]) =>
        tabState.displayName?.toLowerCase().includes(projectSearch.toLowerCase()) ||
        tabState.userPrompt?.toLowerCase().includes(projectSearch.toLowerCase())
    );

    const { data: promptData } = useGetProjectPrompts(linkedProjectId ?? '')
    const { data: fileData } = useGetProjectFiles(linkedProjectId ?? '')

    const fileMap = useMemo(() => {
        const map = new Map<string, ProjectFile>()
        if (fileData?.files) {
            fileData.files.forEach(f => map.set(f.id, f))
        }
        return map
    }, [fileData?.files])

    // --------------------------
    // Copy All Linked Content
    // --------------------------
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

        // const projectTab = state?.projectTabs[activeChatTabState.linkedProjectTabId];
        if (!linkedProjectState) {
            toast.error("Linked project tab not found.");
            return;
        }

        try {
            let content = buildPromptContent({
                fileMap,
                promptData,
                selectedFiles: linkSettings.includeSelectedFiles ? linkedProjectState.selectedFiles : [],
                selectedPrompts: linkSettings.includePrompts ? linkedProjectState.selectedPrompts : [],
                userPrompt: linkSettings.includeUserPrompt ? linkedProjectState.userPrompt : '',
            })

            // // Include Selected Files
            // if (linkSettings.includeSelectedFiles && projectTab.selectedFiles.length > 0) {
            //     content += `<selected_files>\n`;
            //     for (const filePath of projectTab.selectedFiles) {
            //         content += `File: ${filePath}\n`;
            //     }
            //     content += `</selected_files>\n\n`;
            // }

            // // Include Prompts
            // if (linkSettings.includePrompts && projectTab.selectedPrompts.length > 0) {
            //     content += `<selected_prompts>\n`;
            //     for (const promptId of projectTab.selectedPrompts) {
            //         content += `Prompt: ${promptId}\n`;
            //     }
            //     content += `</selected_prompts>\n\n`;
            // }

            // // Include User Prompt
            // if (linkSettings.includeUserPrompt && projectTab.userPrompt) {
            //     content += `<user_prompt>\n${projectTab.userPrompt.trim()}\n</user_prompt>\n`;
            // }

            // if (!content.trim()) {
            //     toast("No linked content to copy!");
            //     return;
            // }

            // Copy to clipboard
            await navigator.clipboard.writeText(content);
            toast.success("Linked content copied to clipboard!");
        } catch (err) {
            console.error(err);
            toast.error("Failed to copy linked content.");
        }
    }

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

    function handleUpdateLinkSettings(
        setting: 'includeSelectedFiles' | 'includePrompts' | 'includeUserPrompt',
        value: boolean
    ) {
        if (!activeChatTabId || !activeChatTabState?.linkSettings) return;
        updateChatLinkSettings(activeChatTabId, {
            ...activeChatTabState.linkSettings,
            [setting]: value
        });
    }

    const currentChatLinkedProjectId = activeChatTabState?.linkedProjectTabId ?? '';
    const linkedProjectTabData = state?.projectTabs[currentChatLinkedProjectId];

    return (
        <div className="flex justify-between items-center mb-2 bg-background p-2 rounded-md">
            {/* Left side */}
            <div className="flex items-center gap-4">
                {currentChatLinkedProjectId && (
                    <Button
                        variant="ghost"
                        size="sm"
                        className="gap-2"
                        onClick={handleBackToProject}
                    >
                        <ArrowLeft className="h-4 w-4" />
                        Back to {linkedProjectTabData?.displayName || currentChatLinkedProjectId}
                        <FolderOpen className="h-4 w-4" />
                    </Button>
                )}
                <div className="font-bold text-xl">
                    {activeChatData?.title} - tab {activeChatTabState?.displayName || 'No Chat Selected'}
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

                    {/* Link Settings Dialog */}
                    <Dialog open={showLinkSettings} onOpenChange={setShowLinkSettings}>
                        <DialogContent className="max-w-2xl max-h-[90vh] flex flex-col">
                            <DialogHeader>
                                <DialogTitle>Project Link Settings</DialogTitle>
                            </DialogHeader>
                            <div className="flex gap-8 min-h-0 flex-1 overflow-hidden">
                                {/* Project Selection */}
                                <div className="flex-1 border-r pr-8 overflow-hidden flex flex-col">
                                    <h4 className="font-semibold mb-4">Link to Project</h4>
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
                                                    const isSelected = tabId === currentChatLinkedProjectId;
                                                    return (
                                                        <div
                                                            key={tabId}
                                                            className={`p-3 rounded-md cursor-pointer hover:bg-accent ${isSelected ? 'bg-accent' : ''
                                                                }`}
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

                                {/* Link Settings */}
                                <div className="flex-1 overflow-y-auto">
                                    <h4 className="font-semibold mb-4">Sync Settings</h4>
                                    <div className="space-y-4">
                                        <div className="flex items-center space-x-2">
                                            <Checkbox
                                                id="includeFiles"
                                                checked={activeChatTabState?.linkSettings?.includeSelectedFiles ?? false}
                                                onCheckedChange={(checked) =>
                                                    handleUpdateLinkSettings('includeSelectedFiles', checked as boolean)
                                                }
                                            />
                                            <label htmlFor="includeFiles">Include Selected Files</label>
                                        </div>
                                        <div className="flex items-center space-x-2">
                                            <Checkbox
                                                id="includePrompts"
                                                checked={activeChatTabState?.linkSettings?.includePrompts ?? false}
                                                onCheckedChange={(checked) =>
                                                    handleUpdateLinkSettings('includePrompts', checked as boolean)
                                                }
                                            />
                                            <label htmlFor="includePrompts">Include Prompts</label>
                                        </div>
                                        <div className="flex items-center space-x-2">
                                            <Checkbox
                                                id="includeUserPrompt"
                                                checked={activeChatTabState?.linkSettings?.includeUserPrompt ?? false}
                                                onCheckedChange={(checked) =>
                                                    handleUpdateLinkSettings('includeUserPrompt', checked as boolean)
                                                }
                                            />
                                            <label htmlFor="includeUserPrompt">Include User Prompt</label>
                                        </div>
                                        {activeChatTabState.linkedProjectTabId && activeChatTabId && (
                                            <div className="pt-4 border-t">
                                                <Button
                                                    variant="destructive"
                                                    onClick={() => {
                                                        unlinkChatTab(activeChatTabId);
                                                        setShowLinkSettings(false);
                                                    }}
                                                    className="w-full"
                                                >
                                                    Unlink Project
                                                </Button>
                                                <p className="text-xs text-muted-foreground">You will unlink the "{activeChatTabState.displayName}" chat from the "{linkedProjectTabData?.displayName || linkedProjectTabId}" project tab.</p>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>
                        </DialogContent>
                    </Dialog>

                    {/* Settings Button */}
                    <Button
                        variant={activeChatTabState.linkedProjectTabId ? "secondary" : "outline"}
                        onClick={() => setShowLinkSettings(true)}
                        className="gap-2"
                    >
                        <Settings2 className="h-4 w-4" />
                        {activeChatTabState.linkedProjectTabId
                            ? "Project Link Settings"
                            : "Link Project"}
                    </Button>

                    <Button variant="outline" onClick={onForkChat}>
                        Fork Chat
                    </Button>
                </div>
            )}
        </div>
    );
}