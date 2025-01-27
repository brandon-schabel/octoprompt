import { useState } from 'react'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Link } from '@tanstack/react-router'
import { useGetProjectPrompts } from '@/hooks/api/use-prompts-api'
import { useGetProjectFiles } from '@/hooks/api/use-projects-api'
import { buildPromptContent } from '@/components/projects/utils/projects-utils'
import { ProjectFile } from 'shared/schema'
import { toast } from 'sonner'
import { linkSettingsSchema, LinkSettings } from 'shared'
import { Copy, FolderOpen, FolderOpenIcon } from 'lucide-react'
import { SelectedFilesList } from '@/components/projects/selected-files-list'
import { SlidingSidebar } from '@/components/sliding-sidebar'
import { PromptsList } from '../projects/prompts-list'
import { useCopyClipboard } from '@/hooks/utility-hooks/use-copy-clipboard'
import {
    useUpdateChatLinkSettings,
    useUnlinkChatTab,
} from '@/websocket-state/hooks/updaters/websocket-updater-hooks'
import { useSelectedFiles } from '@/hooks/utility-hooks/use-selected-files'
import { useQuery } from "@tanstack/react-query";
import {
    useProjectTabField,
} from '@/websocket-state/hooks/project-tab/project-tab-hooks'
import { useChatTabField } from '@/websocket-state/hooks/chat-tab/chat-tab-hooks'

type ChatProjectSidebarProps = {
    linkedProjectTabId: string
}

export function ChatProjectSidebar({ linkedProjectTabId }: ChatProjectSidebarProps) {
    // 1) Which chat tab is active?
    const { data: chatActiveTabId } = useQuery({
        queryKey: ["globalState"],
        select: (gs: any) => gs?.chatActiveTabId ?? null,
    });

    // 2) From that chat tab, read the linkSettings
    const { data: linkSettings } = useChatTabField(
        chatActiveTabId ?? "",
        "linkSettings"
    );

    // 3) Also read the selectedProjectId from the "linkedProjectTabId"
    const { data: selectedProjectId } = useProjectTabField(
        linkedProjectTabId,
        "selectedProjectId"
    );

    // We still use the custom utility to read local selection state
    const selectedFilesState = useSelectedFiles()
    const { selectedFiles, removeSelectedFile } = selectedFilesState
    const { copyToClipboard } = useCopyClipboard()

    // We keep the original updaters for linking/unlinking
    const updateChatLinkSettings = useUpdateChatLinkSettings();
    const unlinkChatTab = useUnlinkChatTab();

    // Local state for switching tabs in the UI
    const [tabValue, setTabValue] = useState('files')

    // Pull files & prompts from the actual project
    const { data: promptsData } = useGetProjectPrompts(selectedProjectId || '')
    const { data: filesData } = useGetProjectFiles(selectedProjectId || '')

    const fileMap = new Map<string, ProjectFile>()
    if (filesData?.files) {
        filesData.files.forEach(f => fileMap.set(f.id, f))
    }

    function handleLinkSettingChange(key: keyof LinkSettings, value: boolean) {
        if (!chatActiveTabId) return
        if (!linkSettings) return
        const merged = { ...linkSettings, [key]: value }
        linkSettingsSchema.parse(merged)
        updateChatLinkSettings(chatActiveTabId, merged)
    }

    async function handleCopyAll() {
        if (!linkSettings) {
            toast.error('No link settings found for this project tab.')
            return
        }
        // We read additional fields from the project tab:
        // e.g. selectedFiles, selectedPrompts, userPrompt
        // For multiple fields, you could either do multiple single-field queries
        // or just read the entire tab if you prefer. For demonstration, let's do single fields:
        const { data: projectSelectedFiles } = useProjectTabField(
            linkedProjectTabId,
            "selectedFiles"
        );
        const { data: projectSelectedPrompts } = useProjectTabField(
            linkedProjectTabId,
            "selectedPrompts"
        );
        const { data: userPrompt } = useProjectTabField(
            linkedProjectTabId,
            "userPrompt"
        );
        const { data: displayName } = useProjectTabField(
            linkedProjectTabId,
            "displayName"
        );

        // Build the content
        const content = buildPromptContent({
            fileMap,
            promptData: promptsData,
            selectedFiles: linkSettings.includeSelectedFiles ? projectSelectedFiles || [] : [],
            selectedPrompts: linkSettings.includePrompts ? projectSelectedPrompts || [] : [],
            userPrompt: linkSettings.includeUserPrompt ? userPrompt || '' : '',
        });

        if (!content.trim()) {
            toast('No content to copy!');
            return
        }

        await copyToClipboard(content, {
            successMessage: 'Linked content copied to clipboard!',
            errorMessage: 'Failed to copy linked content.',
        })
    }

    // If there's no linked project ID, we can't show anything
    if (!selectedProjectId) {
        return null
    }

    return (
        <SlidingSidebar
            width={435}
            side="right"
            localStorageKey="chatProjectSidebarCollapsed"
            icons={{
                openIcon: FolderOpenIcon
            }}
        >
            <div className="bg-background w-full h-full flex flex-col">
                <div className="p-2 border-b mb-2 flex items-start flex-col justify-start">
                    <div>Project Manager</div>

                    <div className='w-full flex items-center justify-between'>
                        <Link>
                            <div className='flex items-center gap-2'>
                                <span className="font-semibold">
                                    { /* For brevity, let's just show the linkedProjectTabId */}
                                    {linkedProjectTabId || 'Linked Project'}
                                </span>
                                <FolderOpen className="h-4 w-4" />
                            </div>
                        </Link>
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={handleCopyAll}
                            className="gap-2"
                        >
                            <Copy className="h-4 w-4" />
                            Copy All
                        </Button>
                    </div>
                </div>

                <Tabs
                    value={tabValue}
                    onValueChange={setTabValue}
                    className="flex flex-col flex-1 overflow-hidden"
                >
                    <TabsList className="p-1 justify-between">
                        <TabsTrigger value="files">Files</TabsTrigger>
                        <TabsTrigger value="prompts">Prompts</TabsTrigger>
                        <TabsTrigger value="settings">Settings</TabsTrigger>
                    </TabsList>

                    <TabsContent value="files" className="flex-1 overflow-hidden">
                        <ScrollArea className="h-full p-2">
                            <SelectedFilesList
                                selectedFiles={selectedFiles}
                                fileMap={fileMap}
                                onRemoveFile={(fileId) => removeSelectedFile(fileId)}
                                projectTabId={linkedProjectTabId}
                                selectedFilesState={selectedFilesState}
                            />
                        </ScrollArea>
                    </TabsContent>

                    <TabsContent value="prompts" className="flex-1 overflow-hidden">
                        <ScrollArea className="h-full p-2 space-y-2">
                            <PromptsList
                                className='w-96'
                                projectTabId={linkedProjectTabId}
                            />
                        </ScrollArea>
                    </TabsContent>

                    <TabsContent value="settings" className="flex-1 p-2 space-y-4">
                        <div className="flex items-center space-x-2">
                            <Checkbox
                                checked={linkSettings?.includeSelectedFiles ?? false}
                                onCheckedChange={(checked) =>
                                    handleLinkSettingChange('includeSelectedFiles', !!checked)
                                }
                            />
                            <label className="text-sm">Include Selected Files</label>
                        </div>

                        <div className="flex items-center space-x-2">
                            <Checkbox
                                checked={linkSettings?.includePrompts ?? false}
                                onCheckedChange={(checked) =>
                                    handleLinkSettingChange('includePrompts', !!checked)
                                }
                            />
                            <label className="text-sm">Include Prompts</label>
                        </div>

                        <div className="flex items-center space-x-2">
                            <Checkbox
                                checked={linkSettings?.includeUserPrompt ?? false}
                                onCheckedChange={(checked) =>
                                    handleLinkSettingChange('includeUserPrompt', !!checked)
                                }
                            />
                            <label className="text-sm">Include User Prompt</label>
                        </div>

                        <div className="border-t pt-4">
                            <Button
                                variant="destructive"
                                onClick={() => {
                                    const chatTabId = chatActiveTabId;
                                    if (!chatTabId) return;
                                    unlinkChatTab(chatTabId);
                                }}
                                className="w-full"
                            >
                                Unlink Project
                            </Button>
                            <p className="text-xs text-muted-foreground mt-2">
                                This removes the link for this chat from project tab "
                                {linkedProjectTabId}".
                            </p>
                        </div>
                    </TabsContent>
                </Tabs>
            </div>
        </SlidingSidebar>
    )
}