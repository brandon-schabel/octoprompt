import React, { useEffect, useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from '@/components/ui/dialog'
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import { Label } from '@/components/ui/label'
import { Loader2, Info, Code } from 'lucide-react'
import { useCreateCommand, useUpdateCommand, useGetCommand } from '@/hooks/api-hooks'
import type { ClaudeCommand, CommandScope } from '@promptliano/schemas'
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible"
import { ChevronDown } from 'lucide-react'

const commandFormSchema = z.object({
  name: z
    .string()
    .min(1, 'Name is required')
    .max(50, 'Name is too long')
    .regex(/^[a-z0-9-]+$/, 'Name must be lowercase letters, numbers, and hyphens only'),
  namespace: z
    .string()
    .max(50, 'Namespace is too long')
    .regex(/^[a-z0-9-\/]*$/, 'Namespace must be lowercase letters, numbers, hyphens, and slashes only')
    .optional()
    .transform((val) => (val === '' ? undefined : val)),
  scope: z.enum(['project', 'user'] as const),
  description: z.string().max(200, 'Description is too long').optional(),
  content: z.string().min(1, 'Command content is required'),
  // Frontmatter fields
  allowedTools: z.string().optional(),
  argumentHint: z.string().max(100, 'Argument hint is too long').optional(),
  model: z.string().optional(),
  maxTurns: z.number().int().positive().max(50).optional(),
  outputFormat: z.enum(['text', 'json']).optional()
})

type CommandFormData = z.infer<typeof commandFormSchema>

interface CommandDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  commandName?: string | null
  namespace?: string | null
  projectId: number
}

const MODEL_OPTIONS = [
  { value: 'claude-3-5-sonnet-20241022', label: 'Claude 3.5 Sonnet' },
  { value: 'claude-3-5-haiku-20241022', label: 'Claude 3.5 Haiku' },
  { value: 'claude-3-opus-20240229', label: 'Claude 3 Opus' },
  { value: 'claude-3-sonnet-20240229', label: 'Claude 3 Sonnet' },
  { value: 'claude-3-haiku-20240307', label: 'Claude 3 Haiku' }
]

export function CommandDialog({ open, onOpenChange, commandName, namespace, projectId }: CommandDialogProps) {
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isAdvancedOpen, setIsAdvancedOpen] = useState(false)
  const isEditing = !!commandName

  // Fetch command data if editing
  const { data: commandResponse, isLoading: isLoadingCommand } = useGetCommand(
    projectId,
    commandName || '',
    namespace || undefined
  )
  const command = commandResponse?.data

  // Mutations
  const createCommandMutation = useCreateCommand(projectId)
  const updateCommandMutation = useUpdateCommand(projectId)

  const form = useForm<CommandFormData>({
    resolver: zodResolver(commandFormSchema),
    defaultValues: {
      name: '',
      namespace: '',
      scope: 'project',
      description: '',
      content: '',
      allowedTools: '',
      argumentHint: '',
      model: undefined,
      maxTurns: undefined,
      outputFormat: undefined
    }
  })

  // Update form when command data is loaded
  useEffect(() => {
    if (command && isEditing) {
      form.reset({
        name: command.name,
        namespace: command.namespace || '',
        scope: command.scope,
        description: command.description || '',
        content: command.content,
        allowedTools: command.frontmatter?.['allowed-tools'] || '',
        argumentHint: command.frontmatter?.['argument-hint'] || '',
        model: command.frontmatter?.model,
        maxTurns: command.frontmatter?.['max-turns'],
        outputFormat: command.frontmatter?.['output-format']
      })
      // Open advanced section if any frontmatter fields are set
      if (
        command.frontmatter?.['allowed-tools'] ||
        command.frontmatter?.['argument-hint'] ||
        command.frontmatter?.model ||
        command.frontmatter?.['max-turns'] ||
        command.frontmatter?.['output-format']
      ) {
        setIsAdvancedOpen(true)
      }
    }
  }, [command, isEditing, form])

  const onSubmit = async (data: CommandFormData) => {
    setIsSubmitting(true)

    try {
      // Build frontmatter object
      const frontmatter: any = {}
      if (data.description) frontmatter.description = data.description
      if (data.allowedTools) frontmatter['allowed-tools'] = data.allowedTools
      if (data.argumentHint) frontmatter['argument-hint'] = data.argumentHint
      if (data.model) frontmatter.model = data.model
      if (data.maxTurns) frontmatter['max-turns'] = data.maxTurns
      if (data.outputFormat) frontmatter['output-format'] = data.outputFormat

      if (isEditing && commandName) {
        await updateCommandMutation.mutateAsync({
          commandName,
          namespace: namespace || undefined,
          data: {
            content: data.content,
            frontmatter,
            namespace: data.namespace
          }
        })
      } else {
        await createCommandMutation.mutateAsync({
          name: data.name,
          namespace: data.namespace,
          scope: data.scope,
          content: data.content,
          frontmatter
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
      <DialogContent className='sm:max-w-[725px] max-h-[90vh] overflow-y-auto'>
        <DialogHeader>
          <DialogTitle>{isEditing ? 'Edit Command' : 'Create New Command'}</DialogTitle>
          <DialogDescription>
            {isEditing
              ? 'Update the command details below.'
              : 'Create a new Claude Code slash command for this project.'}
          </DialogDescription>
        </DialogHeader>

        {isLoadingCommand && isEditing ? (
          <div className='flex items-center justify-center py-8'>
            <Loader2 className='h-8 w-8 animate-spin' />
          </div>
        ) : (
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className='space-y-4'>
              <div className='grid grid-cols-2 gap-4'>
                <FormField
                  control={form.control}
                  name='name'
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Command Name</FormLabel>
                      <FormControl>
                        <Input
                          placeholder='review-code'
                          {...field}
                          disabled={isEditing}
                        />
                      </FormControl>
                      <FormDescription>Lowercase letters, numbers, and hyphens only</FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name='namespace'
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Namespace (Optional)</FormLabel>
                      <FormControl>
                        <Input placeholder='frontend/components' {...field} />
                      </FormControl>
                      <FormDescription>Organize commands in folders</FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              {!isEditing && (
                <FormField
                  control={form.control}
                  name='scope'
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Command Scope</FormLabel>
                      <FormControl>
                        <RadioGroup
                          onValueChange={field.onChange}
                          defaultValue={field.value}
                          className='flex gap-4'
                        >
                          <div className='flex items-center space-x-2'>
                            <RadioGroupItem value='project' id='project' />
                            <Label htmlFor='project'>Project (saved in project directory)</Label>
                          </div>
                          <div className='flex items-center space-x-2'>
                            <RadioGroupItem value='user' id='user' />
                            <Label htmlFor='user'>User (available in all projects)</Label>
                          </div>
                        </RadioGroup>
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              )}

              <FormField
                control={form.control}
                name='description'
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Description (Optional)</FormLabel>
                    <FormControl>
                      <Input
                        placeholder='Performs comprehensive code review with security analysis'
                        {...field}
                      />
                    </FormControl>
                    <FormDescription>Brief description of what this command does</FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name='content'
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Command Content</FormLabel>
                    <FormControl>
                      <Textarea
                        placeholder='Review the code in $ARGUMENTS and provide feedback on:&#10;1. Code quality and best practices&#10;2. Potential bugs or issues&#10;3. Performance optimizations&#10;4. Security concerns&#10;&#10;Focus on actionable suggestions...'
                        className='min-h-[200px] font-mono text-sm'
                        {...field}
                      />
                    </FormControl>
                    <FormDescription>
                      The prompt that will be sent to Claude. Use $ARGUMENTS where user input should be inserted.
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Advanced Settings */}
              <Collapsible open={isAdvancedOpen} onOpenChange={setIsAdvancedOpen}>
                <CollapsibleTrigger asChild>
                  <Button variant='ghost' className='w-full justify-between' type='button'>
                    <span>Advanced Settings (Frontmatter)</span>
                    <ChevronDown className={cn('h-4 w-4 transition-transform', isAdvancedOpen && 'rotate-180')} />
                  </Button>
                </CollapsibleTrigger>
                <CollapsibleContent className='space-y-4 pt-4'>
                  <FormField
                    control={form.control}
                    name='allowedTools'
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Allowed Tools</FormLabel>
                        <FormControl>
                          <Input
                            placeholder='Edit, Read, Bash(git:*), WebSearch'
                            {...field}
                          />
                        </FormControl>
                        <FormDescription>
                          Comma-separated list of tools Claude can use. Leave empty for all tools.
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name='argumentHint'
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Argument Hint</FormLabel>
                        <FormControl>
                          <Input
                            placeholder='[file-path] or [component-name]'
                            {...field}
                          />
                        </FormControl>
                        <FormDescription>
                          Hint shown to users about expected arguments
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <div className='grid grid-cols-2 gap-4'>
                    <FormField
                      control={form.control}
                      name='model'
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Preferred Model</FormLabel>
                          <Select 
                            onValueChange={(value) => field.onChange(value === '_none_' ? undefined : value)} 
                            value={field.value || '_none_'}
                          >
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue placeholder='Default model' />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              <SelectItem value='_none_'>Default model</SelectItem>
                              {MODEL_OPTIONS.map((model) => (
                                <SelectItem key={model.value} value={model.value}>
                                  {model.label}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <FormDescription>Override default model</FormDescription>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name='maxTurns'
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Max Turns</FormLabel>
                          <FormControl>
                            <Input
                              type='number'
                              min='1'
                              max='50'
                              placeholder='10'
                              {...field}
                              onChange={(e) => {
                                const val = e.target.value
                                field.onChange(val === '' ? undefined : parseInt(val))
                              }}
                            />
                          </FormControl>
                          <FormDescription>Maximum conversation turns</FormDescription>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  <FormField
                    control={form.control}
                    name='outputFormat'
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Output Format</FormLabel>
                        <Select 
                          onValueChange={(value) => field.onChange(value === '_none_' ? undefined : value)} 
                          value={field.value || '_none_'}
                        >
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder='Default format' />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value='_none_'>Default format</SelectItem>
                            <SelectItem value='text'>Text</SelectItem>
                            <SelectItem value='json'>JSON</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormDescription>Preferred output format</FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </CollapsibleContent>
              </Collapsible>

              <DialogFooter>
                <Button type='button' variant='outline' onClick={() => onOpenChange(false)} disabled={isSubmitting}>
                  Cancel
                </Button>
                <Button type='submit' disabled={isSubmitting}>
                  {isSubmitting && <Loader2 className='h-4 w-4 mr-2 animate-spin' />}
                  {isEditing ? 'Update Command' : 'Create Command'}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        )}
      </DialogContent>
    </Dialog>
  )
}

// Helper function for cn
function cn(...inputs: (string | undefined | null | false)[]) {
  return inputs.filter(Boolean).join(' ')
}