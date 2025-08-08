import React, { useState, useEffect } from 'react'
import { DndContext, useDraggable } from '@dnd-kit/core'
import { CSS } from '@dnd-kit/utilities'
import { cn } from '../../utils'

export interface DndVerticalResizablePanelProps {
  topPanel: React.ReactNode
  bottomPanel: React.ReactNode
  topPanelClassName?: string
  bottomPanelClassName?: string
  initialTopPanelHeight?: number // Initial height in percentage (0-100)
  minTopPanelHeight?: number // Minimum height in percentage
  maxTopPanelHeight?: number // Maximum height in percentage
  resizerClassName?: string
  className?: string
  storageKey?: string // Optional key to store size in localStorage
}

export function DndVerticalResizablePanel({
  topPanel,
  bottomPanel,
  topPanelClassName,
  bottomPanelClassName,
  initialTopPanelHeight = 60,
  minTopPanelHeight = 10,
  maxTopPanelHeight = 90,
  resizerClassName,
  className,
  storageKey
}: DndVerticalResizablePanelProps) {
  // Try to get saved height from localStorage if storageKey is provided
  const getSavedHeight = () => {
    if (!storageKey) return initialTopPanelHeight
    const saved = localStorage.getItem(`vertical-resizable-panel-${storageKey}`)
    return saved ? parseInt(saved, 10) : initialTopPanelHeight
  }

  const [topPanelHeight, setTopPanelHeight] = useState<number>(getSavedHeight())
  const [isDragging, setIsDragging] = useState(false)

  // Store the current height in localStorage when it changes
  useEffect(() => {
    if (storageKey) {
      localStorage.setItem(`vertical-resizable-panel-${storageKey}`, topPanelHeight.toString())
    }
  }, [topPanelHeight, storageKey])

  const handleDragEnd = (event: any) => {
    setIsDragging(false)
    const { delta } = event
    if (delta) {
      const containerHeight = document.getElementById('vertical-resizable-container')?.clientHeight || 1000
      const deltaPercentage = (delta.y / containerHeight) * 100

      // Calculate the new height as a percentage of the container
      let newHeight = topPanelHeight + deltaPercentage

      // Enforce min and max constraints, but keep a bit of flexibility
      newHeight = Math.max(minTopPanelHeight, Math.min(maxTopPanelHeight, newHeight))

      setTopPanelHeight(newHeight)
    }
  }

  const handleDragStart = () => {
    setIsDragging(true)
  }

  return (
    <DndContext onDragEnd={handleDragEnd} onDragStart={handleDragStart}>
      <div id='vertical-resizable-container' className={cn('flex flex-col overflow-hidden w-full h-full', className)}>
        {/* Top Panel */}
        <div
          className={cn('w-full overflow-auto', topPanelClassName)}
          style={{ height: `${topPanelHeight}%`, minHeight: 0, maxHeight: `${topPanelHeight}%` }}
        >
          {topPanel}
        </div>

        {/* Resizer */}
        <VerticalResizer className={resizerClassName} isDragging={isDragging} />

        {/* Bottom Panel */}
        <div
          className={cn('w-full overflow-auto', bottomPanelClassName)}
          style={{ height: `${100 - topPanelHeight}%`, minHeight: 0, maxHeight: `${100 - topPanelHeight}%` }}
        >
          {bottomPanel}
        </div>
      </div>
    </DndContext>
  )
}

interface VerticalResizerProps {
  className?: string
  isDragging?: boolean
}

function VerticalResizer({ className, isDragging }: VerticalResizerProps) {
  const { attributes, listeners, setNodeRef, transform } = useDraggable({
    id: 'vertical-resizer'
  })

  const style = {
    transform: CSS.Translate.toString(transform),
    cursor: 'row-resize'
  }

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        'group h-2 my-2 bg-transparent hover:bg-primary/10 flex-shrink-0 relative z-10 w-full flex items-center justify-center',
        isDragging && 'bg-primary/10',
        className
      )}
      {...listeners}
      {...attributes}
    >
      <div
        className={cn(
          'absolute h-[3px] w-16 rounded-full bg-border group-hover:bg-primary/60 transition-all',
          isDragging && 'bg-primary/70 w-24'
        )}
      />
    </div>
  )
}