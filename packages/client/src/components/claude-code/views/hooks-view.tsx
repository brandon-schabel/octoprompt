import React, { useState, useMemo } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@promptliano/ui'
import { Button } from '@promptliano/ui'
import { Input } from '@promptliano/ui'
import { Badge } from '@promptliano/ui'
import { Plus, Search, Edit, Trash2, Terminal, Clock, Loader2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Skeleton } from '@promptliano/ui'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle
} from '@promptliano/ui'
import { HookDialog } from '../hook-dialog'
import type { HookListItem, HookEvent } from '@promptliano/schemas'
import { useGetProjectHooks, useDeleteHook } from '@/hooks/api/use-claude-hooks'
import { useGetProject } from '@/hooks/api/use-projects-api'
import { toast } from 'sonner'

interface HooksViewProps {
  projectId: number
  projectName?: string
}

// Event type color mapping with proper contrast
const eventColorClasses: Record<HookEvent, string> = {
  PreToolUse: 'bg-blue-600 text-white hover:bg-blue-700', // Blue with white text
  PostToolUse: 'bg-teal-600 text-white hover:bg-teal-700', // Teal with white text
  UserPromptSubmit: 'bg-purple-600 text-white hover:bg-purple-700', // Purple with white text
  Notification: 'bg-sky-600 text-white hover:bg-sky-700', // Sky blue with white text
  Stop: 'bg-red-600 text-white hover:bg-red-700', // Red with white text
  SubagentStop: 'bg-amber-600 text-white hover:bg-amber-700', // Amber with white text
  SessionStart: 'bg-orange-600 text-white hover:bg-orange-700', // Orange with white text
  PreCompact: 'bg-pink-600 text-white hover:bg-pink-700' // Pink with white text
}

// No longer needed - removed config levels

export function HooksView({ projectId, projectName }: HooksViewProps) {
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedHook, setSelectedHook] = useState<string | null>(null)
  const [deleteHookId, setDeleteHookId] = useState<string | null>(null)
  const [hookDialogOpen, setHookDialogOpen] = useState(false)
  const [editingHookId, setEditingHookId] = useState<string | null>(null)
  const [deletingHook, setDeletingHook] = useState<HookListItem | null>(null)

  // Get project path for API calls
  const { data: project, isLoading: isProjectLoading, error: projectError } = useGetProject(projectId)
  const projectPath = project?.path || ''

  // Get hooks from API - only enable when we have a project path
  const { data: hooksData, isLoading: isHooksLoading, error: hooksError } = useGetProjectHooks(projectPath)
  const hooks = hooksData || []

  console.log({ hooksData })

  // Combine loading states
  const isLoading = isProjectLoading || isHooksLoading
  // Only show error if there's a hooks error (not a project error)
  const error = hooksError

  // Delete hook mutation
  const deleteHookMutation = useDeleteHook(projectPath)

  const filteredHooks = hooks.filter(
    (hook: any) =>
      hook.event.toLowerCase().includes(searchQuery.toLowerCase()) ||
      hook.matcher.toLowerCase().includes(searchQuery.toLowerCase()) ||
      hook.command.toLowerCase().includes(searchQuery.toLowerCase())
  )

  // Group hooks by event type for better organization
  const groupedHooks = filteredHooks.reduce(
    (acc: any, hook: any) => {
      if (!acc[hook.event]) {
        acc[hook.event] = []
      }
      acc[hook.event].push(hook)
      return acc
    },
    {} as Record<HookEvent, HookListItem[]>
  )

  const handleCreateHook = () => {
    setEditingHookId(null)
    setHookDialogOpen(true)
  }

  const handleEditHook = (hookId: string) => {
    setEditingHookId(hookId)
    setHookDialogOpen(true)
  }

  const handleDeleteHook = (hook: HookListItem) => {
    setDeletingHook(hook)
    setDeleteHookId(`${hook.event}_${hook.matcherIndex}`)
  }

  const confirmDelete = async () => {
    if (deletingHook) {
      try {
        await deleteHookMutation.mutateAsync({
          eventName: deletingHook.event,
          matcherIndex: deletingHook.matcherIndex
        })
      } catch (error) {
        console.error('Failed to delete hook:', error)
        toast.error('Failed to delete hook')
      } finally {
        setDeleteHookId(null)
        setDeletingHook(null)
        if (selectedHook === deleteHookId) {
          setSelectedHook(null)
        }
      }
    }
  }

  const truncateCommand = (command: string, maxLength: number = 50) => {
    return command.length > maxLength ? command.substring(0, maxLength) + '...' : command
  }

  return (
    <div className='p-6 space-y-6'>
      {/* Header */}
      <div className='flex items-center justify-between'>
        <div>
          <h2 className='text-2xl font-bold'>Claude Code Hooks</h2>
          <p className='text-muted-foreground'>Manage automated hooks for {projectName || 'this project'}</p>
        </div>
        <Button onClick={handleCreateHook}>
          <Plus className='h-4 w-4 mr-2' />
          New Hook
        </Button>
      </div>

      {/* Security Notice */}
      <Card className='bg-warning/5 border-warning/20'>
        <CardContent className='pt-6'>
          <div className='flex items-start gap-3'>
            <span className='text-warning mt-0.5'>⚠️</span>
            <div className='space-y-1'>
              <p className='text-sm font-medium'>Security Warning</p>
              <p className='text-sm text-muted-foreground'>
                Hooks execute shell commands with full system privileges. Only create hooks with commands you trust.
                Hooks are stored in <code className='text-xs bg-muted px-1 py-0.5 rounded'>.claude/settings.json</code>{' '}
                and will run automatically when Claude Code matches the specified patterns.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Search */}
      <div className='relative'>
        <Search className='absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground' />
        <Input
          placeholder='Search hooks by event, matcher, or command...'
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className='pl-10'
        />
      </div>

      {/* Loading State */}
      {isLoading && (
        <div className='space-y-4'>
          {[1, 2, 3].map((i) => (
            <Card key={i}>
              <CardHeader>
                <Skeleton className='h-6 w-3/4' />
              </CardHeader>
              <CardContent>
                <Skeleton className='h-4 w-full mb-2' />
                <Skeleton className='h-4 w-2/3' />
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Error States */}
      {projectError && (
        <div className='text-center py-12'>
          <p className='text-destructive mb-4'>Failed to load project information.</p>
          <Button variant='outline' onClick={() => window.location.reload()}>
            Retry
          </Button>
        </div>
      )}

      {!projectError && error && (
        <div className='text-center py-12'>
          <p className='text-destructive mb-4'>Failed to load hooks. Please try again.</p>
          <Button variant='outline' onClick={() => window.location.reload()}>
            Retry
          </Button>
        </div>
      )}

      {/* Hooks List - Organized by Event Type */}
      {!isLoading && !error && !projectError && (
        <div className='space-y-6'>
          {Object.entries(groupedHooks).map(([event, eventHooks]: [string, any]) => (
            <div key={event} className='space-y-4'>
              <div className='flex items-center gap-2'>
                <Badge className={cn('px-3 py-1', eventColorClasses[event as HookEvent])}>{event}</Badge>
                <span className='text-sm text-muted-foreground'>
                  {eventHooks.length} hook{eventHooks.length !== 1 ? 's' : ''}
                </span>
              </div>

              <div className='grid grid-cols-1 gap-4'>
                {eventHooks.map((hook: any) => (
                  <Card
                    key={`${hook.event}_${hook.matcherIndex}`}
                    className={cn(
                      'cursor-pointer transition-colors',
                      selectedHook === `${hook.event}_${hook.matcherIndex}` && 'ring-2 ring-primary'
                    )}
                    onClick={() => setSelectedHook(`${hook.event}_${hook.matcherIndex}`)}
                  >
                    <CardHeader>
                      <div className='flex items-start justify-between'>
                        <div className='space-y-2'>
                          <div className='flex items-center gap-2'>
                            <CardTitle className='text-lg'>Matcher: {hook.matcher}</CardTitle>
                          </div>
                          <CardDescription className='flex items-center gap-2'>
                            <Terminal className='h-3 w-3' />
                            <code className='text-xs'>{truncateCommand(hook.command)}</code>
                          </CardDescription>
                        </div>
                        <div className='flex gap-1'>
                          <Button
                            variant='ghost'
                            size='icon'
                            className='h-8 w-8'
                            onClick={(e) => {
                              e.stopPropagation()
                              handleEditHook(`${hook.event}_${hook.matcherIndex}`)
                            }}
                          >
                            <Edit className='h-4 w-4' />
                          </Button>
                          <Button
                            variant='ghost'
                            size='icon'
                            className='h-8 w-8'
                            onClick={(e) => {
                              e.stopPropagation()
                              handleDeleteHook(hook)
                            }}
                          >
                            <Trash2 className='h-4 w-4' />
                          </Button>
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent>
                      <div className='flex items-center gap-4 text-xs text-muted-foreground'>
                        {hook.timeout && (
                          <div className='flex items-center gap-1'>
                            <Clock className='h-3 w-3' />
                            Timeout: {hook.timeout}s
                          </div>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Empty State */}
      {!isLoading && !error && !projectError && filteredHooks.length === 0 && (
        <div className='text-center py-12'>
          <p className='text-muted-foreground mb-4'>
            {searchQuery ? 'No hooks found matching your search.' : 'No hooks configured yet.'}
          </p>
          {!searchQuery && (
            <Button onClick={handleCreateHook}>
              <Plus className='h-4 w-4 mr-2' />
              Create Your First Hook
            </Button>
          )}
        </div>
      )}

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={!!deleteHookId} onOpenChange={(open) => !open && setDeleteHookId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Hook</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this hook? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmDelete}
              className='bg-destructive text-destructive-foreground hover:bg-destructive/90'
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Hook Create/Edit Dialog */}
      <HookDialog
        open={hookDialogOpen}
        onOpenChange={(open) => {
          setHookDialogOpen(open)
          if (!open) {
            setEditingHookId(null)
          }
        }}
        hookId={editingHookId}
        projectId={projectId}
        initialData={(() => {
          if (!editingHookId) return undefined
          const [eventName, matcherIndexStr] = editingHookId.split('_')
          const matcherIndex = parseInt(matcherIndexStr, 10)
          const hook = hooks.find((h: any) => h.event === eventName && h.matcherIndex === matcherIndex)
          if (!hook) return undefined

          return {
            eventName: hook.event,
            matcher: hook.matcher,
            command: hook.command,
            timeout: hook.timeout,
            matcherIndex: hook.matcherIndex
          }
        })()}
      />
    </div>
  )
}
