import { Button } from '@promptliano/ui'
import { ListEmptyState } from '@promptliano/ui'
import { Plus, RefreshCcw, ListTodo, Wand2 } from 'lucide-react'

interface TaskEmptyStateProps {
  onAddTask: () => void
  onAutoGenerate: (e: React.MouseEvent) => void
  hasOverview: boolean
  isGenerating?: boolean
}

export function TaskEmptyState({ onAddTask, onAutoGenerate, hasOverview, isGenerating = false }: TaskEmptyStateProps) {
  return (
    <ListEmptyState
      icon={ListTodo}
      title="No tasks yet"
      description="Break down this ticket into smaller, actionable tasks to track progress effectively."
      actions={
        <div className='flex flex-col gap-2 w-full max-w-xs'>
          <Button variant='outline' size='sm' onClick={onAddTask} className='w-full'>
            <Plus className='mr-2 h-3 w-3' />
            Add First Task
          </Button>
          {hasOverview && (
            <Button variant='outline' size='sm' onClick={onAutoGenerate} disabled={isGenerating} className='w-full'>
              {isGenerating ? (
                <>
                  <RefreshCcw className='mr-2 h-3 w-3 animate-spin' />
                  Generating...
                </>
              ) : (
                <>
                  <Wand2 className='mr-2 h-3 w-3' />
                  Auto-Generate from Overview
                </>
              )}
            </Button>
          )}
        </div>
      }
      tip='Good tasks are specific, measurable, and achievable'
      className="bg-muted/20"
    />
  )
}
