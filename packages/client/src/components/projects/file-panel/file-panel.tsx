import { forwardRef, useImperativeHandle, useRef, memo, RefObject } from 'react'
import { useHotkeys } from 'react-hotkeys-hook'
import { toast } from 'sonner'
import { ProjectHeader } from './project-header'
import { FileExplorer } from './file-explorer/file-explorer'
import { useSettings } from '@/zustand/selectors'
import { useActiveProjectTab } from '@/zustand/selectors'
import { useSelectedFiles } from '@/hooks/utility-hooks/use-selected-files'
import type { Project } from 'shared'
import type { ProjectFile } from 'shared/schema'
import { useGetProject } from '@/hooks/api/use-projects-api'

export type FilePanelRef = {
    focusSearch: () => void
    focusFileTree: () => void
    focusPrompts: () => void
}

type FilePanelProps = {
    className?: string
    /** Called when user wants to open a file in the "global" viewer modal. */
    onFileViewerOpen?: (file: ProjectFile) => void
}

// TODO: invalidate project files when ai file editor is used (to refresh after it changes files)
export const FilePanel = forwardRef<FilePanelRef, FilePanelProps>(
    function FilePanel({ className, onFileViewerOpen }, ref) {
        // If not passed in, get from store
        const { selectedProjectId: projectId } = useActiveProjectTab()
        const { data } = useGetProject(projectId ?? '')

        // We still keep references to let parent call `focusSearch`, etc.
        const searchInputRef = useRef<HTMLInputElement>(null)
        const fileTreeRef = useRef<any>(null) // or FileTreeRef
        const selectedFilesListRef = useRef<any>(null)

        const settings = useSettings()
        const allowSpacebarToSelect = settings?.useSpacebarToSelectAutocomplete ?? true

        // Access our undo/redo hooks from useSelectedFiles (no more prop drilling)
        const { undo, redo, canUndo, canRedo } = useSelectedFiles()

        // Keyboard shortcuts
        useHotkeys('mod+f', (e) => {
            e.preventDefault()
            searchInputRef.current?.focus()
        })
        useHotkeys('mod+g', (e) => {
            e.preventDefault()
            fileTreeRef.current?.focusTree()
        })
        useHotkeys('mod+z', (e) => {
            e.preventDefault()
            if (canUndo) {
                undo()
                toast.success('Undo: Reverted file selection')
            }
        })
        useHotkeys('shift+mod+z', (e) => {
            e.preventDefault()
            if (canRedo) {
                redo()
                toast.success('Redo: Restored file selection')
            }
        })

        // Expose methods to parent
        useImperativeHandle(ref, () => ({
            focusSearch: () => {
                searchInputRef.current?.focus()
            },
            focusFileTree: () => {
                fileTreeRef.current?.focusTree()
            },
            focusPrompts: () => {
                // Let the parent handle focusing the prompts panel
            },
        }))

        if (!projectId) {
            return (
                <div className={`flex flex-col items-center justify-center h-full p-8 text-center space-y-6 ${className}`}>
                    <NoProjectSelectedScreen />
                </div>
            )
        }

        // We pass only references + onFileViewerOpen to the Explorer
        return (
            <div id="outer-area" className={`flex flex-col ${className}`}>
                <div className="flex-1 space-y-4 transition-all duration-300">
                    {data?.project && <ProjectHeader projectData={data.project} />}
                    <div className="flex-1 overflow-hidden space-y-4 p-4">
                        <FileExplorer
                            ref={{
                                searchInputRef: searchInputRef as RefObject<HTMLInputElement>,
                                fileTreeRef,
                                selectedFilesListRef,
                            }}
                            allowSpacebarToSelect={allowSpacebarToSelect}
                            onFileViewerOpen={onFileViewerOpen}
                        />
                    </div>
                </div>
            </div>
        )
    }
)

// -------------------------------------------------------------------------
function NoProjectSelectedScreen() {
    return (
        <div className="max-w-md space-y-4">
            <h3 className="text-lg font-semibold">No Project Selected</h3>
            <p className="text-muted-foreground">
                Select a project to start exploring files, or create a new project if you haven't
                added one yet.
            </p>
        </div>
    )
}