import { createFileRoute } from '@tanstack/react-router'
import { useState, useEffect, useMemo, useRef } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useGetProjects, useGetProjectFiles } from '@/hooks/api/use-projects-api'
import { useGetProjectPrompts } from '@/hooks/api/use-prompts-api'
import { FileViewerDialog } from '@/components/navigation/file-viewer-dialog'
import { PromptOverviewPanel, type PromptOverviewPanelRef } from '@/components/projects/prompt-overview-panel'
import { FilePanel, type FilePanelRef } from '@/components/projects/file-panel'
import { projectSchema } from '@/components/projects/utils/projects-utils'
import { ProjectFile } from 'shared/schema'
import { useHotkeys } from 'react-hotkeys-hook'
import { ProjectsTabManager } from '@/components/tab-managers/projects-tab-manager'
import { Button } from '@/components/ui/button'
import { useSelectedFiles } from '@/hooks/utility-hooks/use-selected-files'
import { useCreateProjectTab, useGlobalStateCore, useUpdateActiveProjectTabStateKey } from '@/components/global-state/global-helper-hooks'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog'
import { InfoTooltip } from '@/components/info-tooltip'
import { useActiveProjectTab, useProjectTabs } from '@/components/global-state/global-websocket-selectors'

export const Route = createFileRoute('/projects')({
    component: ProjectsPage,
})

function ProjectsPage() {
    const filePanelRef = useRef<FilePanelRef>(null)
    const promptPanelRef = useRef<PromptOverviewPanelRef>(null)

    const tabs = useProjectTabs()

    // new way pulling from the query cahce for the project tabs
    const { tabData: activeTabState, id: projectActiveTabId } = useActiveProjectTab()
    const selectedProjectId = activeTabState?.selectedProjectId ?? null

    const createNewTab = useCreateProjectTab()
    const updateActiveTabStateKey = useUpdateActiveProjectTabStateKey()

    const fileSearch = activeTabState?.fileSearch ?? ''
    const searchByContent = activeTabState?.searchByContent ?? false

    // Single source of truth for selected files state
    const selectedFilesState = useSelectedFiles()

    // Query all projects
    const { data: projects } = useGetProjects()

    // Check for "no tabs" scenario
    const noTabsYet = Object.keys(tabs ?? {}).length === 0

    const setFileSearch = (value: string) => {
        updateActiveTabStateKey('fileSearch', value)
    }
    const setSearchByContent = (value: boolean) => {
        updateActiveTabStateKey('searchByContent', value)
    }

    const [viewedFile, setViewedFile] = useState<ProjectFile | null>(null)

    const { data: fileData } = useGetProjectFiles(selectedProjectId ?? '')
    const { data: promptData } = useGetProjectPrompts(selectedProjectId ?? '')
    // Check if we're on the default tab with no project selected
    const isDefaultTab = projectActiveTabId === 'defaultTab'
    const isFirstVisit = isDefaultTab && !selectedProjectId
    const [showWelcomeDialog, setShowWelcomeDialog] = useState(true)


    const projectForm = useForm<z.infer<typeof projectSchema>>({
        resolver: zodResolver(projectSchema),
        defaultValues: {
            name: '',
            description: '',
            path: '',
        },
    })
    useEffect(() => {
        if (!activeTabState) return
        if (!activeTabState.selectedProjectId && projects?.projects?.length) {
            updateActiveTabStateKey('selectedProjectId', projects.projects[0].id)
        }
    }, [activeTabState, projects, updateActiveTabStateKey])

    // Load the project form whenever selectedProjectId changes
    useEffect(() => {
        if (projects?.projects) {
            const project = projects.projects.find(p => p.id === selectedProjectId)
            if (project) {
                projectForm.setValue('name', project.name)
                projectForm.setValue('description', project?.description ?? '')
                projectForm.setValue('path', project.path)
            } else {
                projectForm.reset()
            }
        }
    }, [selectedProjectId, projects?.projects, projectForm])

    // CMD+S for focusing the file search
    useHotkeys('mod+s', (e) => {
        e.preventDefault()
        filePanelRef.current?.focusSearch()
    }, [])

    // CMD+I for focusing the prompt input
    useHotkeys('mod+i', (e) => {
        e.preventDefault()
        promptPanelRef.current?.focusPrompt()
    }, [])

    const fileMap = useMemo(() => {
        const map = new Map<string, ProjectFile>()
        if (fileData?.files) {
            fileData.files.forEach(f => map.set(f.id, f))
        }
        return map
    }, [fileData?.files])

    const projectData = projects?.projects.find(p => p.id === selectedProjectId)
    const closeFileViewer = () => {
        setViewedFile(null)
    }

    // If the user has no tabs at all, show a more helpful message
    if (noTabsYet) {
        return (
            <div className="p-4">
                <ProjectsTabManager />
                <div className="mt-4 flex flex-col items-start gap-3">
                    {projects?.projects && projects.projects.length > 0 ? (
                        <>
                            <p className="text-sm text-muted-foreground">
                                We see you have at least one project, but no tabs created yet.
                                Create a new tab to start exploring your project!
                            </p>
                            <Button onClick={() => createNewTab({ projectId: projects.projects[0].id })}>
                                + Create a Tab
                            </Button>
                        </>
                    ) : (
                        <>
                            <p className="text-sm text-muted-foreground">
                                Looks like you haven't created any projects yet.
                                Click below to create a new project or import one.
                            </p>
                            {/* Replace with your "create project" logic as needed */}
                            <Button onClick={() => /* handleCreateProject() */ console.log('create project')}>
                                + Create a Project
                            </Button>
                        </>
                    )}
                </div>
            </div>
        )
    }

    // If there are tabs, but no active tab is selected, show a prompt
    if (!activeTabState) {
        return (
            <div className="p-4">
                <ProjectsTabManager />
                <p className="text-sm text-muted-foreground">
                    No active tab selected. Create or select a tab above.
                </p>
            </div>
        )
    }

    return (
        <div className="flex-col h-full w-full overflow-hidden flex">
            <ProjectsTabManager />

            <div className='flex-1 flex flex-row overflow-hidden'>
                {/* Always show FilePanel, even in default state */}
                <FilePanel
                    ref={filePanelRef}
                    selectedProjectId={selectedProjectId}
                    projectData={projectData || null}
                    fileSearch={fileSearch}
                    setFileSearch={setFileSearch}
                    searchByContent={searchByContent}
                    setSearchByContent={setSearchByContent}
                    className="w-3/5"
                    onNavigateToPrompts={() => promptPanelRef.current?.focusPrompt()}
                    selectedFilesState={selectedFilesState}
                />

                {/* Always show PromptOverviewPanel, even in default state */}
                <PromptOverviewPanel
                    ref={promptPanelRef}
                    selectedProjectId={selectedProjectId ?? ''}
                    fileMap={fileMap}
                    promptData={promptData}
                    className="w-2/5"
                    selectedFilesState={selectedFilesState}
                />

                {/* Welcome Dialog */}
                {isFirstVisit && (
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
                                    onClick={() => {
                                        setShowWelcomeDialog(false)
                                    }}
                                >
                                    Got it
                                </Button>
                            </DialogFooter>
                        </DialogContent>
                    </Dialog>
                )}
            </div>

            <FileViewerDialog
                open={!!viewedFile}
                viewedFile={viewedFile}
                onClose={closeFileViewer}
            />
        </div>
    )
}

export default ProjectsPage