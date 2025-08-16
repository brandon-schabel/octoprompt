import React from 'react'
import { cn } from '../../utils'

export interface SidebarLayoutProps {
  sidebar: React.ReactNode
  content: React.ReactNode
  sidebarWidth?: 'xs' | 'sm' | 'md' | 'lg' | 'xl'
  sidebarPosition?: 'left' | 'right'
  sidebarClassName?: string
  contentClassName?: string
  className?: string
  collapsible?: boolean
  defaultCollapsed?: boolean
  onCollapsedChange?: (collapsed: boolean) => void
}

const widthClasses = {
  xs: 'w-40',
  sm: 'w-48',
  md: 'w-56',
  lg: 'w-64',
  xl: 'w-72'
}

export function SidebarLayout({
  sidebar,
  content,
  sidebarWidth = 'md',
  sidebarPosition = 'left',
  sidebarClassName,
  contentClassName,
  className,
  collapsible = false,
  defaultCollapsed = false,
  onCollapsedChange
}: SidebarLayoutProps) {
  const [isCollapsed, setIsCollapsed] = React.useState(defaultCollapsed)

  const handleCollapse = React.useCallback((collapsed: boolean) => {
    setIsCollapsed(collapsed)
    onCollapsedChange?.(collapsed)
  }, [onCollapsedChange])

  const sidebarElement = (
    <div
      className={cn(
        'border-r bg-muted/30 flex-shrink-0 transition-all duration-200',
        !isCollapsed && widthClasses[sidebarWidth],
        isCollapsed && 'w-0 overflow-hidden',
        sidebarPosition === 'right' && 'border-l border-r-0',
        sidebarClassName
      )}
    >
      {sidebar}
    </div>
  )

  const contentElement = (
    <div className={cn('flex-1 overflow-auto', contentClassName)}>
      {content}
    </div>
  )

  return (
    <div className={cn('flex h-full', className)}>
      {sidebarPosition === 'left' ? (
        <>
          {sidebarElement}
          {contentElement}
        </>
      ) : (
        <>
          {contentElement}
          {sidebarElement}
        </>
      )}
    </div>
  )
}

// Advanced variant with resizable sidebar
export interface ResizableSidebarLayoutProps extends Omit<SidebarLayoutProps, 'sidebarWidth'> {
  minWidth?: number
  maxWidth?: number
  defaultWidth?: number
  onWidthChange?: (width: number) => void
}

export function ResizableSidebarLayout({
  sidebar,
  content,
  sidebarPosition = 'left',
  sidebarClassName,
  contentClassName,
  className,
  minWidth = 160,
  maxWidth = 400,
  defaultWidth = 224,
  onWidthChange
}: ResizableSidebarLayoutProps) {
  const [width, setWidth] = React.useState(defaultWidth)
  const [isResizing, setIsResizing] = React.useState(false)
  const sidebarRef = React.useRef<HTMLDivElement>(null)

  const handleMouseDown = React.useCallback((e: React.MouseEvent) => {
    e.preventDefault()
    setIsResizing(true)
  }, [])

  React.useEffect(() => {
    if (!isResizing) return

    const handleMouseMove = (e: MouseEvent) => {
      if (!sidebarRef.current) return
      
      const rect = sidebarRef.current.getBoundingClientRect()
      const newWidth = sidebarPosition === 'left' 
        ? e.clientX - rect.left
        : rect.right - e.clientX
      
      const clampedWidth = Math.max(minWidth, Math.min(maxWidth, newWidth))
      setWidth(clampedWidth)
      onWidthChange?.(clampedWidth)
    }

    const handleMouseUp = () => {
      setIsResizing(false)
    }

    document.addEventListener('mousemove', handleMouseMove)
    document.addEventListener('mouseup', handleMouseUp)

    return () => {
      document.removeEventListener('mousemove', handleMouseMove)
      document.removeEventListener('mouseup', handleMouseUp)
    }
  }, [isResizing, minWidth, maxWidth, sidebarPosition, onWidthChange])

  const sidebarElement = (
    <div
      ref={sidebarRef}
      className={cn(
        'relative border-r bg-muted/30 flex-shrink-0',
        sidebarPosition === 'right' && 'border-l border-r-0',
        sidebarClassName
      )}
      style={{ width: `${width}px` }}
    >
      {sidebar}
      
      {/* Resize handle */}
      <div
        className={cn(
          'absolute top-0 w-1 h-full cursor-col-resize hover:bg-primary/20 transition-colors',
          sidebarPosition === 'left' ? 'right-0' : 'left-0',
          isResizing && 'bg-primary/30'
        )}
        onMouseDown={handleMouseDown}
      />
    </div>
  )

  const contentElement = (
    <div className={cn('flex-1 overflow-auto', contentClassName)}>
      {content}
    </div>
  )

  return (
    <div 
      className={cn(
        'flex h-full',
        isResizing && 'select-none',
        className
      )}
    >
      {sidebarPosition === 'left' ? (
        <>
          {sidebarElement}
          {contentElement}
        </>
      ) : (
        <>
          {contentElement}
          {sidebarElement}
        </>
      )}
    </div>
  )
}

// Split pane variant for equal content areas
export interface SplitPaneLayoutProps {
  left: React.ReactNode
  right: React.ReactNode
  defaultRatio?: number
  minRatio?: number
  maxRatio?: number
  orientation?: 'horizontal' | 'vertical'
  leftClassName?: string
  rightClassName?: string
  className?: string
  onRatioChange?: (ratio: number) => void
}

export function SplitPaneLayout({
  left,
  right,
  defaultRatio = 0.5,
  minRatio = 0.2,
  maxRatio = 0.8,
  orientation = 'horizontal',
  leftClassName,
  rightClassName,
  className,
  onRatioChange
}: SplitPaneLayoutProps) {
  const [ratio, setRatio] = React.useState(defaultRatio)
  const [isResizing, setIsResizing] = React.useState(false)
  const containerRef = React.useRef<HTMLDivElement>(null)

  const handleMouseDown = React.useCallback((e: React.MouseEvent) => {
    e.preventDefault()
    setIsResizing(true)
  }, [])

  React.useEffect(() => {
    if (!isResizing) return

    const handleMouseMove = (e: MouseEvent) => {
      if (!containerRef.current) return
      
      const rect = containerRef.current.getBoundingClientRect()
      const newRatio = orientation === 'horizontal'
        ? (e.clientX - rect.left) / rect.width
        : (e.clientY - rect.top) / rect.height
      
      const clampedRatio = Math.max(minRatio, Math.min(maxRatio, newRatio))
      setRatio(clampedRatio)
      onRatioChange?.(clampedRatio)
    }

    const handleMouseUp = () => {
      setIsResizing(false)
    }

    document.addEventListener('mousemove', handleMouseMove)
    document.addEventListener('mouseup', handleMouseUp)

    return () => {
      document.removeEventListener('mousemove', handleMouseMove)
      document.removeEventListener('mouseup', handleMouseUp)
    }
  }, [isResizing, minRatio, maxRatio, orientation, onRatioChange])

  const isHorizontal = orientation === 'horizontal'

  return (
    <div
      ref={containerRef}
      className={cn(
        'flex h-full',
        isHorizontal ? 'flex-row' : 'flex-col',
        isResizing && 'select-none',
        className
      )}
    >
      <div
        className={cn(
          'overflow-auto',
          isHorizontal ? 'border-r' : 'border-b',
          leftClassName
        )}
        style={{
          [isHorizontal ? 'width' : 'height']: `${ratio * 100}%`
        }}
      >
        {left}
      </div>
      
      {/* Resize handle */}
      <div
        className={cn(
          'relative bg-border hover:bg-primary/20 transition-colors',
          isHorizontal ? 'w-1 cursor-col-resize' : 'h-1 cursor-row-resize',
          isResizing && 'bg-primary/30'
        )}
        onMouseDown={handleMouseDown}
      />
      
      <div
        className={cn('flex-1 overflow-auto', rightClassName)}
      >
        {right}
      </div>
    </div>
  )
}
