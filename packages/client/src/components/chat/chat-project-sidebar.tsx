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
import { useUpdateChatLinkSettings, useUnlinkChatTab } from '@/components/global-state/global-helper-hooks'
import { useSelectedFiles, } from '@/hooks/utility-hooks/use-selected-files'
import { useActiveChatTab, useProjectTab } from '../global-state/websocket-selector-hoooks'

type ChatProjectSidebarProps = {
    linkedProjectTabId: string
}

export function ChatProjectSidebar({ linkedProjectTabId }: ChatProjectSidebarProps) {
    const updateChatLinkSettings = useUpdateChatLinkSettings();
    const unlinkChatTab = useUnlinkChatTab();
    const [tabValue, setTabValue] = useState('files')
    const selectedFilesState = useSelectedFiles()
    const { selectedFiles, removeSelectedFile, } = selectedFilesState
    const { copyToClipboard } = useCopyClipboard()
    const { tabData: activeChatTabState, id: activeChatTabId } = useActiveChatTab()
    const linkedProjectTab = useProjectTab(linkedProjectTabId)



    // The actual selected project ID
    const linkedProjectId = linkedProjectTab?.selectedProjectId
    const linkSettings = activeChatTabState?.linkSettings

    // Pull files & prompts from the actual project
    const { data: promptsData } = useGetProjectPrompts(linkedProjectId || '')
    const { data: filesData } = useGetProjectFiles(linkedProjectId || '')

    const fileMap = new Map<string, ProjectFile>()
    if (filesData?.files) {
        filesData.files.forEach(f => fileMap.set(f.id, f))
    }

    function handleLinkSettingChange(key: keyof LinkSettings, value: boolean) {
        // 1) We need the chat tab ID here instead of the project tab ID
        const chatTabId = activeChatTabId
        const linkSettings = activeChatTabState?.linkSettings
        if (!chatTabId || !linkSettings) return

        const merged = { ...linkSettings, [key]: value }
        linkSettingsSchema.parse(merged)
        updateChatLinkSettings(chatTabId, merged)
    }

    async function handleCopyAll() {
        if (!linkSettings) {
            toast.error('No link settings found for this project tab.')
            return
        }
        if (!linkedProjectTab) {
            toast.error('Linked project tab not found.')
            return
        }
        const content = buildPromptContent({
            fileMap,
            promptData: promptsData,
            selectedFiles: linkSettings.includeSelectedFiles ? linkedProjectTab?.selectedFiles || [] : [],
            selectedPrompts: linkSettings.includePrompts ? linkedProjectTab?.selectedPrompts || [] : [],
            userPrompt: linkSettings.includeUserPrompt ? linkedProjectTab?.userPrompt || '' : '',
        })

        if (!content.trim()) {
            toast('No content to copy!')
            return
        }

        await copyToClipboard(content, {
            successMessage: 'Linked content copied to clipboard!',
            errorMessage: 'Failed to copy linked content.',
        })
    }

    // If there's no linked project tab, nothing to show
    if (!linkedProjectTab) {
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
                                    {linkedProjectTab?.displayName || 'Linked Project'}
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
                                    // 2) Also unlink via the chat tab ID
                                    const chatTabId = activeChatTabId
                                    if (!chatTabId) return
                                    unlinkChatTab(chatTabId)
                                }}
                                className="w-full"
                            >
                                Unlink Project
                            </Button>
                            <p className="text-xs text-muted-foreground mt-2">
                                This removes the link for this chat from project tab "
                                {linkedProjectTab?.displayName || linkedProjectTabId}".
                            </p>
                        </div>
                    </TabsContent>
                </Tabs>
            </div>
        </SlidingSidebar>
    )
}