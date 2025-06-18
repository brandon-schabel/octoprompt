import { useState, useEffect } from 'react'
import { ProjectData } from '@octoprompt/schemas'
import { Button } from '@/components/ui/button'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Card } from '@/components/ui/card'
import { Alert, AlertDescription } from '@/components/ui/alert'
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
  project: ProjectData
  projectId: number
  allProjects: ProjectData[]
}

export function AgentCoderAgent({ project, projectId, allProjects }: AgentCoderAgentProps) {
  const [selectedRunId, setSelectedRunId] = useState<number | null>(null)
  const [showRawData, setShowRawData] = useState(false)
  const [activeTab, setActiveTab] = useState<'runs' | 'logs' | 'confirm'>('runs')

  const runAgentCoder = useRunAgentCoder()
  const { data: runs = [], isLoading: isLoadingRuns } = useGetAgentCoderRuns(projectId)
  const { data: logs = [] } = useGetAgentCoderLogs(projectId, selectedRunId)
  const { data: runData } = useGetAgentCoderData(projectId, selectedRunId)
  const confirmChanges = useConfirmAgentCoderChanges()
  const deleteRun = useDeleteAgentCoderRun()

  const handleRunAgentCoder = async () => {
    try {
      const result = await runAgentCoder.mutateAsync({ projectId })
      setSelectedRunId(result.jobId)
      setActiveTab('logs')
      toast.success('Agent Coder job started')
    } catch (error) {
      toast.error('Failed to start Agent Coder job')
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

  const currentRun = runs.find((run) => run.jobId === selectedRunId)
  const hasChanges = runData?.fileChanges && Object.keys(runData.fileChanges).length > 0

  return (
    <div className='h-full flex flex-col'>
      <div className='flex items-center justify-between p-4 border-b'>
        <h2 className='text-lg font-semibold'>Agent Coder</h2>
        <Button onClick={handleRunAgentCoder} disabled={runAgentCoder.isPending} size='sm'>
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
                {runs.map((run) => (
                  <Card
                    key={run.jobId}
                    className={`p-4 cursor-pointer transition-colors ${
                      selectedRunId === run.jobId ? 'border-primary' : ''
                    }`}
                    onClick={() => setSelectedRunId(run.jobId)}
                  >
                    <div className='flex items-center justify-between'>
                      <div>
                        <div className='flex items-center gap-2'>
                          <span className='font-medium'>Run #{run.jobId}</span>
                          <Badge variant={run.status === 'completed' ? 'default' : 'secondary'}>{run.status}</Badge>
                        </div>
                        <p className='text-sm text-muted-foreground'>
                          {formatDistanceToNow(new Date(run.startTime), { addSuffix: true })}
                        </p>
                      </div>
                      <Button
                        variant='ghost'
                        size='sm'
                        onClick={(e) => {
                          e.stopPropagation()
                          handleDeleteRun(run.jobId)
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
                    <span className='text-muted-foreground'>[{new Date(log.timestamp).toLocaleTimeString()}]</span>{' '}
                    <span
                      className={`${
                        log.level === 'error' ? 'text-red-500' : log.level === 'warning' ? 'text-yellow-500' : ''
                      }`}
                    >
                      {log.message}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </ScrollArea>
        </TabsContent>

        <TabsContent value='confirm' className='flex-1 flex flex-col p-4'>
          {runData?.fileChanges && (
            <>
              <div className='flex items-center justify-between mb-4'>
                <h3 className='font-medium'>Proposed Changes</h3>
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
                  {Object.entries(runData.fileChanges).map(([path, change]) => (
                    <Card key={path} className='p-4'>
                      <h4 className='font-medium mb-2'>{path}</h4>
                      <LazyMonacoEditor
                        value={change.content}
                        onChange={() => {}}
                        language={path.split('.').pop() || 'plaintext'}
                        readOnly
                        height='300px'
                      />
                    </Card>
                  ))}
                </div>
              </ScrollArea>
            </>
          )}
        </TabsContent>
      </Tabs>
    </div>
  )
}
