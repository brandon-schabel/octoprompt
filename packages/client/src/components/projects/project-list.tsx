import { Folder, Pencil, Trash, Plus } from 'lucide-react'
import {
  AlertDialog,
  AlertDialogTrigger,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogFooter,
  AlertDialogTitle,
  AlertDialogCancel,
  AlertDialogAction
} from '@ui'
import { cn } from '@/lib/utils'
import { Button } from '@ui'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '@ui'
import { DotsHorizontalIcon } from '@radix-ui/react-icons'
import { Project } from 'shared/src/schemas/project.schemas'
import { ErrorBoundary } from '@/components/error-boundary/error-boundary'

interface ProjectListProps {
  loading: boolean
  projects: Project[]
  selectedProjectId: number | null
  onSelectProject: (id: number) => void
  onEditProject: (id: number) => void
  onDeleteProject: (id: number) => void
  onCreateProject: () => void
}

export function ProjectList({
  loading,
  projects,
  selectedProjectId,
  onSelectProject,
  onEditProject,
  onDeleteProject,
  onCreateProject
}: ProjectListProps) {
  if (loading) {
    return (
      <ErrorBoundary>
        <div className='space-y-2'>
          <div className='text-sm font-medium'>Projects</div>
          <div className='space-y-1'>
            {[1, 2, 3].map((i) => (
              <div key={i} className='flex items-center p-2'>
                <Button variant='ghost' disabled className='w-full justify-start'>
                  <Folder className='mr-2 h-4 w-4 opacity-50' />
                  <span className='opacity-50'>Loading...</span>
                </Button>
              </div>
            ))}
          </div>
        </div>
      </ErrorBoundary>
    )
  }

  return (
    <ErrorBoundary>
      <div className='space-y-2'>
        <div className='flex items-center justify-between px-2'>
          <span className='text-sm font-medium'>Projects</span>
          <Button variant='ghost' onClick={onCreateProject} className='h-6 '>
            <Plus className='h-4 w-4' /> Project
          </Button>
        </div>
        <div className='space-y-1'>
          {projects && projects.length > 0 ? (
            projects.map((project) => (
              <div key={project.id} className='group flex items-center'>
                <Button
                  variant='ghost'
                  onClick={() => onSelectProject(project.id)}
                  className={cn('flex-1 justify-start', selectedProjectId === project.id && 'bg-accent')}
                >
                  <Folder className='mr-2 h-4 w-4 shrink-0' />
                  <div className='flex-1 overflow-hidden text-left'>
                    <div className='truncate'>{project.name}</div>
                    <div className='truncate text-xs text-muted-foreground'>{project.path}</div>
                  </div>
                </Button>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant='ghost' size='icon' className='h-8 w-8 opacity-0 group-hover:opacity-100'>
                      <DotsHorizontalIcon className='h-4 w-4' />
                      <span className='sr-only'>More</span>
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align='end' className='w-48'>
                    <DropdownMenuItem onClick={() => onEditProject(project.id)}>
                      <Pencil className='mr-2 h-4 w-4' />
                      <span>Edit Project</span>
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <DropdownMenuItem onSelect={(e) => e.preventDefault()} className='text-destructive'>
                          <Trash className='mr-2 h-4 w-4' />
                          <span>Delete Project</span>
                        </DropdownMenuItem>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Delete Project</AlertDialogTitle>
                        </AlertDialogHeader>
                        <p className='text-sm text-muted-foreground'>
                          Are you sure you want to delete "{project.name}"?
                        </p>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancel</AlertDialogCancel>
                          <AlertDialogAction onClick={() => onDeleteProject(project.id)}>Delete</AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            ))
          ) : (
            <div className='px-2 py-1.5'>
              <span className='text-sm text-muted-foreground'>No projects yet</span>
            </div>
          )}
        </div>
      </div>
    </ErrorBoundary>
  )
}
