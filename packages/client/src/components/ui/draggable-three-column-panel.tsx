import React, { useState, useEffect } from 'react'
import { DndContext, closestCenter, DragEndEvent, useDraggable, DragOverlay } from '@dnd-kit/core'
import { SortableContext, arrayMove, horizontalListSortingStrategy } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { cn } from '@/lib/utils'
import { SortablePanel } from './sortable-panel'

export interface PanelConfig {
  id: string
  content: React.ReactNode
  className?: string
  minWidth: number
}

export interface DraggableThreeColumnPanelProps {
  panels: [PanelConfig, PanelConfig, PanelConfig]
  initialLeftPanelWidth?: number
  initialRightPanelWidth?: number
  resizerClassName?: string
  className?: string
  storageKey?: string
  dragHandleClassName?: string
}

interface StoredPanelState {
  order: string[]
  leftWidth: number
  rightWidth: number
}

export function DraggableThreeColumnPanel({
  panels: initialPanels,
  initialLeftPanelWidth = 25,
  initialRightPanelWidth = 35,
  resizerClassName,
  className,
  storageKey,
  dragHandleClassName
}: DraggableThreeColumnPanelProps) {
  // Load saved state from localStorage
  const getSavedState = (): StoredPanelState => {
    if (!storageKey) {
      return {
        order: initialPanels.map((p) => p.id),
        leftWidth: initialLeftPanelWidth,
        rightWidth: initialRightPanelWidth
      }
    }

    const saved = localStorage.getItem(`draggable-panel-${storageKey}`)
    if (saved) {
      try {
        const parsed = JSON.parse(saved)
        return {
          order: parsed.order || initialPanels.map((p) => p.id),
          leftWidth: parsed.leftWidth || initialLeftPanelWidth,
          rightWidth: parsed.rightWidth || initialRightPanelWidth
        }
      } catch {
        return {
          order: initialPanels.map((p) => p.id),
          leftWidth: initialLeftPanelWidth,
          rightWidth: initialRightPanelWidth
        }
      }
    }
    return {
      order: initialPanels.map((p) => p.id),
      leftWidth: initialLeftPanelWidth,
      rightWidth: initialRightPanelWidth
    }
  }

  const savedState = getSavedState()

  // Create ordered panels based on saved order
  const createOrderedPanels = (order: string[]) => {
    return order.map((id) => initialPanels.find((p) => p.id === id)!).filter(Boolean)
  }

  const [panels, setPanels] = useState<PanelConfig[]>(() => createOrderedPanels(savedState.order))
  const [leftPanelWidth, setLeftPanelWidth] = useState<number>(savedState.leftWidth)
  const [rightPanelWidth, setRightPanelWidth] = useState<number>(savedState.rightWidth)
  const [isDraggingLeft, setIsDraggingLeft] = useState(false)
  const [isDraggingRight, setIsDraggingRight] = useState(false)
  const [isDraggingPanel, setIsDraggingPanel] = useState(false)
  const [activeId, setActiveId] = useState<string | null>(null)
  const [containerWidth, setContainerWidth] = useState(1000)

  // Calculate middle panel width
  const middlePanelWidth = 100 - leftPanelWidth - rightPanelWidth

  // Save state to localStorage
  useEffect(() => {
    if (storageKey) {
      const state: StoredPanelState = {
        order: panels.map((p) => p.id),
        leftWidth: leftPanelWidth,
        rightWidth: rightPanelWidth
      }
      localStorage.setItem(`draggable-panel-${storageKey}`, JSON.stringify(state))
    }
  }, [panels, leftPanelWidth, rightPanelWidth, storageKey])

  // Update container width on mount and resize
  useEffect(() => {
    const updateContainerWidth = () => {
      const container = document.getElementById('draggable-three-column-container')
      if (container) {
        setContainerWidth(container.clientWidth)
      }
    }
    updateContainerWidth()
    window.addEventListener('resize', updateContainerWidth)
    return () => window.removeEventListener('resize', updateContainerWidth)
  }, [])

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over, delta } = event

    // Clear active ID
    setActiveId(null)

    // Clear panel dragging state for any panel drag operation
    if (active.id && !active.id.toString().includes('resizer')) {
      setIsDraggingPanel(false)
    }

    // Handle panel reordering
    if (active.id && over?.id && active.id !== over.id && !active.id.toString().includes('resizer')) {
      setPanels((items) => {
        const oldIndex = items.findIndex((item) => item.id === active.id)
        const newIndex = items.findIndex((item) => item.id === over.id)
        return arrayMove(items, oldIndex, newIndex)
      })
      return
    }

    // Handle resizing
    if (!delta) return

    const deltaPercentage = (delta.x / containerWidth) * 100

    if (active.id === 'left-resizer') {
      setIsDraggingLeft(false)

      // Calculate new left width
      let newLeftWidth = leftPanelWidth + deltaPercentage
      const minLeftPercent = (panels[0].minWidth / containerWidth) * 100
      const minMiddlePercent = (panels[1].minWidth / containerWidth) * 100

      newLeftWidth = Math.max(minLeftPercent, newLeftWidth)
      const maxLeftWidth = 100 - rightPanelWidth - minMiddlePercent
      newLeftWidth = Math.min(maxLeftWidth, newLeftWidth)

      setLeftPanelWidth(newLeftWidth)
    } else if (active.id === 'right-resizer') {
      setIsDraggingRight(false)

      // Calculate new right width
      let newRightWidth = rightPanelWidth - deltaPercentage
      const minRightPercent = (panels[2].minWidth / containerWidth) * 100
      const minMiddlePercent = (panels[1].minWidth / containerWidth) * 100

      newRightWidth = Math.max(minRightPercent, newRightWidth)
      const maxRightWidth = 100 - leftPanelWidth - minMiddlePercent
      newRightWidth = Math.min(maxRightWidth, newRightWidth)

      setRightPanelWidth(newRightWidth)
    }
  }

  const handleDragStart = (event: DragEndEvent) => {
    const { active } = event
    if (active.id === 'left-resizer') {
      setIsDraggingLeft(true)
    } else if (active.id === 'right-resizer') {
      setIsDraggingRight(true)
    } else {
      setIsDraggingPanel(true)
      setActiveId(active.id as string)
    }
  }

  // Calculate widths for each panel position
  const panelWidths = [leftPanelWidth, middlePanelWidth, rightPanelWidth]

  // Get the active panel for DragOverlay
  const activePanel = activeId ? panels.find((p) => p.id === activeId) : null

  return (
    <DndContext onDragEnd={handleDragEnd} onDragStart={handleDragStart} collisionDetection={closestCenter}>
      <SortableContext items={panels.map((p) => p.id)} strategy={horizontalListSortingStrategy}>
        <div
          id='draggable-three-column-container'
          className={cn('flex flex-row overflow-hidden w-full h-full', className)}
        >
          {panels.map((panel, index) => (
            <React.Fragment key={panel.id}>
              {/* Panel */}
              <div
                className={cn('h-full overflow-auto', panel.className)}
                style={{
                  width: `${panelWidths[index]}%`,
                  minWidth: 0,
                  maxWidth: `${panelWidths[index]}%`
                }}
              >
                <SortablePanel
                  id={panel.id}
                  isDragging={isDraggingPanel}
                  dragHandleClassName={dragHandleClassName}
                  isAnyPanelDragging={isDraggingPanel}
                >
                  {panel.content}
                </SortablePanel>
              </div>

              {/* Resizer (not after last panel) */}
              {index < panels.length - 1 && (
                <Resizer
                  id={index === 0 ? 'left-resizer' : 'right-resizer'}
                  className={resizerClassName}
                  isDragging={index === 0 ? isDraggingLeft : isDraggingRight}
                />
              )}
            </React.Fragment>
          ))}
        </div>
      </SortableContext>
      <DragOverlay>
        {activePanel && (
          <div
            className={cn(
              'h-full w-full bg-background border-2 border-green-500 rounded-lg shadow-2xl opacity-90',
              activePanel.className
            )}
          >
            <div className='p-4 opacity-50'>{activePanel.content}</div>
          </div>
        )}
      </DragOverlay>
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
