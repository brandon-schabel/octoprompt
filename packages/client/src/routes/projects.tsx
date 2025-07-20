import { createFileRoute } from '@tanstack/react-router'
import { useRef, useState, useEffect } from 'react'
import { Button } from '@ui'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@ui'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { useGetProjects, useDeleteProject, useGetProject } from '@/hooks/api/use-projects-api'
import { PromptOverviewPanel, type PromptOverviewPanelRef } from '@/components/projects/prompt-overview-panel'
import { FilePanel, type FilePanelRef } from '@/components/projects/file-panel/file-panel'
import { UserInputPanel, type UserInputPanelRef } from '@/components/projects/user-input-panel'
import { ProjectsTabManager } from '@/components/projects-tab-manager'
import { ThreeColumnResizablePanel } from '@/components/ui/three-column-resizable-panel'
import { ProjectResponse } from '@octoprompt/schemas'
import {
  useActiveProjectTab,
  useGetProjectTabs,
  useUpdateActiveProjectTab,
  useCreateProjectTab,
  useSetKvValue,
  useSetActiveProjectTabId
} from '@/hooks/use-kv-local-storage'
import { ProjectList } from '@/components/projects/project-list'
import { ProjectDialog } from '@/components/projects/project-dialog'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { ProjectStatsDisplay } from '@/components/projects/project-stats-display'
import { ProjectStatsDisplayEnhanced } from '@/components/projects/project-stats-display-enhanced-v2'
import { ProjectSettingsDialog } from '@/components/projects/project-settings-dialog'
import { ErrorBoundary } from '@/components/error-boundary/error-boundary'
import { ProjectSummarizationSettingsPage } from './project-summarization'
import { AgentCoderTabView } from '@/components/projects/agent-coder-tab-view'
import { ProjectAssetsView } from '@/components/projects/project-assets-view'
import { Bot, Code2, Sparkles, GitBranch } from 'lucide-react'
import { ProjectSwitcher } from '@/components/projects/project-switcher'
import { TicketsTabView } from '@/components/tickets/tickets-tab-view'
import { GitTabView } from '@/components/projects/git-tab-view'

export function ProjectsPage() {
  const filePanelRef = useRef<FilePanelRef>(null)
  const promptPanelRef = useRef<PromptOverviewPanelRef>(null)
  const [activeProjectTabState, , activeProjectTabId] = useActiveProjectTab()

  const selectedProjectId = activeProjectTabState?.selectedProjectId
  const { data: projectResponse } = useGetProject(selectedProjectId!)
  const projectData = projectResponse?.data

  const { data: allProjectsData, isLoading: projectsLoading } = useGetProjects()
  const [tabs] = useGetProjectTabs()
  const { createProjectTab: createProjectTabFromHook } = useCreateProjectTab()
  const updateActiveProjectTab = useUpdateActiveProjectTab()
  const { mutate: deleteProjectMutate } = useDeleteProject()

  const [projectModalOpen, setProjectModalOpen] = useState(false)
  const [projectFormOpen, setProjectFormOpen] = useState(false)
  const [editingProjectId, setEditingProjectId] = useState<number | null>(null)

  const projects = allProjectsData?.data || []
  const tabsLen = Object.keys(tabs || {}).length
  const noTabsYet = Object.keys(tabs || {}).length === 0
  const tabsArray = Object.values(tabs || {})
  const tabsKeys = Object.keys(tabs || {})
  const { setActiveProjectTabId } = useSetActiveProjectTabId()
  const { mutate: updateProjectTabs } = useSetKvValue('projectTabs')

  useEffect(() => {
    if (projects.length === 1 && noTabsYet) {
      createProjectTabFromHook({
        displayName: projects[0].name || `Tab for ${projects[0].id.toString().substring(0, 6)}`,
        selectedProjectId: projects[0].id
      })
    }
    if (!selectedProjectId && projects.length === 1 && tabsLen === 1) {
      updateProjectTabs({
        [tabsKeys[0]]: { ...tabsArray[0], selectedProjectId: projects[0].id }
      })
      setActiveProjectTabId(parseInt(tabsKeys[0]))
    }
  }, [
    projects,
    noTabsYet,
    activeProjectTabState,
    selectedProjectId,
    createProjectTabFromHook,
    updateActiveProjectTab,
    tabsKeys,
    tabsArray,
    setActiveProjectTabId,
    tabsLen
  ])

  const handleSelectProject = (id: number) => {
    updateActiveProjectTab((prev) => ({
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
    setProjectModalOpen(false)
  }
  const handleEditProjectForm = (id: number) => {
    setEditingProjectId(id)
    setProjectFormOpen(true)
    setProjectModalOpen(false)
  }
  const handleDeleteProject = (id: number) => {
    deleteProjectMutate(id, {
      onSuccess: () => {
        if (selectedProjectId === id) {
          updateActiveProjectTab((prev) => ({ ...(prev || {}), selectedProjectId: undefined }))
        }
      }
    })
  }
  let content
  if (projectsLoading) {
    content = (
      <div className='flex items-center justify-center h-full w-full'>
        <p>Loading projects...</p>
      </div>
    )
  } else if (projects.length === 0) {
    content = (
      <div className='flex flex-col items-center justify-center h-full w-full p-4 text-center'>
        <p className='text-lg font-semibold text-foreground mb-2'>
          To get started, sync your first project to Octoprompt.
        </p>

        <Tooltip>
          <TooltipTrigger asChild>
            <Button onClick={handleOpenNewProjectForm} size='lg' className='px-6 py-3 text-base mt-4'>
              + Add Project
            </Button>
          </TooltipTrigger>
          <TooltipContent>
            <p>Add your first project to get started.</p>
          </TooltipContent>
        </Tooltip>
      </div>
    )
  } else if (noTabsYet) {
    content = (
      <NoTabsYetView
        projects={projects}
        selectedProjectId={selectedProjectId}
        createProjectTab={async ({ name, projectId }) =>
          Promise.resolve(createProjectTabFromHook({ displayName: name, selectedProjectId: projectId }))
        }
        openProjectModal={() => setProjectModalOpen(true)}
      />
    )
  } else if (!selectedProjectId) {
    content = (
      <div className='p-4 text-center'>
        <ProjectsTabManager />
        <p className='mt-4 text-muted-foreground'>Please select a project by opening a tab or creating a new one.</p>

        <Tooltip>
          <TooltipTrigger asChild>
            <Button variant='outline' onClick={() => setProjectModalOpen(true)} className='mt-4'>
              Open Project Selector
            </Button>
          </TooltipTrigger>
          <TooltipContent>
            <p>Open a dialog to select an existing project or create a new one.</p>
          </TooltipContent>
        </Tooltip>
      </div>
    )
  } else {
    content = (
      <div className='flex flex-col h-full w-full overflow-hidden'>
        <div className='flex-none'>
          <ProjectsTabManager />
        </div>
        <Tabs defaultValue='context' className='flex-1 flex flex-col min-h-0'>
          <div className='flex-none px-4 py-2 border-b dark:border-slate-700 flex items-center justify-between'>
            <ProjectSwitcher
              currentProject={projectData ?? null}
              className='flex-shrink-0'
              onManageProjects={() => setProjectModalOpen(true)}
            />
            <div className='flex-1 flex justify-center'>
              <TabsList>
                <TabsTrigger value='context'>Context</TabsTrigger>
                <TabsTrigger value='stats'>Statistics</TabsTrigger>
                <TabsTrigger value='tickets' className='flex items-center gap-1'>
                  Tickets
                </TabsTrigger>
                <TabsTrigger value='summarization'>Summarization</TabsTrigger>
                {/* <TabsTrigger value='agent-coder' className='flex items-center gap-1'>
                  <Code2 className='h-3.5 w-3.5' />
                  Agent Coder
                </TabsTrigger> */}
                <TabsTrigger value='assets' className='flex items-center gap-1'>
                  Assets
                </TabsTrigger>
                <TabsTrigger value='git' className='flex items-center gap-1'>
                  <GitBranch className='h-3.5 w-3.5' />
                  Git
                </TabsTrigger>
              </TabsList>
            </div>
            <div className='flex-shrink-0'>
              <ProjectSettingsDialog />
            </div>
          </div>

          <TabsContent value='context' className='flex-1 overflow-y-auto mt-0 ring-0 focus-visible:ring-0'>
            <MainProjectsLayout
              filePanelRef={filePanelRef as React.RefObject<FilePanelRef>}
              promptPanelRef={promptPanelRef as React.RefObject<PromptOverviewPanelRef>}
            />
          </TabsContent>

          <TabsContent value='stats' className='flex-1 overflow-y-auto p-4 md:p-6 mt-0 ring-0 focus-visible:ring-0'>
            {selectedProjectId ? (
              <ProjectStatsDisplayEnhanced projectId={selectedProjectId} />
            ) : (
              <p>No project selected for stats.</p>
            )}
          </TabsContent>
          <TabsContent value='tickets' className='flex-1 overflow-y-auto mt-0 ring-0 focus-visible:ring-0'>
            {selectedProjectId && projectData && activeProjectTabId ? (
              <TicketsTabView
                projectId={selectedProjectId}
                projectName={projectData.name}
                projectTabId={activeProjectTabId}
              />
            ) : (
              <p className='p-4 md:p-6'>No project selected for tickets.</p>
            )}
          </TabsContent>
          <TabsContent
            value='summarization'
            className='flex-1 overflow-y-auto p-4 md:p-6 mt-0 ring-0 focus-visible:ring-0'
          >
            {selectedProjectId ? (
              <ProjectSummarizationSettingsPage />
            ) : (
              <p>No project selected for summarization settings.</p>
            )}
          </TabsContent>
          <TabsContent value='agent-coder' className='flex-1 overflow-y-auto mt-0 ring-0 focus-visible:ring-0'>
            {selectedProjectId && projectData && allProjectsData ? (
              <AgentCoderTabView
                project={projectData}
                projectId={selectedProjectId}
                allProjects={allProjectsData.data || []}
              />
            ) : (
              <p className='p-4 md:p-6'>No project selected for Agent Coder.</p>
            )}
          </TabsContent>
          <TabsContent value='assets' className='flex-1 overflow-y-auto mt-0 ring-0 focus-visible:ring-0'>
            {selectedProjectId && projectData ? (
              <ProjectAssetsView project={projectData} projectId={selectedProjectId} />
            ) : (
              <p className='p-4 md:p-6'>No project selected for Assets.</p>
            )}
          </TabsContent>
          <TabsContent value='git' className='flex-1 overflow-y-auto mt-0 ring-0 focus-visible:ring-0'>
            {selectedProjectId ? (
              <GitTabView projectId={selectedProjectId} />
            ) : (
              <p className='p-4 md:p-6'>No project selected for Git.</p>
            )}
          </TabsContent>
        </Tabs>
      </div>
    )
  }

  return (
    <ErrorBoundary>
      <>
        <TooltipProvider>{content}</TooltipProvider>
        <Dialog open={projectModalOpen} onOpenChange={setProjectModalOpen}>
          <DialogContent className='sm:max-w-[425px]'>
            <DialogHeader>
              <DialogTitle>Select or Create Project</DialogTitle>
            </DialogHeader>
            <div className='mt-4'>
              <ProjectList
                loading={projectsLoading && projects.length === 0}
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
        <ProjectDialog open={projectFormOpen} projectId={editingProjectId} onOpenChange={setProjectFormOpen} />
      </>
    </ErrorBoundary>
  )
}

export const Route = createFileRoute('/projects')({ component: ProjectsPage })

type MainProjectsLayoutProps = {
  filePanelRef: React.RefObject<FilePanelRef>
  promptPanelRef: React.RefObject<PromptOverviewPanelRef>
}

function MainProjectsLayout({ filePanelRef, promptPanelRef }: MainProjectsLayoutProps) {
  const userInputRef = useRef<UserInputPanelRef>(null)

  return (
    <ErrorBoundary>
      <div className='flex-1 min-h-0 overflow-hidden h-full flex flex-col'>
        <ThreeColumnResizablePanel
          leftPanel={<FilePanel ref={filePanelRef} className='h-full w-full' />}
          middlePanel={<UserInputPanel ref={userInputRef} className='h-full w-full' />}
          rightPanel={<PromptOverviewPanel ref={promptPanelRef} className='h-full w-full' />}
          initialLeftPanelWidth={25}
          initialRightPanelWidth={35}
          minLeftPanelWidth={200}
          minMiddlePanelWidth={300}
          minRightPanelWidth={250}
          storageKey='projects-three-column'
          className='flex-1 h-full w-full'
        />
      </div>
    </ErrorBoundary>
  )
}

type NoTabsYetViewProps = {
  projects: ProjectResponse['data'][]
  selectedProjectId?: number | null
  createProjectTab: (args: { projectId?: number; name?: string }) => Promise<any>
  openProjectModal: () => void
}

function NoTabsYetView({ projects, selectedProjectId, createProjectTab, openProjectModal }: NoTabsYetViewProps) {
  let projectForButton = selectedProjectId ? projects.find((p) => p.id === selectedProjectId) : undefined
  return (
    <ErrorBoundary>
      <div className='p-4'>
        <ProjectsTabManager />
        <div className='mt-4 flex flex-col items-start gap-3'>
          <p className='text-sm text-muted-foreground'>Welcome! You need a tab to start working with your projects.</p>

          {projectForButton ? (
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  onClick={() =>
                    createProjectTab({
                      projectId: projectForButton!.id,
                      name: projectForButton!.name || `Tab for ${projectForButton!.id.toString()}`
                    })
                  }
                >
                  + Create Tab for "{projectForButton!.name}"
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                <p>Create a new tab for the project: {projectForButton!.name}</p>
              </TooltipContent>
            </Tooltip>
          ) : (
            <Tooltip>
              <TooltipTrigger asChild>
                <Button onClick={openProjectModal}>Select a Project to Create a Tab</Button>
              </TooltipTrigger>
              <TooltipContent>
                <p>Open the project selector to choose a project for a new tab.</p>
              </TooltipContent>
            </Tooltip>
          )}

          {!projectForButton && projects.length > 0 && !selectedProjectId && (
            <p className='text-sm text-muted-foreground mt-2'>Or, choose an existing project to get started.</p>
          )}
        </div>
      </div>
    </ErrorBoundary>
  )
}

// WelcomeDialog is not used in this snippet but kept for completeness if it exists in the original file.
// type WelcomeDialogProps = { showWelcomeDialog: boolean; setShowWelcomeDialog: (open: boolean) => void }
// function WelcomeDialog({ showWelcomeDialog, setShowWelcomeDialog }: WelcomeDialogProps) { /* ... */ }
