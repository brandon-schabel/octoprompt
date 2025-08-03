import React, { useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Plus, Search, Edit, Trash2, FileText, Calendar, Loader2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useGetProjectAgents, useDeleteAgent } from '@/hooks/api-hooks'
import { Skeleton } from '@/components/ui/skeleton'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle
} from '@/components/ui/alert-dialog'
import { AgentDialog } from '../agent-dialog'

interface AgentsViewProps {
  projectId: number
  projectName?: string
}

const colorClasses = {
  blue: 'bg-secondary', // Brand Blue for file types/links
  green: 'bg-accent', // Brand Teal for success/online
  purple: 'bg-primary', // Brand Purple for AI/prompt features
  red: 'bg-destructive', // Semantic red for errors
  yellow: 'bg-warning', // Semantic warning yellow
  cyan: 'bg-info', // Semantic info blue
  orange: 'bg-orange-500', // Orange for summaries/highlights
  pink: 'bg-pink-500' // Pink for service architecture
}

export function AgentsView({ projectId, projectName }: AgentsViewProps) {
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedAgent, setSelectedAgent] = useState<string | null>(null)
  const [deleteAgentId, setDeleteAgentId] = useState<string | null>(null)
  const [agentDialogOpen, setAgentDialogOpen] = useState(false)
  const [editingAgentId, setEditingAgentId] = useState<string | null>(null)

  // Fetch agents for this specific project
  const { data: agentsResponse, isLoading, error } = useGetProjectAgents(projectId)
  const deleteAgentMutation = useDeleteAgent(projectId)

  console.log({ agentsResponse })

  const agents = agentsResponse?.data || []

  const filteredAgents = agents.filter(
    (agent) =>
      agent.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      agent.description.toLowerCase().includes(searchQuery.toLowerCase())
  )

  const handleCreateAgent = () => {
    setEditingAgentId(null)
    setAgentDialogOpen(true)
  }

  const handleEditAgent = (agentId: string) => {
    setEditingAgentId(agentId)
    setAgentDialogOpen(true)
  }

  const handleDeleteAgent = (agentId: string) => {
    setDeleteAgentId(agentId)
  }

  const confirmDelete = () => {
    if (deleteAgentId) {
      deleteAgentMutation.mutate(deleteAgentId, {
        onSuccess: () => {
          setDeleteAgentId(null)
          if (selectedAgent === deleteAgentId) {
            setSelectedAgent(null)
          }
        }
      })
    }
  }

  return (
    <div className='p-6 space-y-6'>
      {/* Header */}
      <div className='flex items-center justify-between'>
        <div>
          <h2 className='text-2xl font-bold'>Claude Code Agents</h2>
          <p className='text-muted-foreground'>Manage specialized AI agents for {projectName || 'this project'}</p>
        </div>
        <Button onClick={handleCreateAgent}>
          <Plus className='h-4 w-4 mr-2' />
          New Agent
        </Button>
      </div>

      {/* Search */}
      <div className='relative'>
        <Search className='absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground' />
        <Input
          placeholder='Search agents...'
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
          <p className='text-destructive mb-4'>Failed to load agents. Please try again.</p>
          <Button variant='outline' onClick={() => window.location.reload()}>
            Retry
          </Button>
        </div>
      )}

      {/* Agents Grid */}
      {!isLoading && !error && (
        <div className='grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4'>
          {filteredAgents.map((agent) => (
            <Card
              key={agent.id}
              className={cn('cursor-pointer transition-colors', selectedAgent === agent.id && 'ring-2 ring-primary')}
              onClick={() => setSelectedAgent(agent.id)}
            >
              <CardHeader>
                <div className='flex items-start justify-between'>
                  <div className='flex items-center gap-3'>
                    <div
                      className={cn('h-3 w-3 rounded-full', colorClasses[agent.color as keyof typeof colorClasses])}
                    />
                    <CardTitle className='text-lg'>{agent.name}</CardTitle>
                  </div>
                  <div className='flex gap-1'>
                    <Button
                      variant='ghost'
                      size='icon'
                      className='h-8 w-8'
                      onClick={(e) => {
                        e.stopPropagation()
                        handleEditAgent(agent.id)
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
                        handleDeleteAgent(agent.id)
                      }}
                    >
                      <Trash2 className='h-4 w-4' />
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <CardDescription className='mb-4'>{agent.description}</CardDescription>
                <div className='flex items-center gap-4 text-xs text-muted-foreground'>
                  <div className='flex items-center gap-1'>
                    <Calendar className='h-3 w-3' />
                    Created {new Date(agent.created).toLocaleDateString()}
                  </div>
                  <div className='flex items-center gap-1'>
                    <FileText className='h-3 w-3' />
                    Updated {new Date(agent.updated).toLocaleDateString()}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Empty State */}
      {!isLoading && !error && filteredAgents.length === 0 && (
        <div className='text-center py-12'>
          <p className='text-muted-foreground mb-4'>
            {searchQuery ? 'No agents found matching your search.' : 'No agents created yet.'}
          </p>
          {!searchQuery && (
            <Button onClick={handleCreateAgent}>
              <Plus className='h-4 w-4 mr-2' />
              Create Your First Agent
            </Button>
          )}
        </div>
      )}

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={!!deleteAgentId} onOpenChange={(open) => !open && setDeleteAgentId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Agent</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this agent? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmDelete}
              disabled={deleteAgentMutation.isPending}
              className='bg-destructive text-destructive-foreground hover:bg-destructive/90'
            >
              {deleteAgentMutation.isPending && <Loader2 className='h-4 w-4 mr-2 animate-spin' />}
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Agent Create/Edit Dialog */}
      <AgentDialog
        open={agentDialogOpen}
        onOpenChange={(open) => {
          setAgentDialogOpen(open)
          if (!open) {
            setEditingAgentId(null)
          }
        }}
        agentId={editingAgentId}
        projectId={projectId}
      />
    </div>
  )
}
