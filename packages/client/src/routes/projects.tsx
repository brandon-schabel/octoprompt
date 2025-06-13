import { createFileRoute, redirect, useNavigate, useParams } from '@tanstack/react-router'
import { useRef, useState, useEffect } from 'react'
import { Button } from '@ui'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@ui'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { useGetProjects, useDeleteProject, useGetProject } from '@/hooks/api/use-projects-api'
import { PromptOverviewPanel, type PromptOverviewPanelRef } from '@/components/projects/prompt-overview-panel'
import { FilePanel, type FilePanelRef } from '@/components/projects/file-panel/file-panel'
import { ProjectsTabManager } from '@/components/projects-tab-manager'
import { ResizablePanel } from '@ui'
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
import { ProjectSummarizationSettingsPage } from '@/routes/project-summarization'
import { ProjectSettingsDialog } from '@/components/projects/project-settings-dialog'
import { ErrorBoundary } from '@/components/error-boundary/error-boundary'
import { ClaudeCodeCard } from '@/components/claude-code/claude-code-card'
import { ClaudeCodeFab } from '@/components/claude-code/claude-code-fab'

export function ProjectsPage() {
  const filePanelRef = useRef<FilePanelRef>(null)
  const promptPanelRef = useRef<PromptOverviewPanelRef>(null)
  const navigate = useNavigate()
  const params = useParams({ from: '/projects/$tabId/$projectId' })
  const [activeProjectTabState] = useActiveProjectTab()
  const pathname = window.location.pathname

  // Use URL params if available, otherwise fall back to localStorage
  const selectedProjectId = params?.projectId ? parseInt(params.projectId) : activeProjectTabState?.selectedProjectId
  const activeTabId = params?.tabId ? parseInt(params.tabId) : activeProjectTabState?.id

  // Sync URL params with localStorage when they change
  useEffect(() => {
    if (params?.tabId && params?.projectId) {
      const urlTabId = parseInt(params.tabId)
      const urlProjectId = parseInt(params.projectId)
      
      // Set active tab if different from URL
      if (activeProjectTabState?.id !== urlTabId) {
        setActiveProjectTabId(urlTabId)
      }
      
      // Update tab's selected project if different from URL
      if (tabs?.[urlTabId] && tabs[urlTabId].selectedProjectId !== urlProjectId) {
        updateProjectTabs({
          ...tabs,
          [urlTabId]: { ...tabs[urlTabId], selectedProjectId: urlProjectId }
        })
      }
    }
  }, [params?.tabId, params?.projectId, activeProjectTabState?.id, tabs, setActiveProjectTabId, updateProjectTabs])
  const { data: projectResponse } = useGetProject(selectedProjectId!)
  const projectData = projectResponse?.data

  const { data: allProjectsData, isLoading: projectsLoading } = useGetProjects()
  const [tabs] = useGetProjectTabs()
  const { createProjectTab: createProjectTabFromHook } = useCreateProjectTab()
  const updateActiveProjectTab = useUpdateActiveProjectTab()
  const { mutate: deleteProjectMutate } = useDeleteProject()
  
  // Redirect from /projects to a specific tab/project if available
  useEffect(() => {
    if (pathname === '/projects' && !params?.tabId && !params?.projectId) {
      // If we have an active tab with a project, navigate to it
      if (activeProjectTabState?.id && activeProjectTabState?.selectedProjectId) {
        navigate({ 
          to: '/projects/$tabId/$projectId', 
          params: { 
            tabId: activeProjectTabState.id.toString(), 
            projectId: activeProjectTabState.selectedProjectId.toString() 
          },
          replace: true
        })
      } else if (tabs && Object.keys(tabs).length > 0) {
        // Find first tab with a project
        const firstTabWithProject = Object.entries(tabs).find(([_, tab]) => tab.selectedProjectId)
        if (firstTabWithProject) {
          const [tabId, tab] = firstTabWithProject
          navigate({ 
            to: '/projects/$tabId/$projectId', 
            params: { 
              tabId: tabId, 
              projectId: tab.selectedProjectId!.toString() 
            },
            replace: true
          })
        }
      }
    }
  }, [pathname, params, activeProjectTabState, tabs, navigate])

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
      const newTabId = createProjectTabFromHook({
        displayName: projects[0].name || `Tab for ${projects[0].id.toString().substring(0, 6)}`,
        selectedProjectId: projects[0].id
      })
      // Navigate to the new tab/project
      navigate({ 
        to: '/projects/$tabId/$projectId', 
        params: { 
          tabId: newTabId.toString(), 
          projectId: projects[0].id.toString() 
        } 
      })
    }
    if (!selectedProjectId && projects.length === 1 && tabsLen === 1) {
      // Navigate to the existing tab/project
      navigate({ 
        to: '/projects/$tabId/$projectId', 
        params: { 
          tabId: tabsKeys[0], 
          projectId: projects[0].id.toString() 
        } 
      })
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
    tabsLen,
    navigate
  ])

  const handleSelectProject = (id: number) => {
    // If there are no tabs, create one for the selected project
    if (noTabsYet) {
      const selectedProject = projects.find((p) => p.id === id)
      const newTabId = createProjectTabFromHook({
        displayName: selectedProject?.name || `Tab for ${id.toString().substring(0, 6)}`,
        selectedProjectId: id
      })
      // Navigate to the new tab/project URL
      navigate({ to: '/projects/$tabId/$projectId', params: { tabId: newTabId.toString(), projectId: id.toString() } })
    } else {
      // Navigate to the selected project with current tab
      const currentTabId = activeTabId || Object.keys(tabs || {})[0]
      if (currentTabId) {
        navigate({ to: '/projects/$tabId/$projectId', params: { tabId: currentTabId.toString(), projectId: id.toString() } })
      }
    }
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
          <div className='flex-none px-4 py-2 border-b dark:border-slate-700 flex items-center'>
            {projectData && (
              <h2 className='text-lg font-semibold whitespace-nowrap mr-4' title={projectData.name}>
                {projectData.name}
              </h2>
            )}

            <div className='flex w-full justify-center items-center'>
              <TabsList>
                <TabsTrigger value='context'>Context</TabsTrigger>
                <TabsTrigger value='stats'>Statistics</TabsTrigger>
                <TabsTrigger value='summarization'>Summarization</TabsTrigger>
                <TabsTrigger value='claude-code'>Claude Code</TabsTrigger>
              </TabsList>
            </div>
            <div className='ml-auto'>
              <ProjectSettingsDialog />
            </div>
          </div>

          <TabsContent value='context' className='flex-1 overflow-y-auto mt-0 ring-0 focus-visible:ring-0'>
            <MainProjectsLayout
              projectData={projectData}
              filePanelRef={filePanelRef as React.RefObject<FilePanelRef>}
              promptPanelRef={promptPanelRef as React.RefObject<PromptOverviewPanelRef>}
            />
          </TabsContent>

          <TabsContent value='stats' className='flex-1 overflow-y-auto p-4 md:p-6 mt-0 ring-0 focus-visible:ring-0'>
            {selectedProjectId ? (
              <ProjectStatsDisplay projectId={selectedProjectId} />
            ) : (
              <p>No project selected for stats.</p>
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
          <TabsContent
            value='claude-code'
            className='flex-1 overflow-y-auto p-4 md:p-6 mt-0 ring-0 focus-visible:ring-0'
          >
            {selectedProjectId && projectData ? (
              <div className='max-w-2xl mx-auto'>
                <h3 className='text-lg font-semibold mb-4'>Claude Code for {projectData.name}</h3>
                <ClaudeCodeCard
                  projectPath={projectData.folderPath}
                  projectName={projectData.name}
                  projectId={selectedProjectId}
                  className='w-full'
                />
              </div>
            ) : (
              <p>No project selected for Claude Code.</p>
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

        {/* Floating Claude Code button - only show when a project is selected */}
        {selectedProjectId && <ClaudeCodeFab projectId={selectedProjectId} />}
      </>
    </ErrorBoundary>
  )
}

export const Route = createFileRoute('/projects')({ 
  component: ProjectsPage
})

type MainProjectsLayoutProps = {
  projectData: ProjectResponse['data'] | undefined
  filePanelRef: React.RefObject<FilePanelRef>
  promptPanelRef: React.RefObject<PromptOverviewPanelRef>
}

function MainProjectsLayout({ projectData, filePanelRef, promptPanelRef }: MainProjectsLayoutProps) {
  return (
    <ErrorBoundary>
      <div className='flex-1 min-h-0 overflow-hidden h-full flex flex-col'>
        <ResizablePanel
          leftPanel={<FilePanel ref={filePanelRef} className='h-full w-full' />}
          rightPanel={<PromptOverviewPanel ref={promptPanelRef} className='h-full w-full' />}
          initialLeftPanelWidth={40}
          minLeftPanelWidth={100}
          storageKey='projects-panel-width'
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
