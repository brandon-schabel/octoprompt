import * as React from 'react'
import { useNavigate } from '@tanstack/react-router'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@promptliano/ui'
import { Button } from '@promptliano/ui'
import { Input } from '@promptliano/ui'
import { Label } from '@promptliano/ui'
import { useCreateProject, useUpdateProject, useGetProject, useSyncProjectWithProgress } from '@/hooks/api/use-projects-api'
import { useEffect, useState, useRef } from 'react'
import { CreateProjectRequestBody, type SyncProgressEvent } from '@promptliano/schemas'
import { useUpdateActiveProjectTab } from '@/hooks/use-kv-local-storage'
import { DirectoryBrowserDialog } from './directory-browser-dialog'
import { SyncProgressDialog } from './sync-progress-dialog'
import { FolderOpen, Loader2 } from 'lucide-react'
import { toast } from 'sonner'

type ProjectDialogProps = {
  open: boolean
  projectId: number | null
  onOpenChange: (open: boolean) => void
}

export function ProjectDialog({ open, projectId, onOpenChange }: ProjectDialogProps) {
  const navigate = useNavigate()
  const updateActiveProjectTab = useUpdateActiveProjectTab()
  const [formData, setFormData] = useState<CreateProjectRequestBody>({
    name: '',
    description: '',
    path: ''
  })
  const [showDirectoryBrowser, setShowDirectoryBrowser] = useState(false)
  const [showSyncProgress, setShowSyncProgress] = useState(false)
  const [syncingProjectName, setSyncingProjectName] = useState<string>('')

  const { mutate: createProject, isPending: isCreating } = useCreateProject()
  const { mutate: updateProject, isPending: isUpdating } = useUpdateProject()
  const { data: projectData } = useGetProject(projectId ?? -1)
  const { syncWithProgress } = useSyncProjectWithProgress()

  // We'll use this state to know when we have a newly created project to sync
  const [newlyCreatedProjectId, setNewlyCreatedProjectId] = useState<number | null>(null)
  const syncProgressRef = useRef<{ updateProgress: (event: SyncProgressEvent) => void } | null>(null)
  const abortControllerRef = useRef<AbortController | null>(null)

  useEffect(() => {
    if (projectData?.id && projectId) {
      setFormData({
        name: projectData.name,
        description: projectData.description ?? undefined,
        path: projectData.path
      })
    } else {
      setFormData({
        name: '',
        description: '',
        path: ''
      })
    }
  }, [projectData, projectId])

  // When newlyCreatedProjectId is set, we sync and then navigate
  useEffect(() => {
    if (newlyCreatedProjectId && syncingProjectName) {
      // Close the create dialog first
      onOpenChange(false)
      
      // Show sync progress dialog
      setShowSyncProgress(true)
      
      // Start SSE sync with progress tracking
      const abortController = new AbortController()
      abortControllerRef.current = abortController
      
      syncWithProgress(
        newlyCreatedProjectId, 
        (event) => {
          // Update progress in the dialog
          syncProgressRef.current?.updateProgress(event)
        },
        abortController.signal
      )
        .then(() => {
          toast.success('Project synced successfully!')
          setShowSyncProgress(false)
          navigate({ to: '/projects' })
        })
        .catch((error) => {
          if (error.message !== 'Sync cancelled') {
            toast.error(`Sync failed: ${error.message}. You can retry sync from project settings.`)
          }
          // Still navigate to projects even if sync fails
          setShowSyncProgress(false)
          navigate({ to: '/projects' })
        })
        .finally(() => {
          setNewlyCreatedProjectId(null)
          setSyncingProjectName('')
          abortControllerRef.current = null
        })
      
      // Cleanup function to abort sync if component unmounts
      return () => {
        abortController.abort()
      }
    }
  }, [newlyCreatedProjectId, syncingProjectName, syncWithProgress, navigate, onOpenChange])

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (projectId) {
      // Editing existing project
      updateProject(
        { id: projectId, data: formData },
        {
          onSuccess: () => {
            onOpenChange(false)
          }
        }
      )
    } else {
      // Creating new project
      createProject(formData, {
        onSuccess: (response) => {
          if (response) {
            // Set newly created project as current
            updateActiveProjectTab((prev) => ({
              ...prev,
              selectedProjectId: response?.id || undefined,
              selectedFiles: [],
              selectedPrompts: []
            }))
            // Store the newly created project id and name to trigger sync in useEffect
            setNewlyCreatedProjectId(response.id)
            setSyncingProjectName(response.name)
          }
        }
      })
    }
  }

  const handleSelectPath = (path: string) => {
    setFormData((prev) => ({ ...prev, path }))
    // Always extract folder name from path (cross-platform)
    const pathParts = path.split(/[/\\]/).filter(Boolean)
    const folderName = pathParts[pathParts.length - 1]

    if (folderName) {
      setFormData((prev) => ({ ...prev, name: folderName.trim() }))
    }
  }

  const handleCancelSync = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort()
      toast.info('Sync cancelled. You can retry from project settings.')
    }
  }

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{projectId ? 'Edit Project' : 'New Project'}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit}>
            <div className='grid gap-4 py-4'>
              <div className='grid gap-2'>
                <Label htmlFor='name'>Name</Label>
                <Input
                  id='name'
                  value={formData.name}
                  onChange={(e) => setFormData((prev: CreateProjectRequestBody) => ({ ...prev, name: e.target.value }))}
                  required
                />
              </div>
              <div className='grid gap-2'>
                <Label htmlFor='path'>Path</Label>
                <div className='flex gap-2'>
                  <Input
                    id='path'
                    value={formData.path}
                    onChange={(e) =>
                      setFormData((prev: CreateProjectRequestBody) => ({ ...prev, path: e.target.value }))
                    }
                    required
                    placeholder='Enter path or browse...'
                  />
                  <Button
                    type='button'
                    variant='outline'
                    size='icon'
                    onClick={() => setShowDirectoryBrowser(true)}
                    title='Browse for folder'
                  >
                    <FolderOpen className='h-4 w-4' />
                  </Button>
                </div>
              </div>
              <div className='grid gap-2'>
                <Label htmlFor='description'>Description</Label>
                <Input
                  id='description'
                  value={formData.description || ''}
                  onChange={(e) =>
                    setFormData((prev: CreateProjectRequestBody) => ({ ...prev, description: e.target.value }))
                  }
                />
              </div>
            </div>

            <DialogFooter>
              <Button type='submit' disabled={isCreating || isUpdating}>
                {isCreating || isUpdating ? (
                  <>
                    <Loader2 className='mr-2 h-4 w-4 animate-spin' />
                    {projectId ? 'Saving...' : 'Creating Project...'}
                  </>
                ) : (
                  projectId ? 'Save Changes' : 'Create Project'
                )}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <DirectoryBrowserDialog
        open={showDirectoryBrowser}
        onOpenChange={setShowDirectoryBrowser}
        onSelectPath={handleSelectPath}
        initialPath={formData.path || undefined}
      />
      
      {/* Sync Progress Dialog */}
      <SyncProgressDialog
        open={showSyncProgress}
        onOpenChange={setShowSyncProgress}
        projectName={syncingProjectName}
        ref={syncProgressRef}
        onCancel={handleCancelSync}
      />
    </>
  )
}
