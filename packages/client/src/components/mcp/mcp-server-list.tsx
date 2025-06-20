import { useState } from 'react'
import { 
  Server, 
  Play, 
  Square, 
  Settings, 
  Trash2, 
  Plus,
  CheckCircle,
  XCircle,
  Loader2,
  AlertCircle
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { 
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { toast } from 'sonner'
import type { MCPServerConfig } from '@octoprompt/schemas'
import { 
  useGetMCPServerConfigs, 
  useDeleteMCPServerConfig,
  useStartMCPServer,
  useStopMCPServer,
  useGetMCPServerState
} from '@/hooks/api/use-mcp-api'
import { MCPServerDialog } from './mcp-server-dialog'

interface MCPServerListProps {
  projectId: number
}

interface ServerItemProps {
  server: MCPServerConfig
  projectId: number
  onEdit: (server: MCPServerConfig) => void
  onDelete: (server: MCPServerConfig) => void
}

function ServerItem({ server, projectId, onEdit, onDelete }: ServerItemProps) {
  const { data: stateResponse } = useGetMCPServerState(projectId, server.id)
  const startMutation = useStartMCPServer(projectId)
  const stopMutation = useStopMCPServer(projectId)
  
  const state = stateResponse?.data
  const isRunning = state?.status === 'running'
  const isStarting = state?.status === 'starting'
  const hasError = state?.status === 'error'

  const handleToggle = async () => {
    try {
      if (isRunning) {
        await stopMutation.mutateAsync(server.id)
        toast.success(`Stopped ${server.name}`)
      } else {
        await startMutation.mutateAsync(server.id)
        toast.success(`Started ${server.name}`)
      }
    } catch (error) {
      toast.error(`Failed to ${isRunning ? 'stop' : 'start'} server`)
    }
  }

  const getStatusIcon = () => {
    if (isStarting) return <Loader2 className="h-4 w-4 animate-spin text-yellow-500" />
    if (isRunning) return <CheckCircle className="h-4 w-4 text-green-500" />
    if (hasError) return <XCircle className="h-4 w-4 text-red-500" />
    return <AlertCircle className="h-4 w-4 text-gray-400" />
  }

  const getStatusBadge = () => {
    if (isStarting) return <Badge variant="outline" className="text-yellow-600">Starting</Badge>
    if (isRunning) return <Badge variant="outline" className="text-green-600">Running</Badge>
    if (hasError) return <Badge variant="destructive">Error</Badge>
    return <Badge variant="secondary">Stopped</Badge>
  }

  return (
    <div className="flex items-center justify-between p-4 border rounded-lg">
      <div className="flex items-center gap-3">
        <Server className="h-5 w-5 text-gray-500" />
        <div>
          <div className="flex items-center gap-2">
            <h4 className="font-medium">{server.name}</h4>
            {getStatusIcon()}
            {getStatusBadge()}
          </div>
          <p className="text-sm text-gray-500">{server.command}</p>
          {state?.error && (
            <p className="text-sm text-red-500 mt-1">Error: {state.error}</p>
          )}
        </div>
      </div>

      <div className="flex items-center gap-2">
        <Button
          size="sm"
          variant="outline"
          onClick={handleToggle}
          disabled={!server.enabled || startMutation.isPending || stopMutation.isPending}
        >
          {isRunning ? (
            <>
              <Square className="h-4 w-4 mr-1" />
              Stop
            </>
          ) : (
            <>
              <Play className="h-4 w-4 mr-1" />
              Start
            </>
          )}
        </Button>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button size="sm" variant="ghost">
              <Settings className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={() => onEdit(server)}>
              Edit
            </DropdownMenuItem>
            <DropdownMenuItem 
              className="text-red-600"
              onClick={() => onDelete(server)}
            >
              Delete
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  )
}

export function MCPServerList({ projectId }: MCPServerListProps) {
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editingServer, setEditingServer] = useState<MCPServerConfig | null>(null)
  const [deleteConfirmServer, setDeleteConfirmServer] = useState<MCPServerConfig | null>(null)
  
  const { data: serversResponse, isLoading } = useGetMCPServerConfigs(projectId)
  const deleteMutation = useDeleteMCPServerConfig(projectId)
  
  const servers = serversResponse?.data || []

  const handleEdit = (server: MCPServerConfig) => {
    setEditingServer(server)
    setDialogOpen(true)
  }

  const handleDelete = (server: MCPServerConfig) => {
    setDeleteConfirmServer(server)
  }

  const confirmDelete = async () => {
    if (!deleteConfirmServer) return
    
    try {
      await deleteMutation.mutateAsync(deleteConfirmServer.id)
      toast.success('MCP server deleted')
      setDeleteConfirmServer(null)
    } catch (error) {
      toast.error('Failed to delete MCP server')
    }
  }

  const handleDialogClose = (open: boolean) => {
    setDialogOpen(open)
    if (!open) {
      setEditingServer(null)
    }
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-8">
        <Loader2 className="h-6 w-6 animate-spin" />
      </div>
    )
  }

  return (
    <>
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-lg">MCP Servers</CardTitle>
          <Button 
            size="sm"
            onClick={() => {
              setEditingServer(null)
              setDialogOpen(true)
            }}
          >
            <Plus className="h-4 w-4 mr-1" />
            Add Server
          </Button>
        </CardHeader>
        <CardContent>
          {servers.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              <Server className="h-12 w-12 mx-auto mb-2 text-gray-300" />
              <p className="text-sm">No MCP servers configured</p>
              <p className="text-xs mt-1">Add a server to enable external tools and resources</p>
            </div>
          ) : (
            <div className="space-y-2">
              {servers.map((server) => (
                <ServerItem
                  key={server.id}
                  server={server}
                  projectId={projectId}
                  onEdit={handleEdit}
                  onDelete={handleDelete}
                />
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <MCPServerDialog
        projectId={projectId}
        open={dialogOpen}
        onOpenChange={handleDialogClose}
        editingServer={editingServer}
      />

      <AlertDialog open={!!deleteConfirmServer} onOpenChange={() => setDeleteConfirmServer(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete MCP Server</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete "{deleteConfirmServer?.name}"? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDelete} className="bg-red-600 hover:bg-red-700">
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}