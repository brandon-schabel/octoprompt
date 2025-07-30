import { useProjectTabField, useUpdateActiveProjectTab, useAppSettings } from '@/hooks/use-kv-local-storage'
import { useSyncProject, useGetProject } from '@/hooks/api/use-projects-api'
import { EditorType, EDITOR_OPTIONS } from '@promptliano/schemas'
import { Button, Input, Slider, Switch, Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@ui'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@ui'
import { useCopyClipboard } from '@/hooks/utility-hooks/use-copy-clipboard'
import { Copy, RefreshCw, Settings, HelpCircle } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { MCPStatusIndicator } from './mcp-status-indicator'
import { AgentFilesManager } from './agent-files-manager'
import { MCPTroubleshooting } from './mcp-troubleshooting'
// import { MCPProjectInstaller } from './mcp-project-installer'
import { MCPProjectConfigEditor } from './mcp-project-config-editor'
import { useScrollToSection } from '@/hooks/use-scroll-to-section'
import { Route } from '@/routes/projects'

export function ProjectSettingsTab() {
  // Get search params and use the scroll to section hook
  const search = Route.useSearch()
  useScrollToSection({ search })
  
  const updateActiveProjectTab = useUpdateActiveProjectTab()
  const [{ summarizationEnabledProjectIds = [] }, updateSettings] = useAppSettings()
  const { data: resolveImports } = useProjectTabField('resolveImports')
  const { data: preferredEditor } = useProjectTabField('preferredEditor')
  const { data: projectId } = useProjectTabField('selectedProjectId')
  const { data: claudeCodeEnabled } = useProjectTabField('claudeCodeEnabled')

  const { data: projectResponse } = useGetProject(projectId!)
  const projectData = projectResponse?.data
  const { copyToClipboard } = useCopyClipboard()
  const [showAgentFiles, setShowAgentFiles] = useState(false)
  const [showTroubleshooting, setShowTroubleshooting] = useState(false)

  const { isPending: isSyncing, mutate: syncProject } = useSyncProject()

  useEffect(() => {
    if (projectId) {
      const interval = setInterval(() => {
        syncProject(projectId)
      }, 5000)
      return () => clearInterval(interval)
    }
  }, [projectId, syncProject])


  const setPreferredEditor = (value: EditorType) => {
    updateActiveProjectTab((prev) => ({
      ...prev,
      preferredEditor: value as EditorType
    }))
  }

  const setResolveImports = (value: boolean) => {
    updateActiveProjectTab((prev) => ({
      ...prev,
      resolveImports: value
    }))
  }

  const setClaudeCodeEnabled = (value: boolean) => {
    updateActiveProjectTab((prev) => ({
      ...prev,
      claudeCodeEnabled: value
    }))
  }

  return (
    <TooltipProvider>
      <div className='p-6 max-w-4xl mx-auto space-y-6'>
        <h2 className='text-2xl font-bold mb-4'>Project Settings</h2>

        {projectData && (
          <Card>
            <CardHeader>
              <CardTitle>Project Information</CardTitle>
              <CardDescription>Basic information about your project</CardDescription>
            </CardHeader>
            <CardContent className='space-y-4'>
              <div className='space-y-2'>
                <label className='text-sm font-medium'>Project Path</label>
                <div className='flex items-center gap-2'>
                  <Input value={projectData.path} readOnly className='flex-1' />
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        variant='outline'
                        size='icon'
                        onClick={() =>
                          copyToClipboard(projectData.path || '', {
                            successMessage: 'Project path copied',
                            errorMessage: 'Failed to copy path'
                          })
                        }
                      >
                        <Copy className='h-4 w-4' />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>Copy Path</TooltipContent>
                  </Tooltip>
                </div>
              </div>

              <div className='space-y-2'>
                <label className='text-sm font-medium'>Project ID</label>
                <div className='flex items-center gap-2'>
                  <Input value={projectData.id.toString()} readOnly className='flex-1' />
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        variant='outline'
                        size='icon'
                        onClick={() =>
                          copyToClipboard(projectData.id.toString(), {
                            successMessage: 'Project ID copied',
                            errorMessage: 'Failed to copy ID'
                          })
                        }
                      >
                        <Copy className='h-4 w-4' />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>Copy ID</TooltipContent>
                  </Tooltip>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        <Card>
          <CardHeader>
            <CardTitle>File Selection</CardTitle>
            <CardDescription>Configure how files are selected and processed</CardDescription>
          </CardHeader>
          <CardContent className='space-y-6'>
            <div className='flex items-center justify-between'>
              <div className='space-y-0.5'>
                <label className='text-base font-medium'>Include Imports</label>
                <p className='text-sm text-muted-foreground'>
                  For TypeScript files, automatically select all imported files when a file is selected. This
                  recursively follows the import tree.
                </p>
              </div>
              <Switch checked={!!resolveImports} onCheckedChange={setResolveImports} />
            </div>

            <div className='space-y-2'>
              <label className='text-base font-medium'>Preferred Editor</label>
              <p className='text-sm text-muted-foreground mb-2'>
                Choose which editor to open files in when using the "Open in Editor" button
              </p>
              <Select
                value={preferredEditor || undefined}
                onValueChange={(value) => setPreferredEditor(value as EditorType)}
              >
                <SelectTrigger>
                  <SelectValue placeholder='Select an editor' />
                </SelectTrigger>
                <SelectContent>
                  {EDITOR_OPTIONS.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Claude Code Integration (Beta)</CardTitle>
            <CardDescription>Enable advanced Claude Code features for this project</CardDescription>
          </CardHeader>
          <CardContent className='space-y-6'>
            <div className='flex items-center justify-between'>
              <div className='space-y-0.5'>
                <label className='text-base font-medium'>Enable Claude Code</label>
                <p className='text-sm text-muted-foreground'>
                  Activate Claude Code tab with agent management, sessions, and chat features. This feature is currently in beta.
                </p>
              </div>
              <Switch checked={!!claudeCodeEnabled} onCheckedChange={setClaudeCodeEnabled} />
            </div>
          </CardContent>
        </Card>

        {/* <Card>
          <CardHeader>
            <div className='flex items-center justify-between'>
              <div>
                <CardTitle>Additional MCP Options</CardTitle>
                <CardDescription>Advanced settings and troubleshooting</CardDescription>
              </div>
              {projectId && <MCPStatusIndicator projectId={projectId} />}
            </div>
          </CardHeader>
          <CardContent className='space-y-4'>
            <div className='flex gap-2 flex-wrap'>
              <Button variant='outline' onClick={() => setShowAgentFiles(!showAgentFiles)}>
                <Settings className='h-4 w-4 mr-2' />
                {showAgentFiles ? 'Hide' : 'Manage'} Agent Files
              </Button>
              <Button variant='outline' onClick={() => setShowTroubleshooting(!showTroubleshooting)}>
                <HelpCircle className='h-4 w-4 mr-2' />
                {showTroubleshooting ? 'Hide' : 'Show'} Troubleshooting
              </Button>
            </div>
          </CardContent>
        </Card> */}

        {/* {showAgentFiles && projectId && <AgentFilesManager projectId={projectId} />} */}

        {showTroubleshooting && <MCPTroubleshooting />}

        {projectId && (
          <div id="mcp-config-section">
            <MCPProjectConfigEditor projectId={projectId} />
          </div>
        )}
      </div>
    </TooltipProvider>
  )
}
