import React, { useEffect, useState } from 'react'
import { Link, useMatches, useNavigate } from '@tanstack/react-router'
import { Button } from '@promptliano/ui' // Assuming @ui maps to @/components/ui
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@promptliano/ui'
import { ProjectList } from '@/components/projects/project-list'
import { ProjectDialog } from '@/components/projects/project-dialog'
import { useGetProjects, useDeleteProject } from '@/hooks/api/use-projects-api'
import { useRecentProjects } from '@/hooks/use-recent-projects'
import { useHotkeys } from 'react-hotkeys-hook'
import packageJson from '../../../package.json'
import {
  FolderIcon,
  MessageSquareIcon,
  Settings as SettingsIcon, // Renamed to avoid conflict with Settings state
  HelpCircleIcon,
  LightbulbIcon,
  MenuIcon, // Icon for SidebarTrigger if needed, or use default
  FolderCogIcon,
  FolderTreeIcon,
  Bot,
  Sparkles,
  Cloud
} from 'lucide-react'
import { HelpDialog } from '@/components/navigation/help-dialog'
import { useActiveProjectTab, useSelectSetting, useUpdateActiveProjectTab } from '@/hooks/use-kv-local-storage'
import { Logo } from '@promptliano/ui'
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
  useSidebar,
  SidebarRail,
  SectionedSidebarNav
} from '@promptliano/ui' // Correct path to your sidebar.tsx
import { ErrorBoundary } from '@/components/error-boundary/error-boundary'
import { ServerStatusIndicator } from '@/components/navigation/server-status-indicator'

const navigationSections = [
  {
    title: 'Core',
    items: [
      {
        id: 'projects',
        title: 'Projects',
        href: '/projects',
        icon: FolderIcon,
        routeIds: ['/projects']
      },
      { 
        id: 'chat', 
        title: 'Chat', 
        href: '/chat', 
        icon: MessageSquareIcon, 
        routeIds: ['/chat']
      }
    ]
  },
  {
    title: 'Tools',
    items: [
      { 
        id: 'prompts', 
        title: 'Prompts', 
        href: '/prompts', 
        icon: LightbulbIcon, 
        routeIds: ['/prompts'] 
      },
      { 
        id: 'providers', 
        title: 'Providers', 
        href: '/providers', 
        icon: Cloud, 
        routeIds: ['/providers'] 
      }
    ]
  }
]

export function AppSidebar() {
  const [openProjectListDialog, setOpenProjectListDialog] = useState(false)
  const [projectFormDialogOpen, setProjectFormDialogOpen] = useState(false)
  const [editProjectId, setEditProjectId] = useState<number | null>(null)
  const [helpOpen, setHelpOpen] = useState(false)

  const matches = useMatches()
  const navigate = useNavigate()

  const theme = useSelectSetting('theme')
  const updateActiveProjectTab = useUpdateActiveProjectTab()
  const [activeProjectTabState] = useActiveProjectTab()
  const selectedProjectId = activeProjectTabState?.selectedProjectId
  const { data: projectData, isLoading: projectsLoading } = useGetProjects()
  const { mutate: deleteProject } = useDeleteProject()
  const { recentProjects, addRecentProject } = useRecentProjects()

  const globalTheme = theme || 'dark'

  useEffect(() => {
    if (globalTheme === 'dark') {
      document.documentElement.classList.add('dark')
    } else {
      document.documentElement.classList.remove('dark')
    }
  }, [globalTheme])

  // Hotkeys
  useHotkeys('mod+o', (e: any) => {
    e.preventDefault()
    setOpenProjectListDialog(true)
  })

  useHotkeys('mod+n', (e: any) => {
    // Assuming this was for new project, redirecting to project form
    e.preventDefault()
    handleOpenNewProject()
  })

  const handleSelectProjectInDialog = (id: number) => {
    updateActiveProjectTab((prev) => ({
      ...(prev || {}), // Ensure prev is not null
      selectedProjectId: id,
      selectedFiles: [],
      selectedPrompts: []
    }))
    setOpenProjectListDialog(false)
    navigate({ to: '/projects' })
  }

  const handleOpenNewProject = () => {
    setEditProjectId(null)
    setProjectFormDialogOpen(true)
    setOpenProjectListDialog(false) // Close project list if it was open
  }

  const handleEditProjectInDialog = (id: number) => {
    setEditProjectId(id)
    setProjectFormDialogOpen(true)
    setOpenProjectListDialog(false)
  }

  // The sidebar state (open/collapsed) is managed by SidebarProvider
  const { open } = useSidebar()

  return (
    <ErrorBoundary>
      <>
        <Sidebar collapsible='icon' side='left' variant='sidebar'>
          <SidebarHeader className='p-2'>
            <div className='flex items-center justify-center relative group-data-[collapsible=icon]:justify-center'>
              <Logo 
                size='sm' 
                className='absolute left-0 group-data-[collapsible=icon]:relative group-data-[collapsible=icon]:left-auto' 
              />
              <span className='text-lg font-semibold group-data-[collapsible=icon]:hidden'>Promptliano</span>
            </div>
          </SidebarHeader>
          <SidebarContent className='p-2'>
            <SectionedSidebarNav
              activeItem={matches.find((match) => 
                navigationSections.some(section => 
                  section.items.some(item => item.routeIds.includes(match.routeId))
                )
              )?.routeId || ''}
              sections={navigationSections.map(section => ({
                ...section,
                items: section.items.map(item => ({
                  ...item,
                  label: item.title,
                  isActive: matches.some((match) => item.routeIds.includes(match.routeId))
                }))
              }))}
              onItemClick={(item: any) => {
                navigate({ to: item.href })
              }}
            />

            {/* Recent Projects Section */}
            {open && recentProjects.length > 0 && projectData && (
              <>
                <div className='px-3 py-2 mt-4'>
                  <p className='text-xs font-medium text-muted-foreground'>Recent Projects</p>
                </div>
                <SidebarMenu>
                  {recentProjects
                    .map((id) => projectData?.find((p) => p.id === id))
                    .filter(Boolean)
                    .slice(0, 3)
                    .map((project) => {
                      const isActive = selectedProjectId === project?.id
                      return (
                        <SidebarMenuItem key={project!.id} className='flex items-center w-full justify-center gap-2'>
                          <SidebarMenuButton asChild isActive={isActive} tooltip={project!.name}>
                            <a
                              className='flex items-center gap-2 cursor-pointer'
                              onClick={() => {
                                if (project) {
                                  handleSelectProjectInDialog(project.id)
                                }
                              }}
                            >
                              <FolderIcon className='h-4 w-4 flex-shrink-0' />
                              <span className='truncate'>{project!.name}</span>
                            </a>
                          </SidebarMenuButton>
                        </SidebarMenuItem>
                      )
                    })}
                </SidebarMenu>
              </>
            )}
          </SidebarContent>
          <SidebarFooter>
            <SidebarMenu>
              <SidebarMenuItem className='flex items-center w-full justify-center gap-2 group-data-[collapsible=icon]:hidden'>
                <ServerStatusIndicator />
              </SidebarMenuItem>
              <SidebarMenuItem className='flex items-center w-full justify-center gap-2'>
                <SidebarMenuButton onClick={() => setOpenProjectListDialog(true)} tooltip='Manage Projects'>
                  <FolderTreeIcon className='h-4 w-4 flex-shrink-0' />
                  <span className='truncate'>Manage Projects</span>
                </SidebarMenuButton>
              </SidebarMenuItem>
              <SidebarMenuItem className='flex items-center w-full justify-center gap-2'>
                <SidebarMenuButton asChild tooltip='Settings'>
                  <Link to='/settings'>
                    <SettingsIcon className='h-4 w-4 flex-shrink-0' />
                    <span className='truncate'>Settings</span>
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
              <SidebarMenuItem className='flex items-center w-full justify-center gap-2'>
                <SidebarMenuButton onClick={() => setHelpOpen(true)} tooltip='Help'>
                  <HelpCircleIcon className='h-4 w-4 flex-shrink-0' />
                  <span className='truncate'>Help</span>
                </SidebarMenuButton>
              </SidebarMenuItem>
              <SidebarMenuItem className='flex items-center w-full justify-center gap-2 text-xs text-muted-foreground'>
                <span className='px-3'>v{packageJson.version}</span>
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarFooter>
          <SidebarRail />
        </Sidebar>

        {/* Dialogs remain, controlled by this component's state */}
        <Dialog open={openProjectListDialog} onOpenChange={setOpenProjectListDialog}>
          <DialogContent className='sm:max-w-[425px]'>
            <DialogHeader>
              <DialogTitle>Open Project</DialogTitle>
            </DialogHeader>
            <div className='mt-4'>
              <ProjectList
                loading={projectsLoading}
                projects={projectData ?? []}
                selectedProjectId={selectedProjectId ?? null}
                onSelectProject={handleSelectProjectInDialog}
                onEditProject={handleEditProjectInDialog}
                onDeleteProject={(id) => {
                  deleteProject(id)
                  // Optionally, close dialog or handle UI update
                  // setOpenProjectListDialog(false);
                }}
                onCreateProject={handleOpenNewProject}
              />
            </div>
          </DialogContent>
        </Dialog>

        <ProjectDialog open={projectFormDialogOpen} projectId={editProjectId} onOpenChange={setProjectFormDialogOpen} />
        <HelpDialog open={helpOpen} onOpenChange={setHelpOpen} />
      </>
    </ErrorBoundary>
  )
}
