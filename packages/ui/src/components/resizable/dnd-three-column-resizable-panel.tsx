import React, { useState, useEffect } from 'react'
import { DndContext, useDraggable } from '@dnd-kit/core'
import { CSS } from '@dnd-kit/utilities'
import { cn } from '../../utils'

export interface DndThreeColumnResizablePanelProps {
  leftPanel: React.ReactNode
  middlePanel: React.ReactNode
  rightPanel: React.ReactNode
  leftPanelClassName?: string
  middlePanelClassName?: string
  rightPanelClassName?: string
  initialLeftPanelWidth?: number // Initial width in percentage (0-100)
  initialRightPanelWidth?: number // Initial width in percentage (0-100)
  minLeftPanelWidth?: number // Minimum width in pixels
  minMiddlePanelWidth?: number // Minimum width in pixels
  minRightPanelWidth?: number // Minimum width in pixels
  resizerClassName?: string
  className?: string
  storageKey?: string // Optional key to store sizes in localStorage
}

export function DndThreeColumnResizablePanel({
  leftPanel,
  middlePanel,
  rightPanel,
  leftPanelClassName,
  middlePanelClassName,
  rightPanelClassName,
  initialLeftPanelWidth = 25,
  initialRightPanelWidth = 35,
  minLeftPanelWidth = 200,
  minMiddlePanelWidth = 300,
  minRightPanelWidth = 250,
  resizerClassName,
  className,
  storageKey
}: DndThreeColumnResizablePanelProps) {
  // Try to get saved widths from localStorage if storageKey is provided
  const getSavedWidths = () => {
    if (!storageKey) return { left: initialLeftPanelWidth, right: initialRightPanelWidth }
    const saved = localStorage.getItem(`three-column-panel-${storageKey}`)
    if (saved) {
      try {
        const parsed = JSON.parse(saved)
        return { left: parsed.left || initialLeftPanelWidth, right: parsed.right || initialRightPanelWidth }
      } catch {
        return { left: initialLeftPanelWidth, right: initialRightPanelWidth }
      }
    }
    return { left: initialLeftPanelWidth, right: initialRightPanelWidth }
  }

  const savedWidths = getSavedWidths()
  const [leftPanelWidth, setLeftPanelWidth] = useState<number>(savedWidths.left)
  const [rightPanelWidth, setRightPanelWidth] = useState<number>(savedWidths.right)
  const [isDraggingLeft, setIsDraggingLeft] = useState(false)
  const [isDraggingRight, setIsDraggingRight] = useState(false)
  const [containerWidth, setContainerWidth] = useState(1000)

  // Calculate middle panel width
  const middlePanelWidth = 100 - leftPanelWidth - rightPanelWidth

  // Store the current widths in localStorage when they change
  useEffect(() => {
    if (storageKey) {
      localStorage.setItem(
        `three-column-panel-${storageKey}`,
        JSON.stringify({ left: leftPanelWidth, right: rightPanelWidth })
      )
    }
  }, [leftPanelWidth, rightPanelWidth, storageKey])

  // Update container width on mount and resize
  useEffect(() => {
    const updateContainerWidth = () => {
      const container = document.getElementById('three-column-resizable-container')
      if (container) {
        setContainerWidth(container.clientWidth)
      }
    }
    updateContainerWidth()
    window.addEventListener('resize', updateContainerWidth)
    return () => window.removeEventListener('resize', updateContainerWidth)
  }, [])

  const handleDragEnd = (event: any) => {
    const { active, delta } = event

    if (!delta) return

    const deltaPercentage = (delta.x / containerWidth) * 100

    if (active.id === 'left-resizer') {
      setIsDraggingLeft(false)

      // Calculate new left width
      let newLeftWidth = leftPanelWidth + deltaPercentage

      // Enforce minimum widths
      const minLeftPercent = (minLeftPanelWidth / containerWidth) * 100
      const minMiddlePercent = (minMiddlePanelWidth / containerWidth) * 100

      // Don't let left panel get too small
      newLeftWidth = Math.max(minLeftPercent, newLeftWidth)

      // Don't let middle panel get too small
      const maxLeftWidth = 100 - rightPanelWidth - minMiddlePercent
      newLeftWidth = Math.min(maxLeftWidth, newLeftWidth)

      setLeftPanelWidth(newLeftWidth)
    } else if (active.id === 'right-resizer') {
      setIsDraggingRight(false)

      // Calculate new right width (resizer moves opposite direction)
      let newRightWidth = rightPanelWidth - deltaPercentage

      // Enforce minimum widths
      const minRightPercent = (minRightPanelWidth / containerWidth) * 100
      const minMiddlePercent = (minMiddlePanelWidth / containerWidth) * 100

      // Don't let right panel get too small
      newRightWidth = Math.max(minRightPercent, newRightWidth)

      // Don't let middle panel get too small
      const maxRightWidth = 100 - leftPanelWidth - minMiddlePercent
      newRightWidth = Math.min(maxRightWidth, newRightWidth)

      setRightPanelWidth(newRightWidth)
    }
  }

  const handleDragStart = (event: any) => {
    const { active } = event
    if (active.id === 'left-resizer') {
      setIsDraggingLeft(true)
    } else if (active.id === 'right-resizer') {
      setIsDraggingRight(true)
    }
  }

  return (
    <DndContext onDragEnd={handleDragEnd} onDragStart={handleDragStart}>
      <div
        id='three-column-resizable-container'
        className={cn('flex flex-row overflow-hidden w-full h-full', className)}
      >
        {/* Left Panel */}
        <div
          className={cn('h-full overflow-auto', leftPanelClassName)}
          style={{
            width: `${leftPanelWidth}%`,
            minWidth: 0,
            maxWidth: `${leftPanelWidth}%`
          }}
        >
          {leftPanel}
        </div>

        {/* Left Resizer */}
        <Resizer id='left-resizer' className={resizerClassName} isDragging={isDraggingLeft} />

        {/* Middle Panel */}
        <div
          className={cn('h-full overflow-auto', middlePanelClassName)}
          style={{
            width: `${middlePanelWidth}%`,
            minWidth: 0,
            maxWidth: `${middlePanelWidth}%`
          }}
        >
          {middlePanel}
        </div>

        {/* Right Resizer */}
        <Resizer id='right-resizer' className={resizerClassName} isDragging={isDraggingRight} />

        {/* Right Panel */}
        <div
          className={cn('h-full overflow-auto', rightPanelClassName)}
          style={{
            width: `${rightPanelWidth}%`,
            minWidth: 0,
            maxWidth: `${rightPanelWidth}%`
          }}
        >
          {rightPanel}
        </div>
      </div>
    </DndContext>
  )
}

interface ResizerProps {
  id: string
  className?: string
  isDragging?: boolean
}

function Resizer({ id, className, isDragging }: ResizerProps) {
  const { attributes, listeners, setNodeRef, transform } = useDraggable({
    id
  })

  const style = {
    transform: CSS.Translate.toString(transform),
    cursor: 'col-resize'
  }

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        'w-1 mx-1 hover:w-1.5 bg-border hover:bg-primary/70 transition-all flex-shrink-0 relative h-full',
        isDragging && 'bg-primary w-1.5',
        className
      )}
      {...listeners}
      {...attributes}
    />
  )
}