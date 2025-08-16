import React, { useState, useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@promptliano/ui'
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from '@promptliano/ui'
import { Input } from '@promptliano/ui'
import { Textarea } from '@promptliano/ui'
import { Button } from '@promptliano/ui'
import { RadioGroup, RadioGroupItem } from '@promptliano/ui'
import { Label } from '@promptliano/ui'
import {
  Loader2,
  Sparkles,
  Code2,
  FileText,
  Settings,
  Brain,
  Zap,
  CheckCircle2,
  AlertCircle,
  History,
  X
} from 'lucide-react'
import { useGenerateCommand } from '@/hooks/api/use-commands-api'
import { useSelectedFiles } from '@/hooks/utility-hooks/use-selected-files'
import { useCommandGenerationCache } from '@/hooks/use-command-generation-cache'
import type { CommandGenerationRequest, ClaudeCommand, ClaudeCommandFrontmatter } from '@promptliano/schemas'
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@promptliano/ui'
import { ChevronDown } from 'lucide-react'
import { Checkbox } from '@promptliano/ui'
import { ScrollArea } from '@promptliano/ui'

const commandGenerationFormSchema = z.object({
  name: z
    .string()
    .min(1, 'Name is required')
    .max(50, 'Name is too long')
    .regex(/^[a-z0-9-]+$/, 'Name must be lowercase letters, numbers, and hyphens only'),
  description: z.string().min(1, 'Description is required').max(500, 'Description is too long'),
  userIntent: z.string().min(1, 'Intent is required').max(1000, 'Intent is too long'),
  namespace: z
    .string()
    .max(50, 'Namespace is too long')
    .regex(/^[a-z0-9-\\/]*$/, 'Namespace must be lowercase letters, numbers, hyphens, and slashes only')
    .optional()
    .transform((val) => (val === '' ? undefined : val)),
  scope: z.enum(['project', 'user'] as const),
  // Context options
  includeProjectSummary: z.boolean(),
  includeFileStructure: z.boolean(),
  includeTechStack: z.boolean(),
  includeSelectedFiles: z.boolean(),
  additionalContext: z.string().optional()
})

type CommandGenerationFormData = z.infer<typeof commandGenerationFormSchema>

interface CommandGenerationDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  projectId: number
  onCommandGenerated?: (command: {
    name: string
    content: string
    description: string
    rationale: string
    frontmatter: ClaudeCommandFrontmatter
    namespace?: string
    suggestedVariations?: Array<{
      name: string
      description: string
      changes: string
    }>
  }) => void
}

// Helper function for cn
function cn(...inputs: (string | undefined | null | false)[]) {
  return inputs.filter(Boolean).join(' ')
}

type GenerationPhase = 'idle' | 'analyzing' | 'generating' | 'finalizing' | 'complete' | 'error'

const phaseMessages: Record<GenerationPhase, { message: string; icon: React.ElementType }> = {
  idle: { message: '', icon: Sparkles },
  analyzing: { message: 'Analyzing project context and requirements...', icon: Brain },
  generating: { message: 'Generating command logic and structure...', icon: Zap },
  finalizing: { message: 'Finalizing command and adding optimizations...', icon: Settings },
  complete: { message: 'Command generated successfully!', icon: CheckCircle2 },
  error: { message: 'Generation failed. Please try again.', icon: AlertCircle }
}

export function CommandGenerationDialog({
  open,
  onOpenChange,
  projectId,
  onCommandGenerated
}: CommandGenerationDialogProps) {
  const [isAdvancedOpen, setIsAdvancedOpen] = useState(false)
  const [generationPhase, setGenerationPhase] = useState<GenerationPhase>('idle')
  const [cachedCommand, setCachedCommand] = useState<ClaudeCommand | null>(null)
  const [showCachedCommand, setShowCachedCommand] = useState(false)
  const [showRecentCommands, setShowRecentCommands] = useState(false)
  const generateCommandMutation = useGenerateCommand(projectId)
  const { selectedFiles, selectedFilePaths } = useSelectedFiles()
  const { cacheCommand, getCachedCommand, getRecentCommands } = useCommandGenerationCache(projectId)
  const recentCommands = getRecentCommands

  const form = useForm<CommandGenerationFormData>({
    resolver: zodResolver(commandGenerationFormSchema),
    defaultValues: {
      name: '',
      description: '',
      userIntent: '',
      namespace: '',
      scope: 'project',
      includeProjectSummary: true,
      includeFileStructure: true,
      includeTechStack: true,
      includeSelectedFiles: true,
      additionalContext: ''
    }
  })

  // Check for cached command when form values change
  useEffect(() => {
    const formValues = form.watch()
    if (formValues.name && formValues.scope) {
      const request: CommandGenerationRequest = {
        name: formValues.name,
        description: formValues.description || '',
        userIntent: formValues.userIntent || '',
        namespace: formValues.namespace,
        scope: formValues.scope,
        context: {
          includeProjectSummary: formValues.includeProjectSummary,
          includeFileStructure: formValues.includeFileStructure,
          includeTechStack: formValues.includeTechStack
        }
      }

      const cached = getCachedCommand(request)
      if (cached) {
        setCachedCommand(cached.generatedCommand)
        setShowCachedCommand(true)
      } else {
        setCachedCommand(null)
        setShowCachedCommand(false)
      }
    }
  }, [form.watch('name'), form.watch('scope'), getCachedCommand])

  const onSubmit = async (data: CommandGenerationFormData) => {
    const request: CommandGenerationRequest = {
      name: data.name,
      description: data.description,
      userIntent: data.userIntent,
      namespace: data.namespace,
      scope: data.scope,
      context: {
        includeProjectSummary: data.includeProjectSummary,
        includeFileStructure: data.includeFileStructure,
        includeTechStack: data.includeTechStack,
        selectedFiles: data.includeSelectedFiles && selectedFilePaths.length > 0 ? selectedFilePaths : undefined,
        additionalContext: data.additionalContext || undefined
      }
    }

    try {
      setGenerationPhase('analyzing')

      // Simulate phase progression
      const phaseTimeout = setTimeout(() => {
        setGenerationPhase('generating')
        setTimeout(() => {
          setGenerationPhase('finalizing')
        }, 15000) // Move to finalizing after 15 seconds
      }, 5000) // Move to generating after 5 seconds

      const result = await generateCommandMutation.mutateAsync(request)

      clearTimeout(phaseTimeout)
      setGenerationPhase('complete')

      // Extract the command data from the response
      const generatedCommand = (result as any).data

      // Create a ClaudeCommand object for caching - needs all required fields
      const commandForCache: ClaudeCommand = {
        id: Date.now(), // Generate temporary ID for cache
        name: generatedCommand.name,
        content: generatedCommand.content,
        created: Date.now(),
        updated: Date.now(),
        filePath: '', // Not available from generation, will be set when saved
        scope: request.scope,
        frontmatter: generatedCommand.frontmatter || {}
      }

      // Cache the generated command with full ClaudeCommand structure
      cacheCommand(request, commandForCache)

      if (onCommandGenerated) {
        onCommandGenerated(generatedCommand)
      }

      // Brief delay to show success state
      setTimeout(() => {
        onOpenChange(false)
        form.reset()
        setGenerationPhase('idle')
        setCachedCommand(null)
        setShowCachedCommand(false)
      }, 1000)
    } catch (error) {
      setGenerationPhase('error')
      // Error is handled by the mutation and will show toast

      // Auto-reset to idle after 3 seconds to allow retry
      setTimeout(() => {
        if (generationPhase === 'error') {
          setGenerationPhase('idle')
        }
      }, 3000)
    }
  }

  const isGenerating = generationPhase !== 'idle' && generationPhase !== 'complete' && generationPhase !== 'error'
  const CurrentPhaseIcon = phaseMessages[generationPhase].icon

  return (
    <Dialog
      open={open}
      onOpenChange={(newOpen) => {
        if (!newOpen && !isGenerating) {
          setGenerationPhase('idle')
        }
        onOpenChange(newOpen)
      }}
    >
      <DialogContent className='sm:max-w-[725px] max-h-[90vh] overflow-y-auto'>
        <DialogHeader>
          <DialogTitle className='flex items-center gap-2'>
            <Sparkles className='h-5 w-5 text-primary' />
            Generate Command with AI
          </DialogTitle>
          <DialogDescription>
            Describe what you want your command to do, and AI will generate a complete slash command for you.
          </DialogDescription>
        </DialogHeader>

        {/* Progress Indicator */}
        {generationPhase !== 'idle' && (
          <div className='mb-4 p-4 rounded-lg bg-muted/50 border'>
            <div className='flex items-center gap-3'>
              <CurrentPhaseIcon
                className={cn(
                  'h-5 w-5',
                  generationPhase === 'analyzing' && 'text-blue-500 animate-pulse',
                  generationPhase === 'generating' && 'text-purple-500 animate-pulse',
                  generationPhase === 'finalizing' && 'text-orange-500 animate-pulse',
                  generationPhase === 'complete' && 'text-green-500',
                  generationPhase === 'error' && 'text-red-500'
                )}
              />
              <div className='flex-1'>
                <p className='text-sm font-medium'>{phaseMessages[generationPhase].message}</p>
                {isGenerating && (
                  <div className='mt-2 w-full bg-secondary rounded-full h-2 overflow-hidden'>
                    <div
                      className={cn(
                        'h-full bg-primary transition-all duration-1000',
                        generationPhase === 'analyzing' && 'w-1/3',
                        generationPhase === 'generating' && 'w-2/3',
                        generationPhase === 'finalizing' && 'w-5/6'
                      )}
                    />
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Cached Command Notification */}
        {cachedCommand && showCachedCommand && generationPhase === 'idle' && (
          <div className='mb-4 p-4 rounded-lg bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800'>
            <div className='flex items-start gap-3'>
              <History className='h-5 w-5 text-blue-600 dark:text-blue-400 mt-0.5' />
              <div className='flex-1'>
                <p className='text-sm font-medium text-blue-900 dark:text-blue-100'>
                  Previously Generated Command Found
                </p>
                <p className='text-sm text-blue-700 dark:text-blue-300 mt-1'>
                  A command with this name and scope was recently generated. You can use it directly or regenerate with
                  new requirements.
                </p>
                <div className='flex gap-2 mt-3'>
                  <Button
                    size='sm'
                    variant='outline'
                    type='button'
                    onClick={() => {
                      if (onCommandGenerated && cachedCommand) {
                        // Extract only the properties expected by the callback
                        onCommandGenerated({
                          name: cachedCommand.name,
                          content: cachedCommand.content,
                          description: cachedCommand.description || '',
                          rationale: 'Using cached command',
                          frontmatter: cachedCommand.frontmatter,
                          namespace: cachedCommand.namespace
                        })
                      }
                      onOpenChange(false)
                    }}
                  >
                    <CheckCircle2 className='h-4 w-4 mr-1' />
                    Use Cached Command
                  </Button>
                  <Button size='sm' variant='ghost' type='button' onClick={() => setShowCachedCommand(false)}>
                    <X className='h-4 w-4 mr-1' />
                    Dismiss
                  </Button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Recent Commands */}
        {recentCommands.length > 0 && generationPhase === 'idle' && (
          <Collapsible open={showRecentCommands} onOpenChange={setShowRecentCommands} className='mb-4'>
            <CollapsibleTrigger asChild>
              <Button variant='ghost' className='w-full justify-between p-2 h-auto' type='button'>
                <span className='flex items-center gap-2'>
                  <History className='h-4 w-4' />
                  Recent Generated Commands ({recentCommands.length})
                </span>
                <ChevronDown className={cn('h-4 w-4 transition-transform', showRecentCommands && 'rotate-180')} />
              </Button>
            </CollapsibleTrigger>
            <CollapsibleContent className='pt-2'>
              <ScrollArea className='max-h-[200px]'>
                <div className='space-y-2'>
                  {recentCommands.map((item, index) => (
                    <div
                      key={index}
                      className='p-3 rounded-lg border bg-card hover:bg-accent/50 cursor-pointer transition-colors'
                      onClick={() => {
                        form.setValue('name', item.request.name)
                        form.setValue('description', item.request.description)
                        form.setValue('userIntent', item.request.userIntent)
                        form.setValue('namespace', item.request.namespace || '')
                        form.setValue('scope', item.request.scope)
                        setShowRecentCommands(false)
                      }}
                    >
                      <div className='flex items-start justify-between'>
                        <div className='flex-1'>
                          <p className='font-medium text-sm'>{item.request.name}</p>
                          <p className='text-xs text-muted-foreground mt-1'>{item.request.description}</p>
                        </div>
                        <Button
                          size='sm'
                          variant='ghost'
                          type='button'
                          className='ml-2'
                          onClick={(e) => {
                            e.stopPropagation()
                            if (onCommandGenerated && item.generatedCommand) {
                              onCommandGenerated({
                                name: item.generatedCommand.name,
                                content: item.generatedCommand.content,
                                description: item.generatedCommand.description || '',
                                rationale: 'Using cached command',
                                frontmatter: item.generatedCommand.frontmatter,
                                namespace: item.generatedCommand.namespace
                              })
                            }
                            onOpenChange(false)
                          }}
                        >
                          Use
                        </Button>
                      </div>
                      <p className='text-xs text-muted-foreground mt-2'>
                        Generated {new Date(item.timestamp).toLocaleDateString()}
                      </p>
                    </div>
                  ))}
                </div>
              </ScrollArea>
            </CollapsibleContent>
          </Collapsible>
        )}

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className='space-y-4'>
            <FormField
              control={form.control}
              name='name'
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Command Name</FormLabel>
                  <FormControl>
                    <Input placeholder='test-coverage' {...field} disabled={isGenerating} />
                  </FormControl>
                  <FormDescription>What should the command be called?</FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name='description'
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Brief Description</FormLabel>
                  <FormControl>
                    <Input placeholder='Run tests with coverage reporting' {...field} disabled={isGenerating} />
                  </FormControl>
                  <FormDescription>A short summary of what the command does</FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name='userIntent'
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Detailed Requirements</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder='I want a command that runs all tests for the current file or directory, shows a coverage report, and fails if coverage is below 80%. It should detect the test framework automatically and use the right commands.'
                      className='min-h-[100px]'
                      {...field}
                      disabled={isGenerating}
                    />
                  </FormControl>
                  <FormDescription>Explain in detail what you want the command to accomplish</FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className='grid grid-cols-2 gap-4'>
              <FormField
                control={form.control}
                name='namespace'
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Namespace (Optional)</FormLabel>
                    <FormControl>
                      <Input placeholder='testing' {...field} disabled={isGenerating} />
                    </FormControl>
                    <FormDescription>Group related commands together</FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

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
                        className='flex gap-4 pt-2'
                        disabled={isGenerating}
                      >
                        <div className='flex items-center space-x-2'>
                          <RadioGroupItem value='project' id='gen-project' />
                          <Label htmlFor='gen-project'>Project</Label>
                        </div>
                        <div className='flex items-center space-x-2'>
                          <RadioGroupItem value='user' id='gen-user' />
                          <Label htmlFor='gen-user'>User</Label>
                        </div>
                      </RadioGroup>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            {/* Advanced Context Options */}
            <Collapsible open={isAdvancedOpen} onOpenChange={setIsAdvancedOpen}>
              <CollapsibleTrigger asChild>
                <Button variant='ghost' className='w-full justify-between' type='button' disabled={isGenerating}>
                  <span className='flex items-center gap-2'>
                    <Settings className='h-4 w-4' />
                    AI Context Options
                  </span>
                  <ChevronDown className={cn('h-4 w-4 transition-transform', isAdvancedOpen && 'rotate-180')} />
                </Button>
              </CollapsibleTrigger>
              <CollapsibleContent className='space-y-4 pt-4'>
                <div className='space-y-3'>
                  <FormField
                    control={form.control}
                    name='includeProjectSummary'
                    render={({ field }) => (
                      <FormItem className='flex flex-row items-center space-x-3 space-y-0'>
                        <FormControl>
                          <Checkbox checked={field.value} onCheckedChange={field.onChange} disabled={isGenerating} />
                        </FormControl>
                        <div className='space-y-1 leading-none'>
                          <FormLabel>Include Project Summary</FormLabel>
                          <FormDescription>
                            Provide AI with project structure and tech stack information
                          </FormDescription>
                        </div>
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name='includeFileStructure'
                    render={({ field }) => (
                      <FormItem className='flex flex-row items-center space-x-3 space-y-0'>
                        <FormControl>
                          <Checkbox checked={field.value} onCheckedChange={field.onChange} disabled={isGenerating} />
                        </FormControl>
                        <div className='space-y-1 leading-none'>
                          <FormLabel>Include File Structure</FormLabel>
                          <FormDescription>Share the project's file tree with AI</FormDescription>
                        </div>
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name='includeTechStack'
                    render={({ field }) => (
                      <FormItem className='flex flex-row items-center space-x-3 space-y-0'>
                        <FormControl>
                          <Checkbox checked={field.value} onCheckedChange={field.onChange} disabled={isGenerating} />
                        </FormControl>
                        <div className='space-y-1 leading-none'>
                          <FormLabel>Include Tech Stack</FormLabel>
                          <FormDescription>Detect and share technologies used in the project</FormDescription>
                        </div>
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name='includeSelectedFiles'
                    render={({ field }) => (
                      <FormItem className='flex flex-row items-center space-x-3 space-y-0'>
                        <FormControl>
                          <Checkbox
                            checked={field.value}
                            onCheckedChange={field.onChange}
                            disabled={isGenerating || selectedFilePaths.length === 0}
                          />
                        </FormControl>
                        <div className='space-y-1 leading-none'>
                          <FormLabel>Include Selected Files ({selectedFilePaths.length})</FormLabel>
                          <FormDescription>
                            {selectedFilePaths.length > 0
                              ? 'Share the currently selected files with AI'
                              : 'No files selected'}
                          </FormDescription>
                        </div>
                      </FormItem>
                    )}
                  />
                </div>

                <FormField
                  control={form.control}
                  name='additionalContext'
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Additional Context (Optional)</FormLabel>
                      <FormControl>
                        <Textarea
                          placeholder='We use Jest for testing with custom utilities in src/test-utils.ts. Our CI requires 80% coverage...'
                          className='min-h-[80px]'
                          {...field}
                          disabled={isGenerating}
                        />
                      </FormControl>
                      <FormDescription>Any other information that might help generate a better command</FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </CollapsibleContent>
            </Collapsible>

            <DialogFooter>
              <Button
                type='button'
                variant='outline'
                onClick={() => {
                  if (!isGenerating) {
                    onOpenChange(false)
                    setGenerationPhase('idle')
                  }
                }}
                disabled={isGenerating}
              >
                {isGenerating ? 'Generating...' : 'Cancel'}
              </Button>
              <Button
                type='submit'
                disabled={isGenerating || generationPhase === 'complete'}
                variant={generationPhase === 'error' ? 'destructive' : 'default'}
              >
                {isGenerating && <Loader2 className='h-4 w-4 mr-2 animate-spin' />}
                {generationPhase === 'error' ? 'Retry' : isGenerating ? 'Generating Command...' : 'Generate Command'}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  )
}
