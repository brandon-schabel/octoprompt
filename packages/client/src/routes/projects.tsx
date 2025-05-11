import { createFileRoute } from '@tanstack/react-router'
import { useRef, useState, useEffect } from 'react' // Added useEffect
import { Button } from '@ui'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@ui'
import { useGetProjects, useDeleteProject } from '@/hooks/api/use-projects-api'
import { PromptOverviewPanel, type PromptOverviewPanelRef } from '@/components/projects/prompt-overview-panel'
import { FilePanel, type FilePanelRef } from '@/components/projects/file-panel/file-panel'
import { ProjectsTabManager } from '@/components/projects-tab-manager'
import { ResizablePanel } from '@ui'
import { ProjectResponse } from '@/generated'
import { useActiveProjectTab, useGetProjectTabs, useUpdateActiveProjectTab, useCreateProjectTab, useSetKvValue, useSetActiveProjectTabId, useUpdateKvValue } from '@/hooks/api/use-kv-api'

import { ProjectList } from '@/components/projects/project-list'
import { ProjectDialog } from '@/components/projects/project-dialog'


// AddProjectUI is not directly used in ProjectsPage after changes, but kept for reference if needed elsewhere.
export const AddProjectUI = ({ openProjectModal }: { openProjectModal: () => void }) => { // Assuming openProjectModal would be passed as a prop
    return (
        <Button variant="outline" onClick={openProjectModal} className="mt-2">
            Add project
        </Button>
    )
}

export function ProjectsPage() {
    const filePanelRef = useRef<FilePanelRef>(null)
    const promptPanelRef = useRef<PromptOverviewPanelRef>(null)
    const [activeProjectTabState,] = useActiveProjectTab()

    const selectedProjectId = activeProjectTabState?.selectedProjectId
    const { data: allProjectsData, isLoading: projectsLoading } = useGetProjects()
    const { data: tabs } = useGetProjectTabs()
    const { createProjectTab: createProjectTabFromHook } = useCreateProjectTab()
    const updateActiveProjectTab = useUpdateActiveProjectTab()
    const { mutate: deleteProjectMutate } = useDeleteProject()

    const [projectModalOpen, setProjectModalOpen] = useState(false)
    const [projectFormOpen, setProjectFormOpen] = useState(false)
    const [editingProjectId, setEditingProjectId] = useState<string | null>(null)

    const projects = allProjectsData?.data || []
    const tabsLen = Object.keys(tabs || {}).length
    const noTabsYet = Object.keys(tabs || {}).length === 0
    const tabsArray = Object.values(tabs || {})
    const tabsKeys = Object.keys(tabs || {})
    const { setActiveProjectTabId } = useSetActiveProjectTabId()
    const { mutate: updateProjectTabs } = useSetKvValue('projectTabs')

    useEffect(() => {
        // if there is a project, and no project tabs, create a new project tab
        if (projects.length === 1 && noTabsYet) {
            const projectTab = createProjectTabFromHook({
                displayName: projects[0].name || `Tab for ${projects[0].id.substring(0, 6)}`,
                selectedProjectId: projects[0].id
            })

        }


        // if there isn't a selected project in the active tab and there is one project, then select the only project
        if (!selectedProjectId && projects.length === 1 && tabsLen === 1) {
            // set the active tab to the only project tab
            updateProjectTabs(
                {
                    [tabsKeys[0]]: {
                        ...tabsArray[0],
                        selectedProjectId: projects[0].id
                    }
                }
            )

            // set active tab id
            setActiveProjectTabId(tabsKeys[0])
        }


    }, [projects, noTabsYet, activeProjectTabState, selectedProjectId])

    const handleSelectProject = (id: string) => {
        updateActiveProjectTab(prev => ({
            ...(prev || {}),
            selectedProjectId: id,
            selectedFiles: [],
            selectedPrompts: []
        }))
        setProjectModalOpen(false)
    }

    const handleOpenNewProjectForm = () => {
        setEditingProjectId(null)
        setProjectFormOpen(true)
        setProjectModalOpen(false) // Close the selector dialog if it was open
    }

    const handleEditProjectForm = (id: string) => {
        setEditingProjectId(id)
        setProjectFormOpen(true)
        setProjectModalOpen(false)
    }

    const handleDeleteProject = (id: string) => {
        deleteProjectMutate(id, {
            onSuccess: () => {
                if (selectedProjectId === id) {
                    updateActiveProjectTab(prev => ({ ...(prev || {}), selectedProjectId: undefined }))
                }
                // If the deleted project was the only one, selectedProjectId might become undefined.
                // If projectModalOpen was true, ProjectList will refresh.
                // Consider if projectModalOpen should be closed. For now, rely on list refresh.
            }
        })
    }
    let content;

    if (projectsLoading) {
        content = (
            <div className="flex items-center justify-center h-full w-full">
                <p>Loading projects...</p>
            </div>
        );
    } else if (projects.length === 0) {
        content = (
            <div className="flex flex-col items-center justify-center h-full w-full p-4 text-center">
                <p className="text-lg font-semibold text-foreground mb-2">
                    To get started, sync your first project to Octoprompt.
                </p>
                <Button onClick={handleOpenNewProjectForm} size="lg" className="px-6 py-3 text-base mt-4">
                    + Add Project
                </Button>
            </div>
        );
    } else if (noTabsYet) {
        // This state is reached if:
        // 1. More than one project exists, and no tabs are open.
        // 2. A single project exists, is selected (by the effect), but tab creation is pending or needs manual trigger.
        // NoTabsYetView will guide the user:
        // - If selectedProjectId is set (e.g., by the effect), it prompts to create a tab for it.
        // - If selectedProjectId is not set (multiple projects scenario), it allows opening project modal.
        content = (
            <NoTabsYetView
                projects={projects}
                selectedProjectId={selectedProjectId}
                createProjectTab={async ({ name, projectId }) => {
                    // Call the renamed hook function and wrap its string result in a promise
                    const result = createProjectTabFromHook({ displayName: name, selectedProjectId: projectId });
                    return Promise.resolve(result); // Satisfies Promise<any>
                }}
                openProjectModal={() => setProjectModalOpen(true)}
            />
        );
    } else if (!selectedProjectId) {
        // Projects exist, and tabs exist (noTabsYet is false), but no project is actively selected.
        content = (
            <div className="p-4 text-center"> {/* Added text-center for button alignment */}
                <ProjectsTabManager />
                <p className="mt-4 text-muted-foreground">
                    Please select a project by opening a tab or creating a new one.
                </p>
                <Button variant="outline" onClick={() => setProjectModalOpen(true)} className="mt-4">
                    Open Project Selector
                </Button>
            </div>
        );
    } else {
        // Projects exist, tabs exist, and a project is selected.
        content = (
            <div className="flex flex-col h-full w-full overflow-hidden">
                <div className="flex-none">
                    <ProjectsTabManager />
                </div>
                <MainProjectsLayout
                    filePanelRef={filePanelRef as React.RefObject<FilePanelRef>}
                    promptPanelRef={promptPanelRef as React.RefObject<PromptOverviewPanelRef>}
                />
            </div>
        );
    }

    return (
        <>
            {content}

            {/* Common Dialogs, available in all states if their open state is true */}
            <Dialog open={projectModalOpen} onOpenChange={setProjectModalOpen}>
                <DialogContent className="sm:max-w-[425px]">
                    <DialogHeader>
                        <DialogTitle>Select or Create Project</DialogTitle>
                    </DialogHeader>
                    <div className="mt-4">
                        <ProjectList
                            loading={projectsLoading && projects.length === 0} // Show loading only if it's the initial load for an empty list
                            projects={projects}
                            selectedProjectId={selectedProjectId ?? null}
                            onSelectProject={handleSelectProject}
                            onEditProject={handleEditProjectForm}
                            onDeleteProject={handleDeleteProject}
                            onCreateProject={handleOpenNewProjectForm}
                        />
                    </div>
                </DialogContent>
            </Dialog>

            <ProjectDialog
                open={projectFormOpen}
                projectId={editingProjectId}
                onOpenChange={setProjectFormOpen}
            />
        </>
    );
}


export const Route = createFileRoute('/projects')({
    component: ProjectsPage,
})

type MainProjectsLayoutProps = {
    filePanelRef: React.RefObject<FilePanelRef>
    promptPanelRef: React.RefObject<PromptOverviewPanelRef>
}

function MainProjectsLayout({
    filePanelRef,
    promptPanelRef,
}: MainProjectsLayoutProps) {

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


        </div>
    )
}

type NoTabsYetViewProps = {
    projects: ProjectResponse['data'][]
    selectedProjectId?: string | null
    createProjectTab: (args: { projectId?: string; name?: string }) => Promise<any>
    openProjectModal: () => void
}

function NoTabsYetView({ projects, selectedProjectId, createProjectTab, openProjectModal }: NoTabsYetViewProps) {
    // This component is shown when projects.length > 0 but noTabsYet is true.
    // The `projects.length === 0` case is handled before this component is rendered.

    let projectForButton: ProjectResponse['data'] | undefined;
    if (selectedProjectId) {
        projectForButton = projects.find(p => p.id === selectedProjectId);
    } else if (projects.length > 0) {
        // If no project is selected yet (e.g. multiple projects exist),
        // don't pick one arbitrarily for tab creation.
        // The user should be prompted to select one via openProjectModal.
    }


    return (
        <div className="p-4">
            <ProjectsTabManager />
            <div className="mt-4 flex flex-col items-start gap-3">
                <p className="text-sm text-muted-foreground">
                    Welcome! You need a tab to start working with your projects.
                </p>
                {projectForButton ? (
                    <Button onClick={() => createProjectTab({ projectId: projectForButton!.id, name: projectForButton!.name || `Tab for ${projectForButton!.id.substring(0, 6)}` })}>
                        + Create Tab for "{projectForButton!.name}"
                    </Button>
                ) : (
                    // If no specific project is selected to create a tab for, prompt to open/select one.
                    // This happens if there are multiple projects and none is yet `selectedProjectId`.
                    <Button onClick={openProjectModal}>
                        Select a Project to Create a Tab
                    </Button>
                )}
                {/* Fallback if projects exist but no project could be determined for button, though less likely with above logic */}
                {!projectForButton && projects.length > 0 && !selectedProjectId && (
                    <p className="text-sm text-muted-foreground mt-2">
                        Or, choose an existing project to get started.
                    </p>
                )}
            </div>
        </div>
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