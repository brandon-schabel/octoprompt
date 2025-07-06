import { Button } from '@ui'
import { Switch } from '@ui'
import { Loader2, RefreshCw, Settings, Copy } from 'lucide-react'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogDescription } from '@ui'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@ui'
import { Input } from '@ui'
import { Slider } from '@ui'
import { useSyncProject, useGetProject } from '@/hooks/api/use-projects-api'
import { useProjectTabField, useUpdateActiveProjectTab, useAppSettings } from '@/hooks/use-kv-local-storage'
import { useEffect } from 'react'
import { useCopyClipboard } from '@/hooks/utility-hooks/use-copy-clipboard'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { EditorType, EDITOR_OPTIONS } from '@promptliano/schemas'

export function ProjectSettingsDialog() {
  const updateActiveProjectTab = useUpdateActiveProjectTab()
  const { data: contextLimit } = useProjectTabField('contextLimit')
  const [{ summarizationEnabledProjectIds = [] }, updateSettings] = useAppSettings()
  const { data: resolveImports } = useProjectTabField('resolveImports')
  const { data: preferredEditor } = useProjectTabField('preferredEditor')
  const { data: projectId } = useProjectTabField('selectedProjectId')

  const { data: projectResponse } = useGetProject(projectId!)
  const projectData = projectResponse?.data
  const { copyToClipboard } = useCopyClipboard()

  const { isPending: isSyncing, mutate: syncProject } = useSyncProject()

  // call sync project on interval
  useEffect(() => {
    if (projectId) {
      // start interval
      const interval = setInterval(() => {
        syncProject(projectId)
      }, 5000)
      return () => clearInterval(interval)
    }
  }, [projectId, syncProject])

  const setContextLimit = (value: number) => {
    updateActiveProjectTab((prev) => ({
      ...prev,
      contextLimit: value
    }))
  }

  const setPreferredEditor = (value: EditorType) => {
    // @ts-ignore
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

  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button variant='outline'>
          <Settings className='h-4 w-4 mr-2' />
          Project
        </Button>
      </DialogTrigger>
      <DialogContent className='sm:max-w-[425px]'>
        <DialogHeader>
          <DialogTitle>Project Settings</DialogTitle>
          <DialogDescription>Configure your project preferences and behavior.</DialogDescription>
        </DialogHeader>
        <TooltipProvider>
          <div className='grid gap-6 py-4'>
            {projectData && (
              <div className='space-y-3'>
                <div>
                  <span className='text-sm font-medium'>Project Path</span>
                  <div className='flex items-center gap-2 mt-1'>
                    <p className='text-sm text-muted-foreground truncate' title={projectData.path}>
                      {projectData.path}
                    </p>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button
                          variant='ghost'
                          size='icon'
                          className='h-6 w-6 hover:bg-accent hover:text-accent-foreground flex-shrink-0'
                          onClick={(e) => {
                            e.preventDefault()
                            copyToClipboard(projectData.path || '', {
                              successMessage: 'Project path copied',
                              errorMessage: 'Failed to copy path'
                            })
                          }}
                        >
                          <Copy className='h-3.5 w-3.5' />
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>Copy Path</TooltipContent>
                    </Tooltip>
                  </div>
                </div>
                <div>
                  <span className='text-sm font-medium'>Project ID</span>
                  <div className='flex items-center gap-2 mt-1'>
                    <p className='text-sm text-muted-foreground truncate' title={projectData.id.toString()}>
                      {projectData.id}
                    </p>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button
                          variant='ghost'
                          size='icon'
                          className='h-6 w-6 hover:bg-accent hover:text-accent-foreground flex-shrink-0'
                          onClick={(e) => {
                            e.preventDefault()
                            copyToClipboard(projectData.id.toString(), {
                              successMessage: 'Project ID copied',
                              errorMessage: 'Failed to copy ID'
                            })
                          }}
                        >
                          <Copy className='h-3.5 w-3.5' />
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>Copy ID</TooltipContent>
                    </Tooltip>
                  </div>
                </div>
              </div>
            )}
            <div className='space-y-2'>
              <div className='flex items-center justify-between'>
                <div>
                  <span className='text-sm font-medium'>Include Imports</span>
                  <p className='text-sm text-muted-foreground'>
                    For TypeScript files, automatically select all imported files when a file is selected. This
                    recursively follows the import tree.
                  </p>
                </div>
                <Switch
                  checked={!!resolveImports}
                  onCheckedChange={(check) => {
                    setResolveImports(check)
                  }}
                />
              </div>
            </div>
            <div className='space-y-2'>
              <div className='flex items-center justify-between'>
                <div>
                  <span className='text-sm font-medium'>Preferred Editor</span>
                  <p className='text-sm text-muted-foreground'>
                    Choose which editor to open files in when using the "Open in Editor" button (second icon on file
                    hover).
                  </p>
                </div>
                <Select
                  value={preferredEditor || undefined}
                  onValueChange={(value) => setPreferredEditor(value as EditorType)}
                >
                  <SelectTrigger className='w-[160px]'>
                    <SelectValue placeholder='Open files with' />
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
            </div>
            <div className='space-y-2'>
              <div>
                <span className='text-sm font-medium'>Context Size Limit</span>
                <p className='text-sm text-muted-foreground'>
                  Maximum number of tokens to include in the context when generating prompts.
                </p>
              </div>
              <div className='flex items-center space-x-2'>
                <Input
                  type='number'
                  value={contextLimit || 0}
                  onChange={(e) => setContextLimit(parseInt(e.target.value, 10) || 0)}
                  className='w-24'
                />
                <div className='flex-1'>
                  <Slider
                    value={[contextLimit || 128000]}
                    onValueChange={(val) => setContextLimit(val[0])}
                    min={4000}
                    max={1000000}
                    step={1000}
                  />
                </div>
              </div>
            </div>
          </div>
        </TooltipProvider>
      </DialogContent>
    </Dialog>
  )
}
