import React, { useEffect, useState } from 'react'
import { Link, useMatches, useNavigate } from '@tanstack/react-router'
import { Button } from '@/components/ui/button' // Assuming @ui maps to @/components/ui
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { ProjectList } from '@/components/projects/project-list'
import { ProjectDialog } from '@/components/projects/project-dialog'
import { useGetProjects, useDeleteProject } from '@/hooks/api/use-projects-api'
import { useHotkeys } from 'react-hotkeys-hook'
import {
  FolderIcon,
  MessageSquareIcon,
  KeyIcon,
  Settings as SettingsIcon, // Renamed to avoid conflict with Settings state
  HelpCircleIcon,
  LightbulbIcon,
  MenuIcon, // Icon for SidebarTrigger if needed, or use default
  FolderCogIcon,
  FolderTreeIcon
} from 'lucide-react'
import { HelpDialog } from '@/components/navigation/help-dialog'
import { SettingsDialog } from '@/components/settings/settings-dialog'
import { useActiveProjectTab, useSelectSetting, useUpdateActiveProjectTab } from '@/hooks/use-kv-local-storage'
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
  SidebarTrigger, // Import if you want a dedicated trigger button in main content
  useSidebar,
  SidebarMenuBadge,
  SidebarRail
} from '@/components/ui/sidebar' // Correct path to your sidebar.tsx
import { ErrorBoundary } from '@/components/error-boundary/error-boundary'

const mainNavItems = [
  {
    id: 'projects',
    title: 'Projects',
    to: '/projects',
    icon: FolderIcon,
    routeIds: ['/projects', '/project-summarization']
  },
  { id: 'chat', title: 'Chat', to: '/chat', icon: MessageSquareIcon, routeIds: ['/chat'], search: { prefill: false } },
  { id: 'keys', title: 'Keys', to: '/keys', icon: KeyIcon, routeIds: ['/keys'] },
  { id: 'prompts', title: 'Prompts', to: '/prompts', icon: LightbulbIcon, routeIds: ['/prompts'] },
]

export function AppSidebar() {
  const [openProjectListDialog, setOpenProjectListDialog] = useState(false)
  const [projectFormDialogOpen, setProjectFormDialogOpen] = useState(false)
  const [editProjectId, setEditProjectId] = useState<number | null>(null)
  const [helpOpen, setHelpOpen] = useState(false)
  const [settingsOpen, setSettingsOpen] = useState(false)

  const matches = useMatches()
  const navigate = useNavigate()

  const theme = useSelectSetting('theme')
  const updateActiveProjectTab = useUpdateActiveProjectTab()
  const [activeProjectTabState] = useActiveProjectTab()
  const selectedProjectId = activeProjectTabState?.selectedProjectId
  const { data: projectData, isLoading: projectsLoading } = useGetProjects()
  const { mutate: deleteProject } = useDeleteProject()

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
  // const { state: sidebarState } = useSidebar(); // To get 'expanded' or 'collapsed'
  const sidebarOpen = useSidebar()

  return (
    <ErrorBoundary>
      <>
        <Sidebar collapsible='icon' side='left' variant='sidebar'>
          <SidebarHeader className='p-2 flex items-center justify-center group-data-[collapsible=icon]:hidden'>
            {/* You can add a logo or App Name here */}
            <span className='text-lg font-semibold'>OctoPrompt</span>
          </SidebarHeader>
          <SidebarContent className='p-2'>
            <SidebarMenu>
              <div className='pt-1'></div>
              {mainNavItems.map((item) => {
                const isActive = matches.some((match) => item.routeIds.includes(match.routeId))
                return (
                  <SidebarMenuItem key={item.id} className='flex items-center w-full justify-center gap-2'>
                    <SidebarMenuButton asChild isActive={isActive} tooltip={item.title}>
                      <Link to={item.to} search={item.search || undefined}>
                        <item.icon className='h-4 w-4 flex-shrink-0' />
                        {<span className='truncate'>{item.title}</span>}
                      </Link>
                    </SidebarMenuButton>
                    {/* Example Badge - replace with actual data */}
                    {/* {item.id === 'chat' && <SidebarMenuBadge>5</SidebarMenuBadge>} */}
                  </SidebarMenuItem>
                )
              })}
            </SidebarMenu>
          </SidebarContent>
          <SidebarFooter>
            <SidebarMenu>
              <SidebarMenuItem className='flex items-center w-full justify-center gap-2'>
                <SidebarMenuButton onClick={() => setOpenProjectListDialog(true)} tooltip='Manage Projects'>
                  <FolderTreeIcon className='h-4 w-4 flex-shrink-0' />
                  <span className='truncate'>Manage Projects</span>
                </SidebarMenuButton>
              </SidebarMenuItem>
              <SidebarMenuItem className='flex items-center w-full justify-center gap-2'>
                <SidebarMenuButton onClick={() => setSettingsOpen(true)} tooltip='Settings'>
                  <SettingsIcon className='h-4 w-4 flex-shrink-0' />
                  <span className='truncate'>Settings</span>
                </SidebarMenuButton>
              </SidebarMenuItem>
              <SidebarMenuItem className='flex items-center w-full justify-center gap-2'>
                <SidebarMenuButton onClick={() => setHelpOpen(true)} tooltip='Help'>
                  <HelpCircleIcon className='h-4 w-4 flex-shrink-0' />
                  <span className='truncate'>Help</span>
                </SidebarMenuButton>
              </SidebarMenuItem>
              <SidebarMenuItem className='flex items-center w-full justify-center gap-2 text-xs text-muted-foreground'>
                <span className='px-3'>v0.5.4</span>
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
                projects={projectData?.data ?? []}
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
        <SettingsDialog open={settingsOpen} onOpenChange={setSettingsOpen} />
      </>
    </ErrorBoundary>
  )
}
