import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { zodValidator } from '@tanstack/zod-adapter'
import { projectsSearchSchema, type ProjectsSearch, type ProjectView } from '@/lib/search-schemas'
import { useRef, useState, useEffect } from 'react'
import { Button } from '@ui'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@ui'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { useGetProjects, useDeleteProject, useGetProject } from '@/hooks/api/use-projects-api'
import { PromptOverviewPanel, type PromptOverviewPanelRef } from '@/components/projects/prompt-overview-panel'
import { FilePanel, type FilePanelRef } from '@/components/projects/file-panel/file-panel'
import { UserInputPanel, type UserInputPanelRef } from '@/components/projects/user-input-panel'
import { ProjectsTabManager } from '@/components/projects-tab-manager'
import { DraggableThreeColumnPanel, type PanelConfig } from '@/components/ui/draggable-three-column-panel'
import { ProjectResponse } from '@promptliano/schemas'
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
import { Tabs, TabsContent } from '@/components/ui/tabs'
import { ErrorBoundary } from '@/components/error-boundary/error-boundary'
import { AssetsTabWithSidebar } from '@/components/assets/assets-tab-with-sidebar'
import { ProjectSwitcher } from '@/components/projects/project-switcher'
import { TicketsTabWithSidebar } from '@/components/tickets/tickets-tab-with-sidebar'
import { GitTabWithSidebar } from '@/components/projects/git-tab-with-sidebar'
import { useActiveTabSync } from '@/hooks/utility-hooks/use-active-tab-sync'
import { ClaudeCodeTabWithSidebar } from '@/components/claude-code'
import { EmptyProjectTabsView } from '@/components/projects/empty-project-tabs-view'
import { ManageTabWithSidebar } from '@/components/projects/manage-tab-with-sidebar'
import { ProjectNavigationMenu } from '@/components/projects/project-navigation-menu'
import { migrateUrlParams, needsUrlMigration, getMigrationMessage } from '@/lib/tab-migration'
import { toast } from 'sonner'

export function ProjectsPage() {
  const filePanelRef = useRef<FilePanelRef>(null)
  const promptPanelRef = useRef<PromptOverviewPanelRef>(null)
  const navigate = useNavigate()
  const search = Route.useSearch()
  const [activeProjectTabState, , activeProjectTabId] = useActiveProjectTab()
  const [hasMigrationNotified, setHasMigrationNotified] = useState(false)

  const selectedProjectId = activeProjectTabState?.selectedProjectId
  const { data: projectResponse } = useGetProject(selectedProjectId!)
  const projectData = projectResponse?.data

  // Sync active tab with backend
  useActiveTabSync(selectedProjectId)
  
  // Clear section parameter after navigation
  useEffect(() => {
    if (search.section) {
      // Clear section parameter after a delay to allow scrolling
      const timer = setTimeout(() => {
        navigate({
          to: '/projects',
          search: (prev) => {
            const { section, ...rest } = prev
            return rest
          },
          replace: true
        })
      }, 500)
      return () => clearTimeout(timer)
    }
  }, [search.section, navigate])

  const { data: allProjectsData, isLoading: projectsLoading } = useGetProjects()
  const [tabs] = useGetProjectTabs()
  const { createProjectTab: createProjectTabFromHook } = useCreateProjectTab()
  const updateActiveProjectTab = useUpdateActiveProjectTab()
  const { mutate: deleteProjectMutate } = useDeleteProject()
  const { setActiveProjectTabId } = useSetActiveProjectTabId()

  const [projectModalOpen, setProjectModalOpen] = useState(false)
  const [projectFormOpen, setProjectFormOpen] = useState(false)
  const [editingProjectId, setEditingProjectId] = useState<number | null>(null)
  const [hasInitializedFromUrl, setHasInitializedFromUrl] = useState(false)

  const projects = allProjectsData?.data || []
  // Filter out non-numeric tab IDs (like 'defaultTab')
  const validTabKeys = Object.keys(tabs || {}).filter((key) => !isNaN(Number(key)))
  const tabsLen = validTabKeys.length
  const noTabsYet = validTabKeys.length === 0
  const tabsArray = validTabKeys.map((key) => tabs[key])
  const tabsKeys = validTabKeys
  const { mutate: updateProjectTabs } = useSetKvValue('projectTabs')

  // Sync tab from URL on initial load
  useEffect(() => {
    if (!hasInitializedFromUrl && tabs) {
      if (search.tab) {
        const tabIdNum = parseInt(search.tab)
        // Only set if it's a valid tab that exists
        if (!isNaN(tabIdNum) && tabs[tabIdNum]) {
          setActiveProjectTabId(tabIdNum)
        } else if (activeProjectTabId && tabs[activeProjectTabId]) {
          // If URL tab is invalid but we have a valid active tab, update URL to match
          navigate({
            to: '/projects',
            search: (prev) => ({ ...prev, tab: activeProjectTabId.toString() }),
            replace: true
          })
        }
      } else if (activeProjectTabId && tabs[activeProjectTabId]) {
        // If no tab in URL but we have an active tab, add it to URL
        navigate({
          to: '/projects',
          search: (prev) => ({ ...prev, tab: activeProjectTabId.toString() }),
          replace: true
        })
      }
      setHasInitializedFromUrl(true)
    }
  }, [search.tab, tabs, hasInitializedFromUrl, setActiveProjectTabId, activeProjectTabId, navigate])

  // Update URL when active tab changes (but not on initial load)
  useEffect(() => {
    if (hasInitializedFromUrl && activeProjectTabId !== undefined && activeProjectTabId !== null) {
      const currentUrlTabId = search.tab ? parseInt(search.tab) : undefined
      if (currentUrlTabId !== activeProjectTabId) {
        navigate({
          to: '/projects',
          search: (prev) => ({ ...prev, tab: activeProjectTabId.toString() }),
          replace: true
        })
      }
    }
  }, [activeProjectTabId, hasInitializedFromUrl, navigate, search.tab])

  // Handle URL migration for old tab structure
  useEffect(() => {
    if (needsUrlMigration(search)) {
      const migratedParams = migrateUrlParams(search)
      if (migratedParams) {
        // Show migration notification once
        if (!hasMigrationNotified && search.activeView) {
          const message = getMigrationMessage(search.activeView)
          if (message) {
            toast.info(message, {
              duration: 5000,
              id: 'tab-migration-notice'
            })
            setHasMigrationNotified(true)
          }
        }
        
        // Redirect to new URL structure
        navigate({
          to: '/projects',
          search: migratedParams,
          replace: true
        })
      }
    }
  }, [search, navigate, hasMigrationNotified])

  const handleSelectProject = async (id: number) => {
    // If no tabs exist, create a new tab first
    if (noTabsYet) {
      const project = projects.find((p) => p.id === id)
      const newTabId = createProjectTabFromHook({
        displayName: project?.name || `Tab ${Date.now().toString().slice(-4)}`,
        selectedProjectId: id,
        selectedFiles: [],
        selectedPrompts: []
      })
      setActiveProjectTabId(newTabId)
    } else {
      // Update existing tab
      updateActiveProjectTab((prev) => ({
        ...(prev || {}),
        selectedProjectId: id,
        selectedFiles: [],
        selectedPrompts: []
      }))
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
          To get started, sync your first project to Promptliano.
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
      <EmptyProjectTabsView
        onOpenProjectInTab={() => {
          setProjectModalOpen(true)
        }}
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
        <div className='flex-none px-4 py-1 border-b dark:border-slate-700 grid grid-cols-3 items-center'>
          <div className='justify-self-start'>
            <ProjectNavigationMenu 
              currentSearch={search}
              activeView={search.activeView || 'context'}
              onViewChange={(value) => {
                // Ensure the value is valid before navigating
                const validValue = value as ProjectView
                const newSearch: any = { ...search, activeView: validValue }
                
                // If navigating to manage tab, ensure we have a default manageView
                if (validValue === 'manage' && !search.manageView) {
                  newSearch.manageView = 'statistics'
                }
                
                navigate({
                  to: '/projects',
                  search: newSearch,
                  replace: true
                })
              }}
              claudeCodeEnabled={activeProjectTabState?.claudeCodeEnabled}
              showTabs={false}
              showMenus={true}
            />
          </div>
          <div className='justify-self-center'>
            <ProjectNavigationMenu 
              currentSearch={search}
              activeView={search.activeView || 'context'}
              onViewChange={(value) => {
                // Ensure the value is valid before navigating
                const validValue = value as ProjectView
                const newSearch: any = { ...search, activeView: validValue }
                
                // If navigating to manage tab, ensure we have a default manageView
                if (validValue === 'manage' && !search.manageView) {
                  newSearch.manageView = 'statistics'
                }
                
                navigate({
                  to: '/projects',
                  search: newSearch,
                  replace: true
                })
              }}
              claudeCodeEnabled={activeProjectTabState?.claudeCodeEnabled}
              showTabs={true}
              showMenus={false}
            />
          </div>
          <div className='justify-self-end'>
            <ProjectSwitcher
              currentProject={projectData ?? null}
              onManageProjects={() => setProjectModalOpen(true)}
            />
          </div>
        </div>
        <Tabs
          value={search.activeView || 'context'}
          className='flex-1 flex flex-col min-h-0'
        >

          <TabsContent value='context' className='flex-1 overflow-y-auto mt-0 ring-0 focus-visible:ring-0'>
            <MainProjectsLayout
              filePanelRef={filePanelRef as React.RefObject<FilePanelRef>}
              promptPanelRef={promptPanelRef as React.RefObject<PromptOverviewPanelRef>}
            />
          </TabsContent>

          <TabsContent value='tickets' className='flex-1 overflow-y-auto mt-0 ring-0 focus-visible:ring-0'>
            {selectedProjectId && projectData && activeProjectTabId ? (
              <TicketsTabWithSidebar
                projectId={selectedProjectId}
                projectName={projectData.name}
                projectTabId={activeProjectTabId}
                ticketView={search.ticketView}
                selectedTicketId={search.selectedTicketId}
                onTicketViewChange={(view) => {
                  navigate({
                    to: '/projects',
                    search: (prev) => ({ ...prev, ticketView: view }),
                    replace: true
                  })
                }}
                onTicketSelect={(ticketId) => {
                  navigate({
                    to: '/projects',
                    search: (prev) => ({ ...prev, selectedTicketId: ticketId }),
                    replace: true
                  })
                }}
              />
            ) : (
              <p className='p-4 md:p-6'>No project selected for tickets.</p>
            )}
          </TabsContent>

          <TabsContent value='git' className='flex-1 overflow-y-auto mt-0 ring-0 focus-visible:ring-0'>
            {selectedProjectId ? (
              <GitTabWithSidebar
                projectId={selectedProjectId}
                gitView={search.gitView}
                onGitViewChange={(view) => {
                  navigate({
                    to: '/projects',
                    search: (prev) => ({ ...prev, gitView: view }),
                    replace: true
                  })
                }}
              />
            ) : (
              <p className='p-4 md:p-6'>No project selected for Git.</p>
            )}
          </TabsContent>
          <TabsContent value='manage' className='flex-1 overflow-y-auto mt-0 ring-0 focus-visible:ring-0'>
            {selectedProjectId ? (
              <ManageTabWithSidebar
                projectId={selectedProjectId}
                manageView={search.manageView}
                onManageViewChange={(view) => {
                  navigate({
                    to: '/projects',
                    search: (prev) => ({ ...prev, manageView: view }),
                    replace: true
                  })
                }}
              />
            ) : (
              <p className='p-4 md:p-6'>No project selected for Manage.</p>
            )}
          </TabsContent>
          <TabsContent value='assets' className='flex-1 overflow-y-auto mt-0 ring-0 focus-visible:ring-0'>
            {selectedProjectId && projectData ? (
              <AssetsTabWithSidebar
                projectId={selectedProjectId}
                projectName={projectData.name}
                assetView={search.assetView}
                onAssetViewChange={(view) => {
                  navigate({
                    to: '/projects',
                    search: (prev) => ({ ...prev, assetView: view }),
                    replace: true
                  })
                }}
              />
            ) : (
              <p className='p-4 md:p-6'>No project selected for Assets.</p>
            )}
          </TabsContent>
          <TabsContent value='claude-code' className='flex-1 overflow-y-auto mt-0 ring-0 focus-visible:ring-0'>
            {activeProjectTabState?.claudeCodeEnabled ? (
              selectedProjectId && projectData ? (
                <ClaudeCodeTabWithSidebar
                  projectId={selectedProjectId}
                  projectName={projectData.name}
                  claudeCodeView={search.claudeCodeView}
                  onClaudeCodeViewChange={(view) => {
                    navigate({
                      to: '/projects',
                      search: (prev) => ({ ...prev, claudeCodeView: view }),
                      replace: true
                    })
                  }}
                />
              ) : (
                <p className='p-4 md:p-6'>No project selected for Claude Code.</p>
              )
            ) : (
              <div className='p-6 text-center text-muted-foreground'>
                <p>Claude Code is not enabled for this project.</p>
                <p className='mt-2'>Enable it in the Settings tab to access Claude Code features.</p>
              </div>
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

export const Route = createFileRoute('/projects')({
  validateSearch: zodValidator(projectsSearchSchema),
  beforeLoad: async ({ context, search }) => {
    const { queryClient, promptlianoClient } = context

    // Prefetch projects list if not already cached
    await queryClient.prefetchQuery({
      queryKey: ['projects'],
      queryFn: () => promptlianoClient.projects.listProjects(),
      staleTime: 5 * 60 * 1000 // 5 minutes
    })

    // If we have a projectId in search, prefetch that project's data
    if (search.projectId) {
      await queryClient.prefetchQuery({
        queryKey: ['project', search.projectId],
        queryFn: () => promptlianoClient.projects.getProject(search.projectId!),
        staleTime: 5 * 60 * 1000
      })
    }
  },
  component: ProjectsPage
})

type MainProjectsLayoutProps = {
  filePanelRef: React.RefObject<FilePanelRef>
  promptPanelRef: React.RefObject<PromptOverviewPanelRef>
}

function MainProjectsLayout({ filePanelRef, promptPanelRef }: MainProjectsLayoutProps) {
  const userInputRef = useRef<UserInputPanelRef>(null)

  const panels: [PanelConfig, PanelConfig, PanelConfig] = [
    {
      id: 'file-panel',
      content: <FilePanel ref={filePanelRef} className='h-full w-full' />,
      minWidth: 200
    },
    {
      id: 'input-panel',
      content: <UserInputPanel ref={userInputRef} className='h-full w-full' />,
      minWidth: 300
    },
    {
      id: 'prompt-panel',
      content: <PromptOverviewPanel ref={promptPanelRef} className='h-full w-full' />,
      minWidth: 250
    }
  ]

  return (
    <ErrorBoundary>
      <div className='flex-1 min-h-0 overflow-hidden h-full flex flex-col'>
        <DraggableThreeColumnPanel
          panels={panels}
          initialLeftPanelWidth={25}
          initialRightPanelWidth={35}
          storageKey='projects-draggable-columns'
          className='flex-1 h-full w-full'
        />
      </div>
    </ErrorBoundary>
  )
}

// WelcomeDialog is not used in this snippet but kept for completeness if it exists in the original file.
// type WelcomeDialogProps = { showWelcomeDialog: boolean; setShowWelcomeDialog: (open: boolean) => void }
// function WelcomeDialog({ showWelcomeDialog, setShowWelcomeDialog }: WelcomeDialogProps) { /* ... */ }
