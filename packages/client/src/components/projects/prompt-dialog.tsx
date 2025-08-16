import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogClose
} from '@promptliano/ui'
import { Form, FormField, FormItem, FormLabel, FormControl, FormMessage } from '@promptliano/ui'
import { Input } from '@promptliano/ui'
import { Button } from '@promptliano/ui'
import { Loader2 } from 'lucide-react'
import { UseFormReturn } from 'react-hook-form'
import { ExpandableTextarea } from '@/components/expandable-textarea'
import { ErrorBoundary } from '@/components/error-boundary/error-boundary'
import {
  useCreatePrompt,
  useUpdatePrompt,
  useGetProjectPrompts,
  useAddPromptToProject
} from '@/hooks/api/use-prompts-api'
import { toast } from 'sonner'
import { useEffect } from 'react'

interface PromptDialogProps {
  open: boolean
  editPromptId: number | null
  promptForm: UseFormReturn<any, any>
  projectId: number
  onClose: () => void
  onSuccess?: () => void
}

export function PromptDialog({ open, editPromptId, promptForm, projectId, onClose, onSuccess }: PromptDialogProps) {
  const createPromptMutation = useCreatePrompt()
  const updatePromptMutation = useUpdatePrompt()
  const addPromptToProjectMutation = useAddPromptToProject()
  const { data: promptData } = useGetProjectPrompts(projectId)

  // Populate form when editing
  useEffect(() => {
    if (editPromptId && promptData?.data) {
      const prompt = promptData.data.find((p) => p.id === editPromptId)
      if (prompt) {
        promptForm.setValue('name', prompt.name)
        promptForm.setValue('content', prompt.content)
      }
    } else {
      promptForm.reset()
    }
  }, [editPromptId, promptData?.data, promptForm])

  const handleFormKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && e.target instanceof HTMLTextAreaElement) {
      e.stopPropagation()
    }
  }

  const handleCreatePrompt = async (values: { name: string; content: string }) => {
    try {
      const result = await createPromptMutation.mutateAsync({
        projectId,
        name: values.name,
        content: values.content
      })

      if (!result) {
        toast.error('Failed to create prompt')
        return
      }

      try {
        await addPromptToProjectMutation.mutateAsync({
          projectId,
          promptId: result.data.id
        })
      } catch (e) {
        toast.error('Failed to add prompt to project')
      }

      toast.success('Prompt created successfully')
      onSuccess?.()
    } catch (error) {
      console.error('Error creating prompt:', error)
      toast.error('Failed to create prompt')
    }
  }

  const handleUpdatePrompt = async (values: { name: string; content: string }) => {
    if (!editPromptId) return

    try {
      await updatePromptMutation.mutateAsync({
        promptId: editPromptId,
        data: {
          name: values.name,
          content: values.content
        }
      })

      toast.success('Prompt updated successfully')
      onSuccess?.()
    } catch (error) {
      console.error('Error updating prompt:', error)
      toast.error('Failed to update prompt')
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(dialogOpen) => {
        if (!dialogOpen) {
          promptForm.reset()
        }
        if (!dialogOpen) {
          onClose()
        }
      }}
    >
      <DialogContent className='sm:max-w-[800px]'>
        <ErrorBoundary>
          <DialogHeader>
            <DialogTitle>{editPromptId ? 'Edit Prompt' : 'New Prompt'}</DialogTitle>
            <DialogDescription>
              {editPromptId ? 'Update the prompt details.' : 'Create a new prompt.'}
            </DialogDescription>
          </DialogHeader>
          <Form {...promptForm}>
            <form
              onSubmit={promptForm.handleSubmit(editPromptId ? handleUpdatePrompt : handleCreatePrompt)}
              className='space-y-4'
              onKeyDown={handleFormKeyDown}
            >
              <FormField
                control={promptForm.control}
                name='name'
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Prompt Name</FormLabel>
                    <FormControl>
                      <Input placeholder='e.g. Summarize Document' {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={promptForm.control}
                name='content'
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Prompt Content</FormLabel>
                    <FormControl>
                      <ExpandableTextarea
                        value={field.value || ''}
                        onChange={field.onChange}
                        placeholder='Enter the prompt instructions here...'
                        title='Edit Prompt Content'
                        className='min-h-[200px]'
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <DialogFooter>
                <DialogClose asChild>
                  <Button variant='outline'>Cancel</Button>
                </DialogClose>
                <Button
                  disabled={createPromptMutation.isPending || updatePromptMutation.isPending}
                  onClick={(e) => {
                    e.preventDefault()
                    // handle form submit/prompt creation becuase form submit is not working
                    if (editPromptId) {
                      handleUpdatePrompt(promptForm.getValues())
                    } else {
                      handleCreatePrompt(promptForm.getValues())
                    }
                  }}
                >
                  {(createPromptMutation.isPending || updatePromptMutation.isPending) && (
                    <Loader2 className='mr-2 h-4 w-4 animate-spin' />
                  )}
                  {editPromptId ? 'Update Prompt' : 'Create Prompt'}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </ErrorBoundary>
      </DialogContent>
    </Dialog>
  )
}
