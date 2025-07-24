import { Button } from '@ui'
import { CheckSquare, Plus, RefreshCcw, ListTodo, Wand2 } from 'lucide-react'

interface TaskEmptyStateProps {
  onAddTask: () => void
  onAutoGenerate: (e: React.MouseEvent) => void
  hasOverview: boolean
  isGenerating?: boolean
}

export function TaskEmptyState({ onAddTask, onAutoGenerate, hasOverview, isGenerating = false }: TaskEmptyStateProps) {
  return (
    <div className='flex flex-col items-center justify-center p-6 text-center space-y-4 bg-muted/20 rounded-lg min-h-[200px]'>
      <div className='text-muted-foreground'>
        <div className='relative'>
          <ListTodo className='mx-auto h-12 w-12 mb-2 opacity-30' />
          <CheckSquare className='absolute -bottom-1 -right-1 h-5 w-5 text-primary opacity-60' />
        </div>
      </div>
      <div className='space-y-1'>
        <h4 className='text-sm font-semibold'>No tasks yet</h4>
        <p className='text-xs text-muted-foreground max-w-sm'>
          Break down this ticket into smaller, actionable tasks to track progress effectively.
        </p>
      </div>
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
      <div className='mt-4 text-xs text-muted-foreground italic'>
        💡 Tip: Good tasks are specific, measurable, and achievable
      </div>
    </div>
  )
}
