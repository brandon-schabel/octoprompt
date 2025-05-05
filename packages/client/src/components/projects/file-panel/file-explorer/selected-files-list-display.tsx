import { SelectedFilesListRef } from "../../selected-files-list"
import { SelectedFilesList } from "../../selected-files-list"
import { ShortcutDisplay } from "@/components/app-shortcut-display"
import { InfoTooltip } from "@/components/info-tooltip"
import { Badge } from '@ui'
import { ScrollArea } from "@ui"
import { useSelectedFiles } from "@/hooks/utility-hooks/use-selected-files"
import { ProjectFileMap } from "shared/src/schemas/project.schemas"
import { useActiveProjectTab } from "@/hooks/api/use-kv-api"

type SelectedFilesSidebarProps = {
    allFilesMap: ProjectFileMap
    selectedFilesListRef: React.RefObject<SelectedFilesListRef>
    onNavigateToFileTree: () => void
}

const SelectedFilesListDisplay = function SelectedFilesSidebar({
    selectedFilesListRef,
    onNavigateToFileTree,
}: SelectedFilesSidebarProps) {
    const [, , activeProjectTabId] = useActiveProjectTab()
    const { selectedFiles, removeSelectedFile } = useSelectedFiles()

    return (
        <div className="flex flex-col h-full min-h-0 w-full">
            <div className="flex justify-between items-center mb-3 shrink-0">
                <div className="flex text-sm font-medium items-center space-x-2">
                    <Badge variant="secondary">{selectedFiles.length}</Badge>
                    <span>Selected Files</span>
                    <InfoTooltip>
                        Selected files will be included with your prompt.
                        <ul className="mt-2 list-disc list-inside">
                            <li>
                                Use arrow keys <ShortcutDisplay shortcut={['up', 'down']} /> to navigate
                                the selected files list.
                            </li>
                            <li>
                                Press <ShortcutDisplay shortcut={['r', '[1-9]']} /> or{' '}
                                <ShortcutDisplay shortcut={['delete', 'backspace']} /> to remove a file.
                            </li>
                            <li>
                                Press <ShortcutDisplay shortcut={['mod', 'b']} /> to show/hide this panel.
                            </li>
                        </ul>
                    </InfoTooltip>
                </div>
            </div>
            <ScrollArea
                className="flex-1 min-h-0 border rounded-md"
                type="auto"
            >
                <div className="p-2">
                    {activeProjectTabId && <SelectedFilesList
                        ref={selectedFilesListRef}
                        onRemoveFile={(fileId: string) => {
                            removeSelectedFile(fileId)
                        }}
                        onNavigateLeft={onNavigateToFileTree}
                        className="w-full"
                        projectTabId={activeProjectTabId}
                    />}
                </div>
            </ScrollArea>
        </div>
    )
}

export { SelectedFilesListDisplay }

