import * as React from 'react'
import { useNavigate } from '@tanstack/react-router'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@promptliano/ui'
import { Button } from '@promptliano/ui'
import { Input } from '@promptliano/ui'
import { Label } from '@promptliano/ui'
import { Progress } from '@promptliano/ui'
import { useCreateProject, useUpdateProject, useGetProject, useSyncProject } from '@/hooks/api/use-projects-api'
import { useEffect, useState } from 'react'
import { CreateProjectRequestBody } from '@promptliano/schemas'
import { useUpdateActiveProjectTab } from '@/hooks/use-kv-local-storage'
import { DirectoryBrowserDialog } from './directory-browser-dialog'
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

  const { mutate: createProject, isPending: isCreating } = useCreateProject()
  const { mutate: updateProject, isPending: isUpdating } = useUpdateProject()
  const { data: projectData } = useGetProject(projectId ?? -1)

  // We'll use this state to know when we have a newly created project to sync
  const [newlyCreatedProjectId, setNewlyCreatedProjectId] = useState<number | null>(null)
  const [isSyncing, setIsSyncing] = useState(false)
  const [syncMessage, setSyncMessage] = useState<string>('')
  const { mutate: syncProject } = useSyncProject()

  useEffect(() => {
    if (projectData?.data?.id && projectId) {
      setFormData({
        name: projectData.data.name,
        description: projectData.data.description ?? undefined,
        path: projectData.data.path
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
    if (newlyCreatedProjectId) {
      setIsSyncing(true)
      setSyncMessage('Syncing project files... This may take a few minutes for large projects.')

      syncProject(newlyCreatedProjectId, {
        onSuccess: () => {
          setIsSyncing(false)
          setSyncMessage('')
          toast.success('Project synced successfully!')
          navigate({ to: '/projects' })
          onOpenChange(false)
        },
        onError: (error) => {
          setIsSyncing(false)
          setSyncMessage('')
          toast.error(`Sync failed: ${error.message}. You can retry sync from project settings.`)
          // Still navigate to projects even if sync fails
          navigate({ to: '/projects' })
          onOpenChange(false)
        }
      })
    }
  }, [newlyCreatedProjectId, syncProject, navigate, onOpenChange])

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (projectId) {
      // Editing existing project
      updateProject(
        { projectId: projectId, data: formData },
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
          if (response.data) {
            // Set newly created project as current
            updateActiveProjectTab((prev) => ({
              ...prev,
              selectedProjectId: response?.data?.id || undefined,
              selectedFiles: [],
              selectedPrompts: []
            }))
            // Store the newly created project id to trigger sync in useEffect
            setNewlyCreatedProjectId(response.data.id)
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

            {/* Show sync progress when syncing */}
            {isSyncing && (
              <div className='space-y-3 p-4 bg-muted/50 rounded-lg'>
                <div className='flex items-center gap-2'>
                  <Loader2 className='h-4 w-4 animate-spin' />
                  <span className='text-sm font-medium'>Syncing Project Files</span>
                </div>
                <Progress value={undefined} className='h-2' />
                <p className='text-xs text-muted-foreground'>{syncMessage}</p>
              </div>
            )}

            <DialogFooter>
              <Button type='submit' disabled={isCreating || isUpdating || isSyncing}>
                {isSyncing ? 'Syncing...' : projectId ? 'Save Changes' : 'Create Project'}
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
    </>
  )
}
