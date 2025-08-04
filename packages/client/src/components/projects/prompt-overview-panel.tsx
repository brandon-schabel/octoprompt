/**
 * Recent changes:
 * 1. Fixed file suggestions API response handling - now correctly uses ProjectFile[] directly instead of mapping IDs
 * 2. Refactored to remove user input section - now only contains prompts and selected files
 * 3.
 * 4.
 * 5.
 */
import { forwardRef, useRef, useImperativeHandle } from 'react'
import { cn } from '@/lib/utils'
import { PromptsList, type PromptsListRef } from '@/components/projects/prompts-list'
import { CollapsibleSelectedFilesList } from '@/components/projects/collapsible-selected-files-list'
import { type SelectedFilesListRef } from '@/components/projects/selected-files-list'
import { useActiveProjectTab, useProjectTabField } from '@/hooks/use-kv-local-storage'
import { VerticalResizable as VerticalResizablePanel } from '@promptliano/ui'
import { ErrorBoundary } from '@/components/error-boundary/error-boundary'

export type PromptOverviewPanelRef = {
  // Removed focusPrompt as user input is now in a separate panel
}

interface PromptOverviewPanelProps {
  className?: string
}

export const PromptOverviewPanel = forwardRef<PromptOverviewPanelRef, PromptOverviewPanelProps>(
  function PromptOverviewPanel({ className }, ref) {
    const [, , activeProjectTabId] = useActiveProjectTab()

    const { data: promptsPanelCollapsed = true } = useProjectTabField('promptsPanelCollapsed', activeProjectTabId ?? -1)
    const { data: selectedFilesCollapsed = true } = useProjectTabField(
      'selectedFilesCollapsed',
      activeProjectTabId ?? -1
    )

    // Refs for child components
    const promptsListRef = useRef<PromptsListRef>(null)
    const selectedFilesListRef = useRef<SelectedFilesListRef>(null)

    // Expose empty methods to parent (for compatibility)
    useImperativeHandle(ref, () => ({}))

    return (
      <ErrorBoundary>
        <div className={cn('flex flex-col h-full overflow-hidden', className)}>
          <div className='flex-1 flex flex-col min-h-0 p-4 overflow-hidden min-w-0'>
            {/* Dynamic layout based on collapsed states */}
            {!promptsPanelCollapsed && !selectedFilesCollapsed ? (
              // Both expanded - use resizable panel for manual control
              <VerticalResizablePanel
                topPanel={
                  <PromptsList ref={promptsListRef} projectTabId={activeProjectTabId || -1} className='h-full w-full' />
                }
                bottomPanel={
                  <CollapsibleSelectedFilesList
                    ref={selectedFilesListRef}
                    projectTabId={activeProjectTabId || -1}
                    className='h-full w-full'
                  />
                }
                initialTopPanelHeight={50}
                minTopPanelHeight={20}
                maxTopPanelHeight={80}
                storageKey='prompts-files-split'
                className='h-full w-full'
              />
            ) : (
              // At least one collapsed - use flex layout for automatic sizing
              <div className='flex flex-col gap-4 h-full overflow-hidden'>
                <PromptsList
                  ref={promptsListRef}
                  projectTabId={activeProjectTabId || -1}
                  className={promptsPanelCollapsed ? 'flex-shrink-0' : 'flex-1 min-h-0'}
                />
                <CollapsibleSelectedFilesList
                  ref={selectedFilesListRef}
                  projectTabId={activeProjectTabId || -1}
                  className={selectedFilesCollapsed ? 'flex-shrink-0' : 'flex-1 min-h-0'}
                />
              </div>
            )}
          </div>
        </div>
      </ErrorBoundary>
    )
  }
)
