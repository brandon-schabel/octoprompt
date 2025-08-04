import React from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@promptliano/ui'
import { Badge } from '@promptliano/ui'
import { Button } from '@promptliano/ui'
import { Alert, AlertDescription } from '@promptliano/ui'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@promptliano/ui'
import { CheckCircle2, XCircle, Copy, RefreshCw, Terminal, FileJson, AlertCircle, ExternalLink } from 'lucide-react'
import { useQuery } from '@tanstack/react-query'
import { cn } from '@/lib/utils'
import { Skeleton } from '@promptliano/ui'
import { promptlianoClient } from '@/hooks/promptliano-client'
import { toast } from 'sonner'

interface MCPViewProps {
  projectId: number
  projectName?: string
}

interface MCPStatusInfo {
  claudeDesktop: {
    installed: boolean
    configExists: boolean
    hasPromptliano: boolean
    configPath?: string
    error?: string
  }
  claudeCode: {
    globalConfigExists: boolean
    globalHasPromptliano: boolean
    globalConfigPath?: string
    projectConfigExists: boolean
    projectHasPromptliano: boolean
    projectConfigPath?: string
    localConfigExists: boolean
    localHasPromptliano: boolean
    localConfigPath?: string
    error?: string
  }
  projectId: string
  installCommand: string
}

export function MCPView({ projectId, projectName }: MCPViewProps) {
  const {
    data: status,
    isLoading,
    error,
    refetch
  } = useQuery({
    queryKey: ['claude-code-mcp-status', projectId],
    queryFn: async () => {
      const response = await promptlianoClient.claudeCode.getMCPStatus(projectId)
      return response.data as MCPStatusInfo
    },
    refetchInterval: false
  })

  const copyToClipboard = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text)
      toast.success('Copied to clipboard')
    } catch (error) {
      toast.error('Failed to copy. Please try copying manually.')
    }
  }

  if (isLoading) {
    return (
      <div className='p-6 space-y-6'>
        <Skeleton className='h-8 w-64' />
        <div className='space-y-4'>
          <Skeleton className='h-32 w-full' />
          <Skeleton className='h-32 w-full' />
          <Skeleton className='h-32 w-full' />
        </div>
      </div>
    )
  }

  if (error || !status) {
    return (
      <div className='p-6'>
        <Alert variant='destructive'>
          <AlertCircle className='h-4 w-4' />
          <AlertDescription>
            Failed to check MCP status. Please try again.
            <Button size='sm' variant='outline' className='ml-2' onClick={() => refetch()}>
              <RefreshCw className='h-3 w-3 mr-1' />
              Retry
            </Button>
          </AlertDescription>
        </Alert>
      </div>
    )
  }

  const isClaudeDesktopConfigured = status.claudeDesktop.configExists && status.claudeDesktop.hasPromptliano
  const isClaudeCodeConfigured =
    (status.claudeCode.globalConfigExists && status.claudeCode.globalHasPromptliano) ||
    (status.claudeCode.projectConfigExists && status.claudeCode.projectHasPromptliano) ||
    (status.claudeCode.localConfigExists && status.claudeCode.localHasPromptliano)

  return (
    <div className='p-6 space-y-6'>
      <div className='flex items-center justify-between'>
        <div>
          <h2 className='text-2xl font-bold tracking-tight'>MCP Configuration</h2>
          <p className='text-muted-foreground'>
            Check and manage Model Context Protocol (MCP) installations for Claude
          </p>
        </div>
        <Button variant='outline' size='sm' onClick={() => refetch()}>
          <RefreshCw className='h-4 w-4 mr-2' />
          Refresh
        </Button>
      </div>

      {/* Status Overview */}
      <div className='grid gap-4 md:grid-cols-2'>
        <Card>
          <CardHeader>
            <CardTitle className='flex items-center gap-2'>
              <FileJson className='h-5 w-5' />
              Claude Desktop
            </CardTitle>
            <CardDescription>Desktop application configuration</CardDescription>
          </CardHeader>
          <CardContent>
            <div className='space-y-3'>
              <div className='flex items-center justify-between'>
                <span className='text-sm'>Application Installed</span>
                {status.claudeDesktop.installed ? (
                  <CheckCircle2 className='h-4 w-4 text-green-500' />
                ) : (
                  <XCircle className='h-4 w-4 text-muted-foreground' />
                )}
              </div>
              <div className='flex items-center justify-between'>
                <span className='text-sm'>Configuration File</span>
                {status.claudeDesktop.configExists ? (
                  <CheckCircle2 className='h-4 w-4 text-green-500' />
                ) : (
                  <XCircle className='h-4 w-4 text-muted-foreground' />
                )}
              </div>
              <div className='flex items-center justify-between'>
                <span className='text-sm'>Promptliano Configured</span>
                {status.claudeDesktop.hasPromptliano ? (
                  <CheckCircle2 className='h-4 w-4 text-green-500' />
                ) : (
                  <XCircle className='h-4 w-4 text-muted-foreground' />
                )}
              </div>
              {status.claudeDesktop.configPath && (
                <div className='pt-2 border-t'>
                  <p className='text-xs text-muted-foreground font-mono break-all'>{status.claudeDesktop.configPath}</p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className='flex items-center gap-2'>
              <Terminal className='h-5 w-5' />
              Claude Code CLI
            </CardTitle>
            <CardDescription>Command-line interface configuration</CardDescription>
          </CardHeader>
          <CardContent>
            <div className='space-y-3'>
              <div className='flex items-center justify-between'>
                <span className='text-sm'>Global Config</span>
                {status.claudeCode.globalHasPromptliano ? (
                  <CheckCircle2 className='h-4 w-4 text-green-500' />
                ) : (
                  <XCircle className='h-4 w-4 text-muted-foreground' />
                )}
              </div>
              <div className='flex items-center justify-between'>
                <span className='text-sm'>Project Config (.mcp.json)</span>
                {status.claudeCode.projectHasPromptliano ? (
                  <CheckCircle2 className='h-4 w-4 text-green-500' />
                ) : (
                  <XCircle className='h-4 w-4 text-muted-foreground' />
                )}
              </div>
              <div className='flex items-center justify-between'>
                <span className='text-sm'>Local Config</span>
                {status.claudeCode.localHasPromptliano ? (
                  <CheckCircle2 className='h-4 w-4 text-green-500' />
                ) : (
                  <XCircle className='h-4 w-4 text-muted-foreground' />
                )}
              </div>
              {status.projectId && (
                <div className='pt-2 border-t'>
                  <p className='text-xs text-muted-foreground'>
                    Project ID: <span className='font-mono'>{status.projectId}</span>
                  </p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Installation Instructions */}
      <Card>
        <CardHeader>
          <CardTitle>Installation</CardTitle>
          <CardDescription>
            {isClaudeCodeConfigured
              ? 'Promptliano MCP is configured for Claude Code. You can still add it to other scopes if needed.'
              : 'Install Promptliano MCP server for Claude Code CLI'}
          </CardDescription>
        </CardHeader>
        <CardContent className='space-y-4'>
          <Tabs defaultValue='project' className='w-full'>
            <TabsList className='grid w-full grid-cols-3'>
              <TabsTrigger value='project'>Project (Recommended)</TabsTrigger>
              <TabsTrigger value='global'>Global</TabsTrigger>
              <TabsTrigger value='desktop'>Claude Desktop</TabsTrigger>
            </TabsList>

            <TabsContent value='project' className='space-y-4'>
              <p className='text-sm text-muted-foreground'>
                Add Promptliano MCP to this project. The configuration will be saved in{' '}
                <code className='font-mono text-xs bg-muted px-1 py-0.5 rounded'>.mcp.json</code> and can be shared with
                your team.
              </p>
              <div className='relative'>
                <div className='bg-muted rounded-md p-4 pr-12 font-mono text-sm'>
                  <code>{status.installCommand.replace('--global', '')}</code>
                </div>
                <Button
                  size='sm'
                  variant='outline'
                  className='absolute top-2 right-2'
                  onClick={() => copyToClipboard(status.installCommand.replace('--global', ''))}
                >
                  <Copy className='h-3 w-3 mr-1' />
                  Copy
                </Button>
              </div>
            </TabsContent>

            <TabsContent value='global' className='space-y-4'>
              <p className='text-sm text-muted-foreground'>
                Add Promptliano MCP globally. It will be available in all your projects.
              </p>
              <div className='relative'>
                <div className='bg-muted rounded-md p-4 pr-12 font-mono text-sm'>
                  <code>{status.installCommand}</code>
                </div>
                <Button
                  size='sm'
                  variant='outline'
                  className='absolute top-2 right-2'
                  onClick={() => copyToClipboard(status.installCommand)}
                >
                  <Copy className='h-3 w-3 mr-1' />
                  Copy
                </Button>
              </div>
            </TabsContent>

            <TabsContent value='desktop' className='space-y-4'>
              <p className='text-sm text-muted-foreground'>
                Claude Desktop requires manual configuration. Add the following to your Claude Desktop config file:
              </p>
              <div className='relative'>
                <div className='bg-muted rounded-md p-4 pr-12 font-mono text-sm overflow-x-auto'>
                  <pre>
                    {JSON.stringify(
                      {
                        mcpServers: {
                          promptliano: {
                            command: '/path/to/promptliano/packages/server/mcp-start.sh'
                          }
                        }
                      },
                      null,
                      2
                    )}
                  </pre>
                </div>
                <Button
                  size='sm'
                  variant='outline'
                  className='absolute top-2 right-2'
                  onClick={() =>
                    copyToClipboard(
                      JSON.stringify(
                        {
                          mcpServers: {
                            promptliano: {
                              command: '/path/to/promptliano/packages/server/mcp-start.sh'
                            }
                          }
                        },
                        null,
                        2
                      )
                    )
                  }
                >
                  <Copy className='h-3 w-3 mr-1' />
                  Copy
                </Button>
              </div>
              {status.claudeDesktop.configPath && (
                <p className='text-xs text-muted-foreground'>
                  Config location:{' '}
                  <code className='font-mono bg-muted px-1 py-0.5 rounded'>{status.claudeDesktop.configPath}</code>
                </p>
              )}
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>

      {/* Configuration Locations */}
      <Card>
        <CardHeader>
          <CardTitle>Configuration Locations</CardTitle>
          <CardDescription>Where MCP configurations are stored on your system</CardDescription>
        </CardHeader>
        <CardContent>
          <div className='space-y-4'>
            <div>
              <h4 className='text-sm font-medium mb-2'>Claude Code CLI</h4>
              <div className='space-y-2 text-sm'>
                <div className='flex items-start gap-2'>
                  <Badge variant='outline' className='mt-0.5'>
                    Global
                  </Badge>
                  <code className='font-mono text-xs bg-muted px-2 py-1 rounded flex-1 break-all'>
                    {status.claudeCode.globalConfigPath || '~/.claude.json'}
                  </code>
                </div>
                <div className='flex items-start gap-2'>
                  <Badge variant='outline' className='mt-0.5'>
                    Project
                  </Badge>
                  <code className='font-mono text-xs bg-muted px-2 py-1 rounded flex-1 break-all'>
                    {status.claudeCode.projectConfigPath || '.mcp.json'}
                  </code>
                </div>
                <div className='flex items-start gap-2'>
                  <Badge variant='outline' className='mt-0.5'>
                    Local
                  </Badge>
                  <code className='font-mono text-xs bg-muted px-2 py-1 rounded flex-1 break-all'>
                    {status.claudeCode.localConfigPath || '~/.claude.json [project specific]'}
                  </code>
                </div>
              </div>
            </div>

            {status.claudeDesktop.configPath && (
              <div>
                <h4 className='text-sm font-medium mb-2'>Claude Desktop</h4>
                <code className='font-mono text-xs bg-muted px-2 py-1 rounded block break-all'>
                  {status.claudeDesktop.configPath}
                </code>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Troubleshooting */}
      <Card>
        <CardHeader>
          <CardTitle>Troubleshooting</CardTitle>
          <CardDescription>Common issues and solutions</CardDescription>
        </CardHeader>
        <CardContent>
          <div className='space-y-3 text-sm'>
            <div className='flex items-start gap-2'>
              <AlertCircle className='h-4 w-4 text-muted-foreground mt-0.5' />
              <div>
                <p className='font-medium'>MCP not showing in Claude Code</p>
                <p className='text-muted-foreground text-xs mt-1'>
                  Make sure you've restarted Claude Code after adding the configuration. You may need to run{' '}
                  <code className='font-mono bg-muted px-1 py-0.5 rounded'>claude restart</code>.
                </p>
              </div>
            </div>
            <div className='flex items-start gap-2'>
              <AlertCircle className='h-4 w-4 text-muted-foreground mt-0.5' />
              <div>
                <p className='font-medium'>Project ID not set</p>
                <p className='text-muted-foreground text-xs mt-1'>
                  The project ID is automatically generated from your project path. Make sure you're running the command
                  from within your project directory.
                </p>
              </div>
            </div>
            <div className='flex items-start gap-2'>
              <AlertCircle className='h-4 w-4 text-muted-foreground mt-0.5' />
              <div>
                <p className='font-medium'>Permission denied errors</p>
                <p className='text-muted-foreground text-xs mt-1'>
                  Ensure the MCP start script has execute permissions. Run{' '}
                  <code className='font-mono bg-muted px-1 py-0.5 rounded'>chmod +x /path/to/mcp-start.sh</code>.
                </p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
