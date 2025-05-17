import React, { useState } from 'react'
import {
  useListTasks,
  useCreateTask,
  useUpdateTask,
  useDeleteTask,
  useReorderTasks,
  useAutoGenerateTasks
} from '../../hooks/api/use-tickets-api'
import { Input } from '@ui'
import { Button } from '@ui'
import { ArrowDown, ArrowUp, Copy, Plus, RefreshCcw, Trash2, CircleCheckBig, Circle } from 'lucide-react'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@ui'
import { useCopyClipboard } from '@/hooks/utility-hooks/use-copy-clipboard'
import { toast } from 'sonner'
import { Task } from '@/generated'

interface TicketTasksPanelProps {
  ticketId: string
  overview: string
}

/**
 * Utility to format tasks in different ways:
 * - Markdown (checkbox list)
 * - Bulleted
 * - Comma-separated
 */
function formatTasks(mode: 'markdown' | 'bulleted' | 'comma', tasks: Task[]): string {
  switch (mode) {
    case 'markdown':
      return tasks.map((t) => `- [${t.done ? 'x' : ' '}] ${t.content}`).join('\n')
    case 'bulleted':
      return tasks.map((t) => `• ${t.content}`).join('\n')
    case 'comma':
      return tasks.map((t) => t.content).join(', ')
    default:
      return tasks.map((t) => t.content).join('\n')
  }
}

export function TicketTasksPanel({ ticketId, overview }: TicketTasksPanelProps) {
  const { data, isLoading } = useListTasks(ticketId)
  const createTaskMut = useCreateTask()
  const updateTaskMut = useUpdateTask()
  const deleteTaskMut = useDeleteTask()
  const reorderMut = useReorderTasks()
  const autoGenMut = useAutoGenerateTasks()

  const [newTaskContent, setNewTaskContent] = useState('')
  const { copyToClipboard } = useCopyClipboard()

  const tasks = data?.tasks ?? []

  const handleCreateTask = async (e?: React.MouseEvent | React.KeyboardEvent) => {
    e?.preventDefault()
    e?.stopPropagation()
    if (!newTaskContent.trim()) return
    await createTaskMut.mutateAsync({ ticketId, content: newTaskContent })
    setNewTaskContent('')
  }

  const handleToggleDone = (e: React.MouseEvent, task: Task) => {
    e.preventDefault()
    e.stopPropagation()
    updateTaskMut.mutate({
      ticketId,
      taskId: task.id,
      updates: { done: !task.done }
    })
  }

  const handleDeleteTask = (e: React.MouseEvent, task: Task) => {
    e.preventDefault()
    e.stopPropagation()
    deleteTaskMut.mutate({ ticketId, taskId: task.id })
  }

  const moveTaskUp = (e: React.MouseEvent, idx: number) => {
    e.preventDefault()
    e.stopPropagation()
    if (idx <= 0) return
    const newOrder = [...tasks]
    const temp = newOrder[idx]
    newOrder[idx] = newOrder[idx - 1]
    newOrder[idx - 1] = temp
    reorderMut.mutate({
      ticketId,
      tasks: newOrder.map((t, i) => ({ taskId: t.id, orderIndex: i }))
    })
  }

  const moveTaskDown = (e: React.MouseEvent, idx: number) => {
    e.preventDefault()
    e.stopPropagation()
    if (idx >= tasks.length - 1) return
    const newOrder = [...tasks]
    const temp = newOrder[idx]
    newOrder[idx] = newOrder[idx + 1]
    newOrder[idx + 1] = temp
    reorderMut.mutate({
      ticketId,
      tasks: newOrder.map((t, i) => ({ taskId: t.id, orderIndex: i }))
    })
  }

  const handleCopyTasks = (e: React.MouseEvent, mode: 'markdown' | 'bulleted' | 'comma') => {
    e.preventDefault()
    e.stopPropagation()
    const formatted = formatTasks(mode, tasks)
    copyToClipboard(formatted, {
      successMessage: `Tasks copied as ${mode}!`,
      errorMessage: 'Failed to copy tasks'
    })
  }

  const handleAutoGenerateTasks = async (e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    await autoGenMut.mutateAsync({ ticketId })
    toast.success('Tasks generated from overview!')
  }

  return (
    <div className='border rounded p-3 space-y-3'>
      <div className='flex items-center justify-between'>
        <h3 className='text-sm font-semibold'>Tasks</h3>
        <div className='flex items-center space-x-2'>
          <Button
            type='button'
            variant='outline'
            size='sm'
            onClick={handleAutoGenerateTasks}
            disabled={autoGenMut.isPending}
          >
            <RefreshCcw className='h-3 w-3 mr-1' />
            {autoGenMut.isPending ? 'Generating...' : 'Auto-Generate'}
          </Button>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button type='button' variant='outline' size='sm'>
                <Copy className='h-3 w-3 mr-1' />
                Copy Tasks
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent>
              <DropdownMenuItem onClick={(e) => handleCopyTasks(e, 'markdown')}>Copy as Markdown</DropdownMenuItem>
              <DropdownMenuItem onClick={(e) => handleCopyTasks(e, 'bulleted')}>Copy as Bulleted List</DropdownMenuItem>
              <DropdownMenuItem onClick={(e) => handleCopyTasks(e, 'comma')}>Copy as Comma-Separated</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {/* New Task Input */}
      <div className='flex items-center space-x-2'>
        <Input
          placeholder='Add a new task...'
          value={newTaskContent}
          onChange={(e) => setNewTaskContent(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault()
              handleCreateTask(e)
            }
          }}
        />
        <Button type='button' onClick={handleCreateTask}>
          <Plus className='h-4 w-4' />
        </Button>
      </div>

      {/* Tasks List */}
      <div className='space-y-2 max-h-64 overflow-auto'>
        {isLoading && <p className='text-sm text-muted-foreground'>Loading tasks...</p>}
        {!isLoading && tasks.length === 0 && (
          <p className='text-sm text-muted-foreground'>No tasks yet. Add some above.</p>
        )}
        {tasks.map((task, idx) => (
          <div>
            <div key={task.id} className='flex items-center justify-between p-2 border rounded'>
              <div className='flex items-center space-x-3 overflow-hidden'>
                <button
                  type='button'
                  onClick={(e) => handleToggleDone(e, task)}
                  className='flex items-center justify-center'
                >
                  {task.done ? (
                    <CircleCheckBig className={`h-4 w-4 text-green-600`} />
                  ) : (
                    <Circle className={`h-4 w-4 text-gray-400`} />
                  )}
                </button>
                <span className={`text-sm whitespace-pre-wrap ${task.done ? 'line-through text-gray-400' : ''}`}>
                  {task.content}
                </span>
              </div>
              <div className='flex items-center space-x-1'>
                <Button
                  type='button'
                  variant='ghost'
                  size='icon'
                  onClick={(e) => moveTaskUp(e, idx)}
                  disabled={idx <= 0}
                >
                  <ArrowUp className='h-4 w-4' />
                </Button>
                <Button
                  type='button'
                  variant='ghost'
                  size='icon'
                  onClick={(e) => moveTaskDown(e, idx)}
                  disabled={idx >= tasks.length - 1}
                >
                  <ArrowDown className='h-4 w-4' />
                </Button>
                <Button type='button' variant='ghost' size='icon' onClick={(e) => handleDeleteTask(e, task)}>
                  <Trash2 className='h-4 w-4 text-red-500' />
                </Button>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
