import { createFileRoute } from '@tanstack/react-router'
import { useRef, useState, RefObject } from 'react'
import { useHotkeys } from 'react-hotkeys-hook'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog'
import { InfoTooltip } from '@/components/info-tooltip'
import { useGetProjects, useGetProjectFiles } from '@/hooks/api/use-projects-api'
import { useGetProjectPrompts } from '@/hooks/api/use-prompts-api'
import { FileViewerDialog } from '@/components/navigation/file-viewer-dialog'
import { PromptOverviewPanel, type PromptOverviewPanelRef } from '@/components/projects/prompt-overview-panel'
import { FilePanel, type FilePanelRef } from '@/components/projects/file-panel/file-panel'
import { ProjectsTabManager } from '@/components/tab-managers/projects-tab-manager'
import { useSelectedFiles } from '@/hooks/utility-hooks/use-selected-files'
import { useCreateProjectTab } from '@/zustand/updaters'
import { useActiveProjectTab, useAllProjectTabs } from '@/zustand/selectors'
import { ProjectFile } from 'shared/schema'
import type { Project } from 'shared'

export function ProjectsPage() {
    const filePanelRef = useRef<FilePanelRef>(null)
    const promptPanelRef = useRef<PromptOverviewPanelRef>(null)

    // All tabs + active tab
    const tabs = useAllProjectTabs()
    const { id: projectActiveTabId, selectedProjectId } = useActiveProjectTab()

    // Field-specific state from the active tab
    // const { data: selectedProjectId } = useProjectTabField(projectActiveTabId ?? '', 'selectedProjectId')

    // We track the existence of tabs to handle "no tabs" scenario
    const noTabsYet = Object.keys(tabs || {}).length === 0

    // Create a new tab from WebSocket side
    const createNewTab = useCreateProjectTab()

    // Single source of truth for selected files (local undo/redo & server sync)
    const selectedFilesState = useSelectedFiles()

    // Load all projects & relevant data
    const { data: projects } = useGetProjects()
    const { data: fileData } = useGetProjectFiles(selectedProjectId ?? '')
    const { data: promptData } = useGetProjectPrompts(selectedProjectId ?? '')

    const projectData = projects?.projects || []

    // If the user has no tabs at all, show the "NoTabsYetView"
    if (noTabsYet) {
        return (
            <NoTabsYetView
                projects={projects?.projects || []}
                createNewTab={createNewTab}
            />
        )
    }

    // If there are tabs, but no active tab is selected, show a short prompt
    if (!selectedProjectId) {
        return (
            <div className="p-4">
                <ProjectsTabManager />
                <NoActiveTabView />
            </div>
        )
    }

    // Otherwise, we have an active tab + selectedProjectId
    return (
        <div className="flex-col h-full w-full overflow-hidden flex">
            <ProjectsTabManager />

            <MainProjectsLayout
                filePanelRef={filePanelRef as RefObject<FilePanelRef>}
                promptPanelRef={promptPanelRef as RefObject<PromptOverviewPanelRef>}
                selectedProjectId={selectedProjectId}
                projects={projectData}
                fileData={fileData?.files || []}
                promptData={promptData}
                selectedFilesState={selectedFilesState}
            />
        </div>
    )
}


export const Route = createFileRoute('/projects')({
    component: ProjectsPage,
})

// ─────────────────────────────────────────────────────────────────────────────
// Subcomponent: Main Layout
// Renders the two main panels + handles the welcome dialog logic
// ─────────────────────────────────────────────────────────────────────────────
//
// Already wrapped in `memo` to avoid unnecessary re-renders.
//
type MainProjectsLayoutProps = {
    filePanelRef: React.RefObject<FilePanelRef>
    promptPanelRef: React.RefObject<PromptOverviewPanelRef>
    selectedProjectId: string
    projects: Project[]
    fileData: ProjectFile[]
    promptData: any
    selectedFilesState: ReturnType<typeof useSelectedFiles>
}

function MainProjectsLayout({
    filePanelRef,
    promptPanelRef,
    selectedProjectId,
    projects,
    fileData,
    promptData,
    selectedFilesState
}: MainProjectsLayoutProps) {
    const projectData = projects.find((p) => p.id === selectedProjectId)

    // Initialize welcome dialog state from localStorage
    const [showWelcomeDialog, setShowWelcomeDialog] = useState(() => {
        const hasSeenWelcome = localStorage.getItem('hasSeenProjectsWelcome')
        return !hasSeenWelcome
    })

    // Update localStorage when dialog is closed
    const handleCloseWelcomeDialog = () => {
        localStorage.setItem('hasSeenProjectsWelcome', 'true')
        setShowWelcomeDialog(false)
    }

    // For file viewer
    const [viewedFile, setViewedFile] = useState<ProjectFile | null>(null)
    const closeFileViewer = () => setViewedFile(null)

    // CMD+S => focus file search
    useHotkeys(
        'mod+s',
        (e) => {
            e.preventDefault()
            filePanelRef.current?.focusSearch()
        },
        []
    )

    // CMD+I => focus prompt input
    useHotkeys(
        'mod+i',
        (e) => {
            e.preventDefault()
            promptPanelRef.current?.focusPrompt()
        },
        []
    )

    // Build a file map for the prompt panel
    const fileMap = new Map(fileData?.map(file => [file.id, file]) || [])

    return (
        <div className="flex-1 flex flex-row overflow-hidden">
            {/* Left panel: FilePanel */}
            <FilePanel
                ref={filePanelRef}
                selectedProjectId={selectedProjectId}
                projectData={projectData || null}
                className="w-3/5"
                onNavigateToPrompts={() => promptPanelRef.current?.focusPrompt()}
                selectedFilesState={selectedFilesState}
            />

            {/* Right panel: PromptOverviewPanel */}
            <PromptOverviewPanel
                ref={promptPanelRef}
                selectedProjectId={selectedProjectId}
                fileMap={fileMap}
                promptData={promptData}
                className="w-2/5"
                selectedFilesState={selectedFilesState}
            />

            {/* Welcome Dialog Example */}
            <WelcomeDialog
                showWelcomeDialog={showWelcomeDialog}
                setShowWelcomeDialog={handleCloseWelcomeDialog}
            />

            {/* File Viewer Dialog */}
            <FileViewerDialog
                open={!!viewedFile}
                viewedFile={viewedFile}
                onClose={closeFileViewer}
            />
        </div>
    )
}

// ─────────────────────────────────────────────────────────────────────────────
// Subcomponent: NoTabsYetView
// Shown if there are zero existing tabs across the entire app
// ─────────────────────────────────────────────────────────────────────────────
type NoTabsYetViewProps = {
    projects: Project[]
    createNewTab: (args: { projectId: string }) => void
}

function NoTabsYetView({
    projects,
    createNewTab
}: NoTabsYetViewProps) {
    return (
        <div className="p-4">
            <ProjectsTabManager />
            <div className="mt-4 flex flex-col items-start gap-3">
                {projects.length > 0 ? (
                    <>
                        <p className="text-sm text-muted-foreground">
                            We see you have at least one project, but no tabs created yet.
                            Create a new tab to start exploring your project!
                        </p>
                        <Button onClick={() => createNewTab({ projectId: projects[0].id })}>
                            + Create a Tab
                        </Button>
                    </>
                ) : (
                    <>
                        <p className="text-sm text-muted-foreground">
                            Looks like you haven't created any projects yet.
                            Click below to create a new project or import one.
                        </p>
                        <Button onClick={() => console.log('create project')}>
                            + Create a Project
                        </Button>
                    </>
                )}
            </div>
        </div>
    )
}

// ─────────────────────────────────────────────────────────────────────────────
// Subcomponent: NoActiveTabView
// Shown if there *are* tabs, but none is selected
// ─────────────────────────────────────────────────────────────────────────────
function NoActiveTabView() {
    return (
        <p className="text-sm text-muted-foreground">
            No active tab selected. Create or select a tab above.
        </p>
    )
}

// ─────────────────────────────────────────────────────────────────────────────
// Subcomponent: WelcomeDialog
// A simple example "getting started" dialog
// ─────────────────────────────────────────────────────────────────────────────
type WelcomeDialogProps = {
    showWelcomeDialog: boolean
    setShowWelcomeDialog: (open: boolean) => void
}

function WelcomeDialog({
    showWelcomeDialog,
    setShowWelcomeDialog
}: WelcomeDialogProps) {
    return (
        <Dialog open={showWelcomeDialog} onOpenChange={setShowWelcomeDialog}>
            <DialogContent className="sm:max-w-[600px]">
                <DialogHeader>
                    <DialogTitle>Welcome to Project View!</DialogTitle>
                    <DialogDescription className="space-y-2">
                        <p>This is where you'll explore and interact with your codebase.</p>
                        <p className="text-sm bg-muted/50 p-2 rounded-md flex items-center gap-2">
                            <span>💡</span> Click the <strong>"Projects"</strong> button in the top right to open a project
                        </p>
                    </DialogDescription>
                </DialogHeader>

                <div className="grid grid-cols-2 gap-6 py-6">
                    <div className="space-y-2">
                        <h3 className="font-semibold flex items-center gap-2">
                            File Explorer
                            <InfoTooltip>
                                Browse, search, and manage your project files
                            </InfoTooltip>
                        </h3>
                        <ul className="text-sm text-muted-foreground space-y-1 list-disc list-inside">
                            <li>Browse your project files</li>
                            <li>Search by filename or content</li>
                            <li>Select files for AI context</li>
                            <li>View and edit code</li>
                        </ul>
                    </div>

                    <div className="space-y-2">
                        <h3 className="font-semibold flex items-center gap-2">
                            AI Interaction
                            <InfoTooltip>
                                Leverage AI to understand and improve your code
                            </InfoTooltip>
                        </h3>
                        <ul className="text-sm text-muted-foreground space-y-1 list-disc list-inside">
                            <li>Create reusable prompts</li>
                            <li>Get AI suggestions</li>
                            <li>Analyze code context</li>
                            <li>Generate code improvements</li>
                        </ul>
                    </div>
                </div>

                <DialogFooter className="gap-2">
                    <Button
                        variant="outline"
                        onClick={() => setShowWelcomeDialog(false)}
                    >
                        Got it
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    )
}