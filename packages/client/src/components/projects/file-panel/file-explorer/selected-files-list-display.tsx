import { ProjectFile } from "shared/schema"
import { SelectedFilesListRef } from "../../selected-files-list"
import { SelectedFilesList } from "../../selected-files-list"
import { ShortcutDisplay } from "@/components/app-shortcut-display"
import { InfoTooltip } from "@/components/info-tooltip"
import { Badge } from "@/components/ui/badge"
import { ScrollArea } from "@/components/ui/scroll-area"
import { useSelectedFiles } from "@/hooks/utility-hooks/use-selected-files"
import { useActiveProjectTab } from "@/zustand/selectors"

type SelectedFilesSidebarProps = {
    allFilesMap: Map<string, ProjectFile>

    selectedFilesListRef: React.RefObject<SelectedFilesListRef>
    onNavigateToFileTree: () => void
    onNavigateToPrompts?: () => void
}

const SelectedFilesListDisplay = function SelectedFilesSidebar({
    selectedFilesListRef,
    onNavigateToFileTree,
    onNavigateToPrompts,
}: SelectedFilesSidebarProps) {
    const { id: activeProjectTabId } = useActiveProjectTab()
    const { selectedFiles, removeSelectedFile } = useSelectedFiles()

    return (
        <div className="flex flex-col w-full">
            <div className="flex justify-between items-center mb-2">
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
                        </ul>
                    </InfoTooltip>
                </div>
            </div>
            <ScrollArea
                className="flex-1 min-h-0 border rounded-md max-h-[50vh] items-center flex w-60"
                type="auto"
            >
                {activeProjectTabId && <SelectedFilesList
                    ref={selectedFilesListRef}
                    onRemoveFile={(fileId: string) => {
                        removeSelectedFile(fileId)
                    }}
                    onNavigateLeft={onNavigateToFileTree}
                    onNavigateRight={onNavigateToPrompts}
                    className="w-60"
                    projectTabId={activeProjectTabId}
                />}
            </ScrollArea>
        </div>
    )
}

export { SelectedFilesListDisplay }

