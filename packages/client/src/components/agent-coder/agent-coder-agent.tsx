import { useState, useEffect } from 'react'
import { Project } from '@octoprompt/schemas'
import { Button } from '@/components/ui/button'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Card } from '@/components/ui/card'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Textarea } from '@/components/ui/textarea'
import { Loader2, Play, Check, X, Trash2 } from 'lucide-react'
import { LazyMonacoEditor } from '@/components/lazy-monaco-editor'
import { toast } from 'sonner'
import {
  useRunAgentCoder,
  useGetAgentCoderRuns,
  useGetAgentCoderLogs,
  useGetAgentCoderData,
  useConfirmAgentCoderChanges,
  useDeleteAgentCoderRun
} from '@/hooks/api/use-agent-coder-api'
import { Badge } from '@/components/ui/badge'
import { formatDistanceToNow } from 'date-fns'

interface AgentCoderAgentProps {
  project: Project
  projectId: number
  allProjects: Project[]
  selectedFileIds?: number[]
  selectedPromptIds?: number[]
  userInput?: string
}

export function AgentCoderAgent({ 
  project, 
  projectId, 
  allProjects,
  selectedFileIds = [],
  selectedPromptIds = [],
  userInput: initialUserInput = ''
}: AgentCoderAgentProps) {
  const [selectedRunId, setSelectedRunId] = useState<number | null>(null)
  const [showRawData, setShowRawData] = useState(false)
  const [activeTab, setActiveTab] = useState<'runs' | 'logs' | 'confirm'>('runs')
  const [userInput, setUserInput] = useState(initialUserInput)

  const runAgentCoder = useRunAgentCoder()
  const { data: runs = [], isLoading: isLoadingRuns } = useGetAgentCoderRuns(projectId)
  const { data: logs = [] } = useGetAgentCoderLogs(projectId, selectedRunId)
  const { data: runData } = useGetAgentCoderData(projectId, selectedRunId)
  const confirmChanges = useConfirmAgentCoderChanges()
  const deleteRun = useDeleteAgentCoderRun()

  const handleRunAgentCoder = async () => {
    if (!userInput.trim()) {
      toast.error('Please provide instructions for the Agent Coder')
      return
    }
    
    try {
      const result = await runAgentCoder.mutateAsync({ 
        projectId,
        userInput,
        selectedFileIds,
        selectedPromptIds
      })
      
      if (result.success && result.data?.agentJobId) {
        setSelectedRunId(result.data.agentJobId)
        setActiveTab('logs')
      }
    } catch (error) {
      // Error already handled by the mutation hook
    }
  }

  const handleConfirmChanges = async () => {
    if (!selectedRunId) return

    try {
      await confirmChanges.mutateAsync({ projectId, agentJobId: selectedRunId })
      toast.success('Changes confirmed and applied')
      setActiveTab('runs')
    } catch (error) {
      toast.error('Failed to confirm changes')
    }
  }

  const handleDeleteRun = async (runId: number) => {
    try {
      await deleteRun.mutateAsync({ agentJobId: runId })
      if (selectedRunId === runId) {
        setSelectedRunId(null)
      }
      toast.success('Run deleted')
    } catch (error) {
      toast.error('Failed to delete run')
    }
  }

  const currentRunId = selectedRunId
  const hasChanges = runData?.updatedFiles && runData.updatedFiles.length > 0

  return (
    <div className='h-full flex flex-col'>
      <div className='p-4 border-b space-y-4'>
        <div className='flex items-center justify-between'>
          <h2 className='text-lg font-semibold'>Agent Coder</h2>
          <Button onClick={handleRunAgentCoder} disabled={runAgentCoder.isPending || !userInput.trim()} size='sm'>
            {runAgentCoder.isPending ? (
              <>
                <Loader2 className='mr-2 h-4 w-4 animate-spin' />
                Running...
              </>
            ) : (
              <>
                <Play className='mr-2 h-4 w-4' />
                Run Agent
              </>
            )}
          </Button>
        </div>
        <div>
          <Textarea
            placeholder="Enter instructions for the Agent Coder (e.g., 'Refactor the authentication logic to use JWT tokens')"
            value={userInput}
            onChange={(e) => setUserInput(e.target.value)}
            className='min-h-[80px]'
          />
          <div className='text-xs text-muted-foreground mt-2'>
            Selected: {selectedFileIds.length} file(s), {selectedPromptIds.length} prompt(s)
          </div>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as any)} className='flex-1 flex flex-col'>
        <TabsList className='w-full justify-start rounded-none border-b'>
          <TabsTrigger value='runs'>Runs</TabsTrigger>
          <TabsTrigger value='logs' disabled={!selectedRunId}>
            Logs
          </TabsTrigger>
          <TabsTrigger value='confirm' disabled={!selectedRunId || !hasChanges}>
            Confirm Changes
          </TabsTrigger>
        </TabsList>

        <TabsContent value='runs' className='flex-1 p-4'>
          <ScrollArea className='h-full'>
            {isLoadingRuns ? (
              <div className='flex items-center justify-center p-8'>
                <Loader2 className='h-6 w-6 animate-spin' />
              </div>
            ) : runs.length === 0 ? (
              <Alert>
                <AlertDescription>No agent runs yet. Click "Run Agent" to start.</AlertDescription>
              </Alert>
            ) : (
              <div className='space-y-2'>
                {runs.map((runId) => (
                  <Card
                    key={runId}
                    className={`p-4 cursor-pointer transition-colors ${
                      selectedRunId === runId ? 'border-primary' : ''
                    }`}
                    onClick={() => setSelectedRunId(runId)}
                  >
                    <div className='flex items-center justify-between'>
                      <div>
                        <div className='flex items-center gap-2'>
                          <span className='font-medium'>Run #{runId}</span>
                        </div>
                      </div>
                      <Button
                        variant='ghost'
                        size='sm'
                        onClick={(e) => {
                          e.stopPropagation()
                          handleDeleteRun(runId)
                        }}
                      >
                        <Trash2 className='h-4 w-4' />
                      </Button>
                    </div>
                  </Card>
                ))}
              </div>
            )}
          </ScrollArea>
        </TabsContent>

        <TabsContent value='logs' className='flex-1 flex flex-col p-4'>
          <div className='flex items-center justify-between mb-4'>
            <h3 className='font-medium'>Execution Logs</h3>
            <Button variant='outline' size='sm' onClick={() => setShowRawData(!showRawData)}>
              {showRawData ? 'Show Logs' : 'Show Raw Data'}
            </Button>
          </div>
          <ScrollArea className='flex-1'>
            {showRawData && runData ? (
              <LazyMonacoEditor
                value={JSON.stringify(runData, null, 2)}
                onChange={() => {}}
                language='json'
                readOnly
                height='100%'
              />
            ) : (
              <div className='space-y-2'>
                {logs.map((log, index) => (
                  <div key={index} className='font-mono text-sm'>
                    <pre className='whitespace-pre-wrap'>{JSON.stringify(log, null, 2)}</pre>
                  </div>
                ))}
              </div>
            )}
          </ScrollArea>
        </TabsContent>

        <TabsContent value='confirm' className='flex-1 flex flex-col p-4'>
          {runData && hasChanges && (
            <>
              <div className='flex items-center justify-between mb-4'>
                <h3 className='font-medium'>Run Details</h3>
                <Button onClick={handleConfirmChanges} disabled={confirmChanges.isPending}>
                  {confirmChanges.isPending ? (
                    <>
                      <Loader2 className='mr-2 h-4 w-4 animate-spin' />
                      Applying...
                    </>
                  ) : (
                    <>
                      <Check className='mr-2 h-4 w-4' />
                      Confirm Changes
                    </>
                  )}
                </Button>
              </div>
              <ScrollArea className='flex-1'>
                <div className='space-y-4'>
                  <Card className='p-4'>
                    <h4 className='font-medium mb-2'>Updated Files</h4>
                    <p className='text-sm text-muted-foreground'>
                      {runData.updatedFiles.length} file(s) were modified
                    </p>
                    {runData.taskPlan && (
                      <div className='mt-4'>
                        <h5 className='font-medium mb-2'>Task Plan</h5>
                        <pre className='text-xs whitespace-pre-wrap'>
                          {JSON.stringify(runData.taskPlan, null, 2)}
                        </pre>
                      </div>
                    )}
                  </Card>
                </div>
              </ScrollArea>
            </>
          )}
        </TabsContent>
      </Tabs>
    </div>
  )
}
