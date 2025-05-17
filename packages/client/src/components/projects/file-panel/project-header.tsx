import { ScanEye } from 'lucide-react'
import { toast } from 'sonner'
import { Tooltip, TooltipContent, TooltipTrigger } from '@ui'
import { TooltipProvider } from '@ui'
import { TicketIcon } from 'lucide-react'
import { Copy } from 'lucide-react'
import { Button } from '@ui'
import { ProjectSettingsDialog } from '../project-settings-dialog'
import { Badge } from '@ui'
import { Link, useMatches } from '@tanstack/react-router'
import { useState, useEffect } from 'react'
import { Pencil, Trash2, Icon } from 'lucide-react'
import { tab } from '@lucide/lab'
import { useListTicketsWithTasks } from '@/hooks/api/use-tickets-api'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@ui'
import { ProjectResponse } from '@/generated'
import {
  useActiveProjectTab,
  useDeleteProjectTabById,
  useGetActiveProjectTabId,
  useGetProjectTab,
  useUpdateProjectTabById
} from '@/hooks/api/use-kv-api'
import { useCopyClipboard } from '@/hooks/utility-hooks/use-copy-clipboard'

type ProjectHeaderProps = {
  projectData: ProjectResponse['data'] | null
}

const ProjectHeader = function ProjectHeader({ projectData }: ProjectHeaderProps) {
  const matches = useMatches()
  const [projectTabData] = useActiveProjectTab()
  const { deleteTab } = useDeleteProjectTabById()
  const selectedProjectId = projectTabData?.selectedProjectId
  const isOnTicketsRoute = matches.some((m) => m.routeId === '/tickets')
  const isOnSummarizationRoute = matches.some((m) => m.routeId === '/project-summarization')

  // Tickets for this project
  const { data: ticketsData } = useListTicketsWithTasks(selectedProjectId ?? '')
  const openTicketsCount = ticketsData?.ticketsWithTasks?.filter((t) => t.ticket.status === 'open').length ?? 0

  if (!projectData) return null

  const [isEditing, setIsEditing] = useState(false)
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false)
  const { projectTab: activeProjectTabData } = useGetProjectTab(projectData.id)
  const [newTabName, setNewTabName] = useState(activeProjectTabData?.displayName || '')
  const { activeProjectTabId = 'unset' } = useGetActiveProjectTabId()
  const { updateProjectTabById } = useUpdateProjectTabById()
  const { copyToClipboard } = useCopyClipboard()

  const renameTab = (newName: string) => {
    if (!activeProjectTabId) {
      toast.error('No active project tab found')
      return
    }
    updateProjectTabById(activeProjectTabId, { displayName: newName })
  }

  useEffect(() => {
    setNewTabName(activeProjectTabData?.displayName || '')
  }, [activeProjectTabData?.displayName])

  return (
    <>
      <div className='flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between px-4 pt-4'>
        <div>
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <h2 className='text-lg font-semibold hover:cursor-help'>{projectData?.name}</h2>
              </TooltipTrigger>
              <TooltipContent side='bottom' className='flex flex-col items-center gap-2 max-w-md'>
                <div className='flex items-center gap-2'>
                  <span className='break-all'>{projectData?.path}</span>
                  <Button
                    variant='ghost'
                    size='icon'
                    className='h-4 w-4 hover:bg-accent hover:text-accent-foreground'
                    onClick={(e) => {
                      e.preventDefault()
                      copyToClipboard(projectData?.path || '', {
                        successMessage: 'Project path copied to clipboard',
                        errorMessage: 'Failed to copy project path'
                      })
                    }}
                  >
                    <Copy className='h-3 w-3' />
                  </Button>
                </div>

                <div className='flex items-center gap-2'>
                  <span>Copy Project ID</span>
                  <Button
                    variant='ghost'
                    size='icon'
                    className='h-4 w-4 hover:bg-accent hover:text-accent-foreground'
                    onClick={(e) => {
                      e.preventDefault()
                      copyToClipboard(projectData?.id || '', {
                        successMessage: 'Project ID copied to clipboard',
                        errorMessage: 'Failed to copy project ID'
                      })
                    }}
                  >
                    <Copy className='h-3 w-3' />
                  </Button>
                </div>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
          <span className='hidden md:block text-sm text-muted-foreground'>{projectData?.path.slice(0, 100)}</span>

          {/* NEW: Display active tab name with inline editing and delete actions */}
          {activeProjectTabData && (
            <div className='mt-1 text-[0.8rem] text-muted-foreground group inline-block'>
              {isEditing ? (
                <input
                  type='text'
                  value={newTabName}
                  onChange={(e) => setNewTabName(e.target.value)}
                  onBlur={() => {
                    renameTab(newTabName)
                    setIsEditing(false)
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      renameTab(newTabName)
                      setIsEditing(false)
                    }
                    if (e.key === 'Escape') {
                      setNewTabName(activeProjectTabData.displayName || '')
                      setIsEditing(false)
                    }
                  }}
                  className='text-[0.8rem] border-b border-dotted bg-transparent focus:outline-none'
                />
              ) : (
                <div className='flex items-center space-x-1'>
                  <Icon iconNode={tab} className='w-3 h-3 text-gray-500' aria-label='Tab Name' />
                  <span onClick={() => setIsEditing(true)} className='cursor-pointer' title='Click to rename tab'>
                    {activeProjectTabData.displayName || 'Unnamed Tab'}
                  </span>
                  <Pencil
                    className='invisible group-hover:visible w-3 h-3 text-gray-500 cursor-pointer'
                    onClick={() => setIsEditing(true)}
                    //   title="Rename tab"
                  />
                  <button
                    onClick={() => setIsDeleteDialogOpen(true)}
                    className='invisible group-hover:visible text-red-500'
                    title='Delete tab'
                  >
                    <Trash2 className='w-3 h-3' />
                  </button>
                </div>
              )}
            </div>
          )}
        </div>

        <div className='flex items-center space-x-4'>
          <ProjectSettingsDialog />

          <Link
            to='/tickets'
            className={`inline-flex items-center gap-2 text-sm font-medium transition-colors 
                    hover:bg-accent/50 px-3 py-2 rounded-md ${
                      isOnTicketsRoute
                        ? 'text-indigo-600 dark:text-indigo-400 bg-accent/80'
                        : 'text-foreground hover:text-indigo-600 dark:hover:text-indigo-400'
                    }`}
          >
            <TicketIcon className='w-4 h-4' />
            Tickets
            {openTicketsCount > 0 && (
              <Badge variant='count' className='ml-1'>
                {openTicketsCount}
              </Badge>
            )}
          </Link>

          <Link
            to='/project-summarization'
            className={`inline-flex items-center gap-2 text-sm font-medium transition-colors 
                    hover:bg-accent/50 px-3 py-2 rounded-md ${
                      isOnSummarizationRoute
                        ? 'text-indigo-600 dark:text-indigo-400 bg-accent/80'
                        : 'text-foreground hover:text-indigo-600 dark:hover:text-indigo-400'
                    }`}
          >
            <ScanEye className='w-4 h-4' />
            Summarization
          </Link>
        </div>
      </div>
      <Dialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Confirm Tab Deletion</DialogTitle>
          </DialogHeader>
          <DialogDescription>Are you sure you want to delete this tab? This action cannot be undone.</DialogDescription>
          <div className='mt-4 flex justify-end space-x-2'>
            <Button variant='outline' onClick={() => setIsDeleteDialogOpen(false)}>
              Cancel
            </Button>
            <Button
              variant='destructive'
              onClick={() => {
                deleteTab(activeProjectTabId ?? '')
                setIsDeleteDialogOpen(false)
              }}
            >
              Delete
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  )
}

export { ProjectHeader }
