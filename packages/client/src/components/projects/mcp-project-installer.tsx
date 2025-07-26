import { useState } from 'react'
import { useMutation, useQuery } from '@tanstack/react-query'
import { octoClient } from '@/hooks/octo-client'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@ui'
import { Button } from '@ui'
import { Alert, AlertDescription } from '@ui'
import { Badge } from '@/components/ui/badge'
import { CheckCircle2, Download, Loader2, FileJson, Info } from 'lucide-react'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'

interface MCPProjectInstallerProps {
  projectId: number
  projectName: string
  projectPath: string
}

const COMPATIBLE_PLATFORMS = [
  { name: 'VS Code', icon: '🔷', supports: true },
  { name: 'Cursor', icon: '🎯', supports: true },
  { name: 'Claude Code', icon: '🤖', supports: true },
  { name: 'Windsurf', icon: '🏄', supports: true },
  { name: 'Continue', icon: '⚡', supports: true },
  { name: 'Claude Desktop', icon: '💬', supports: false, note: 'Use global config' }
]

export function MCPProjectInstaller({ projectId, projectName, projectPath }: MCPProjectInstallerProps) {
  const [isInstalling, setIsInstalling] = useState(false)

  // Check if project has .mcp.json config
  const { data: configData, refetch: refetchConfig } = useQuery({
    queryKey: ['mcp-project-config-status', projectId],
    queryFn: async () => {
      const result = await octoClient.mcpProjectConfig.getConfigLocations(projectId)
      return result.data
    }
  })

  // Check if MCP is connected
  const { data: statusData } = useQuery({
    queryKey: ['mcp-installation-status-project', projectId],
    queryFn: async () => {
      const result = await octoClient.mcpInstallation.getInstallationStatus(projectId)
      return result.data
    },
    refetchInterval: 5000
  })

  const installMutation = useMutation({
    mutationFn: async () => {
      const response = await octoClient.mcpInstallation.installProjectConfig(projectId)
      return response
    },
    onSuccess: (data) => {
      if (data.success) {
        toast.success('Project MCP Config Installed', {
          description: 'The .mcp.json file has been created in your project root. Compatible editors will automatically detect it.'
        })
        refetchConfig()
      } else {
        toast.error('Installation Failed', {
          description: data.data.message || 'Failed to create project MCP configuration'
        })
      }
    },
    onError: (error) => {
      toast.error('Installation Error', {
        description: error.message
      })
    }
  })

  const handleInstall = async () => {
    setIsInstalling(true)
    try {
      await installMutation.mutateAsync()
    } finally {
      setIsInstalling(false)
    }
  }

  // Find if .mcp.json exists
  const mcpJsonLocation = configData?.locations?.find(loc => loc.path.endsWith('.mcp.json'))
  const isInstalled = mcpJsonLocation?.exists || false
  const isConnected = statusData?.connectionStatus?.connected || false

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <FileJson className="h-5 w-5" />
              Project MCP Configuration
            </CardTitle>
            <CardDescription>
              Enable AI assistants to access this project's context and tools
            </CardDescription>
          </div>
          {isInstalled && (
            <Badge variant={isConnected ? "default" : "secondary"} className="gap-1">
              <CheckCircle2 className="h-3 w-3" />
              {isConnected ? 'Connected' : 'Installed'}
            </Badge>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {!isInstalled ? (
          <>
            <Alert>
              <Info className="h-4 w-4" />
              <AlertDescription>
                Installing MCP will create a <code className="text-xs bg-muted px-1 py-0.5 rounded">.mcp.json</code> file 
                in your project root. This configuration is specific to this project and will be automatically 
                detected by compatible editors.
              </AlertDescription>
            </Alert>

            <div className="space-y-2">
              <p className="text-sm font-medium">Compatible Platforms:</p>
              <div className="grid grid-cols-2 gap-2">
                {COMPATIBLE_PLATFORMS.map((platform) => (
                  <div
                    key={platform.name}
                    className={cn(
                      "flex items-center gap-2 text-sm p-2 rounded-md",
                      platform.supports ? "bg-muted" : "opacity-60"
                    )}
                  >
                    <span>{platform.icon}</span>
                    <span className="flex-1">{platform.name}</span>
                    {!platform.supports && (
                      <span className="text-xs text-muted-foreground">{platform.note}</span>
                    )}
                  </div>
                ))}
              </div>
            </div>

            <Button 
              onClick={handleInstall} 
              disabled={isInstalling}
              className="w-full"
            >
              {isInstalling ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Installing...
                </>
              ) : (
                <>
                  <Download className="h-4 w-4 mr-2" />
                  Install MCP for This Project
                </>
              )}
            </Button>
          </>
        ) : (
          <>
            <Alert className="border-green-200 bg-green-50 dark:border-green-900 dark:bg-green-950">
              <CheckCircle2 className="h-4 w-4 text-green-600 dark:text-green-400" />
              <AlertDescription className="text-green-800 dark:text-green-200">
                MCP configuration is installed at:{' '}
                <code className="text-xs bg-green-100 dark:bg-green-900 px-1 py-0.5 rounded">
                  {mcpJsonLocation?.path.replace(projectPath, '').replace(/^\//, '')}
                </code>
              </AlertDescription>
            </Alert>

            {isConnected && (
              <div className="flex items-center gap-2 text-sm text-green-600 dark:text-green-400">
                <div className="relative">
                  <div className="h-2 w-2 bg-green-500 rounded-full animate-pulse" />
                  <div className="absolute inset-0 h-2 w-2 bg-green-500 rounded-full animate-ping" />
                </div>
                <span>MCP is actively connected to this project</span>
              </div>
            )}

            <div className="pt-2 space-y-2">
              <p className="text-sm text-muted-foreground">
                The MCP configuration has been installed. Any compatible editor or AI assistant that opens this 
                project will automatically have access to OctoPrompt's tools and context.
              </p>
              <p className="text-xs text-muted-foreground">
                To modify the configuration, use the "MCP Configuration Editor" below.
              </p>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  )
}