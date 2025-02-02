import { forwardRef, useCallback, useImperativeHandle, useMemo, useRef, useState, memo, RefObject, useEffect } from 'react'
import { useHotkeys } from 'react-hotkeys-hook'
import { toast } from 'sonner'
import { useMatches } from '@tanstack/react-router'

import { formatShortcut } from '@/lib/shortcuts'
import { FileTreeRef } from '@/components/projects/file-panel/file-tree/file-tree'
import { SelectedFilesListRef } from '@/components/projects/selected-files-list'
import { FileViewerDialog } from '@/components/navigation/file-viewer-dialog'
import { Project } from 'shared'
import { ProjectFile } from 'shared/schema'

import { useListTicketsWithTasks } from '@/hooks/api/use-tickets-api'
import { useSettings } from '@/zustand/selectors'
import { useActiveProjectTab } from '@/zustand/selectors'
import { type UseSelectedFileReturn } from '@/hooks/utility-hooks/use-selected-files'
import {
    useProjectTabField,
} from '@/zustand/zustand-utility-hooks'
import { FileExplorer } from './file-explorer/file-explorer'
import { ProjectHeader } from './project-header'


export type FilePanelRef = {
    focusSearch: () => void
    focusFileTree: () => void
    focusPrompts: () => void
}

type FilePanelProps = {
    selectedProjectId: string | null
    projectData: Project | null
    className?: string
    onNavigateToPrompts?: () => void
    selectedFilesState: UseSelectedFileReturn
}

export const FilePanel =
    forwardRef<FilePanelRef, FilePanelProps>(function FilePanel(
        { selectedProjectId, projectData, className, onNavigateToPrompts, selectedFilesState },
        ref
    ) {

        const searchInputRef = useRef<HTMLInputElement>(null)
        const fileTreeRef = useRef<FileTreeRef>(null)
        const selectedFilesListRef = useRef<SelectedFilesListRef>(null)

        const [viewedFile, setViewedFile] = useState<ProjectFile | null>(null)
        const [showAutocomplete, setShowAutocomplete] = useState<boolean>(false)
        const { id: activeProjectTabId = '' } = useActiveProjectTab()

        // Local or global "selectedFiles"
        const { data: selectedFiles = [], mutate: setSelectedFiles } = useProjectTabField('selectedFiles',)
        const settings = useSettings()
        const allowSpacebarToSelect = settings?.useSpacebarToSelectAutocomplete ?? true

        // Router info (for highlighting tickets, etc.)
        const matches = useMatches()
        const isOnTicketsRoute = matches.some((m) => m.routeId === '/tickets')
        const isOnSummarizationRoute = matches.some((m) => m.routeId === '/project-summarization')

        // Tickets for this project
        const { data: ticketsData } = useListTicketsWithTasks(selectedProjectId ?? '')
        const openTicketsCount =
            ticketsData?.ticketsWithTasks?.filter((t) => t.status === 'open').length ?? 0

        // Imperative handle
        useImperativeHandle(ref, () => ({
            focusSearch: () => {
                searchInputRef.current?.focus()
            },
            focusFileTree: () => {
                fileTreeRef.current?.focusTree()
            },
            focusPrompts: () => {
                onNavigateToPrompts?.()
            },
        }))

        // Keyboard shortcuts
        useHotkeys('mod+f', (e) => {
            e.preventDefault()
            searchInputRef.current?.focus()
        })

        useHotkeys('mod+g', (e) => {
            e.preventDefault()
            fileTreeRef.current?.focusTree()
        })

        useHotkeys('mod+p', (e) => {
            e.preventDefault()
            onNavigateToPrompts?.()
        })

        // Undo/Redo for selected files
        const { undo, redo, canUndo, canRedo } = selectedFilesState
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

        // If no project selected, show fallback
        if (!selectedProjectId) {
            return (
                <div
                    className={`flex flex-col items-center justify-center h-full p-8 text-center space-y-6 ${className}`}
                >
                    <NoProjectSelectedScreen />
                </div>
            )
        }

        // The main layout: project header + file explorer
        return (
            <div id="outer-area" className={`flex flex-col ${className}`}>
                <div className="flex-1 space-y-4 transition-all duration-300">
                    {/* Top Header: project name, links, etc. */}
                    <ProjectHeader
                        projectData={projectData}
                        isOnTicketsRoute={isOnTicketsRoute}
                        isOnSummarizationRoute={isOnSummarizationRoute}
                        openTicketsCount={openTicketsCount}
                    />

                    {/* Main Content: the search + file tree */}
                    <div className="flex-1 overflow-hidden space-y-4 p-4">
                        <FileExplorer
                            projectData={projectData}
                            setViewedFile={setViewedFile}
                            allowSpacebarToSelect={allowSpacebarToSelect}
                            searchInputRef={searchInputRef as RefObject<HTMLInputElement>}
                            fileTreeRef={fileTreeRef as RefObject<FileTreeRef>}
                            selectedFilesListRef={selectedFilesListRef as RefObject<SelectedFilesListRef>}
                            onNavigateToPrompts={onNavigateToPrompts}
                            selectedFilesState={selectedFilesState}
                            // Here we pass the local search state, no longer from global:
                            showAutocomplete={showAutocomplete}
                            setShowAutocomplete={setShowAutocomplete}
                            // These remain in global if you want them shared
                            // Also pass read/write for the "selectedFiles"
                            selectedFiles={selectedFiles ?? []}
                            setSelectedFiles={setSelectedFiles}
                        />
                    </div>
                </div>

                {/* File Viewer Modal */}
                <FileViewerDialog
                    open={!!viewedFile}
                    viewedFile={viewedFile}
                    onClose={() => {
                        setViewedFile(null)
                        // Refocus the search input after closing
                        setTimeout(() => {
                            searchInputRef.current?.focus()
                            setShowAutocomplete((prev) => !!prev)
                        }, 0)
                    }}
                />
            </div>
        )
    })




/* -------------------------------------------------------------------------
   NoProjectSelectedScreen
--------------------------------------------------------------------------*/
function NoProjectSelectedScreen() {
    return (
        <div className="max-w-md space-y-4">
            <h3 className="text-lg font-semibold">No Project Selected</h3>
            <p className="text-muted-foreground">
                Select a project to start exploring files, or create a new project if you haven't
                added one yet.
            </p>
            <div className="space-y-2">
                <p className="text-sm font-medium">Quick Tips:</p>
                <ul className="text-sm text-muted-foreground space-y-2 list-disc list-inside">
                    <li>
                        Use{' '}
                        <kbd className="px-1 rounded bg-muted">{formatShortcut('mod+f')}</kbd> to quickly
                        search files
                    </li>
                    <li>
                        Use{' '}
                        <kbd className="px-1 rounded bg-muted">{formatShortcut('mod+g')}</kbd> to focus
                        the file tree
                    </li>
                    <li>Enable content search to find text within files</li>
                    <li>Select files to include them in your AI prompts</li>
                </ul>
            </div>
        </div>
    )
}
