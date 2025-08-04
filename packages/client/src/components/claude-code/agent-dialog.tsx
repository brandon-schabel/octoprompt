import React, { useEffect, useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@promptliano/ui'
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from '@promptliano/ui'
import { Input } from '@promptliano/ui'
import { Textarea } from '@promptliano/ui'
import { Button } from '@promptliano/ui'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@promptliano/ui'
import { Loader2 } from 'lucide-react'
import { useCreateAgent, useUpdateAgent, useGetAgent } from '@/hooks/api-hooks'
import type { ClaudeAgent, AgentColor } from '@promptliano/schemas'

const agentFormSchema = z.object({
  name: z.string().min(1, 'Name is required').max(100, 'Name is too long'),
  description: z.string().min(1, 'Description is required').max(500, 'Description is too long'),
  content: z.string().min(1, 'Content is required'),
  color: z.enum(['blue', 'green', 'red', 'yellow', 'purple', 'cyan', 'orange', 'pink'] as const)
})

type AgentFormData = z.infer<typeof agentFormSchema>

interface AgentDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  agentId?: string | null
  projectId?: number
}

const colorOptions: { value: AgentColor; label: string; className: string }[] = [
  { value: 'blue', label: 'Blue', className: 'bg-blue-500' },
  { value: 'green', label: 'Green', className: 'bg-green-500' },
  { value: 'red', label: 'Red', className: 'bg-red-500' },
  { value: 'yellow', label: 'Yellow', className: 'bg-yellow-500' },
  { value: 'purple', label: 'Purple', className: 'bg-purple-500' },
  { value: 'cyan', label: 'Cyan', className: 'bg-cyan-500' },
  { value: 'orange', label: 'Orange', className: 'bg-orange-500' },
  { value: 'pink', label: 'Pink', className: 'bg-pink-500' }
]

export function AgentDialog({ open, onOpenChange, agentId, projectId }: AgentDialogProps) {
  const [isSubmitting, setIsSubmitting] = useState(false)
  const isEditing = !!agentId

  // Fetch agent data if editing
  const { data: agentResponse, isLoading: isLoadingAgent } = useGetAgent(agentId || '', projectId)
  const agent = agentResponse?.data

  // Mutations
  const createAgentMutation = useCreateAgent(projectId)
  const updateAgentMutation = useUpdateAgent(projectId)

  const form = useForm<AgentFormData>({
    resolver: zodResolver(agentFormSchema),
    defaultValues: {
      name: '',
      description: '',
      content: '',
      color: 'blue'
    }
  })

  // Update form when agent data is loaded
  useEffect(() => {
    if (agent && isEditing) {
      form.reset({
        name: agent.name,
        description: agent.description,
        content: agent.content,
        color: agent.color
      })
    }
  }, [agent, isEditing, form])

  const onSubmit = async (data: AgentFormData) => {
    setIsSubmitting(true)

    try {
      if (isEditing && agentId) {
        await updateAgentMutation.mutateAsync({
          agentId,
          data
        })
      } else {
        await createAgentMutation.mutateAsync({
          ...data,
          projectId
        })
      }

      onOpenChange(false)
      form.reset()
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className='sm:max-w-[625px]'>
        <DialogHeader>
          <DialogTitle>{isEditing ? 'Edit Agent' : 'Create New Agent'}</DialogTitle>
          <DialogDescription>
            {isEditing
              ? 'Update the agent details below.'
              : 'Create a new Claude Code agent for specialized AI assistance.'}
          </DialogDescription>
        </DialogHeader>

        {isLoadingAgent && isEditing ? (
          <div className='flex items-center justify-center py-8'>
            <Loader2 className='h-8 w-8 animate-spin' />
          </div>
        ) : (
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className='space-y-4'>
              <FormField
                control={form.control}
                name='name'
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Name</FormLabel>
                    <FormControl>
                      <Input placeholder='e.g., frontend-expert' {...field} />
                    </FormControl>
                    <FormDescription>A unique identifier for this agent (lowercase, hyphens allowed)</FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name='description'
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Description</FormLabel>
                    <FormControl>
                      <Input
                        placeholder='e.g., Expert in React, TypeScript, and modern frontend development'
                        {...field}
                      />
                    </FormControl>
                    <FormDescription>Brief description of the agent's capabilities</FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name='color'
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Color</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder='Select a color' />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {colorOptions.map((option) => (
                          <SelectItem key={option.value} value={option.value}>
                            <div className='flex items-center gap-2'>
                              <div className={`h-3 w-3 rounded-full ${option.className}`} />
                              {option.label}
                            </div>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormDescription>Color for visual identification</FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name='content'
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Agent Instructions (Markdown)</FormLabel>
                    <FormControl>
                      <Textarea
                        placeholder='# Agent Name&#10;&#10;## Expertise&#10;- List areas of expertise...&#10;&#10;## Instructions&#10;Detailed instructions for the AI...'
                        className='min-h-[200px] font-mono text-sm'
                        {...field}
                      />
                    </FormControl>
                    <FormDescription>Full markdown content defining the agent's behavior and knowledge</FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <DialogFooter>
                <Button type='button' variant='outline' onClick={() => onOpenChange(false)} disabled={isSubmitting}>
                  Cancel
                </Button>
                <Button type='submit' disabled={isSubmitting}>
                  {isSubmitting && <Loader2 className='h-4 w-4 mr-2 animate-spin' />}
                  {isEditing ? 'Update Agent' : 'Create Agent'}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        )}
      </DialogContent>
    </Dialog>
  )
}
