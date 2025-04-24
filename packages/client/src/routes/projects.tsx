import { createFileRoute } from '@tanstack/react-router'
import { useRef, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog'
import { useGetProjects } from '@/hooks/api/use-projects-api'
import { PromptOverviewPanel, type PromptOverviewPanelRef } from '@/components/projects/prompt-overview-panel'
import { FilePanel, type FilePanelRef } from '@/components/projects/file-panel/file-panel'
import { ProjectsTabManager } from '@/components/projects-tab-manager'
import { useCreateProjectTab } from '@/hooks/api/global-state/updaters'
import { useActiveProjectTab, useAllProjectTabs } from '@/hooks/api/global-state/selectors'
import { ResizablePanel } from '@/components/ui/resizable-panel'
import { ProjectResponse } from '@/hooks/generated'

export function ProjectsPage() {
    const filePanelRef = useRef<FilePanelRef>(null)
    const promptPanelRef = useRef<PromptOverviewPanelRef>(null)

    // All tabs + active tab
    const tabs = useAllProjectTabs()
    const { selectedProjectId } = useActiveProjectTab()
    const { data: projects } = useGetProjects()

    // Create a new tab from WebSocket side
    const createNewTab = useCreateProjectTab()

    const noTabsYet = Object.keys(tabs || {}).length === 0

    if (noTabsYet) {
        return (
            <NoTabsYetView
                projects={projects?.data || []}
                createNewTab={createNewTab}
            />
        )
    }

    if (!selectedProjectId) {
        return (
            <div className="p-4">
                <ProjectsTabManager />
                <NoActiveTabView />
            </div>
        )
    }

    return (
        <div className="flex flex-col h-full w-full overflow-hidden">
            <div className="flex-none">
                <ProjectsTabManager />
            </div>
            <MainProjectsLayout
                filePanelRef={filePanelRef as React.RefObject<FilePanelRef>}
                promptPanelRef={promptPanelRef as React.RefObject<PromptOverviewPanelRef>}
            />
        </div>
    )
}

export const Route = createFileRoute('/projects')({
    component: ProjectsPage,
})

// -------------------------------------------------------------------------
// MainProjectsLayout: minimal wrapper around the two panels + dialogs
// -------------------------------------------------------------------------
type MainProjectsLayoutProps = {
    filePanelRef: React.RefObject<FilePanelRef>
    promptPanelRef: React.RefObject<PromptOverviewPanelRef>
}

function MainProjectsLayout({
    filePanelRef,
    promptPanelRef,
}: MainProjectsLayoutProps) {
    // Show welcome dialog once
    const [showWelcomeDialog, setShowWelcomeDialog] = useState(() => {
        const hasSeenWelcome = localStorage.getItem('hasSeenProjectsWelcome')
        return !hasSeenWelcome
    })
    const handleCloseWelcomeDialog = () => {
        localStorage.setItem('hasSeenProjectsWelcome', 'true')
        setShowWelcomeDialog(false)
    }

    return (
        <div className="flex-1 min-h-0 overflow-hidden">
            <ResizablePanel
                leftPanel={
                    <FilePanel
                        ref={filePanelRef}
                        className="h-full w-full"
                    />
                }
                rightPanel={
                    <PromptOverviewPanel
                        ref={promptPanelRef}
                        className="h-full w-full"
                    />
                }
                initialLeftPanelWidth={40}
                minLeftPanelWidth={100}
                storageKey="projects-panel-width"
                className="h-full w-full"
            />

            {/* Show welcome once */}
            <WelcomeDialog
                showWelcomeDialog={showWelcomeDialog}
                setShowWelcomeDialog={handleCloseWelcomeDialog}
            />
        </div>
    )
}

// -------------------------------------------------------------------------
// NoTabsYetView + NoActiveTabView + WelcomeDialog (unchanged except removing
// references to selectedFiles, etc.)
// -------------------------------------------------------------------------
type NoTabsYetViewProps = {
    projects: ProjectResponse['data'][]
    createNewTab: (args: { projectId: string }) => void
}

function NoTabsYetView({ projects, createNewTab }: NoTabsYetViewProps) {
    return (
        <div className="p-4">
            <ProjectsTabManager />
            <div className="mt-4 flex flex-col items-start gap-3">
                {projects.length > 0 ? (
                    <>
                        <p className="text-sm text-muted-foreground">
                            We see you have at least one project, but no tabs created yet.
                        </p>
                        <Button onClick={() => createNewTab({ projectId: projects[0].id })}>
                            + Create a Tab
                        </Button>
                    </>
                ) : (
                    <>
                        <p className="text-sm text-muted-foreground">
                            Looks like you haven't created any projects yet.
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

function NoActiveTabView() {
    return (
        <p className="text-sm text-muted-foreground">
            No active tab selected. Create or select a tab above.
        </p>
    )
}

type WelcomeDialogProps = {
    showWelcomeDialog: boolean
    setShowWelcomeDialog: (open: boolean) => void
}
function WelcomeDialog({ showWelcomeDialog, setShowWelcomeDialog }: WelcomeDialogProps) {
    return (
        <Dialog open={showWelcomeDialog} onOpenChange={setShowWelcomeDialog}>
            <DialogContent className="sm:max-w-[600px]">
                <DialogHeader>
                    <DialogTitle>Welcome to Project View!</DialogTitle>
                    <DialogDescription className="space-y-2">
                        <p>This is where you'll explore and interact with your codebase.</p>
                    </DialogDescription>
                </DialogHeader>
                <DialogFooter className="gap-2">
                    <Button variant="outline" onClick={() => setShowWelcomeDialog(false)}>
                        Got it
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    )
}