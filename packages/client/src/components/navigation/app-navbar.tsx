import { useEffect, useState } from 'react'
import { useNavigate, useMatches } from '@tanstack/react-router'
import { Button } from '@promptliano/ui'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@promptliano/ui'
import { ProjectList } from '@/components/projects/project-list'
import { ProjectDialog } from '@/components/projects/project-dialog'
import { useGetProjects, useDeleteProject } from '@/hooks/api/use-projects-api'
import { Link } from '@tanstack/react-router'
import { useHotkeys } from 'react-hotkeys-hook'
import { FolderIcon, MessageSquareIcon, KeyIcon, Settings, HelpCircle, Lightbulb } from 'lucide-react'
import { HelpDialog } from '@/components/navigation/help-dialog'
import { SettingsDialog } from '@/components/settings/settings-dialog'
import { useActiveProjectTab, useSelectSetting } from '@/hooks/use-kv-local-storage'
import { useUpdateActiveProjectTab } from '@/hooks/use-kv-local-storage'

export function AppNavbar() {
  const [openDialog, setOpenDialog] = useState(false)
  const [projectDialogOpen, setProjectDialogOpen] = useState(false)
  const [editProjectId, setEditProjectId] = useState<number | null>(null)
  const [helpOpen, setHelpOpen] = useState(false)
  const [settingsOpen, setSettingsOpen] = useState(false)

  const matches = useMatches()
  const isOnProjectsRoute = matches.some((match) => match.routeId === '/projects')
  const isOnChatRoute = matches.some((match) => match.routeId === '/chat')
  const isOnKeysRoute = matches.some((match) => match.routeId === '/keys')
  const isOnPromptsRoute = matches.some((match) => match.routeId === '/prompts')

  const theme = useSelectSetting('theme')

  const updateActiveProjectTab = useUpdateActiveProjectTab()
  const [activeProjectTabState] = useActiveProjectTab()
  const selectedProjectId = activeProjectTabState?.selectedProjectId
  const navigate = useNavigate()
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
    setOpenDialog(true)
  })

  useHotkeys('mod+n', (e: any) => {
    e.preventDefault()
    handleOpenNewProject()
  })

  const handleSelectProject = (id: number) => {
    //
    updateActiveProjectTab((prev) => ({
      ...prev,
      selectedProjectId: id,
      selectedFiles: [],
      selectedPrompts: []
    }))
    setOpenDialog(false)
    navigate({ to: '/projects' })
  }

  const handleOpenNewProject = () => {
    setEditProjectId(null)
    setProjectDialogOpen(true)
  }

  const handleEditProject = (id: number) => {
    setEditProjectId(id)
    setProjectDialogOpen(true)
    setOpenDialog(false)
  }

  return (
    <>
      <nav className='flex items-center w-full px-2 md:px-4 py-2 border-b'>
        <div className='flex items-center justify-between w-full'>
          <div className='flex items-center gap-1 md:gap-4'>
            {/* Projects link */}
            <Link
              to='/projects'
              className={`inline-flex items-center gap-1 md:gap-2 text-sm font-medium transition-colors 
                                px-2 py-1 md:px-3 md:py-2 rounded-md 
                                ${
                                  isOnProjectsRoute
                                    ? 'text-accent-foreground bg-accent/20'
                                    : 'text-foreground hover:text-accent-foreground hover:bg-accent/10'
                                }`}
              title='Project'
            >
              <FolderIcon className='w-4 h-4 flex-shrink-0' />
              <span className='hidden md:inline'>Project</span>
            </Link>
            <div className='h-4 w-[1px] bg-border' />

            {/* Chat link */}
            <Link
              to='/chat'
              search={{ prefill: false }}
              className={`inline-flex items-center gap-1 md:gap-2 text-sm font-medium transition-colors 
                                px-2 py-1 md:px-3 md:py-2 rounded-md 
                                ${
                                  isOnChatRoute
                                    ? 'text-accent-foreground bg-accent/20'
                                    : 'text-foreground hover:text-accent-foreground hover:bg-accent/10'
                                }`}
              title='Chat'
            >
              <MessageSquareIcon className='w-4 h-4 flex-shrink-0' />
              <span className='hidden md:inline'>Chat</span>
            </Link>
            <div className='h-4 w-[1px] bg-border' />

            {/* Keys link */}
            <Link
              to='/keys'
              className={`inline-flex items-center gap-1 md:gap-2 text-sm font-medium transition-colors 
                                px-2 py-1 md:px-3 md:py-2 rounded-md 
                                ${
                                  isOnKeysRoute
                                    ? 'text-accent-foreground bg-accent/20'
                                    : 'text-foreground hover:text-accent-foreground hover:bg-accent/10'
                                }`}
              title='Keys'
            >
              <KeyIcon className='w-4 h-4 flex-shrink-0' />
              <span className='hidden md:inline'>Keys</span>
            </Link>
            <div className='h-4 w-[1px] bg-border' />

            {/* Prompts link */}
            <Link
              to='/prompts'
              className={`inline-flex items-center gap-1 md:gap-2 text-sm font-medium transition-colors 
                                px-2 py-1 md:px-3 md:py-2 rounded-md 
                                ${
                                  isOnPromptsRoute
                                    ? 'text-accent-foreground bg-accent/20'
                                    : 'text-foreground hover:text-accent-foreground hover:bg-accent/10'
                                }`}
              title='Prompts'
            >
              <Lightbulb className='w-4 h-4 flex-shrink-0' />
              <span className='hidden md:inline'>Prompts</span>
            </Link>
          </div>

          <div className='flex items-center gap-1 md:gap-2'>
            {!isOnChatRoute && (
              <Button
                variant='outline'
                onClick={() => setOpenDialog(true)}
                className='ml-auto px-2 py-1 md:px-3 md:py-2'
                title='Open Projects'
              >
                <FolderIcon className='h-4 w-4 md:mr-2' />
                <span className='hidden md:inline'>Projects</span>
              </Button>
            )}

            {/* Settings button */}
            <Button variant='ghost' size='icon' onClick={() => setSettingsOpen(true)} title='Settings'>
              <Settings className='h-5 w-5' />
            </Button>

            {/* Help button */}
            <Button variant='ghost' size='icon' onClick={() => setHelpOpen(true)} className='ml-1 md:ml-2' title='Help'>
              <HelpCircle className='h-5 w-5' />
            </Button>
          </div>
        </div>
      </nav>

      {/* Dialog: Open Project */}
      <Dialog open={openDialog} onOpenChange={setOpenDialog}>
        <DialogContent className='sm:max-w-[600px] max-h-[80vh] overflow-hidden'>
          <DialogHeader>
            <DialogTitle>Open Project</DialogTitle>
          </DialogHeader>
          <div className='mt-4'>
            <ProjectList
              loading={projectsLoading}
              projects={projectData?.data ?? []}
              selectedProjectId={selectedProjectId ?? null}
              onSelectProject={handleSelectProject}
              onEditProject={handleEditProject}
              onDeleteProject={(id) => {
                deleteProject(id)
                setOpenDialog(false)
              }}
              onCreateProject={() => {
                setEditProjectId(null)
                setProjectDialogOpen(true)
                setOpenDialog(false)
              }}
            />
          </div>
        </DialogContent>
      </Dialog>

      <ProjectDialog open={projectDialogOpen} projectId={editProjectId} onOpenChange={setProjectDialogOpen} />
      <HelpDialog open={helpOpen} onOpenChange={setHelpOpen} />
      <SettingsDialog open={settingsOpen} onOpenChange={setSettingsOpen} />
    </>
  )
}
