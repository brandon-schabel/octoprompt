import { toast } from 'sonner'
import { Tooltip, TooltipContent, TooltipTrigger } from '@ui'
import { TooltipProvider } from '@ui'
import { Copy } from 'lucide-react'
import { Button } from '@ui'
import { Badge } from '@ui'
import { Link, useMatches } from '@tanstack/react-router'
import { useState, useEffect } from 'react'
import { Pencil, Trash2, Icon } from 'lucide-react'
import { tab } from '@lucide/lab'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@ui'
import { ProjectResponse } from '@octoprompt/schemas'
import {
  useActiveProjectTab,
  useDeleteProjectTabById,
  useGetActiveProjectTabId,
  useGetProjectTab,
  useUpdateProjectTabById
} from '@/hooks/use-kv-local-storage'
import { useCopyClipboard } from '@/hooks/utility-hooks/use-copy-clipboard'

type ProjectHeaderProps = {
  projectData: ProjectResponse['data'] | null
}

const ProjectHeader = function ProjectHeader({ projectData }: ProjectHeaderProps) {
  const matches = useMatches()
  const [projectTabData] = useActiveProjectTab()
  const { deleteTab } = useDeleteProjectTabById()
  const selectedProjectId = projectTabData?.selectedProjectId

  if (!projectData) return null

  const [isEditing, setIsEditing] = useState(false)
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false)
  const { projectTab: activeProjectTabData } = useGetProjectTab(projectData.id)
  const [newTabName, setNewTabName] = useState(activeProjectTabData?.displayName || '')
  const [activeProjectTabId] = useGetActiveProjectTabId()
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

  if (!activeProjectTabData && activeProjectTabId === -1) return null

  return (
    <>
      <div className='flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between px-4'>
        <div>
          {/* Project Title and Path Removed */}

          {/* Active tab name with inline editing and delete actions */}
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
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Pencil
                          className='invisible group-hover:visible w-3 h-3 text-gray-500 cursor-pointer'
                          onClick={() => setIsEditing(true)}
                        />
                      </TooltipTrigger>
                      <TooltipContent>
                        <p>Rename tab</p>
                      </TooltipContent>
                    </Tooltip>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <button
                          onClick={() => setIsDeleteDialogOpen(true)}
                          className='invisible group-hover:visible text-red-500'
                        >
                          <Trash2 className='w-3 h-3' />
                        </button>
                      </TooltipTrigger>
                      <TooltipContent>
                        <p>Delete tab</p>
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                </div>
              )}
            </div>
          )}
        </div>

        {/* <div className='flex items-center space-x-4'>ProjectSettingsDialog Button Removed</div> */}
      </div>
      <Dialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Confirm Tab Deletion</DialogTitle>
          </DialogHeader>
          <DialogDescription>Are you sure you want to delete this tab? This action cannot be undone.</DialogDescription>
          <div className='mt-4 flex justify-end space-x-2'>
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button variant='outline' onClick={() => setIsDeleteDialogOpen(false)}>
                    Cancel
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  <p>Cancel tab deletion</p>
                </TooltipContent>
              </Tooltip>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant='destructive'
                    onClick={() => {
                      if (activeProjectTabId && activeProjectTabId !== -1) {
                        deleteTab(activeProjectTabId)
                      }
                      setIsDeleteDialogOpen(false)
                    }}
                  >
                    Delete
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  <p>Confirm to delete tab</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </div>
        </DialogContent>
      </Dialog>
    </>
  )
}

export { ProjectHeader }
