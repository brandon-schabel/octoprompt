import { useState, useMemo, useCallback } from 'react'
import { ResizablePanel } from '@ui'
import { AgentCoderAgent } from '@/components/agent-coder/agent-coder-agent'
import { Project, ProjectTabState } from '@octoprompt/schemas'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { ChevronDown, RefreshCw, FileText, MessageSquare, User } from 'lucide-react'
import { toast } from 'sonner'
import { useMediaQuery } from '@/hooks/use-media-query'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Badge } from '@/components/ui/badge'
import { useGetProjectFiles } from '@/hooks/api/use-projects-api'
import { useGetProjectPrompts } from '@/hooks/api/use-prompts-api'
import { useActiveProjectTab } from '@/hooks/use-kv-local-storage'

interface AgentCoderTabViewProps {
  project: Project
  projectId: number
  allProjects: Project[]
}

export function AgentCoderTabView({ project, projectId, allProjects }: AgentCoderTabViewProps) {
  const isDesktop = useMediaQuery('(min-width: 768px)')
  const [refreshKey, setRefreshKey] = useState(0)
  const [isContextOpen, setIsContextOpen] = useState(false)
  const [activeProjectTabState] = useActiveProjectTab()

  const { data: promptsData } = useGetProjectPrompts(projectId)
  const { data: filesData } = useGetProjectFiles(projectId)

  const prompts = promptsData?.data || []
  const files = filesData?.data || []

  const handleRefresh = useCallback(() => {
    setRefreshKey((prev) => prev + 1)
    toast.success('Agent Coder refreshed with latest context')
  }, [])

  // Get selected files and prompts
  const selectedFiles = useMemo(() => {
    if (!files || !activeProjectTabState) return []
    return activeProjectTabState.selectedFiles.map((fileId) => files.find((f) => f.id === fileId)).filter(Boolean)
  }, [files, activeProjectTabState])

  const selectedPrompts = useMemo(() => {
    if (!prompts || !activeProjectTabState) return []
    return activeProjectTabState.selectedPrompts
      .map((promptId) => prompts.find((p) => p.id === promptId))
      .filter(Boolean)
  }, [prompts, activeProjectTabState])

  const contextContent = useMemo(
    () => (
      <Card className='h-full flex flex-col'>
        <CardHeader className='flex-none pb-3'>
          <div className='flex items-center justify-between'>
            <CardTitle className='text-lg'>Context</CardTitle>
            <Button variant='ghost' size='sm' onClick={handleRefresh} title='Refresh Agent Coder with current context'>
              <RefreshCw className='h-4 w-4' />
            </Button>
          </div>
          <CardDescription>Selected files, prompts, and user input for Agent Coder</CardDescription>
        </CardHeader>
        <CardContent className='flex-1 min-h-0 flex flex-col space-y-4 pb-4'>
          <ScrollArea className='h-full'>
            <div className='space-y-4'>
              {/* User Input Section */}
              {activeProjectTabState?.userPrompt && (
                <div className='space-y-2'>
                  <div className='flex items-center gap-2'>
                    <User className='h-4 w-4 text-muted-foreground' />
                    <span className='text-sm font-medium'>User Input</span>
                  </div>
                  <div className='bg-muted/50 rounded-md p-3'>
                    <p className='text-sm whitespace-pre-wrap'>{activeProjectTabState.userPrompt}</p>
                  </div>
                </div>
              )}

              {/* Selected Prompts Section */}
              {selectedPrompts.length > 0 && (
                <div className='space-y-2'>
                  <div className='flex items-center gap-2'>
                    <MessageSquare className='h-4 w-4 text-muted-foreground' />
                    <span className='text-sm font-medium'>Selected Prompts</span>
                    <Badge variant='secondary' className='text-xs'>
                      {selectedPrompts.length}
                    </Badge>
                  </div>
                  <div className='space-y-2'>
                    {selectedPrompts.map(
                      (prompt) =>
                        prompt && (
                          <div key={prompt.id} className='bg-muted/50 rounded-md p-2'>
                            <p className='text-sm font-medium'>{prompt.name}</p>
                            <p className='text-xs text-muted-foreground line-clamp-2 mt-1'>{prompt.content}</p>
                          </div>
                        )
                    )}
                  </div>
                </div>
              )}

              {/* Selected Files Section */}
              {selectedFiles.length > 0 && (
                <div className='space-y-2'>
                  <div className='flex items-center gap-2'>
                    <FileText className='h-4 w-4 text-muted-foreground' />
                    <span className='text-sm font-medium'>Selected Files</span>
                    <Badge variant='secondary' className='text-xs'>
                      {selectedFiles.length}
                    </Badge>
                  </div>
                  <div className='space-y-1'>
                    {selectedFiles.map(
                      (file) =>
                        file && (
                          <div key={file.id} className='bg-muted/50 rounded-md px-2 py-1.5 text-xs font-mono'>
                            {file.path}
                          </div>
                        )
                    )}
                  </div>
                </div>
              )}

              {/* Empty State */}
              {!activeProjectTabState?.userPrompt && selectedPrompts.length === 0 && selectedFiles.length === 0 && (
                <div className='flex-1 flex items-center justify-center p-8'>
                  <p className='text-sm text-muted-foreground text-center'>
                    Select files, prompts, or enter user input in the Context tab to begin
                  </p>
                </div>
              )}
            </div>
          </ScrollArea>
        </CardContent>
      </Card>
    ),
    [activeProjectTabState, selectedFiles, selectedPrompts, handleRefresh]
  )

  const agentContent = (
    <AgentCoderAgent 
      key={refreshKey} 
      project={project} 
      projectId={projectId} 
      allProjects={allProjects}
      selectedFileIds={activeProjectTabState?.selectedFiles || []}
      selectedPromptIds={activeProjectTabState?.selectedPrompts || []}
      userInput={activeProjectTabState?.userPrompt || ''}
    />
  )

  if (!isDesktop) {
    return (
      <div className='h-full flex flex-col'>
        <div className='border-b'>
          <Button
            variant='ghost'
            className='w-full justify-between p-4'
            onClick={() => setIsContextOpen(!isContextOpen)}
          >
            <span>Context</span>
            <ChevronDown className={`h-4 w-4 transition-transform ${isContextOpen ? 'rotate-180' : ''}`} />
          </Button>
        </div>
        {isContextOpen && <div className='border-b'>{contextContent}</div>}
        <div className='flex-1 overflow-hidden'>{agentContent}</div>
      </div>
    )
  }

  return (
    <ResizablePanel
      leftPanel={contextContent}
      rightPanel={agentContent}
      initialLeftPanelWidth={30}
      minLeftPanelWidth={200}
      storageKey='agent-coder-panel-width'
      className='h-full'
    />
  )
}
