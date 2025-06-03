import * as React from 'react'
import { useNavigate } from '@tanstack/react-router'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@ui'
import { Button } from '@ui'
import { Input } from '@ui'
import { Label } from '@ui'
import { useCreateProject, useUpdateProject, useGetProject, useSyncProject } from '@/hooks/api/use-projects-api'
import { useEffect, useState, useRef } from 'react'
import { CreateProjectRequestBody } from '@octoprompt/schemas'
import { useUpdateActiveProjectTab } from '@/hooks/use-kv-local-storage'
import { FolderOpen } from 'lucide-react'

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

  const { mutate: createProject, isPending: isCreating } = useCreateProject()
  const { mutate: updateProject, isPending: isUpdating } = useUpdateProject()
  const { data: projectData } = useGetProject(projectId ?? -1)

  // We'll use this state to know when we have a newly created project to sync
  const [newlyCreatedProjectId, setNewlyCreatedProjectId] = useState<number | null>(null)
  const { mutate: syncProject } = useSyncProject()
  
  // Ref for the hidden file input
  const fileInputRef = useRef<HTMLInputElement>(null)

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
      syncProject(newlyCreatedProjectId, {
        onSuccess: () => {
          navigate({ to: '/projects' })
          onOpenChange(false)
        }
      })
    }
  }, [newlyCreatedProjectId, syncProject, navigate, onOpenChange])

  const handleBrowseFolder = () => {
    fileInputRef.current?.click()
  }

  const handleFolderSelection = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files
    if (files && files.length > 0) {
      // Get the first file to extract the folder path
      const firstFile = files[0]
      // Extract the folder path by removing the file name from the webkitRelativePath
      const relativePath = firstFile.webkitRelativePath
      
      if (relativePath) {
        const folderPath = relativePath.substring(0, relativePath.lastIndexOf('/'))
        setFormData((prev: CreateProjectRequestBody) => ({ ...prev, path: folderPath }))
      }
    }
    // Reset the input so the same folder can be selected again if needed
    event.target.value = ''
  }

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

  return (
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
                  onChange={(e) => setFormData((prev: CreateProjectRequestBody) => ({ ...prev, path: e.target.value }))}
                  required
                  className='flex-1'
                />
                <Button
                  type='button'
                  variant='outline'
                  size='sm'
                  onClick={handleBrowseFolder}
                  className='px-3'
                >
                  <FolderOpen className='h-4 w-4' />
                </Button>
              </div>
              <input
                ref={fileInputRef}
                type='file'
                style={{ display: 'none' }}
                {...({ webkitdirectory: '' } as any)}
                multiple
                onChange={handleFolderSelection}
              />
            </div>
            <div className='grid gap-2'>
              <Label htmlFor='description'>Description</Label>
              <Input 
                id='description' 
                value={formData.description} 
                onChange={(e) => setFormData((prev: CreateProjectRequestBody) => ({ ...prev, description: e.target.value }))}
              />
            </div>
          </div>
          <DialogFooter>
            <Button type='submit' disabled={isCreating || isUpdating}>
              {projectId ? 'Save Changes' : 'Create Project'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
