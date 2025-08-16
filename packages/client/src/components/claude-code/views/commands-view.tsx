import React, { useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@promptliano/ui'
import { Button } from '@promptliano/ui'
import { Input } from '@promptliano/ui'
import { Badge } from '@promptliano/ui'
import { Plus, Search, Edit, Trash2, Terminal, Calendar, Loader2, FolderOpen, User, Sparkles } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useGetProjectCommands, useDeleteCommand } from '@/hooks/api-hooks'
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
import { CommandDialog } from '../command-dialog'
import { CommandGenerationDialog } from '../command-generation-dialog'
import type { ClaudeCommand, ClaudeCommandFrontmatter } from '@promptliano/schemas'

interface CommandsViewProps {
  projectId: number
  projectName?: string
}

export function CommandsView({ projectId, projectName }: CommandsViewProps) {
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedCommand, setSelectedCommand] = useState<ClaudeCommand | null>(null)
  const [deleteCommand, setDeleteCommand] = useState<{ name: string; namespace?: string } | null>(null)
  const [commandDialogOpen, setCommandDialogOpen] = useState(false)
  const [editingCommand, setEditingCommand] = useState<{ name: string; namespace?: string } | null>(null)
  const [generatedCommand, setGeneratedCommand] = useState<ClaudeCommand | null>(null)
  const [generationDialogOpen, setGenerationDialogOpen] = useState(false)

  // Fetch commands for this specific project
  const { data: commandsResponse, isLoading, error } = useGetProjectCommands(projectId)
  const deleteCommandMutation = useDeleteCommand(projectId)

  const commands = commandsResponse?.data || []

  const filteredCommands = commands.filter((command: any) => {
    const searchLower = searchQuery.toLowerCase()
    return (
      command.name.toLowerCase().includes(searchLower) ||
      command.description?.toLowerCase().includes(searchLower) ||
      command.namespace?.toLowerCase().includes(searchLower) ||
      command.content.toLowerCase().includes(searchLower)
    )
  })

  const handleCreateCommand = () => {
    setEditingCommand(null)
    setGeneratedCommand(null)
    setCommandDialogOpen(true)
  }

  const handleEditCommand = (command: ClaudeCommand) => {
    setEditingCommand({ name: command.name, namespace: command.namespace })
    setGeneratedCommand(null)
    setCommandDialogOpen(true)
  }

  const handleDeleteCommand = (command: ClaudeCommand) => {
    setDeleteCommand({ name: command.name, namespace: command.namespace })
  }

  const confirmDelete = () => {
    if (deleteCommand) {
      deleteCommandMutation.mutate(
        {
          commandName: deleteCommand.name,
          namespace: deleteCommand.namespace
        },
        {
          onSuccess: () => {
            setDeleteCommand(null)
            if (selectedCommand?.name === deleteCommand.name) {
              setSelectedCommand(null)
            }
          }
        }
      )
    }
  }

  const handleCommandGenerated = (command: {
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
  }) => {
    // After generating, open the command dialog with the generated content
    // Create a partial ClaudeCommand with available fields
    const partialCommand: Partial<ClaudeCommand> = {
      name: command.name,
      content: command.content,
      description: command.description,
      frontmatter: command.frontmatter,
      namespace: command.namespace
    }
    setEditingCommand(null)
    setGeneratedCommand(partialCommand as ClaudeCommand)
    setCommandDialogOpen(true)
  }

  // Group commands by namespace
  const commandsByNamespace = filteredCommands.reduce(
    (acc: any, command: any) => {
      const namespace = command.namespace || 'root'
      if (!acc[namespace]) {
        acc[namespace] = []
      }
      acc[namespace].push(command)
      return acc
    },
    {} as Record<string, ClaudeCommand[]>
  )

  return (
    <div className='p-6 space-y-6'>
      {/* Header */}
      <div className='flex items-center justify-between'>
        <div>
          <h2 className='text-2xl font-bold'>Claude Code Commands</h2>
          <p className='text-muted-foreground'>Manage slash commands for {projectName || 'this project'}</p>
        </div>
        <div className='flex gap-2'>
          <Button variant='outline' onClick={() => setGenerationDialogOpen(true)}>
            <Sparkles className='h-4 w-4 mr-2' />
            Generate with AI
          </Button>
          <Button onClick={handleCreateCommand}>
            <Plus className='h-4 w-4 mr-2' />
            New Command
          </Button>
        </div>
      </div>

      {/* Search */}
      <div className='relative'>
        <Search className='absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground' />
        <Input
          placeholder='Search commands...'
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className='pl-10'
        />
      </div>

      {/* Loading State */}
      {isLoading && (
        <div className='grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4'>
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

      {/* Error State */}
      {error && (
        <div className='text-center py-12'>
          <p className='text-destructive mb-4'>Failed to load commands. Please try again.</p>
          <Button variant='outline' onClick={() => window.location.reload()}>
            Retry
          </Button>
        </div>
      )}

      {/* Commands Grid */}
      {!isLoading && !error && (
        <div className='space-y-6'>
          {Object.entries(commandsByNamespace).map(([namespace, namespaceCommands]: [string, any]) => (
            <div key={namespace}>
              {namespace !== 'root' && (
                <div className='flex items-center gap-2 mb-3'>
                  <FolderOpen className='h-4 w-4 text-muted-foreground' />
                  <h3 className='text-sm font-medium text-muted-foreground'>{namespace}</h3>
                </div>
              )}
              <div className='grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4'>
                {namespaceCommands.map((command: any) => (
                  <Card
                    key={`${command.scope}:${command.namespace || 'root'}:${command.name}`}
                    className={cn(
                      'cursor-pointer transition-colors',
                      selectedCommand?.name === command.name &&
                        selectedCommand?.namespace === command.namespace &&
                        'ring-2 ring-primary'
                    )}
                    onClick={() => setSelectedCommand(command)}
                  >
                    <CardHeader>
                      <div className='flex items-start justify-between'>
                        <div className='flex items-center gap-2'>
                          <Terminal className='h-4 w-4 text-primary' />
                          <CardTitle className='text-lg'>{command.name}</CardTitle>
                        </div>
                        <div className='flex gap-1'>
                          <Button
                            variant='ghost'
                            size='icon'
                            className='h-8 w-8'
                            onClick={(e) => {
                              e.stopPropagation()
                              handleEditCommand(command)
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
                              handleDeleteCommand(command)
                            }}
                          >
                            <Trash2 className='h-4 w-4' />
                          </Button>
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent>
                      <CardDescription className='mb-3'>{command.description || 'No description'}</CardDescription>

                      {/* Badges for scope and frontmatter */}
                      <div className='flex flex-wrap gap-2 mb-3'>
                        <Badge variant={command.scope === 'user' ? 'secondary' : 'default'}>
                          {command.scope === 'user' ? <User className='h-3 w-3 mr-1' /> : null}
                          {command.scope}
                        </Badge>
                        {command.frontmatter?.['allowed-tools'] && (
                          <Badge variant='outline' className='text-xs'>
                            Tools: {command.frontmatter['allowed-tools'].split(',').length}
                          </Badge>
                        )}
                        {command.frontmatter?.model && (
                          <Badge variant='outline' className='text-xs'>
                            {command.frontmatter.model.split('-').slice(0, 2).join('-')}
                          </Badge>
                        )}
                        {command.frontmatter?.['output-format'] && (
                          <Badge variant='outline' className='text-xs'>
                            {command.frontmatter['output-format']}
                          </Badge>
                        )}
                      </div>

                      <div className='flex items-center gap-4 text-xs text-muted-foreground'>
                        <div className='flex items-center gap-1'>
                          <Calendar className='h-3 w-3' />
                          Updated {new Date(command.updated).toLocaleDateString()}
                        </div>
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
      {!isLoading && !error && filteredCommands.length === 0 && (
        <div className='text-center py-12'>
          <p className='text-muted-foreground mb-4'>
            {searchQuery ? 'No commands found matching your search.' : 'No commands created yet.'}
          </p>
          {!searchQuery && (
            <div className='flex gap-2 justify-center'>
              <Button variant='outline' onClick={() => setGenerationDialogOpen(true)}>
                <Sparkles className='h-4 w-4 mr-2' />
                Generate with AI
              </Button>
              <Button onClick={handleCreateCommand}>
                <Plus className='h-4 w-4 mr-2' />
                Create Your First Command
              </Button>
            </div>
          )}
        </div>
      )}

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={!!deleteCommand} onOpenChange={(open) => !open && setDeleteCommand(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Command</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete the command "{deleteCommand?.name}"? This will permanently delete the
              command file and cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmDelete}
              disabled={deleteCommandMutation.isPending}
              className='bg-destructive text-destructive-foreground hover:bg-destructive/90'
            >
              {deleteCommandMutation.isPending && <Loader2 className='h-4 w-4 mr-2 animate-spin' />}
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Command Create/Edit Dialog */}
      <CommandDialog
        open={commandDialogOpen}
        onOpenChange={(open) => {
          setCommandDialogOpen(open)
          if (!open) {
            setEditingCommand(null)
            setGeneratedCommand(null)
          }
        }}
        commandName={editingCommand?.name}
        namespace={editingCommand?.namespace}
        projectId={projectId}
        initialData={generatedCommand}
      />

      {/* Command Generation Dialog */}
      <CommandGenerationDialog
        open={generationDialogOpen}
        onOpenChange={setGenerationDialogOpen}
        projectId={projectId}
        onCommandGenerated={handleCommandGenerated}
      />
    </div>
  )
}
