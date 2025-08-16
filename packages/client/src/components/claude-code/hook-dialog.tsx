import React, { useState, useEffect } from 'react'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@promptliano/ui'
import { Button } from '@promptliano/ui'
import { Input } from '@promptliano/ui'
import { Label } from '@promptliano/ui'
import { Textarea } from '@promptliano/ui'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@promptliano/ui'
// Removed Switch import - no longer needed
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@promptliano/ui'
import { Badge } from '@promptliano/ui'
import { ScrollArea } from '@promptliano/ui'
import { Loader2, Sparkles, FileText } from 'lucide-react'
import { useCreateHook, useUpdateHook, useGenerateHook } from '@/hooks/api/use-claude-hooks'
import { useGetProject } from '@/hooks/api/use-projects-api'
import { HOOK_TEMPLATES, getTemplatesByCategory, type HookTemplate } from '@promptliano/shared'
import type { HookEvent, CreateHookConfigBody } from '@promptliano/schemas'
import { toast } from 'sonner'

interface HookDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  hookId: string | null
  projectId: number
  initialData?: {
    eventName: HookEvent
    matcher: string
    command: string
    timeout?: number
    matcherIndex?: number
  }
}

const HOOK_EVENTS: { value: HookEvent; label: string; description: string }[] = [
  { value: 'PreToolUse', label: 'Pre Tool Use', description: 'Before any tool is executed' },
  { value: 'PostToolUse', label: 'Post Tool Use', description: 'After any tool is executed' },
  { value: 'UserPromptSubmit', label: 'User Prompt Submit', description: 'When user submits a prompt' },
  { value: 'Notification', label: 'Notification', description: 'When a notification is triggered' },
  { value: 'Stop', label: 'Stop', description: 'When Claude Code is stopped' },
  { value: 'SubagentStop', label: 'Subagent Stop', description: 'When a subagent is stopped' },
  { value: 'SessionStart', label: 'Session Start', description: 'When a new session starts' },
  { value: 'PreCompact', label: 'Pre Compact', description: 'Before context compaction' }
]

// Removed MATCHER_TYPES - Claude Code uses simple string matchers

export function HookDialog({ open, onOpenChange, hookId, projectId, initialData }: HookDialogProps) {
  const isEditing = !!hookId
  const [activeTab, setActiveTab] = useState<'manual' | 'templates' | 'ai'>('manual')
  const [selectedTemplate, setSelectedTemplate] = useState<HookTemplate | null>(null)
  const [aiDescription, setAiDescription] = useState('')

  // Form state
  const [eventName, setEventName] = useState<HookEvent>(initialData?.eventName || 'PreToolUse')
  const [matcher, setMatcher] = useState(initialData?.matcher || '')
  const [command, setCommand] = useState(initialData?.command || '')
  const [timeout, setTimeout] = useState(initialData?.timeout?.toString() || '')

  // API hooks
  const { data: project } = useGetProject(projectId)
  const projectPath = project?.path || ''
  const createHook = useCreateHook(projectPath)
  const updateHook = useUpdateHook(projectPath)
  const generateHook = useGenerateHook(projectPath)

  // Reset form when dialog opens/closes
  useEffect(() => {
    if (!open) {
      setActiveTab('manual')
      setSelectedTemplate(null)
      setAiDescription('')
      if (!initialData) {
        setEventName('PreToolUse')
        setMatcher('')
        setCommand('')
        setTimeout('')
      }
    }
  }, [open, initialData])

  // Apply template
  useEffect(() => {
    if (selectedTemplate) {
      setEventName(selectedTemplate.event)
      setMatcher(selectedTemplate.matcher)
      setCommand(selectedTemplate.config.command)
      setTimeout(selectedTemplate.config.timeout?.toString() || '')
    }
  }, [selectedTemplate])

  const handleGenerateFromAI = async () => {
    if (!aiDescription.trim()) {
      toast.error('Please enter a description')
      return
    }

    const result = await generateHook.mutateAsync({
      description: aiDescription,
      context: { suggestedEvent: eventName }
    })

    if (result) {
      setEventName(result.event)
      setMatcher(result.matcher)
      setCommand(result.command)
      setTimeout(result.timeout?.toString() || '')
      setActiveTab('manual')
      toast.success('Hook generated successfully')
    }
  }

  const handleSubmit = async () => {
    if (!projectPath) return

    const hookData: CreateHookConfigBody = {
      event: eventName,
      matcher,
      command,
      timeout: timeout ? parseInt(timeout, 10) : undefined
    }

    try {
      if (isEditing && initialData?.matcherIndex !== undefined) {
        await updateHook.mutateAsync({
          eventName,
          matcherIndex: initialData.matcherIndex,
          data: {
            event: eventName,
            matcherIndex: initialData.matcherIndex,
            matcher,
            command,
            timeout: timeout ? parseInt(timeout, 10) : undefined
          }
        })
      } else {
        await createHook.mutateAsync(hookData)
      }
      onOpenChange(false)
    } catch (error) {
      // Error toast is handled by the mutation hook
    }
  }

  const isFormValid = eventName && matcher && command

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className='sm:max-w-[700px] max-h-[80vh]'>
        <DialogHeader>
          <DialogTitle>{isEditing ? 'Edit Hook' : 'Create New Hook'}</DialogTitle>
          <DialogDescription>
            Configure automated hooks to run commands at specific Claude Code events.
          </DialogDescription>
        </DialogHeader>

        {/* Security Warning */}
        <div className='bg-warning/10 border border-warning/20 rounded-lg p-3 mb-4'>
          <div className='flex items-start gap-2'>
            <span className='text-warning text-sm'>⚠️</span>
            <div className='text-sm text-muted-foreground'>
              <strong className='text-foreground'>Security Notice:</strong> Hooks execute shell commands with full
              system access. Only use commands you trust and understand. Malicious hooks can damage your system or
              expose sensitive data.
            </div>
          </div>
        </div>

        <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as any)}>
          <TabsList className='grid w-full grid-cols-3'>
            <TabsTrigger value='manual'>Manual</TabsTrigger>
            <TabsTrigger value='templates' disabled={isEditing}>
              <FileText className='w-4 h-4 mr-2' />
              Templates
            </TabsTrigger>
            <TabsTrigger value='ai' disabled={isEditing}>
              <Sparkles className='w-4 h-4 mr-2' />
              AI Generate
            </TabsTrigger>
          </TabsList>

          <TabsContent value='manual' className='space-y-4'>
            <div className='grid gap-4'>
              <div className='space-y-2'>
                <Label>Event</Label>
                <Select value={eventName} onValueChange={(v) => setEventName(v as HookEvent)} disabled={isEditing}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {HOOK_EVENTS.map((event) => (
                      <SelectItem key={event.value} value={event.value}>
                        <div>
                          <div>{event.label}</div>
                          <div className='text-xs text-muted-foreground'>{event.description}</div>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className='space-y-2'>
                <Label>Matcher Pattern</Label>
                <Input
                  value={matcher}
                  onChange={(e) => setMatcher(e.target.value)}
                  placeholder='Enter regex pattern (e.g., Edit|Write, .*\.test\.ts$)'
                />
                <p className='text-xs text-muted-foreground'>
                  Use regex patterns to match tool names, file paths, or other event data
                </p>
              </div>

              <div className='space-y-2'>
                <Label>Command</Label>
                <Textarea
                  value={command}
                  onChange={(e) => setCommand(e.target.value)}
                  placeholder="echo 'Hook triggered!'"
                  rows={3}
                />
                <p className='text-xs text-muted-foreground'>Command to execute when the hook is triggered</p>
              </div>

              <div className='space-y-2'>
                <Label>Timeout (seconds)</Label>
                <Input
                  type='number'
                  value={timeout}
                  onChange={(e) => setTimeout(e.target.value)}
                  placeholder='60'
                  min='1'
                />
                <p className='text-xs text-muted-foreground'>
                  Maximum time to wait for command completion (default: 60 seconds)
                </p>
              </div>
            </div>
          </TabsContent>

          <TabsContent value='templates' className='space-y-4'>
            <ScrollArea className='h-[400px] pr-4'>
              <div className='space-y-6'>
                {(['security', 'workflow', 'logging', 'testing', 'productivity'] as const).map((category) => {
                  const templates = getTemplatesByCategory(category)
                  if (templates.length === 0) return null

                  return (
                    <div key={category}>
                      <h3 className='text-sm font-medium capitalize mb-3'>{category}</h3>
                      <div className='space-y-2'>
                        {templates.map((template) => (
                          <div
                            key={template.id}
                            className={`p-3 rounded-lg border cursor-pointer transition-colors ${
                              selectedTemplate?.id === template.id
                                ? 'border-primary bg-primary/5'
                                : 'border-border hover:border-primary/50'
                            }`}
                            onClick={() => setSelectedTemplate(template)}
                          >
                            <div className='flex items-start justify-between'>
                              <div className='flex-1'>
                                <h4 className='font-medium text-sm'>{template.name}</h4>
                                <p className='text-xs text-muted-foreground mt-1'>{template.description}</p>
                              </div>
                            </div>
                            <div className='flex flex-wrap gap-1 mt-2'>
                              {template.tags.map((tag) => (
                                <Badge key={tag} variant='secondary' className='text-xs'>
                                  {tag}
                                </Badge>
                              ))}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )
                })}
              </div>
            </ScrollArea>
          </TabsContent>

          <TabsContent value='ai' className='space-y-4'>
            <div className='space-y-4'>
              <div className='space-y-2'>
                <Label>Describe what you want the hook to do</Label>
                <Textarea
                  value={aiDescription}
                  onChange={(e) => setAiDescription(e.target.value)}
                  placeholder='Block all rm -rf commands and show a warning message'
                  rows={4}
                />
              </div>

              <div className='space-y-2'>
                <Label>Target Event</Label>
                <Select value={eventName} onValueChange={(v) => setEventName(v as HookEvent)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {HOOK_EVENTS.map((event) => (
                      <SelectItem key={event.value} value={event.value}>
                        <div>
                          <div>{event.label}</div>
                          <div className='text-xs text-muted-foreground'>{event.description}</div>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <Button
                onClick={handleGenerateFromAI}
                disabled={!aiDescription.trim() || generateHook.isPending}
                className='w-full'
              >
                {generateHook.isPending ? (
                  <Loader2 className='w-4 h-4 mr-2 animate-spin' />
                ) : (
                  <Sparkles className='w-4 h-4 mr-2' />
                )}
                Generate Hook
              </Button>
            </div>
          </TabsContent>
        </Tabs>

        <DialogFooter>
          <Button variant='outline' onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={
              !isFormValid ||
              createHook.isPending ||
              updateHook.isPending ||
              (activeTab === 'templates' && !selectedTemplate)
            }
          >
            {createHook.isPending || updateHook.isPending ? <Loader2 className='w-4 h-4 mr-2 animate-spin' /> : null}
            {isEditing ? 'Update' : 'Create'} Hook
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
