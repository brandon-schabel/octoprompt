import { useState } from 'react'
import { useMutation, useQuery } from '@tanstack/react-query'
import { useApiClient } from '@/hooks/api/use-api-client'
import { Button } from '@promptliano/ui'
import { Checkbox } from '@promptliano/ui'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@promptliano/ui'
import { Badge } from '@promptliano/ui'
import { Loader2, Download, CheckCircle2, XCircle, AlertCircle } from 'lucide-react'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'

interface MCPBatchInstallerProps {
  projectId: number
  projectName: string
}

export function MCPBatchInstaller({ projectId, projectName }: MCPBatchInstallerProps) {
  const client = useApiClient()
  const [selectedTools, setSelectedTools] = useState<string[]>([])
  const [isInstalling, setIsInstalling] = useState(false)

  const { data: detectionData, refetch: refetchDetection } = useQuery({
    queryKey: ['mcp-detection-batch'],
    queryFn: async () => {
      const result = await client?.mcpInstallation.detectTools()
      return result.data
    }
  })

  const { data: statusData, refetch: refetchStatus } = useQuery({
    queryKey: ['mcp-installation-status-batch', projectId],
    queryFn: async () => {
      const result = await client?.mcpInstallation.getInstallationStatus(projectId)
      return result.data
    }
  })

  const batchInstallMutation = useMutation({
    mutationFn: async (tools: string[]) => {
      const response = await client?.mcpInstallation.batchInstall(projectId, {
        tools,
        debug: false
      })
      return response
    },
    onSuccess: async (data) => {
      const { succeeded, failed, total } = data.data.summary

      if (succeeded === total) {
        toast.success('Installation Complete', {
          description: `Successfully installed Promptliano MCP to ${succeeded} platform${succeeded > 1 ? 's' : ''}`
        })
      } else if (succeeded > 0) {
        toast.warning('Partial Installation', {
          description: `Installed to ${succeeded} platform${succeeded > 1 ? 's' : ''}, ${failed} failed`
        })
      } else {
        toast.error('Installation Failed', {
          description: 'Failed to install to any platforms'
        })
      }

      // Show individual results
      data.data.results.forEach((result) => {
        if (!result.success) {
          toast.error(`${result.tool} failed: ${result.message}`)
        }
      })

      await refetchDetection()
      await refetchStatus()
      setSelectedTools([])
    },
    onError: (error) => {
      toast.error('Installation Error', {
        description: error.message
      })
    }
  })

  const tools = detectionData?.tools || []
  const installedTools = statusData?.projectConfig?.installedTools || []

  const availableTools = tools.filter((tool) => tool.installed && !installedTools.some((t) => t.tool === tool.tool))

  const handleToggleTool = (toolId: string) => {
    setSelectedTools((prev) => (prev.includes(toolId) ? prev.filter((t) => t !== toolId) : [...prev, toolId]))
  }

  const handleSelectAll = () => {
    if (selectedTools.length === availableTools.length) {
      setSelectedTools([])
    } else {
      setSelectedTools(availableTools.map((t) => t.tool))
    }
  }

  const handleInstall = async () => {
    if (selectedTools.length === 0) {
      toast.error('No platforms selected', {
        description: 'Please select at least one platform to install'
      })
      return
    }

    setIsInstalling(true)
    try {
      await batchInstallMutation.mutateAsync(selectedTools)
    } finally {
      setIsInstalling(false)
    }
  }

  if (availableTools.length === 0) {
    return null
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Quick Install</CardTitle>
        <CardDescription>Install Promptliano MCP to multiple platforms at once</CardDescription>
      </CardHeader>
      <CardContent className='space-y-4'>
        <div className='flex items-center justify-between mb-2'>
          <span className='text-sm font-medium'>Available Platforms</span>
          <Button variant='ghost' size='sm' onClick={handleSelectAll}>
            {selectedTools.length === availableTools.length ? 'Deselect All' : 'Select All'}
          </Button>
        </div>

        <div className='grid grid-cols-1 md:grid-cols-2 gap-3'>
          {availableTools.map((tool) => (
            <div
              key={tool.tool}
              className={cn(
                'flex items-center space-x-3 rounded-lg border p-3 cursor-pointer transition-colors',
                selectedTools.includes(tool.tool)
                  ? 'border-primary bg-primary/5'
                  : 'border-muted hover:border-muted-foreground/50'
              )}
              onClick={() => handleToggleTool(tool.tool)}
            >
              <Checkbox
                checked={selectedTools.includes(tool.tool)}
                onCheckedChange={() => handleToggleTool(tool.tool)}
                onClick={(e) => e.stopPropagation()}
              />
              <div className='flex-1'>
                <div className='font-medium text-sm'>{tool.name}</div>
                {tool.configPath && (
                  <div className='text-xs text-muted-foreground truncate' title={tool.configPath}>
                    {tool.configPath}
                  </div>
                )}
              </div>
              <CheckCircle2 className='h-4 w-4 text-green-500' />
            </div>
          ))}
        </div>

        <div className='flex items-center justify-between pt-4'>
          <span className='text-sm text-muted-foreground'>
            {selectedTools.length} platform{selectedTools.length !== 1 ? 's' : ''} selected
          </span>
          <Button onClick={handleInstall} disabled={selectedTools.length === 0 || isInstalling}>
            {isInstalling ? (
              <>
                <Loader2 className='h-4 w-4 mr-2 animate-spin' />
                Installing...
              </>
            ) : (
              <>
                <Download className='h-4 w-4 mr-2' />
                Install to Selected
              </>
            )}
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}
