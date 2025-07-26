import { useQuery } from '@tanstack/react-query'
import { octoClient } from '@/hooks/octo-client'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@ui'
import { Badge } from '@/components/ui/badge'
import { Alert, AlertDescription } from '@ui'
import { CheckCircle2, XCircle, Loader2 } from 'lucide-react'
import { cn } from '@/lib/utils'

interface MCPPlatformDetectorProps {
  projectId: number
}

export function MCPPlatformDetector({ projectId }: MCPPlatformDetectorProps) {
  const { data: detectionData, isLoading: isDetecting } = useQuery({
    queryKey: ['mcp-detection'],
    queryFn: async () => {
      const result = await octoClient.mcpInstallation.detectTools()
      return result.data
    },
    refetchInterval: 60000 // Refresh every minute
  })

  const { data: configData } = useQuery({
    queryKey: ['mcp-project-config-locations', projectId],
    queryFn: async () => {
      const result = await octoClient.mcpProjectConfig.getConfigLocations(projectId)
      return result.data
    }
  })

  if (isDetecting) {
    return (
      <Card>
        <CardContent className="pt-6">
          <div className="flex items-center justify-center space-x-2">
            <Loader2 className="h-4 w-4 animate-spin" />
            <span className="text-sm text-muted-foreground">Detecting installed platforms...</span>
          </div>
        </CardContent>
      </Card>
    )
  }

  const tools = detectionData?.tools || []
  const mcpJsonExists = configData?.locations?.some(loc => loc.path.endsWith('.mcp.json') && loc.exists) || false
  
  // Filter tools that support .mcp.json
  const compatibleTools = tools.filter(tool => 
    ['vscode', 'cursor', 'claude-code', 'windsurf', 'continue'].includes(tool.tool)
  )

  return (
    <Card>
      <CardHeader>
        <CardTitle>Compatible Platforms</CardTitle>
        <CardDescription>
          Editors and AI tools that can use project-level MCP configuration
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {compatibleTools.map((tool) => {
            const isInstalled = tool.installed
            const canUseMCP = isInstalled && mcpJsonExists

            return (
              <div
                key={tool.tool}
                className={cn(
                  "relative rounded-lg border p-3 transition-colors",
                  isInstalled ? "border-muted" : "border-muted/50 opacity-60"
                )}
              >
                <div className="flex items-center justify-between">
                  <div className="space-y-1 flex-1">
                    <h4 className="text-sm font-medium">{tool.name}</h4>
                    <div className="flex items-center gap-2">
                      {isInstalled ? (
                        <Badge variant="outline" className="text-xs">
                          <CheckCircle2 className="mr-1 h-3 w-3 text-green-500" />
                          Installed
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="text-xs">
                          <XCircle className="mr-1 h-3 w-3 text-muted-foreground" />
                          Not Installed
                        </Badge>
                      )}
                      {canUseMCP && (
                        <Badge variant="secondary" className="text-xs">
                          MCP Ready
                        </Badge>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
        
        {compatibleTools.length === 0 && (
          <div className="text-center py-8 text-muted-foreground">
            <p className="text-sm">No compatible platforms detected.</p>
            <p className="text-xs mt-2">Install VS Code, Cursor, or another MCP-compatible editor to get started.</p>
          </div>
        )}

        {mcpJsonExists && compatibleTools.some(t => t.installed) && (
          <Alert className="mt-4">
            <CheckCircle2 className="h-4 w-4" />
            <AlertDescription>
              Project MCP configuration is active. Compatible editors will automatically connect when you open this project.
            </AlertDescription>
          </Alert>
        )}
      </CardContent>
    </Card>
  )
}