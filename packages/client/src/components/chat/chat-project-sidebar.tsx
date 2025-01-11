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
import { useSelectedFiles } from '@/hooks/utility-hooks/use-selected-files'
import { linkSettingsSchema, LinkSettings } from 'shared'
import { Copy, Folder, FolderOpen, FolderOpenIcon } from 'lucide-react'
import { SelectedFilesList } from '@/components/projects/selected-files-list'
import { SlidingSidebar } from '@/components/sliding-sidebar'
import { PromptsList } from '../projects/prompts-list'
import { useCopyClipboard } from '@/hooks/utility-hooks/use-copy-clipboard'
import { useGlobalStateHelpers } from '../use-global-state-helpers'

type ChatProjectSidebarProps = {
    linkedProjectTabId: string
}

export function ChatProjectSidebar({ linkedProjectTabId }: ChatProjectSidebarProps) {
    const { state, updateChatLinkSettings, unlinkChatTab, activeChatTabState } = useGlobalStateHelpers()
    const linkedProjectState = state?.projectTabs[linkedProjectTabId]
    const [tabValue, setTabValue] = useState('files')

    const { copyToClipboard } = useCopyClipboard()

    // If there's no linked project tab, nothing to show
    if (!linkedProjectState) {
        return null
    }

    // The actual selected project ID
    const linkedProjectId = linkedProjectState.selectedProjectId
    const linkSettings = activeChatTabState?.linkSettings

    // Pull files & prompts from the actual project
    const { data: promptsData } = useGetProjectPrompts(linkedProjectId || '')
    const { data: filesData } = useGetProjectFiles(linkedProjectId || '')

    // The useSelectedFiles hook (for the currently active project tab)
    const {
        selectedFiles,
        removeSelectedFile,
        getSelectedFilesData,
    } = useSelectedFiles()

    const fileMap = new Map<string, ProjectFile>()
    if (filesData?.files) {
        filesData.files.forEach(f => fileMap.set(f.id, f))
    }

    // ------------------------------------------------------------------
    // Link Settings
    // ------------------------------------------------------------------
    function handleLinkSettingChange(key: keyof LinkSettings, value: boolean) {
        // 1) We need the chat tab ID here instead of the project tab ID
        const chatTabId = state?.chatActiveTabId
        const linkSettings = activeChatTabState?.linkSettings
        if (!chatTabId || !linkSettings) return

        const merged = { ...linkSettings, [key]: value }
        linkSettingsSchema.parse(merged)
        updateChatLinkSettings(chatTabId, merged)
    }
    // ------------------------------------------------------------------
    // Copy All Linked Content
    // ------------------------------------------------------------------
    async function handleCopyAll() {
        if (!linkSettings) {
            toast.error('No link settings found for this project tab.')
            return
        }
        if (!linkedProjectState) {
            toast.error('Linked project tab not found.')
            return
        }
        const content = buildPromptContent({
            fileMap,
            promptData: promptsData,
            selectedFiles: linkSettings.includeSelectedFiles ? linkedProjectState.selectedFiles : [],
            selectedPrompts: linkSettings.includePrompts ? linkedProjectState.selectedPrompts : [],
            userPrompt: linkSettings.includeUserPrompt ? linkedProjectState.userPrompt : '',
        })

        if (!content.trim()) {
            toast('No content to copy!')
            return
        }

        copyToClipboard(content, {
            successMessage: 'Linked content copied to clipboard!',
            errorMessage: 'Failed to copy linked content.',
        })
    }

    // ------------------------------------------------------------------
    // Render
    // ------------------------------------------------------------------
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
                                    {linkedProjectState.displayName || 'Linked Project'}
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

                    {/* -------------------------
              Tab: Selected Files
          ------------------------- */}
                    <TabsContent value="files" className="flex-1 overflow-hidden">
                        <ScrollArea className="h-full p-2">
                            <SelectedFilesList
                                selectedFiles={selectedFiles}
                                fileMap={fileMap}
                                onRemoveFile={(fileId) => removeSelectedFile(fileId)}
                            />
                        </ScrollArea>
                    </TabsContent>

                    {/* -------------------------
              Tab: Project Prompts
          ------------------------- */}
                    <TabsContent value="prompts" className="flex-1 overflow-hidden">
                        <ScrollArea className="h-full p-2 space-y-2">
                            <PromptsList
                                className='w-96'
                                projectTabId={linkedProjectTabId}
                            />
                        </ScrollArea>
                    </TabsContent>

                    {/* -------------------------
              Tab: Link Settings
          ------------------------- */}
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
                                    const chatTabId = state?.chatActiveTabId
                                    if (!chatTabId) return
                                    unlinkChatTab(chatTabId)
                                }}
                                className="w-full"
                            >
                                Unlink Project
                            </Button>
                            <p className="text-xs text-muted-foreground mt-2">
                                This removes the link for this chat from project tab "
                                {linkedProjectState.displayName || linkedProjectTabId}".
                            </p>
                        </div>
                    </TabsContent>
                </Tabs>
            </div>
        </SlidingSidebar>
    )
}