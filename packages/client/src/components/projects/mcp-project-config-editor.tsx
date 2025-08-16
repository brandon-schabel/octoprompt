import { useState, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useApiClient } from '@/hooks/api/use-api-client'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@promptliano/ui'
import { Button } from '@promptliano/ui'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@promptliano/ui'
import { Alert, AlertDescription, AlertTitle } from '@promptliano/ui'
import { Badge } from '@promptliano/ui'
import {
  FileIcon,
  FolderIcon,
  CheckCircle2,
  XCircle,
  Edit,
  Save,
  X,
  Plus,
  Trash2,
  Copy,
  Code,
  Sparkles,
  Terminal
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { toast } from 'sonner'
import { Editor } from '@monaco-editor/react'
import { Input } from '@promptliano/ui'
import { Label } from '@promptliano/ui'
import { Switch } from '@promptliano/ui'
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@promptliano/ui'
import { getEditorInfoFromPath, getRelativeConfigPath } from '@/lib/utils/editor-utils'

interface MCPProjectConfigEditorProps {
  projectId: number
}

interface ConfigLocation {
  path: string
  exists: boolean
  priority: number
}

interface MCPConfigLocation {
  path: string
  exists: boolean
  priority: number
}

interface MCPServerConfig {
  type: 'stdio' | 'http'
  command: string
  args?: string[]
  env?: Record<string, string>
  timeout?: number
}

type ProjectMCPConfigInput = 
  | {
      type: 'promptString'
      id: string
      description: string
      default?: string
      password?: boolean
    }
  | {
      type: 'promptNumber'
      id: string
      description: string
      default?: number
      password?: boolean
    }
  | {
      type: 'promptBoolean'
      id: string
      description: string
      default?: boolean
      password?: boolean
    }

interface ProjectMCPConfig {
  mcpServers?: Record<string, MCPServerConfig>
  servers?: Record<string, MCPServerConfig>
  inputs?: ProjectMCPConfigInput[]
  extends?: string | string[]
}

export function MCPProjectConfigEditor({ projectId }: MCPProjectConfigEditorProps) {
  const client = useApiClient()
  const queryClient = useQueryClient()
  const [editMode, setEditMode] = useState(false)
  const [jsonError, setJsonError] = useState<string | null>(null)
  const [configJson, setConfigJson] = useState<string>('')
  const [selectedLocation, setSelectedLocation] = useState<string | null>(null)
  const [claudeCodeCommand, setClaudeCodeCommand] = useState<string>('')

  // Get project information
  const { data: projectData } = useQuery({
    queryKey: ['project', projectId],
    queryFn: async () => {
      if (!client) return
      const result = await client.projects.getProject(projectId)
      return result.data
    },
    enabled: !!client
  })

  // Get config locations
  const { data: locationsData, isLoading: isLoadingLocations } = useQuery({
    queryKey: ['mcp-project-config-locations', projectId],
    queryFn: async () => {
      if (!client) return
      const result = await client.mcpProjectConfig.getConfigLocations(projectId)
      return result.data
    },
    enabled: !!client
  })

  // Get current project config
  const { data: configData, isLoading: isLoadingConfig } = useQuery({
    queryKey: ['mcp-project-config', projectId],
    queryFn: async () => {
      if (!client) return
      const result = await client.mcpProjectConfig.loadProjectConfig(projectId)
      return result.data
    },
    enabled: !!client
  })

  // Get merged config (with hierarchy)
  const { data: mergedConfigData } = useQuery({
    queryKey: ['mcp-merged-config', projectId],
    queryFn: async () => {
      if (!client) return
      const result = await client.mcpProjectConfig.getMergedConfig(projectId)
      return result.data
    },
    enabled: !!client
  })

  // Get expanded config (with variables resolved)
  const { data: expandedConfigData } = useQuery({
    queryKey: ['mcp-expanded-config', projectId],
    queryFn: async () => {
      if (!client) return
      const result = await client.mcpProjectConfig.getExpandedConfig(projectId)
      return result.data
    },
    enabled: !!client
  })

  // Save config mutation
  const saveConfigMutation = useMutation({
    mutationFn: async (config: ProjectMCPConfig) => {
      if (!client) return
      await client.mcpProjectConfig.saveProjectConfig(projectId, config)
    },
    onSuccess: () => {
      toast.success('MCP configuration saved successfully')
      setEditMode(false)
      queryClient.invalidateQueries({ queryKey: ['mcp-project-config', projectId] })
      queryClient.invalidateQueries({ queryKey: ['mcp-merged-config', projectId] })
      queryClient.invalidateQueries({ queryKey: ['mcp-expanded-config', projectId] })
      queryClient.invalidateQueries({ queryKey: ['mcp-project-config-locations', projectId] })
    },
    onError: (error) => {
      toast.error('Failed to save configuration', {
        description: error.message
      })
    }
  })

  // Initialize JSON editor with current config
  useEffect(() => {
    if (configData?.config) {
      setConfigJson(JSON.stringify(configData.config, null, 2))
    } else if (!configData?.config && !isLoadingConfig) {
      // No config exists, provide a template
      const template: ProjectMCPConfig = {
        mcpServers: {
          'example-server': {
            type: 'stdio',
            command: 'node',
            args: ['./path/to/server.js']
          }
        }
      }
      setConfigJson(JSON.stringify(template, null, 2))
    }
  }, [configData, isLoadingConfig])

  // Generate Claude Code command
  useEffect(() => {
    if (locationsData?.locations) {
      // Find the path that would be used for the MCP script
      // This is typically the project path with the script path appended
      const firstLocation = locationsData.locations[0]
      if (firstLocation) {
        // Extract the base path from the location (remove the .vscode/mcp.json or similar)
        const basePath = firstLocation.path
          .replace('/.vscode/mcp.json', '')
          .replace('/.cursor/mcp.json', '')
          .replace('/mcp.json', '')

        // For Promptliano project itself, the script is in packages/server
        // For other projects, we'd need to know where Promptliano is installed
        let scriptPath = ''
        if (basePath.includes('promptliano')) {
          // This is the Promptliano project itself
          scriptPath = window.navigator.platform.includes('Win')
            ? `${basePath}/packages/server/mcp-start.bat`
            : `${basePath}/packages/server/mcp-start.sh`
        } else {
          // For other projects, we'll use a placeholder that users need to update
          scriptPath = window.navigator.platform.includes('Win')
            ? '/path/to/promptliano/packages/server/mcp-start.bat'
            : '/path/to/promptliano/packages/server/mcp-start.sh'
        }

        const command = `claude mcp add promptliano ${scriptPath}`
        setClaudeCodeCommand(command)
      }
    }
  }, [locationsData])

  const handleSave = () => {
    try {
      const parsedConfig = JSON.parse(configJson) as ProjectMCPConfig
      setJsonError(null)
      saveConfigMutation.mutate(parsedConfig)
    } catch (error) {
      setJsonError(error instanceof Error ? error.message : 'Invalid JSON')
    }
  }

  const handleCancel = () => {
    setEditMode(false)
    setJsonError(null)
    // Reset to original config
    if (configData?.config) {
      setConfigJson(JSON.stringify(configData.config, null, 2))
    }
  }

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text)
    toast.success('Copied to clipboard')
  }

  // Initialize config at specific location
  const initializeConfigMutation = useMutation({
    mutationFn: async (location: MCPConfigLocation) => {
      // Get default config for this location
      const defaultConfigResult = await client?.mcpProjectConfig.getDefaultConfigForLocation(projectId, location.path)

      // Save it to the specific location
      if (!client || !defaultConfigResult) return
      await client.mcpProjectConfig.saveProjectConfigToLocation(
        projectId,
        defaultConfigResult.data.config,
        location.path
      )
    },
    onSuccess: (_, location) => {
      const editorInfo = getEditorInfoFromPath(location.path)
      toast.success(`Initialized ${editorInfo.name} configuration`, {
        description: `Created MCP config at ${getRelativeConfigPath(location.path, '')}`
      })

      // Refresh data
      queryClient.invalidateQueries({ queryKey: ['mcp-project-config-locations', projectId] })
      queryClient.invalidateQueries({ queryKey: ['mcp-project-config', projectId] })
      queryClient.invalidateQueries({ queryKey: ['mcp-merged-config', projectId] })
      queryClient.invalidateQueries({ queryKey: ['mcp-expanded-config', projectId] })
    },
    onError: (error) => {
      toast.error('Failed to initialize configuration', {
        description: error.message
      })
    }
  })

  if (isLoadingLocations || isLoadingConfig) {
    return (
      <Card>
        <CardContent className='pt-6'>
          <div className='text-center text-muted-foreground'>Loading configuration...</div>
        </CardContent>
      </Card>
    )
  }

  const locations = locationsData?.locations || []
  const currentConfig = configData?.config
  const currentSource = configData?.source

  return (
    <Card>
      <CardHeader>
        <div className='flex items-center justify-between'>
          <div>
            <CardTitle>Project MCP Configuration</CardTitle>
            <CardDescription>Configure Model Context Protocol servers for this project</CardDescription>
          </div>
          {!editMode && (
            <Button onClick={() => setEditMode(true)} variant='outline'>
              <Edit className='h-4 w-4 mr-2' />
              Edit Configuration
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent className='space-y-4'>
        {/* Config Locations */}
        <div className='space-y-2'>
          <h4 className='text-sm font-medium'>Configuration Locations</h4>
          <div className='space-y-1'>
            {locations.map((location: ConfigLocation, index: number) => {
              const editorInfo = getEditorInfoFromPath(location.path)
              const EditorIcon = editorInfo?.icon ?? null

              return (
                <div
                  key={location.path}
                  className={cn(
                    'flex items-center justify-between p-3 rounded-md text-sm',
                    location.exists ? 'bg-muted' : 'bg-background border border-dashed',
                    currentSource === location.path && 'ring-2 ring-primary'
                  )}
                >
                  <div className='flex items-center gap-3 flex-1'>
                    {EditorIcon && editorInfo?.color && <EditorIcon className={cn('h-4 w-4', editorInfo?.color)} />}
                    <div className='flex-1'>
                      <div className='flex items-center gap-2'>
                        <span className={cn('font-medium', !location.exists && 'text-muted-foreground')}>
                          {editorInfo?.name}
                        </span>
                        <span className='text-xs text-muted-foreground'>
                          {getRelativeConfigPath(location.path, '')}
                        </span>
                      </div>
                      {!location.exists && (
                        <p className='text-xs text-muted-foreground mt-0.5'>{editorInfo.description}</p>
                      )}
                    </div>
                  </div>
                  <div className='flex items-center gap-2'>
                    <Badge variant={location.exists ? 'default' : 'outline'} className='text-xs'>
                      Priority {location.priority}
                    </Badge>
                    {location.exists ? (
                      <>
                        <CheckCircle2 className='h-4 w-4 text-green-500' />
                        {currentSource === location.path && (
                          <Badge variant='secondary' className='text-xs'>
                            Active
                          </Badge>
                        )}
                      </>
                    ) : (
                      <Button
                        size='sm'
                        variant='outline'
                        onClick={() => initializeConfigMutation.mutate(location)}
                        disabled={initializeConfigMutation.isPending}
                        className='h-7 px-2 text-xs'
                      >
                        <Sparkles className='h-3 w-3 mr-1' />
                        Install MCP
                      </Button>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        {/* Claude Code CLI */}
        <div className='space-y-2'>
          <h4 className='text-sm font-medium'>Claude Code CLI</h4>
          <div
            className={cn(
              'flex items-center justify-between p-3 rounded-md text-sm',
              'bg-background border border-dashed'
            )}
          >
            <div className='flex items-center gap-3 flex-1'>
              <Terminal className={cn('h-4 w-4', 'text-orange-500')} />
              <div className='flex-1'>
                <div className='flex items-center gap-2'>
                  <span className='font-medium'>Claude Code</span>
                </div>
                <p className='text-xs text-muted-foreground mt-0.5'>Add Promptliano MCP server to Claude Code CLI</p>
              </div>
            </div>
          </div>

          {/* Command block */}
          <div className='relative'>
            <div className='bg-muted rounded-md p-4 font-mono text-sm'>
              <code>{claudeCodeCommand}</code>
            </div>
            <Button
              size='sm'
              variant='outline'
              className='absolute top-2 right-2'
              onClick={() => copyToClipboard(claudeCodeCommand)}
            >
              <Copy className='h-3 w-3 mr-1' />
              Copy
            </Button>
          </div>
          <p className='text-xs text-muted-foreground'>
            Run this command in your terminal to add the Promptliano MCP server to Claude Code.
          </p>
        </div>

        {/* Edit Mode */}
        {editMode ? (
          <div className='space-y-4'>
            <div className='space-y-2'>
              <Label>Configuration JSON</Label>
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
              <Button onClick={handleSave} disabled={saveConfigMutation.isPending}>
                <Save className='h-4 w-4 mr-2' />
                Save Configuration
              </Button>
              <Button onClick={handleCancel} variant='outline'>
                <X className='h-4 w-4 mr-2' />
                Cancel
              </Button>
            </div>
          </div>
        ) : (
          /* View Mode */
          <Tabs defaultValue='current' className='w-full'>
            <TabsList className='grid w-full grid-cols-3'>
              <TabsTrigger value='current'>Current</TabsTrigger>
              <TabsTrigger value='merged'>Merged</TabsTrigger>
              <TabsTrigger value='expanded'>Expanded</TabsTrigger>
            </TabsList>

            <TabsContent value='current' className='space-y-4'>
              {currentConfig ? (
                <div className='space-y-2'>
                  <div className='flex items-center justify-between'>
                    <Label>Project Configuration</Label>
                    <Button
                      onClick={() => copyToClipboard(JSON.stringify(currentConfig, null, 2))}
                      variant='outline'
                      size='sm'
                    >
                      <Copy className='h-4 w-4 mr-2' />
                      Copy
                    </Button>
                  </div>
                  <pre className='p-4 bg-muted rounded-md overflow-auto text-sm'>
                    {JSON.stringify(currentConfig, null, 2)}
                  </pre>
                </div>
              ) : (
                <Alert>
                  <AlertDescription>
                    No project-level configuration found. Click "Edit Configuration" to create one.
                  </AlertDescription>
                </Alert>
              )}
            </TabsContent>

            <TabsContent value='merged' className='space-y-4'>
              {mergedConfigData?.config && (
                <div className='space-y-2'>
                  <div className='flex items-center justify-between'>
                    <Label>
                      Merged Configuration (Project {'>'} User {'>'} Global)
                    </Label>
                    <Button
                      onClick={() => copyToClipboard(JSON.stringify(mergedConfigData.config, null, 2))}
                      variant='outline'
                      size='sm'
                    >
                      <Copy className='h-4 w-4 mr-2' />
                      Copy
                    </Button>
                  </div>
                  <pre className='p-4 bg-muted rounded-md overflow-auto text-sm'>
                    {JSON.stringify(mergedConfigData.config, null, 2)}
                  </pre>
                </div>
              )}
            </TabsContent>

            <TabsContent value='expanded' className='space-y-4'>
              {expandedConfigData?.config && (
                <div className='space-y-2'>
                  <div className='flex items-center justify-between'>
                    <Label>Expanded Configuration (Variables Resolved)</Label>
                    <Button
                      onClick={() => copyToClipboard(JSON.stringify(expandedConfigData.config, null, 2))}
                      variant='outline'
                      size='sm'
                    >
                      <Copy className='h-4 w-4 mr-2' />
                      Copy
                    </Button>
                  </div>
                  <Alert>
                    <AlertDescription>
                      Variables like ${'{workspaceFolder}'}, ${'{projectId}'}, and ${'{userHome}'} have been expanded.
                    </AlertDescription>
                  </Alert>
                  <pre className='p-4 bg-muted rounded-md overflow-auto text-sm'>
                    {JSON.stringify(expandedConfigData.config, null, 2)}
                  </pre>
                </div>
              )}
            </TabsContent>
          </Tabs>
        )}
      </CardContent>
    </Card>
  )
}
