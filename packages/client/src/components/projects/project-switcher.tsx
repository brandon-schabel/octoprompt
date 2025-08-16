import { useState, useEffect, useRef } from 'react'
import { Folder, ChevronDown, Search, Clock, Star, FolderOpen, GitBranch } from 'lucide-react'
import { useNavigate } from '@tanstack/react-router'
import { Button } from '@promptliano/ui'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  DropdownMenuGroup,
  DropdownMenuLabel
} from '@promptliano/ui'
import { Input } from '@promptliano/ui'
import { cn } from '@/lib/utils'
import { Project } from '@promptliano/schemas'
import { useGetProjects } from '@/hooks/api/use-projects-api'
import { useUpdateActiveProjectTab } from '@/hooks/use-kv-local-storage'
import { useRecentProjects } from '@/hooks/use-recent-projects'
import { useGitCurrentBranch } from '@/hooks/api/use-git-branch'
import { ProjectBranchInfo } from './project-branch-info'

interface ProjectSwitcherProps {
  currentProject: Project | null
  className?: string
  onManageProjects?: () => void
}

export function ProjectSwitcher({ currentProject, className, onManageProjects }: ProjectSwitcherProps) {
  const navigate = useNavigate()
  const [open, setOpen] = useState(false)
  const [search, setSearch] = useState('')
  const searchInputRef = useRef<HTMLInputElement>(null)

  const { data: projectsData, isLoading } = useGetProjects()
  const projects = projectsData ?? []
  const updateActiveProjectTab = useUpdateActiveProjectTab()
  const { recentProjects, addRecentProject } = useRecentProjects()
  const { branch: currentBranch } = useGitCurrentBranch(currentProject?.id)

  const handleSelectProject = (projectId: number) => {
    updateActiveProjectTab((prev) => ({
      ...(prev || {}),
      selectedProjectId: projectId,
      selectedFiles: [],
      selectedPrompts: []
    }))

    addRecentProject(projectId)
    setOpen(false)
    navigate({ to: '/projects' })
  }

  const filteredProjects = projects.filter(
    (project) =>
      project.name.toLowerCase().includes(search.toLowerCase()) ||
      project.path.toLowerCase().includes(search.toLowerCase())
  )

  const recentProjectsList = recentProjects
    .map((id) => projects.find((p) => p.id === id))
    .filter((p): p is Project => p !== undefined)
    .slice(0, 3)

  useEffect(() => {
    if (open && searchInputRef.current) {
      searchInputRef.current.focus()
    }
  }, [open])

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'p') {
        e.preventDefault()
        setOpen((prev) => !prev)
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [])

  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <DropdownMenuTrigger asChild>
        <Button
          variant='ghost'
          size='sm'
          className={cn(
            'h-auto py-1 px-2 font-medium justify-start gap-1.5',
            'hover:bg-accent/50 transition-colors',
            isLoading && 'opacity-50 cursor-wait',
            className
          )}
          title={currentProject ? `${currentProject.name} - Click to switch project` : 'Click to select a project'}
          disabled={isLoading}
        >
          {open ? (
            <FolderOpen className='h-4 w-4 shrink-0 text-muted-foreground' />
          ) : (
            <Folder className='h-4 w-4 shrink-0 text-muted-foreground' />
          )}
          <div className='flex flex-col items-start max-w-[300px]'>
            <span className='truncate text-sm'>
              {isLoading ? 'Loading...' : currentProject?.name || 'Select Project'}
            </span>
            {currentProject && currentBranch && (
              <div className='flex items-center gap-1 text-xs text-muted-foreground'>
                <GitBranch className='h-3 w-3 shrink-0' />
                <span className='truncate'>{currentBranch}</span>
              </div>
            )}
          </div>
          <ChevronDown className='h-3.5 w-3.5 shrink-0 opacity-50 ml-1' />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align='start' className='w-[320px] p-2' sideOffset={8}>
        <div className='px-2 pb-2'>
          <div className='relative'>
            <Search className='absolute left-2 top-2.5 h-4 w-4 text-muted-foreground' />
            <Input
              ref={searchInputRef}
              placeholder='Search projects...'
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className='pl-8 h-9'
            />
          </div>
        </div>

        {recentProjectsList.length > 0 && !search && (
          <>
            <DropdownMenuLabel className='px-2 py-1.5 text-xs font-medium text-muted-foreground'>
              Recent
            </DropdownMenuLabel>
            <DropdownMenuGroup>
              {recentProjectsList.map((project) => (
                <DropdownMenuItem
                  key={project.id}
                  onClick={() => handleSelectProject(project.id)}
                  className={cn('px-2 py-2 cursor-pointer', currentProject?.id === project.id && 'bg-accent')}
                >
                  <Clock className='h-4 w-4 mr-2 shrink-0 text-muted-foreground' />
                  <div className='flex-1 overflow-hidden'>
                    <div className='truncate font-medium'>{project.name}</div>
                    <div className='flex items-center gap-2'>
                      <div className='truncate text-xs text-muted-foreground flex-1'>{project.path}</div>
                      <ProjectBranchInfo projectId={project.id} />
                    </div>
                  </div>
                </DropdownMenuItem>
              ))}
            </DropdownMenuGroup>
            <DropdownMenuSeparator />
          </>
        )}

        <DropdownMenuLabel className='px-2 py-1.5 text-xs font-medium text-muted-foreground'>
          All Projects
        </DropdownMenuLabel>
        <DropdownMenuGroup className='max-h-[300px] overflow-y-auto'>
          {isLoading ? (
            <DropdownMenuItem disabled>
              <span className='text-muted-foreground'>Loading projects...</span>
            </DropdownMenuItem>
          ) : filteredProjects.length === 0 ? (
            <DropdownMenuItem disabled>
              <span className='text-muted-foreground'>{search ? 'No projects found' : 'No projects yet'}</span>
            </DropdownMenuItem>
          ) : (
            filteredProjects.map((project) => (
              <DropdownMenuItem
                key={project.id}
                onClick={() => handleSelectProject(project.id)}
                className={cn('px-2 py-2 cursor-pointer', currentProject?.id === project.id && 'bg-accent')}
              >
                {currentProject?.id === project.id ? (
                  <FolderOpen className='h-4 w-4 mr-2 shrink-0' />
                ) : (
                  <Folder className='h-4 w-4 mr-2 shrink-0' />
                )}
                <div className='flex-1 overflow-hidden'>
                  <div className='truncate font-medium'>{project.name}</div>
                  <div className='flex items-center gap-2'>
                    <div className='truncate text-xs text-muted-foreground flex-1'>{project.path}</div>
                    <ProjectBranchInfo projectId={project.id} />
                  </div>
                </div>
              </DropdownMenuItem>
            ))
          )}
        </DropdownMenuGroup>

        <DropdownMenuSeparator />
        <DropdownMenuItem
          className='px-2 py-2'
          onClick={() => {
            setOpen(false)
            if (onManageProjects) {
              onManageProjects()
            } else {
              navigate({ to: '/projects' })
            }
          }}
        >
          <span className='text-sm'>Manage Projects</span>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
