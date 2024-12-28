import { createFileRoute } from '@tanstack/react-router'
import { useState, useEffect, useMemo, useRef } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useGetProjects, useGetProjectFiles } from '@/hooks/api/use-projects-api'
import { useGetProjectPrompts } from '@/hooks/api/use-prompts-api'
import { FileViewerDialog } from '@/components/file-viewer-dialog'
import { PromptOverviewPanel, type PromptOverviewPanelRef } from '@/components/projects/prompt-overview-panel'
import { FilePanel, type FilePanelRef } from '@/components/projects/file-panel'
import { projectSchema } from '@/components/projects/utils/projects-utils'
import { ProjectFile } from 'shared/schema'
import { useHotkeys } from 'react-hotkeys-hook'
import { ProjectsTabManager } from '@/components/tab-managers/projects-tab-manager'
import { Button } from '@/components/ui/button'
import { useGlobalStateContext } from '@/components/global-state-context'
import { useEditFile } from '@/hooks/api/use-code-editor-api'
import { toast } from 'sonner'
import { useSelectedFiles } from '@/hooks/use-selected-files'

export const Route = createFileRoute('/projects')({
    component: ProjectsPage,
})

function ProjectsPage() {
    const filePanelRef = useRef<FilePanelRef>(null)
    const promptPanelRef = useRef<PromptOverviewPanelRef>(null)


    // Access global tab state + helpers
    const {
        state,
        activeProjectTabState: activeTabState,
        createProjectTab: createNewTab,
        wsReady,                      // track readiness
        updateActiveProjectTabStateKey: updateActiveTabStateKey,
    } = useGlobalStateContext()
    const [aiPrompt, setAiPrompt] = useState('')
    const aiCodeEditMutation = useEditFile()

    // Otherwise, proceed with your normal code below

    const selectedProjectId = activeTabState?.selectedProjectId ?? null
    const fileSearch = activeTabState?.fileSearch ?? ''
    const searchByContent = activeTabState?.searchByContent ?? false
    const selectedProvider = 'openai'
    const { selectedFiles } = useSelectedFiles()
    // Query all projects
    const { data: projects } = useGetProjects()



    // Check for “no tabs” scenario
    const noTabsYet = Object.keys(state?.projectTabs ?? {}).length === 0


    const handleApplyFixes = async () => {
        if (!selectedProjectId) {
            toast.error('No project selected!')
            return
        }
        if (selectedFiles.length === 0) {
            toast.error('No files selected!')
            return
        }
        if (!aiPrompt.trim()) {
            toast.error('Enter an AI prompt describing your desired code changes.')
            return
        }

        try {
            const result = await aiCodeEditMutation.mutateAsync({
                projectId: selectedProjectId,
                // fileIds: selectedFiles,
                // userPrompt: aiPrompt,
                provider: selectedProvider,
                // options: { model: 'gpt-4o', temperature: 0.7 },
                instructions: aiPrompt,
                fileId: selectedFiles[0],
            })

            // After success, show a success message or handle updated files
            // toast.success(`AI Edits Applied: ${result.explanation}`)
            toast.success(`AI Edits Applied`)
            // e.g. re-fetch project files or show them in the UI
        } catch (err: any) {
            toast.error(`Failed to apply AI fixes: ${err.message}`)
        }
    }

    const setFileSearch = (value: string) => {
        updateActiveTabStateKey('fileSearch', value)
    }
    const setSearchByContent = (value: boolean) => {
        updateActiveTabStateKey('searchByContent', value)
    }

    const [viewedFile, setViewedFile] = useState<ProjectFile | null>(null)

    const { data: fileData } = useGetProjectFiles(selectedProjectId ?? '')
    const { data: promptData } = useGetProjectPrompts(selectedProjectId ?? '')

    const projectForm = useForm<z.infer<typeof projectSchema>>({
        resolver: zodResolver(projectSchema),
        defaultValues: {
            name: '',
            description: '',
            path: '',
        },
    })
    useEffect(() => {
        if (!wsReady) return // skip if WebSocket not ready
        if (!activeTabState) return
        if (!activeTabState.selectedProjectId && projects?.projects?.length) {
            updateActiveTabStateKey('selectedProjectId', projects.projects[0].id)
        }
    }, [wsReady, activeTabState, projects, updateActiveTabStateKey])

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
                            <Button onClick={() => createNewTab()}>
                                + Create a Tab
                            </Button>
                        </>
                    ) : (
                        <>
                            <p className="text-sm text-muted-foreground">
                                Looks like you haven’t created any projects yet.
                                Click below to create a new project or import one.
                            </p>
                            {/* Replace with your “create project” logic as needed */}
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
        <div className="flex-col h-full w-full overflow-hidden flex bg-secondary">
            <ProjectsTabManager />

            <div className='flex-1 flex flex-row overflow-hidden'>
                {projectData && selectedProjectId && (
                    <FilePanel
                        ref={filePanelRef}
                        selectedProjectId={selectedProjectId}
                        projectData={projectData}
                        fileSearch={fileSearch}
                        setFileSearch={setFileSearch}
                        searchByContent={searchByContent}
                        setSearchByContent={setSearchByContent}
                        className="w-2/3"
                        onNavigateToPrompts={() => promptPanelRef.current?.focusPrompt()}
                    />
                )}

                {selectedProjectId && promptData && (
                    <PromptOverviewPanel
                        ref={promptPanelRef}
                        selectedProjectId={selectedProjectId}
                        fileMap={fileMap}
                        promptData={promptData}
                        className="w-1/3"
                    />
                )}
            </div>

            <FileViewerDialog
                open={!!viewedFile}
                viewedFile={viewedFile}
                onClose={closeFileViewer}
            />
            {/* <div className="space-y-2">
                <Label className="text-sm font-medium">Describe your fix/feature:</Label>
                <Textarea
                    className="block w-full border rounded p-2"
                    rows={4}
                    value={aiPrompt}
                    onChange={(e) => setAiPrompt(e.target.value)}
                    placeholder="Explain your desired code changes..."
                />

                <Button
                    disabled={aiCodeEditMutation.isPending}
                    onClick={handleApplyFixes}
                >
                    {aiCodeEditMutation.isPending ? 'Applying Fixes...' : 'Apply AI Fixes'}
                </Button>
            </div> */}
        </div>
    )
}

export default ProjectsPage