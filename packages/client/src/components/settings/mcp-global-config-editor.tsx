import { useState, useEffect } from 'react'
import { useGlobalMCPManager } from '@/hooks/api/use-mcp-global-api'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@promptliano/ui'
import { Button } from '@promptliano/ui'
import { Alert, AlertDescription } from '@promptliano/ui'
import { Badge } from '@promptliano/ui'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@promptliano/ui'
import {
  CheckCircle2,
  XCircle,
  Download,
  Trash2,
  Copy,
  RefreshCw,
  Globe,
  Package,
  Clock,
  User,
  FolderOpen,
  Settings,
  FileEdit
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { toast } from 'sonner'
import { Editor } from '@monaco-editor/react'
import { Skeleton } from '@promptliano/ui'
import { getEditorUrl } from '@/utils/editor-urls'

interface ToolInfo {
  id: string
  name: string
  description: string
  icon: React.ElementType
  color: string
}

interface ToolStatus {
  tool: string
  installed: boolean
  hasGlobalPromptliano: boolean
  configPath?: string
  configExists?: boolean
}

interface Installation {
  tool: string
  version: string
  installedAt: string | number
  location?: string
}

const SUPPORTED_TOOLS: Record<string, ToolInfo> = {
  'claude-desktop': {
    id: 'claude-desktop',
    name: 'Claude Desktop',
    description: "Anthropic's Claude Desktop application",
    icon: Package,
    color: 'text-purple-500'
  },
  vscode: {
    id: 'vscode',
    name: 'VS Code',
    description: 'Visual Studio Code editor',
    icon: Package,
    color: 'text-blue-500'
  },
  cursor: {
    id: 'cursor',
    name: 'Cursor',
    description: 'Cursor AI-powered IDE',
    icon: Package,
    color: 'text-orange-500'
  },
  continue: {
    id: 'continue',
    name: 'Continue',
    description: 'AI-powered code assistant',
    icon: Package,
    color: 'text-green-500'
  },
  'claude-code': {
    id: 'claude-code',
    name: 'Claude Code',
    description: 'Claude Code CLI tool',
    icon: Package,
    color: 'text-purple-600'
  },
  windsurf: {
    id: 'windsurf',
    name: 'Windsurf',
    description: 'Windsurf AI IDE',
    icon: Package,
    color: 'text-cyan-500'
  }
}

export function MCPGlobalConfigEditor() {
  const {
    config,
    installations,
    toolStatuses,
    status,
    isLoading,
    install,
    uninstall,
    updateConfig,
    isInstalling,
    isUninstalling,
    isUpdating,
    isToolInstalled,
    getInstallation
  } = useGlobalMCPManager()

  const [editMode, setEditMode] = useState(false)
  const [configJson, setConfigJson] = useState<string>('')
  const [jsonError, setJsonError] = useState<string | null>(null)

  // Initialize JSON editor with current config
  useEffect(() => {
    if (config) {
      setConfigJson(JSON.stringify(config, null, 2))
    } else if (!config && !isLoading) {
      // No config exists, provide a template
      const template = {
        servers: {},
        capabilities: {
          sampling: true
        }
      }
      setConfigJson(JSON.stringify(template, null, 2))
    }
  }, [config, isLoading])

  const handleSave = () => {
    try {
      const parsedConfig = JSON.parse(configJson)
      setJsonError(null)
      updateConfig(parsedConfig)
      setEditMode(false)
    } catch (error) {
      setJsonError(error instanceof Error ? error.message : 'Invalid JSON')
    }
  }

  const handleCancel = () => {
    setEditMode(false)
    setJsonError(null)
    // Reset to original config
    if (config) {
      setConfigJson(JSON.stringify(config, null, 2))
    }
  }

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text)
    toast.success('Copied to clipboard')
  }

  const handleInstall = (toolId: string) => {
    install({ tool: toolId })
  }

  const handleUninstall = (toolId: string) => {
    uninstall({ tool: toolId })
  }

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Global MCP Configuration</CardTitle>
          <CardDescription>Manage Model Context Protocol tools globally</CardDescription>
        </CardHeader>
        <CardContent className='space-y-4'>
          <Skeleton className='h-20 w-full' />
          <Skeleton className='h-20 w-full' />
          <Skeleton className='h-20 w-full' />
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader>
        <div className='flex items-center justify-between'>
          <div>
            <CardTitle className='flex items-center gap-2'>
              <Globe className='h-5 w-5' />
              Global MCP Configuration
            </CardTitle>
            <CardDescription>Manage Model Context Protocol tools and configuration globally</CardDescription>
          </div>
          {!editMode && (
            <Button onClick={() => setEditMode(true)} variant='outline'>
              <Settings className='h-4 w-4 mr-2' />
              Edit Configuration
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent className='space-y-6'>
        {/* Status Overview */}
        {status && (
          <Alert>
            <AlertDescription className='flex items-center justify-between'>
              <div className='flex items-center gap-2'>
                {status.installed ? (
                  <>
                    <CheckCircle2 className='h-4 w-4 text-green-500' />
                    <span>Global MCP configuration is active</span>
                  </>
                ) : (
                  <>
                    <XCircle className='h-4 w-4 text-red-500' />
                    <span>Global MCP configuration not found</span>
                  </>
                )}
              </div>
              {status.configPath && (
                <div className='flex items-center gap-2 text-sm text-muted-foreground'>
                  <FolderOpen className='h-3 w-3' />
                  <code className='text-xs'>{status.configPath}</code>
                </div>
              )}
            </AlertDescription>
          </Alert>
        )}

        {/* Installed Tools */}
        <div className='space-y-4'>
          <h4 className='text-sm font-medium'>Available Tools</h4>
          <div className='grid gap-3 md:grid-cols-2 lg:grid-cols-3'>
            {Object.values(SUPPORTED_TOOLS).map((tool) => {
              const installation = getInstallation(tool.id)
              // Find the tool status from the API response
              const toolStatus = toolStatuses?.find((t: ToolStatus) => t.tool === tool.id)
              const isInstalled = toolStatus?.installed || false
              const hasGlobalPromptliano = toolStatus?.hasGlobalPromptliano || false
              const Icon = tool.icon

              return (
                <div
                  key={tool.id}
                  className={cn(
                    'relative rounded-lg border p-4 transition-colors',
                    isInstalled ? 'bg-muted/50' : 'bg-background'
                  )}
                >
                  <div className='flex items-start justify-between mb-2'>
                    <div className='flex items-center gap-2'>
                      <Icon className={cn('h-5 w-5', tool.color)} />
                      <h5 className='font-medium'>{tool.name}</h5>
                    </div>
                    <div className='flex flex-col gap-1 items-end'>
                      <Badge variant={isInstalled ? 'default' : 'outline'} className='text-xs'>
                        {isInstalled ? 'Installed' : 'Not Installed'}
                      </Badge>
                      {isInstalled && (
                        <Badge variant={hasGlobalPromptliano ? 'secondary' : 'outline'} className='text-xs'>
                          {hasGlobalPromptliano ? 'Promptliano' : 'No Promptliano'}
                        </Badge>
                      )}
                    </div>
                  </div>

                  <p className='text-sm text-muted-foreground mb-3'>{tool.description}</p>

                  {installation && (
                    <div className='space-y-1 mb-3 text-xs text-muted-foreground'>
                      <div className='flex items-center gap-1'>
                        <Clock className='h-3 w-3' />
                        <span>Installed: {new Date(installation.installedAt).toLocaleDateString()}</span>
                      </div>
                      {installation.version && (
                        <div className='flex items-center gap-1'>
                          <Package className='h-3 w-3' />
                          <span>Version: {installation.version}</span>
                        </div>
                      )}
                      {installation &&
                      'location' in installation &&
                      installation.location &&
                      typeof installation.location === 'string' ? (
                        <div className='flex items-center gap-1'>
                          <FolderOpen className='h-3 w-3' />
                          <span className='truncate' title={installation.location as string}>
                            {String(installation.location)}
                          </span>
                        </div>
                      ) : null}
                    </div>
                  )}

                  <div className='flex gap-2'>
                    {isInstalled && toolStatus?.configPath && (
                      <Button size='sm' variant='outline' title='Open config file' asChild>
                        <a
                          href={getEditorUrl('vscode', toolStatus.configPath)}
                          target='_blank'
                          rel='noopener noreferrer'
                        >
                          <FileEdit className='h-3 w-3' />
                        </a>
                      </Button>
                    )}
                    {isInstalled && hasGlobalPromptliano ? (
                      <Button
                        size='sm'
                        variant='destructive'
                        onClick={() => handleUninstall(tool.id)}
                        disabled={isUninstalling}
                        className='flex-1'
                      >
                        <Trash2 className='h-3 w-3 mr-1' />
                        Uninstall
                      </Button>
                    ) : (
                      <Button
                        size='sm'
                        onClick={() => handleInstall(tool.id)}
                        disabled={isInstalling}
                        className='flex-1'
                      >
                        <Download className='h-3 w-3 mr-1' />
                        Install
                      </Button>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        {/* Configuration Editor */}
        {editMode ? (
          <div className='space-y-4'>
            <div className='space-y-2'>
              <label className='text-sm font-medium'>Global Configuration JSON</label>
              <div className='border rounded-md overflow-hidden'>
                <Editor
                  height='400px'
                  defaultLanguage='json'
                  value={configJson}
                  onChange={(value) => {
                    setConfigJson(value || '')
                    setJsonError(null)
                  }}
                  options={{
                    minimap: { enabled: false },
                    fontSize: 14,
                    wordWrap: 'on',
                    formatOnPaste: true,
                    formatOnType: true
                  }}
                  theme='vs-dark'
                />
              </div>
              {jsonError && (
                <Alert variant='destructive'>
                  <AlertDescription>{jsonError}</AlertDescription>
                </Alert>
              )}
            </div>
            <div className='flex gap-2'>
              <Button onClick={handleSave} disabled={isUpdating}>
                <CheckCircle2 className='h-4 w-4 mr-2' />
                Save Configuration
              </Button>
              <Button onClick={handleCancel} variant='outline'>
                <XCircle className='h-4 w-4 mr-2' />
                Cancel
              </Button>
            </div>
          </div>
        ) : (
          /* View Mode */
          <Tabs defaultValue='current' className='w-full'>
            <TabsList className='grid w-full grid-cols-2'>
              <TabsTrigger value='current'>Configuration</TabsTrigger>
              <TabsTrigger value='installations'>Installation Details</TabsTrigger>
            </TabsList>

            <TabsContent value='current' className='space-y-4'>
              {config ? (
                <div className='space-y-2'>
                  <div className='flex items-center justify-between'>
                    <label className='text-sm font-medium'>Global Configuration</label>
                    <Button
                      onClick={() => copyToClipboard(JSON.stringify(config, null, 2))}
                      variant='outline'
                      size='sm'
                    >
                      <Copy className='h-4 w-4 mr-2' />
                      Copy
                    </Button>
                  </div>
                  <pre className='p-4 bg-muted rounded-md overflow-auto text-sm max-h-96'>
                    {JSON.stringify(config, null, 2)}
                  </pre>
                </div>
              ) : (
                <Alert>
                  <AlertDescription>
                    No global configuration found. Click "Edit Configuration" to create one.
                  </AlertDescription>
                </Alert>
              )}
            </TabsContent>

            <TabsContent value='installations' className='space-y-4'>
              {installations?.installations && installations.installations.length > 0 ? (
                <div className='space-y-3'>
                  {installations.installations.map((installation: Installation) => (
                    <div key={installation.tool} className='p-4 bg-muted rounded-md space-y-2'>
                      <div className='flex items-center justify-between'>
                        <h5 className='font-medium'>{SUPPORTED_TOOLS[installation.tool]?.name || installation.tool}</h5>
                        <Badge variant='secondary'>{installation.version}</Badge>
                      </div>
                      <div className='grid grid-cols-2 gap-2 text-sm text-muted-foreground'>
                        <div className='flex items-center gap-1'>
                          <Clock className='h-3 w-3' />
                          <span>{new Date(installation.installedAt).toLocaleString()}</span>
                        </div>
                        <div className='flex items-center gap-1'>
                          <User className='h-3 w-3' />
                          <span>
                            {installation.installedAt ? new Date(installation.installedAt).toLocaleString() : 'Unknown'}
                          </span>
                        </div>
                      </div>
                      {installation &&
                      'location' in installation &&
                      installation.location &&
                      typeof installation.location === 'string' ? (
                        <div className='flex items-center gap-1 text-sm text-muted-foreground'>
                          <FolderOpen className='h-3 w-3' />
                          <code className='text-xs'>{installation.location as string}</code>
                        </div>
                      ) : null}
                      {installation &&
                      'config' in installation &&
                      installation.config &&
                      typeof installation.config === 'object' ? (
                        <details className='mt-2'>
                          <summary className='cursor-pointer text-sm text-muted-foreground hover:text-foreground'>
                            View configuration
                          </summary>
                          <pre className='mt-2 p-2 bg-background rounded text-xs overflow-auto'>
                            {JSON.stringify(installation.config as any, null, 2)}
                          </pre>
                        </details>
                      ) : null}
                    </div>
                  ))}
                </div>
              ) : (
                <Alert>
                  <AlertDescription>No tools are currently installed globally.</AlertDescription>
                </Alert>
              )}
            </TabsContent>
          </Tabs>
        )}
      </CardContent>
    </Card>
  )
}
