import { useState } from 'react'
import { FileText, Folder, ExternalLink, Eye, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { ScrollArea } from '@/components/ui/scroll-area'
import { toast } from 'sonner'
import { useGetMCPResources, useReadMCPResource } from '@/hooks/api/use-mcp-api'
import type { MCPResource } from '@octoprompt/schemas'

interface MCPResourcesPanelProps {
  projectId: number
}

interface ResourceItemProps {
  resource: MCPResource
  projectId: number
}

function ResourceItem({ resource, projectId }: ResourceItemProps) {
  const [viewDialogOpen, setViewDialogOpen] = useState(false)
  const [content, setContent] = useState<any>(null)
  const readMutation = useReadMCPResource(projectId)

  const handleView = async () => {
    try {
      const response = await readMutation.mutateAsync({
        serverId: resource.serverId,
        uri: resource.uri
      })
      setContent(response.data)
      setViewDialogOpen(true)
    } catch (error) {
      toast.error('Failed to read resource')
    }
  }

  const getIcon = () => {
    if (resource.uri.includes('file://')) return <FileText className='h-4 w-4' />
    if (resource.uri.includes('folder://')) return <Folder className='h-4 w-4' />
    return <ExternalLink className='h-4 w-4' />
  }

  const getMimeTypeBadge = () => {
    if (!resource.mimeType) return null

    const mimeColors: Record<string, string> = {
      'text/plain': 'bg-blue-100 text-blue-700',
      'application/json': 'bg-green-100 text-green-700',
      'text/html': 'bg-orange-100 text-orange-700',
      'text/markdown': 'bg-purple-100 text-purple-700'
    }

    const colorClass = mimeColors[resource.mimeType] || 'bg-gray-100 text-gray-700'

    return (
      <Badge variant='outline' className={`text-xs ${colorClass}`}>
        {resource.mimeType.split('/')[1]}
      </Badge>
    )
  }

  return (
    <>
      <div className='flex items-center justify-between p-3 border rounded-lg hover:bg-gray-50'>
        <div className='flex items-center gap-3 flex-1 min-w-0'>
          <div className='text-gray-500'>{getIcon()}</div>
          <div className='flex-1 min-w-0'>
            <h4 className='font-medium truncate'>{resource.name}</h4>
            {resource.description && <p className='text-sm text-gray-500 truncate'>{resource.description}</p>}
            <p className='text-xs text-gray-400 truncate mt-1'>{resource.uri}</p>
          </div>
          {getMimeTypeBadge()}
        </div>

        <Button size='sm' variant='ghost' onClick={handleView} disabled={readMutation.isPending}>
          {readMutation.isPending ? <Loader2 className='h-4 w-4 animate-spin' /> : <Eye className='h-4 w-4' />}
        </Button>
      </div>

      <Dialog open={viewDialogOpen} onOpenChange={setViewDialogOpen}>
        <DialogContent className='max-w-3xl max-h-[80vh]'>
          <DialogHeader>
            <DialogTitle>{resource.name}</DialogTitle>
          </DialogHeader>
          <ScrollArea className='h-[60vh]'>
            <div className='p-4'>
              {typeof content === 'string' ? (
                <pre className='text-sm whitespace-pre-wrap'>{content}</pre>
              ) : (
                <pre className='text-sm'>{JSON.stringify(content, null, 2)}</pre>
              )}
            </div>
          </ScrollArea>
        </DialogContent>
      </Dialog>
    </>
  )
}

export function MCPResourcesPanel({ projectId }: MCPResourcesPanelProps) {
  const { data: resourcesResponse, isLoading } = useGetMCPResources(projectId)
  const resources = resourcesResponse?.data || []

  if (isLoading) {
    return (
      <Card>
        <CardContent className='flex items-center justify-center p-8'>
          <Loader2 className='h-6 w-6 animate-spin' />
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className='text-lg flex items-center gap-2'>
          <FileText className='h-5 w-5' />
          MCP Resources
          <Badge variant='secondary'>{resources.length}</Badge>
        </CardTitle>
      </CardHeader>
      <CardContent>
        {resources.length === 0 ? (
          <div className='text-center py-8 text-gray-500'>
            <FileText className='h-12 w-12 mx-auto mb-2 text-gray-300' />
            <p className='text-sm'>No resources available</p>
            <p className='text-xs mt-1'>Start an MCP server to access resources</p>
          </div>
        ) : (
          <div className='space-y-2'>
            {resources.map((resource, index) => (
              <ResourceItem
                key={`${resource.serverId}-${resource.uri}-${index}`}
                resource={resource}
                projectId={projectId}
              />
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
