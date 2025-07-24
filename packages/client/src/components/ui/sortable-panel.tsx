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
}

export function SortablePanel({ id, children, className, isDragging, dragHandleClassName }: SortablePanelProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging: isSortableDragging
  } = useSortable({ id })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition
  }

  const isCurrentlyDragging = isDragging || isSortableDragging

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn('relative h-full flex flex-col', isCurrentlyDragging && 'opacity-50 z-50', className)}
    >
      {/* Drag Handle */}
      <div
        className={cn(
          'absolute top-3 left-1/2 -translate-x-1/2 z-10',
          'cursor-grab active:cursor-grabbing',
          'bg-background/80 backdrop-blur-sm rounded-md',
          'border border-border/50 shadow-sm',
          'hover:bg-accent hover:border-border',
          'transition-all duration-200',
          'px-2 py-1',
          dragHandleClassName
        )}
        {...attributes}
        {...listeners}
      >
        <GripHorizontal className='h-3 w-5 text-muted-foreground' />
      </div>

      {/* Panel Content with padding */}
      <div className='h-full w-full pt-6'>{children}</div>
    </div>
  )
}
