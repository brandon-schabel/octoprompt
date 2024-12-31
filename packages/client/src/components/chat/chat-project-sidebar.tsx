import { useState } from 'react'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Input } from '@/components/ui/input'
import { useGetProjectPrompts } from '@/hooks/api/use-prompts-api'
import { useGetProjectFiles } from '@/hooks/api/use-projects-api'
import { buildPromptContent } from '@/components/projects/utils/projects-utils'
import { ProjectFile } from 'shared/schema'
import { toast } from 'sonner'
import { useGlobalStateContext } from '@/components/global-state-context'
import { useSelectedFiles } from '@/hooks/use-selected-files'
import { linkSettingsSchema, LinkSettings } from 'shared'
import { Copy } from 'lucide-react'
import { SelectedFilesList } from '@/components/projects/selected-files-list'
import { FormatTokenCount } from '@/components/format-token-count'

type ChatProjectSidebarProps = {
    linkedProjectTabId: string
}

export function ChatProjectSidebar({ linkedProjectTabId }: ChatProjectSidebarProps) {
    const { state, updateChatLinkSettings, unlinkChatTab, activeChatTabState } = useGlobalStateContext()
    const linkedProjectState = state?.projectTabs[linkedProjectTabId]
    const [tabValue, setTabValue] = useState('files')

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
        if (!linkedProjectTabId || !linkSettings) return
        const merged = { ...linkSettings, [key]: value }
        // Validate just to be safe
        linkSettingsSchema.parse(merged)
        updateChatLinkSettings(linkedProjectTabId, merged)
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
        // build the combined content
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
        try {
            await navigator.clipboard.writeText(content)
            toast.success('Linked content copied to clipboard!')
        } catch (err) {
            console.error(err)
            toast.error('Failed to copy linked content.')
        }
    }

    // ------------------------------------------------------------------
    // Render
    // ------------------------------------------------------------------
    return (
        <div className="border-l bg-background min-w-[300px] max-w-sm flex flex-col">
            <div className="p-2 border-b flex items-center justify-between">
                <span className="font-semibold">
                    {linkedProjectState.displayName || 'Linked Project'}
                </span>
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
                        {!promptsData?.prompts?.length ? (
                            <p className="text-sm text-muted-foreground">No prompts found.</p>
                        ) : (
                            promptsData.prompts.map(prompt => (
                                <div
                                    key={prompt.id}
                                    className="border rounded-md p-2 hover:bg-accent hover:cursor-pointer"
                                >
                                    <div className="font-medium">{prompt.name}</div>
                                    <div className="text-xs text-muted-foreground line-clamp-2">
                                        {prompt.content}
                                    </div>
                                </div>
                            ))
                        )}
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
                            onClick={() => unlinkChatTab(linkedProjectTabId)}
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
    )
}