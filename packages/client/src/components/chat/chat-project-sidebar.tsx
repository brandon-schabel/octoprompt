import { useState } from 'react'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Link } from '@tanstack/react-router'
import { useGetProjectPrompts } from '@/hooks/api/use-prompts-api'
import { buildPromptContent } from '@/components/projects/utils/projects-utils'
import { toast } from 'sonner'
import { Copy, FolderOpen, FolderOpenIcon } from 'lucide-react'
import { SelectedFilesList } from '@/components/projects/selected-files-list'
import { SlidingSidebar } from '@/components/sliding-sidebar'
import { PromptsList } from '../projects/prompts-list'
import { useCopyClipboard } from '@/hooks/utility-hooks/use-copy-clipboard'

import { useSelectedFiles } from '@/hooks/utility-hooks/use-selected-files'
import { useQuery } from "@tanstack/react-query";
import {
    useProjectTabField,
} from '@/zustand/zustand-utility-hooks'

type ChatProjectSidebarProps = {
    linkedProjectTabId: string
}

export function ChatProjectSidebar({ linkedProjectTabId }: ChatProjectSidebarProps) {
    // We get the activeChat from a global state or query
    const { data: activeChatId } = useQuery({
        queryKey: ["activeChat"],
        select: (state: any) => state?.activeChatId ?? null,
    });

    // Get link settings for the active chat
    const { data: linkSettings } = useQuery({
        queryKey: ["chatLinkSettings", activeChatId],
        select: (state: any) => state?.linkSettings ?? null,
    });

    // Read the selectedProjectId from the project tab
    const { data: selectedProjectId } = useProjectTabField(
        "selectedProjectId",
        linkedProjectTabId
    );

    // Clipboard utility
    const { copyToClipboard } = useCopyClipboard()

    // Project linking functions using direct chat IDs instead of tabs
    const updateChatLinkSettings = async (chatId: string, settings: any) => {
        // Implementation would be updated to work with chat IDs directly
        toast.success('Link settings updated')
    };
    
    const unlinkProjectFromChat = async (chatId: string) => {
        // Implementation would be updated to work with chat IDs directly
        toast.success('Project unlinked from chat')
    };

    // Local state for switching tabs in the UI
    const [tabValue, setTabValue] = useState('files')

    // Pull files & prompts from the actual project
    const { data: promptsData } = useGetProjectPrompts(selectedProjectId || '')

    const { removeSelectedFile, projectFileMap } = useSelectedFiles({ tabId: linkedProjectTabId })

    function handleLinkSettingChange(key: string, value: boolean) {
        if (!activeChatId) return
        if (!linkSettings) return
        const merged = { ...linkSettings, [key]: value }
        updateChatLinkSettings(activeChatId, merged)
    }

    async function handleCopyAll() {
        if (!linkSettings) {
            toast.error('No link settings found for this project.')
            return
        }
        
        // Get project data for building content
        const { data: projectSelectedFiles } = useProjectTabField(
            "selectedFiles",
            linkedProjectTabId
        );
        const { data: projectSelectedPrompts } = useProjectTabField(
            "selectedPrompts",
            linkedProjectTabId
        );
        const { data: userPrompt } = useProjectTabField(
            "userPrompt",
            linkedProjectTabId
        );

        // Build the content
        const content = buildPromptContent({
            fileMap: projectFileMap,
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
                                onRemoveFile={(fileId) => removeSelectedFile(fileId)}
                                projectTabId={linkedProjectTabId}
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
                                    if (!activeChatId) return;
                                    unlinkProjectFromChat(activeChatId);
                                }}
                                className="w-full"
                            >
                                Unlink Project
                            </Button>
                            <p className="text-xs text-muted-foreground mt-2">
                                This removes the link between this chat and project tab "
                                {linkedProjectTabId}".
                            </p>
                        </div>
                    </TabsContent>
                </Tabs>
            </div>
        </SlidingSidebar>
    )
}