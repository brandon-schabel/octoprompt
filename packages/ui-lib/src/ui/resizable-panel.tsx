import React, { useState, useEffect } from 'react'
import { DndContext, useDraggable } from '@dnd-kit/core'
import { CSS } from '@dnd-kit/utilities'
import { cn } from '../lib/utils'
import { ChevronLeft } from 'lucide-react'

export interface ResizablePanelProps {
  leftPanel: React.ReactNode
  rightPanel: React.ReactNode
  leftPanelClassName?: string
  rightPanelClassName?: string
  initialLeftPanelWidth?: number  // Initial width in percentage (0-100)
  minLeftPanelWidth?: number      // Minimum width in pixels
  maxLeftPanelWidth?: number      // Maximum width in pixels
  collapseThreshold?: number      // Width in pixels below which the panel auto-collapses
  resizerClassName?: string
  className?: string
  storageKey?: string            // Optional key to store size in localStorage
  onCollapseChange?: (collapsed: boolean) => void // Callback when collapse state changes
  badgeContent?: React.ReactNode // Content to show in badge when collapsed
  isCollapsedExternal?: boolean  // External control of collapsed state
} 

export function ResizablePanel({
  leftPanel,
  rightPanel,
  leftPanelClassName,
  rightPanelClassName,
  initialLeftPanelWidth = 40,
  minLeftPanelWidth = 200,
  maxLeftPanelWidth = 800,
  collapseThreshold = 100,
  resizerClassName,
  className,
  storageKey,
  onCollapseChange,
  badgeContent,
  isCollapsedExternal,
}: ResizablePanelProps) {
  // Try to get saved width and collapsed state from localStorage if storageKey is provided
  const getSavedWidth = () => {
    if (!storageKey) return initialLeftPanelWidth;
    const saved = localStorage.getItem(`resizable-panel-${storageKey}`);
    return saved ? parseInt(saved, 10) : initialLeftPanelWidth;
  };

  const getSavedCollapsedState = () => {
    if (!storageKey) return false;
    const saved = localStorage.getItem(`resizable-panel-collapsed-${storageKey}`);
    return saved === 'true';
  };

  const [leftPanelWidth, setLeftPanelWidth] = useState<number>(getSavedWidth());
  const [isDragging, setIsDragging] = useState(false);
  const [isCollapsed, setIsCollapsed] = useState<boolean>(getSavedCollapsedState());
  const [containerWidth, setContainerWidth] = useState(1000);

  // Store the current width in localStorage when it changes
  useEffect(() => {
    if (storageKey) {
      localStorage.setItem(`resizable-panel-${storageKey}`, leftPanelWidth.toString());
    }
  }, [leftPanelWidth, storageKey]);

  // Store the collapsed state in localStorage when it changes
  useEffect(() => {
    if (storageKey) {
      localStorage.setItem(`resizable-panel-collapsed-${storageKey}`, isCollapsed.toString());
    }
    // Call the callback if provided
    onCollapseChange?.(isCollapsed);
  }, [isCollapsed, storageKey, onCollapseChange]);

  // Calculate if the panel should auto-collapse based on right panel width
  useEffect(() => {
    const container = document.getElementById('resizable-container');
    if (container) {
      const width = container.clientWidth;
      setContainerWidth(width);
      
      // Auto-collapse when right panel width goes below threshold
      const rightPanelWidth = (width * (100 - leftPanelWidth)) / 100;
      if (rightPanelWidth < collapseThreshold && !isCollapsed) {
        setIsCollapsed(true);
      }
    }
  }, [leftPanelWidth, isCollapsed, collapseThreshold]);

  // Add effect to respond to external collapse state changes
  useEffect(() => {
    if (isCollapsedExternal !== undefined && isCollapsedExternal !== isCollapsed) {
      setIsCollapsed(isCollapsedExternal);
      
      // If we're expanding, set a reasonable width for the right panel
      if (!isCollapsedExternal && isCollapsed) {
        const desiredRightPanelWidth = 250; // pixels
        const rightPanelPercent = Math.min(30, (desiredRightPanelWidth / containerWidth) * 100);
        setLeftPanelWidth(100 - rightPanelPercent);
      }
    }
  }, [isCollapsedExternal, isCollapsed, containerWidth]);

  const handleDragEnd = (event: any) => {
    setIsDragging(false);
    const { delta } = event;
    if (delta) {
      const deltaPercentage = (delta.x / containerWidth) * 100;
      
      // Calculate the new width as a percentage of the container
      let newWidth = leftPanelWidth + deltaPercentage;
      
      // Only enforce minimum width on left panel if it's provided, otherwise use a smaller default
      const minWidthPercent = minLeftPanelWidth ? (minLeftPanelWidth / containerWidth) * 100 : 5;
      
      // Allow resizing all the way from 0.5% to 99.5%
      newWidth = Math.max(0.5, Math.min(99.5, newWidth));
      
      // Only apply the minimum width constraint if explicitly set and the new width is less than the minimum
      if (minLeftPanelWidth && newWidth < minWidthPercent) {
        newWidth = minWidthPercent;
      }
      
      setLeftPanelWidth(newWidth);
      
      // Check if we should uncollapse based on new right panel width
      const newRightPanelWidth = (containerWidth * (100 - newWidth)) / 100;
      if (newRightPanelWidth >= collapseThreshold && isCollapsed) {
        setIsCollapsed(false);
      }
    }
  };

  const handleDragStart = () => {
    setIsDragging(true);
  };

  // Handle expand button click
  const handleExpand = () => {
    setIsCollapsed(false);
    // Set a reasonable right panel width when expanding
    const desiredRightPanelWidth = 250; // pixels
    const rightPanelPercent = Math.min(30, (desiredRightPanelWidth / containerWidth) * 100);
    setLeftPanelWidth(100 - rightPanelPercent);
  };

  return (
    <DndContext onDragEnd={handleDragEnd} onDragStart={handleDragStart}>
      <div 
        id="resizable-container"
        className={cn("flex flex-row overflow-hidden w-full h-full", className)}
      >
        {/* Left Panel */}
        <div 
          className={cn("h-full overflow-auto", leftPanelClassName)} 
          style={{ 
            width: isCollapsed ? '100%' : `${leftPanelWidth}%`, 
            minWidth: 0, 
            maxWidth: isCollapsed ? '100%' : `${leftPanelWidth}%` 
          }}
        >
          <div className="relative h-full">
            {leftPanel}
            
            {/* Expand button - only visible when collapsed */}
            {isCollapsed && (
              <div className="absolute right-2 top-2">
                <button
                  className="h-7 w-7 rounded-full bg-muted/80 hover:bg-muted flex items-center justify-center relative"
                  onClick={handleExpand}
                  title="Show selected files (⌘+B)"
                >
                  <ChevronLeft className="h-3.5 w-3.5" />
                  {badgeContent}
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Resizer - only shown when not collapsed */}
        {!isCollapsed && (
          <Resizer className={resizerClassName} isDragging={isDragging} />
        )}

        {/* Right Panel - only shown when not collapsed */}
        {!isCollapsed && (
          <div 
            className={cn("h-full overflow-auto", rightPanelClassName)} 
            style={{ 
              width: `${100 - leftPanelWidth}%`, 
              minWidth: 0, 
              maxWidth: `${100 - leftPanelWidth}%` 
            }}
          >
            {rightPanel}
          </div>
        )}
      </div>
    </DndContext>
  );
}

interface ResizerProps {
  className?: string;
  isDragging?: boolean;
}

function Resizer({ className, isDragging }: ResizerProps) {
  const { attributes, listeners, setNodeRef, transform } = useDraggable({
    id: 'resizer',
  });

  const style = {
    transform: CSS.Translate.toString(transform),
    cursor: 'col-resize',
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        "w-1 mx-1 hover:w-1.5 bg-border hover:bg-primary/70 transition-all flex-shrink-0 relative h-full",
        isDragging && "bg-primary w-1.5",
        className
      )}
      {...listeners}
      {...attributes}
    />
  );
} 