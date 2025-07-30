import React from 'react'
import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { GripHorizontal } from 'lucide-react'
import { cn } from '@/lib/utils'

export interface SortablePanelProps {
  id: string
  children: React.ReactNode
  className?: string
  isDragging?: boolean
  dragHandleClassName?: string
  isAnyPanelDragging?: boolean
}

export function SortablePanel({
  id,
  children,
  className,
  isDragging,
  dragHandleClassName,
  isAnyPanelDragging
}: SortablePanelProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging: isSortableDragging,
    isOver,
    active,
    over
  } = useSortable({ id })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition
  }

  const isCurrentlyDragging = isDragging || isSortableDragging
  const isDropTarget = isOver && active?.id !== id
  const showDropIndicator = isAnyPanelDragging && !isCurrentlyDragging

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        'relative h-full flex flex-col transition-all duration-200',
        isCurrentlyDragging && 'opacity-50 z-50 scale-[0.98]',
        isDropTarget && 'ring-2 ring-green-500 ring-offset-2 ring-offset-background',
        showDropIndicator && 'ring-1 ring-border/50',
        className
      )}
    >
      {/* Panel Content with padding */}
      <div className='h-full w-full pb-6'>{children}</div>

      {/* Drag Handle */}
      <div
        className={cn(
          'absolute bottom-3 left-1/2 -translate-x-1/2 z-10',
          'cursor-grab active:cursor-grabbing',
          'bg-background/80 backdrop-blur-sm rounded-md',
          'border border-border/50 shadow-sm',
          'hover:bg-accent hover:border-border hover:scale-110',
          'transition-all duration-200',
          'px-2 py-1',
          isCurrentlyDragging && 'cursor-grabbing scale-110 bg-accent border-primary',
          dragHandleClassName
        )}
        {...attributes}
        {...listeners}
      >
        <GripHorizontal
          className={cn('h-3 w-5 text-muted-foreground transition-colors', isCurrentlyDragging && 'text-primary')}
        />
      </div>
    </div>
  )
}
