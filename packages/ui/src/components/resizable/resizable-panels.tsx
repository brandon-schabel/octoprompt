import * as React from 'react'
import { cn } from '../../utils'
import { PanelResizeHandle, Panel, PanelGroup, type ImperativePanelHandle } from 'react-resizable-panels'

// Re-export the core components from react-resizable-panels with aliases
export {
  PanelResizeHandle as ResizableHandle,
  Panel as ResizablePanel,
  PanelGroup as ResizablePanelGroup,
  type ImperativePanelHandle
} from 'react-resizable-panels'

// Custom styled handle component
interface ResizableHandleStyledProps extends React.ComponentProps<typeof PanelResizeHandle> {
  withHandle?: boolean
  orientation?: 'horizontal' | 'vertical'
}

export const ResizableHandleStyled = React.forwardRef<
  React.ElementRef<typeof PanelResizeHandle>,
  ResizableHandleStyledProps
>(({ withHandle, orientation = 'horizontal', className, ...props }, ref) => (
  <PanelResizeHandle
    className={cn(
      'relative flex w-px items-center justify-center bg-border after:absolute after:inset-y-0 after:left-1/2 after:w-1 after:-translate-x-1/2 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring focus-visible:ring-offset-1 data-[panel-group-direction=vertical]:h-px data-[panel-group-direction=vertical]:w-full data-[panel-group-direction=vertical]:after:left-0 data-[panel-group-direction=vertical]:after:h-1 data-[panel-group-direction=vertical]:after:w-full data-[panel-group-direction=vertical]:after:-translate-y-1/2 data-[panel-group-direction=vertical]:after:translate-x-0 [&[data-panel-group-direction=vertical]>div]:rotate-90',
      className
    )}
    {...props}
  >
    {withHandle && (
      <div className='z-10 flex h-4 w-3 items-center justify-center rounded-sm border bg-border'>
        <svg width='6' height='14' viewBox='0 0 6 14' fill='none' className='h-2.5 w-1.5'>
          <circle cx='1' cy='1' r='1' fill='currentColor' />
          <circle cx='5' cy='1' r='1' fill='currentColor' />
          <circle cx='1' cy='5' r='1' fill='currentColor' />
          <circle cx='5' cy='5' r='1' fill='currentColor' />
          <circle cx='1' cy='9' r='1' fill='currentColor' />
          <circle cx='5' cy='9' r='1' fill='currentColor' />
          <circle cx='1' cy='13' r='1' fill='currentColor' />
          <circle cx='5' cy='13' r='1' fill='currentColor' />
        </svg>
      </div>
    )}
  </PanelResizeHandle>
))
ResizableHandleStyled.displayName = 'ResizableHandleStyled'

// Convenience component for horizontal layout
interface HorizontalResizableProps {
  leftPanel: React.ReactNode
  rightPanel: React.ReactNode
  defaultSize?: number
  minSize?: number
  maxSize?: number
  collapsible?: boolean
  className?: string
  leftPanelClassName?: string
  rightPanelClassName?: string
  onCollapse?: () => void
  storageKey?: string
}

export function HorizontalResizable({
  leftPanel,
  rightPanel,
  defaultSize = 50,
  minSize = 10,
  maxSize = 90,
  collapsible = false,
  className,
  leftPanelClassName,
  rightPanelClassName,
  onCollapse,
  storageKey
}: HorizontalResizableProps) {
  return (
    <PanelGroup direction='horizontal' className={cn('h-full w-full', className)} autoSaveId={storageKey}>
      <Panel
        defaultSize={defaultSize}
        minSize={minSize}
        maxSize={maxSize}
        collapsible={collapsible}
        onCollapse={onCollapse}
        className={leftPanelClassName}
      >
        {leftPanel}
      </Panel>
      <ResizableHandleStyled withHandle />
      <Panel className={rightPanelClassName}>{rightPanel}</Panel>
    </PanelGroup>
  )
}

// Convenience component for vertical layout
interface VerticalResizableProps {
  topPanel: React.ReactNode
  bottomPanel: React.ReactNode
  defaultSize?: number
  minSize?: number
  maxSize?: number
  collapsible?: boolean
  className?: string
  topPanelClassName?: string
  bottomPanelClassName?: string
  onCollapse?: () => void
  storageKey?: string
}

export function VerticalResizable({
  topPanel,
  bottomPanel,
  defaultSize = 50,
  minSize = 10,
  maxSize = 90,
  collapsible = false,
  className,
  topPanelClassName,
  bottomPanelClassName,
  onCollapse,
  storageKey
}: VerticalResizableProps) {
  return (
    <PanelGroup direction='vertical' className={cn('h-full w-full', className)} autoSaveId={storageKey}>
      <Panel
        defaultSize={defaultSize}
        minSize={minSize}
        maxSize={maxSize}
        collapsible={collapsible}
        onCollapse={onCollapse}
        className={topPanelClassName}
      >
        {topPanel}
      </Panel>
      <ResizableHandleStyled withHandle orientation='vertical' />
      <Panel className={bottomPanelClassName}>{bottomPanel}</Panel>
    </PanelGroup>
  )
}

// Three column layout
interface ThreeColumnResizableProps {
  leftPanel: React.ReactNode
  middlePanel: React.ReactNode
  rightPanel: React.ReactNode
  defaultLeftSize?: number
  defaultRightSize?: number
  minSize?: number
  className?: string
  leftPanelClassName?: string
  middlePanelClassName?: string
  rightPanelClassName?: string
  storageKey?: string
}

export function ThreeColumnResizable({
  leftPanel,
  middlePanel,
  rightPanel,
  defaultLeftSize = 25,
  defaultRightSize = 25,
  minSize = 10,
  className,
  leftPanelClassName,
  middlePanelClassName,
  rightPanelClassName,
  storageKey
}: ThreeColumnResizableProps) {
  return (
    <PanelGroup direction='horizontal' className={cn('h-full w-full', className)} autoSaveId={storageKey}>
      <Panel defaultSize={defaultLeftSize} minSize={minSize} className={leftPanelClassName}>
        {leftPanel}
      </Panel>
      <ResizableHandleStyled withHandle />
      <Panel defaultSize={100 - defaultLeftSize - defaultRightSize} minSize={minSize} className={middlePanelClassName}>
        {middlePanel}
      </Panel>
      <ResizableHandleStyled withHandle />
      <Panel defaultSize={defaultRightSize} minSize={minSize} className={rightPanelClassName}>
        {rightPanel}
      </Panel>
    </PanelGroup>
  )
}
