import React from 'react'
import { useNavigate } from '@tanstack/react-router'
import { Folder, Pencil, Trash, Plus } from 'lucide-react'
import {
  ConfiguredDataTable,
  createDataTableColumns,
  createTextColumn,
  createDateColumn,
  type DataTableColumnsConfig
} from '@promptliano/ui'
import { Button } from '@promptliano/ui'
import {
  AlertDialog,
  AlertDialogTrigger,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogFooter,
  AlertDialogTitle,
  AlertDialogCancel,
  AlertDialogAction
} from '@promptliano/ui'
import type { Project } from '@promptliano/schemas'

interface ProjectDataTableProps {
  loading: boolean
  projects: Project[]
  selectedProjectId: number | null
  onSelectProject: (id: number) => void
  onEditProject: (id: number) => void
  onDeleteProject: (id: number) => void
  onCreateProject: () => void
}

function truncatePath(path: string, maxLength: number = 50): string {
  if (path.length <= maxLength) return path

  const parts = path.split('/')
  if (parts.length <= 2) return `...${path.slice(-(maxLength - 3))}`

  const firstPart = parts[0]
  const lastPart = parts[parts.length - 1]
  const middleLength = maxLength - firstPart.length - lastPart.length - 6

  if (middleLength > 0) {
    return `${firstPart}/.../${lastPart}`
  }

  return `.../${lastPart}`.slice(0, maxLength)
}

export function ProjectDataTable({
  loading,
  projects,
  selectedProjectId,
  onSelectProject,
  onEditProject,
  onDeleteProject,
  onCreateProject
}: ProjectDataTableProps) {
  const navigate = useNavigate()
  const [deleteProjectId, setDeleteProjectId] = React.useState<number | null>(null)
  const projectToDelete = projects.find(p => p.id === deleteProjectId)

  // Define columns using the column factory
  const columnsConfig: DataTableColumnsConfig<Project> = {
    selectable: false,
    columns: [
      {
        type: 'custom',
        column: {
          id: 'icon',
          header: () => null,
          cell: () => <Folder className='h-4 w-4 text-muted-foreground' />,
          enableSorting: false,
          meta: { width: '40px' }
        }
      },
      {
        type: 'text',
        config: {
          accessorKey: 'name',
          header: 'Project Name',
          enableSorting: true
        }
      },
      {
        type: 'text', 
        config: {
          accessorKey: 'path',
          header: 'Path',
          formatFn: (value) => truncatePath(value, 45),
          enableSorting: true,
          className: 'text-xs text-muted-foreground font-mono'
        }
      },
      {
        type: 'date',
        config: {
          accessorKey: 'updated',
          header: 'Last Updated',
          format: 'relative',
          enableSorting: true
        }
      }
    ],
    actions: {
      actions: [
        {
          label: 'Edit',
          icon: Pencil,
          onClick: (project) => onEditProject(project.id)
        },
        {
          label: 'Delete',
          icon: Trash,
          onClick: (project) => setDeleteProjectId(project.id),
          variant: 'destructive'
        }
      ]
    }
  }

  const columns = createDataTableColumns(columnsConfig)

  return (
    <>
      <div className='space-y-2'>
        <div className='flex items-center justify-between px-2'>
          <span className='text-sm font-medium'>Projects</span>
          <Button variant='ghost' onClick={onCreateProject} className='h-6'>
            <Plus className='h-4 w-4' /> Project
          </Button>
        </div>
        
        <ConfiguredDataTable
          columns={columns}
          data={projects}
          isLoading={loading}
          pagination={{
            enabled: true,
            pageSize: 20,
            pageSizeOptions: [10, 20, 50]
          }}
          sorting={{
            enabled: true,
            defaultSort: [{ id: 'updated', desc: true }]
          }}
          filtering={{
            enabled: true,
            searchPlaceholder: 'Search projects...'
          }}
          selection={{
            enabled: false
          }}
          onRowClick={(row) => onSelectProject(row.original.id)}
          getRowId={(project) => project.id.toString()}
          emptyMessage='No projects yet. Create your first project to get started.'
          className='h-[60vh]'
          showToolbar={true}
          showPagination={projects.length > 20}
        />
      </div>

      <AlertDialog open={!!deleteProjectId} onOpenChange={(open) => !open && setDeleteProjectId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Project</AlertDialogTitle>
          </AlertDialogHeader>
          <p className='text-sm text-muted-foreground'>
            Are you sure you want to delete "{projectToDelete?.name}"?
          </p>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setDeleteProjectId(null)}>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={() => {
              if (deleteProjectId) {
                onDeleteProject(deleteProjectId)
                setDeleteProjectId(null)
              }
            }}>Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}