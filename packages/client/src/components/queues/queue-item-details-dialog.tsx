import { useState, useEffect } from 'react'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@promptliano/ui'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@promptliano/ui'
import { ScrollArea } from '@promptliano/ui'
import { Badge } from '@promptliano/ui'
import { Button } from '@promptliano/ui'
import { Skeleton } from '@promptliano/ui'
import { Separator } from '@promptliano/ui'
import { QueueItem } from '@promptliano/schemas'
import { useGetTicket, useGetTasks } from '@/hooks/api/use-tickets-api'
import { useGetProjectFiles } from '@/hooks/api/use-projects-api'
import { cn } from '@/lib/utils'
import { formatDistanceToNow } from 'date-fns'
import { safeFormatDate } from '@/utils/queue-item-utils'
import {
  FileText,
  FileIcon,
  Clock,
  User,
  AlertCircle,
  CheckCircle2,
  XCircle,
  ListTodo,
  Bot,
  Code,
  FolderOpen,
  Hash,
  Calendar,
  Target
} from 'lucide-react'

interface QueueItemDetailsDialogProps {
  item: QueueItem
  projectId: number
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function QueueItemDetailsDialog({ item, projectId, open, onOpenChange }: QueueItemDetailsDialogProps) {
  const [activeTab, setActiveTab] = useState('details')

  // Fetch ticket and task details
  const { data: ticket } = useGetTicket(item.ticketId || 0)
  const { data: tasks } = useGetTasks(item.ticketId || 0)
  const task = tasks?.find((t) => t.id === item.taskId)

  // Fetch files for the project
  const { data: files } = useGetProjectFiles(projectId)

  // Get file details from IDs
  const getFileDetails = (fileIds: string[]) => {
    return fileIds.map((id) => {
      const file = files?.find((f) => f.id.toString() === id)
      return file || { id, path: `Unknown file (ID: ${id})` }
    })
  }

  const suggestedFiles = task?.suggestedFileIds ? getFileDetails(task.suggestedFileIds) : []

  const statusConfig = {
    queued: { icon: AlertCircle, color: 'text-muted-foreground', bgColor: 'bg-muted', label: 'Queued' },
    in_progress: { icon: Clock, color: 'text-blue-600', bgColor: 'bg-blue-100', label: 'In Progress' },
    completed: { icon: CheckCircle2, color: 'text-green-600', bgColor: 'bg-green-100', label: 'Completed' },
    failed: { icon: XCircle, color: 'text-red-600', bgColor: 'bg-red-100', label: 'Failed' },
    cancelled: { icon: XCircle, color: 'text-gray-600', bgColor: 'bg-gray-100', label: 'Cancelled' },
    timeout: { icon: Clock, color: 'text-orange-600', bgColor: 'bg-orange-100', label: 'Timeout' }
  }

  const config = statusConfig[item.status]
  const StatusIcon = config.icon

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className='max-w-3xl max-h-[80vh]'>
        <DialogHeader>
          <DialogTitle className='flex items-center gap-3'>
            <span>Queue Item Details</span>
            <Badge className={cn('gap-1', config.bgColor, config.color)}>
              <StatusIcon className='h-3 w-3' />
              {config.label}
            </Badge>
          </DialogTitle>
          <DialogDescription>
            Item #{item.id} • Priority {item.priority}
          </DialogDescription>
        </DialogHeader>

        <Tabs value={activeTab} onValueChange={setActiveTab} className='mt-4'>
          <TabsList className='grid w-full grid-cols-3'>
            <TabsTrigger value='details'>Details</TabsTrigger>
            <TabsTrigger value='files'>Files</TabsTrigger>
            <TabsTrigger value='processing'>Processing</TabsTrigger>
          </TabsList>

          {/* Details Tab */}
          <TabsContent value='details' className='mt-4'>
            <ScrollArea className='h-[400px] pr-4'>
              <div className='space-y-6'>
                {/* Task Information */}
                {task && ticket ? (
                  <div className='space-y-4'>
                    <div>
                      <h3 className='font-semibold mb-2 flex items-center gap-2'>
                        <ListTodo className='h-4 w-4' />
                        Task Information
                      </h3>
                      <div className='space-y-3 text-sm'>
                        <div>
                          <p className='text-muted-foreground'>Ticket</p>
                          <p className='font-medium'>
                            {ticket.title} (#{ticket.id})
                          </p>
                        </div>
                        <div>
                          <p className='text-muted-foreground'>Task</p>
                          <p className='font-medium'>{task.content}</p>
                        </div>
                        {task.description && (
                          <div>
                            <p className='text-muted-foreground'>Description</p>
                            <p className='whitespace-pre-wrap'>{task.description}</p>
                          </div>
                        )}
                        {task.estimatedHours && (
                          <div>
                            <p className='text-muted-foreground'>Estimated Hours</p>
                            <p className='font-medium'>{task.estimatedHours} hours</p>
                          </div>
                        )}
                        {task.tags && task.tags.length > 0 && (
                          <div>
                            <p className='text-muted-foreground mb-1'>Tags</p>
                            <div className='flex flex-wrap gap-1'>
                              {task.tags.map((tag, idx) => (
                                <Badge key={idx} variant='secondary' className='text-xs'>
                                  {tag}
                                </Badge>
                              ))}
                            </div>
                          </div>
                        )}
                        {task.agentId && (
                          <div>
                            <p className='text-muted-foreground'>Recommended Agent</p>
                            <div className='flex items-center gap-2'>
                              <Bot className='h-4 w-4' />
                              <span className='font-medium'>{task.agentId}</span>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className='text-center py-8 text-muted-foreground'>
                    <AlertCircle className='h-8 w-8 mx-auto mb-2' />
                    <p>Task details not available</p>
                  </div>
                )}

                <Separator />

                {/* Queue Item Metadata */}
                <div>
                  <h3 className='font-semibold mb-2 flex items-center gap-2'>
                    <Hash className='h-4 w-4' />
                    Queue Metadata
                  </h3>
                  <div className='grid grid-cols-2 gap-4 text-sm'>
                    <div>
                      <p className='text-muted-foreground'>Created</p>
                      <p className='font-medium'>{safeFormatDate(item.created)}</p>
                    </div>
                    <div>
                      <p className='text-muted-foreground'>Priority</p>
                      <p className='font-medium'>Level {item.priority}</p>
                    </div>
                  </div>
                </div>
              </div>
            </ScrollArea>
          </TabsContent>

          {/* Files Tab */}
          <TabsContent value='files' className='mt-4'>
            <ScrollArea className='h-[400px] pr-4'>
              <div className='space-y-6'>
                {/* Suggested Files */}
                <div>
                  <h3 className='font-semibold mb-3 flex items-center gap-2'>
                    <Target className='h-4 w-4' />
                    Suggested Files ({suggestedFiles.length})
                  </h3>
                  {suggestedFiles.length > 0 ? (
                    <div className='space-y-2'>
                      {suggestedFiles.map((file) => (
                        <div
                          key={file.id}
                          className='flex items-center gap-3 p-3 rounded-lg border hover:bg-muted/50 transition-colors'
                        >
                          <FileIcon className='h-4 w-4 text-blue-600 flex-shrink-0' />
                          <div className='flex-1 min-w-0'>
                            <p className='text-sm font-medium truncate'>{file.path || `File #${file.id}`}</p>
                          </div>
                          <Button size='sm' variant='ghost'>
                            <Code className='h-4 w-4' />
                          </Button>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className='text-center py-8 text-muted-foreground'>
                      <FolderOpen className='h-8 w-8 mx-auto mb-2' />
                      <p>No suggested files for this task</p>
                    </div>
                  )}
                </div>

                {/* File Context Info */}
                <div className='p-4 bg-muted/50 rounded-lg text-sm'>
                  <p className='text-muted-foreground'>
                    Suggested files help AI agents understand the context and dependencies for this task. These files
                    are automatically analyzed when processing begins.
                  </p>
                </div>
              </div>
            </ScrollArea>
          </TabsContent>

          {/* Processing Tab */}
          <TabsContent value='processing' className='mt-4'>
            <ScrollArea className='h-[400px] pr-4'>
              <div className='space-y-6'>
                {/* Processing Timeline */}
                <div>
                  <h3 className='font-semibold mb-3 flex items-center gap-2'>
                    <Clock className='h-4 w-4' />
                    Processing Timeline
                  </h3>
                  <div className='space-y-3'>
                    <div className='flex items-start gap-3'>
                      <div className={cn('p-2 rounded-full', 'bg-muted')}>
                        <Calendar className='h-4 w-4 text-muted-foreground' />
                      </div>
                      <div className='flex-1'>
                        <p className='font-medium'>Created</p>
                        <p className='text-sm text-muted-foreground'>
                          {item.created && item.created > 0
                            ? new Date(item.created * 1000).toLocaleString()
                            : 'Unknown'}
                        </p>
                      </div>
                    </div>

                    {item.startedAt && item.startedAt > 0 && (
                      <div className='flex items-start gap-3'>
                        <div className={cn('p-2 rounded-full', 'bg-blue-100')}>
                          <Clock className='h-4 w-4 text-blue-600' />
                        </div>
                        <div className='flex-1'>
                          <p className='font-medium'>Processing Started</p>
                          <p className='text-sm text-muted-foreground'>
                            {new Date(item.startedAt * 1000).toLocaleString()}
                          </p>
                        </div>
                      </div>
                    )}

                    {item.completedAt && item.completedAt > 0 && (
                      <div className='flex items-start gap-3'>
                        <div className={cn('p-2 rounded-full', config.bgColor)}>
                          <StatusIcon className={cn('h-4 w-4', config.color)} />
                        </div>
                        <div className='flex-1'>
                          <p className='font-medium'>{item.status === 'completed' ? 'Completed' : 'Stopped'}</p>
                          <p className='text-sm text-muted-foreground'>
                            {new Date(item.completedAt * 1000).toLocaleString()}
                          </p>
                          {item.startedAt && item.startedAt > 0 && (
                            <p className='text-xs text-muted-foreground mt-1'>
                              Duration: {Math.round((item.completedAt - item.startedAt) / 60)} minutes
                            </p>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                {/* Agent Assignment */}
                {item.agentId && (
                  <>
                    <Separator />
                    <div>
                      <h3 className='font-semibold mb-3 flex items-center gap-2'>
                        <Bot className='h-4 w-4' />
                        Agent Assignment
                      </h3>
                      <div className='p-4 rounded-lg border'>
                        <p className='font-medium'>{item.agentId}</p>
                        <p className='text-sm text-muted-foreground mt-1'>
                          This agent is responsible for processing this task
                        </p>
                      </div>
                    </div>
                  </>
                )}

                {/* Error Information */}
                {item.errorMessage && (
                  <>
                    <Separator />
                    <div>
                      <h3 className='font-semibold mb-3 flex items-center gap-2 text-red-600'>
                        <XCircle className='h-4 w-4' />
                        Error Details
                      </h3>
                      <div className='p-4 rounded-lg border border-red-200 bg-red-50'>
                        <pre className='text-sm whitespace-pre-wrap text-red-800'>{item.errorMessage}</pre>
                      </div>
                    </div>
                  </>
                )}
              </div>
            </ScrollArea>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  )
}
