import { useProjectTabField, useUpdateActiveProjectTab, useAppSettings } from '@/hooks/use-kv-local-storage'
import { useSyncProjectWithProgress, useGetProject } from '@/hooks/api/use-projects-api'
import { SyncProgressDialog } from './sync-progress-dialog'
import type { SyncProgressEvent } from '@promptliano/schemas'
import { GlobalStateEditorType as EditorType, EDITOR_OPTIONS } from '@promptliano/schemas'
import {
  Button,
  Input,
  Slider,
  Switch,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Checkbox,
  Label,
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger
} from '@promptliano/ui'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@promptliano/ui'
import { useCopyClipboard } from '@/hooks/utility-hooks/use-copy-clipboard'
import { Copy, RefreshCw, Settings, HelpCircle, ChevronDown } from 'lucide-react'
import { useEffect, useState, useRef } from 'react'
import { toast } from 'sonner'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@promptliano/ui'
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
  const { data: assetsEnabled } = useProjectTabField('assetsEnabled')
  const { data: autoIncludeClaudeMd } = useProjectTabField('autoIncludeClaudeMd')
  const { data: instructionFileSettings } = useProjectTabField('instructionFileSettings')

  const { data: projectData } = useGetProject(projectId!)
  const { copyToClipboard } = useCopyClipboard()
  const [showAgentFiles, setShowAgentFiles] = useState(false)
  const [showTroubleshooting, setShowTroubleshooting] = useState(false)
  const [showInstructionFileSettings, setShowInstructionFileSettings] = useState(false)
  const [showSyncProgress, setShowSyncProgress] = useState(false)
  
  const { syncWithProgress } = useSyncProjectWithProgress()
  const syncProgressRef = useRef<{ updateProgress: (event: SyncProgressEvent) => void } | null>(null)

  // Removed auto-sync to prevent blocking - sync is now handled with progress tracking on demand
  
  const handleManualSync = () => {
    if (!projectId || !projectData) return
    
    setShowSyncProgress(true)
    
    syncWithProgress(projectId, (event) => {
      syncProgressRef.current?.updateProgress(event)
    })
      .then(() => {
        toast.success('Project synced successfully!')
        setShowSyncProgress(false)
      })
      .catch((error) => {
        toast.error(`Sync failed: ${error.message}`)
        setShowSyncProgress(false)
      })
  }

  const setPreferredEditor = (value: EditorType) => {
    updateActiveProjectTab((prev) => ({
      ...prev,
      preferredEditor: value
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

  const setAssetsEnabled = (value: boolean) => {
    updateActiveProjectTab((prev) => ({
      ...prev,
      assetsEnabled: value
    }))
  }

  const setAutoIncludeClaudeMd = (value: boolean) => {
    updateActiveProjectTab((prev) => ({
      ...prev,
      autoIncludeClaudeMd: value
    }))
  }

  const setInstructionFileSettings = (updater: (prev: any) => any) => {
    updateActiveProjectTab((prev) => ({
      ...prev,
      instructionFileSettings: updater(
        prev.instructionFileSettings || {
          autoIncludeEnabled: false,
          fileTypes: ['claude'],
          priority: 'claude',
          includeGlobal: false,
          includeProjectRoot: true,
          includeHierarchy: true
        }
      )
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
              
              <div className='pt-4 border-t'>
                <Button variant='outline' onClick={handleManualSync} className='w-full'>
                  <RefreshCw className='h-4 w-4 mr-2' />
                  Sync Project Files
                </Button>
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

            <div className='space-y-4'>
              <div className='flex items-center justify-between'>
                <div className='space-y-0.5'>
                  <label className='text-base font-medium'>Auto-Include AI Instruction Files</label>
                  <p className='text-sm text-muted-foreground'>
                    Automatically include AI instruction files (CLAUDE.md, copilot-instructions.md, etc.) when selecting
                    files
                  </p>
                </div>
                <Switch
                  checked={instructionFileSettings?.autoIncludeEnabled ?? autoIncludeClaudeMd}
                  onCheckedChange={(value) => {
                    setInstructionFileSettings((prev) => ({ ...prev, autoIncludeEnabled: value }))
                    // Also update legacy setting for backward compatibility
                    if (!instructionFileSettings) {
                      setAutoIncludeClaudeMd(value)
                    }
                  }}
                />
              </div>

              {(instructionFileSettings?.autoIncludeEnabled || (!instructionFileSettings && autoIncludeClaudeMd)) && (
                <Collapsible open={showInstructionFileSettings} onOpenChange={setShowInstructionFileSettings}>
                  <CollapsibleTrigger asChild>
                    <Button variant='ghost' size='sm' className='w-full justify-between'>
                      <span>Configure Instruction File Types</span>
                      <ChevronDown
                        className={`h-4 w-4 transition-transform ${showInstructionFileSettings ? 'rotate-180' : ''}`}
                      />
                    </Button>
                  </CollapsibleTrigger>
                  <CollapsibleContent className='space-y-4 pt-4'>
                    <div className='space-y-2'>
                      <Label className='text-sm font-medium'>Enabled File Types</Label>
                      <div className='space-y-2 pl-4'>
                        {[
                          { type: 'claude', label: 'Claude (CLAUDE.md)', description: 'Claude AI context files' },
                          {
                            type: 'agents',
                            label: 'Agents (AGENTS.md)',
                            description: 'General agent instructions standard'
                          },
                          {
                            type: 'copilot',
                            label: 'GitHub Copilot (copilot-instructions.md)',
                            description: 'Copilot configuration'
                          },
                          { type: 'cursor', label: 'Cursor (.cursorrules)', description: 'Cursor IDE settings' },
                          { type: 'aider', label: 'Aider (.aider)', description: 'Aider AI assistant config' },
                          {
                            type: 'codebase',
                            label: 'Codebase (codebase-instructions.md)',
                            description: 'General AI instructions'
                          },
                          {
                            type: 'windsurf',
                            label: 'Windsurf (.windsurf/rules.md)',
                            description: 'Windsurf IDE rules'
                          },
                          {
                            type: 'continue',
                            label: 'Continue (.continue/config.json)',
                            description: 'Continue extension config'
                          }
                        ].map(({ type, label, description }) => (
                          <div key={type} className='flex items-start space-x-2'>
                            <Checkbox
                              id={`file-type-${type}`}
                              checked={(instructionFileSettings?.fileTypes || ['claude']).includes(type as any)}
                              onCheckedChange={(checked) => {
                                setInstructionFileSettings((prev) => {
                                  const fileTypes = prev.fileTypes || ['claude']
                                  if (checked) {
                                    return { ...prev, fileTypes: [...fileTypes, type] }
                                  } else {
                                    return { ...prev, fileTypes: fileTypes.filter((t: any) => t !== type) }
                                  }
                                })
                              }}
                            />
                            <div className='space-y-0.5'>
                              <Label htmlFor={`file-type-${type}`} className='text-sm font-normal cursor-pointer'>
                                {label}
                              </Label>
                              <p className='text-xs text-muted-foreground'>{description}</p>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>

                    <div className='space-y-2'>
                      <div className='flex items-center justify-between'>
                        <div className='space-y-0.5'>
                          <Label className='text-sm font-medium'>Include Full Hierarchy</Label>
                          <p className='text-xs text-muted-foreground'>
                            Include instruction files from all parent directories up to the project root
                          </p>
                        </div>
                        <Switch
                          checked={instructionFileSettings?.includeHierarchy ?? true}
                          onCheckedChange={(value) => {
                            setInstructionFileSettings((prev) => ({ ...prev, includeHierarchy: value }))
                          }}
                        />
                      </div>
                    </div>

                    <div className='space-y-2'>
                      <Label className='text-sm font-medium'>Priority</Label>
                      <p className='text-xs text-muted-foreground mb-2'>
                        When multiple instruction files exist in the same directory, use this type
                      </p>
                      <Select
                        value={instructionFileSettings?.priority || 'claude'}
                        onValueChange={(value) => {
                          setInstructionFileSettings((prev) => ({ ...prev, priority: value }))
                        }}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder='Select priority type' />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value='claude'>Claude</SelectItem>
                          <SelectItem value='agents'>Agents</SelectItem>
                          <SelectItem value='copilot'>GitHub Copilot</SelectItem>
                          <SelectItem value='cursor'>Cursor</SelectItem>
                          <SelectItem value='aider'>Aider</SelectItem>
                          <SelectItem value='codebase'>Codebase</SelectItem>
                          <SelectItem value='windsurf'>Windsurf</SelectItem>
                          <SelectItem value='continue'>Continue</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <div className='flex items-center space-x-2'>
                      <Checkbox
                        id='include-project-root'
                        checked={instructionFileSettings?.includeProjectRoot ?? true}
                        onCheckedChange={(checked) => {
                          setInstructionFileSettings((prev) => ({ ...prev, includeProjectRoot: !!checked }))
                        }}
                      />
                      <div className='space-y-0.5'>
                        <Label htmlFor='include-project-root' className='text-sm font-normal cursor-pointer'>
                          Include Project Root Files
                        </Label>
                        <p className='text-xs text-muted-foreground'>
                          Include instruction files from project root (e.g., /CLAUDE.md,
                          /.github/copilot-instructions.md)
                        </p>
                      </div>
                    </div>

                    <div className='flex items-center space-x-2'>
                      <Checkbox
                        id='include-global'
                        checked={instructionFileSettings?.includeGlobal ?? false}
                        onCheckedChange={(checked) => {
                          setInstructionFileSettings((prev) => ({ ...prev, includeGlobal: !!checked }))
                        }}
                      />
                      <div className='space-y-0.5'>
                        <Label htmlFor='include-global' className='text-sm font-normal cursor-pointer'>
                          Include Global Instruction Files
                        </Label>
                        <p className='text-xs text-muted-foreground'>
                          Include instruction files from your home directory (e.g., ~/.claude/CLAUDE.md)
                        </p>
                      </div>
                    </div>
                  </CollapsibleContent>
                </Collapsible>
              )}
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
                  Activate Claude Code tab with agent management, sessions, and chat features. This feature is currently
                  in beta.
                </p>
              </div>
              <Switch checked={!!claudeCodeEnabled} onCheckedChange={setClaudeCodeEnabled} />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Assets (Beta)</CardTitle>
            <CardDescription>Enable the Assets tab for this project</CardDescription>
          </CardHeader>
          <CardContent className='space-y-6'>
            <div className='flex items-center justify-between'>
              <div className='space-y-0.5'>
                <label className='text-base font-medium'>Enable Assets</label>
                <p className='text-sm text-muted-foreground'>The Assets tab is experimental and subject to change.</p>
              </div>
              <Switch checked={!!assetsEnabled} onCheckedChange={setAssetsEnabled} />
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
          <div id='mcp-config-section'>
            <MCPProjectConfigEditor projectId={projectId} />
          </div>
        )}
      </div>
      
      {/* Sync Progress Dialog */}
      {projectData && (
        <SyncProgressDialog
          open={showSyncProgress}
          onOpenChange={setShowSyncProgress}
          projectName={projectData.name}
          ref={syncProgressRef}
        />
      )}
    </TooltipProvider>
  )
}
