import { forwardRef, useMemo } from 'react'
import { Badge, ScrollArea } from '@ui'
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@ui'
import { ChevronRight } from 'lucide-react'
import { cn } from '@/lib/utils'
import { OctoTooltip } from '@/components/octo/octo-tooltip'
import { ShortcutDisplay } from '@/components/app-shortcut-display'
import { SelectedFilesList, SelectedFilesListRef } from './selected-files-list'
import { useSelectedFiles } from '@/hooks/utility-hooks/use-selected-files'
import { useSelectedFilesSync } from '@/hooks/utility-hooks/use-selected-files-sync'
import { useUpdateProjectTabState, useGetProjectTabById } from '@/hooks/use-kv-local-storage'

interface CollapsibleSelectedFilesListProps {
  projectTabId: number
  className?: string
}

export const CollapsibleSelectedFilesList = forwardRef<SelectedFilesListRef, CollapsibleSelectedFilesListProps>(
  ({ projectTabId, className = '' }, ref) => {
    const updateProjectTabState = useUpdateProjectTabState(projectTabId)
    const [projectTab] = useGetProjectTabById(projectTabId)
    const { selectedFiles, removeSelectedFile } = useSelectedFiles()
    
    // Enable sync to backend
    useSelectedFilesSync(projectTabId?.toString())

    // Collapsible state - default to true (collapsed) to save space
    const isCollapsed = projectTab?.selectedFilesCollapsed ?? true

    const toggleCollapsed = () => {
      updateProjectTabState((prev) => ({
        ...prev,
        selectedFilesCollapsed: !isCollapsed
      }))
    }

    return (
      <div className={cn('border rounded-lg flex flex-col', isCollapsed ? '' : 'h-full', className)}>
        <Collapsible open={!isCollapsed} onOpenChange={() => toggleCollapsed()}>
          <CollapsibleTrigger asChild>
            <div className='flex-shrink-0 flex flex-row items-center justify-between p-2 border-b hover:bg-muted/50 cursor-pointer transition-colors'>
              <div className='flex items-center gap-2'>
                <ChevronRight className={cn('h-4 w-4 transition-transform', !isCollapsed && 'rotate-90')} />
                <div className='text-md font-medium flex items-center gap-2'>
                  <span>
                    <Badge variant={selectedFiles.length > 0 && isCollapsed ? 'default' : 'secondary'}>
                      {selectedFiles.length}
                    </Badge>{' '}
                    Selected Files
                  </span>
                  {isCollapsed && selectedFiles.length > 0 && (
                    <span className='text-xs text-muted-foreground'>({selectedFiles.length} selected)</span>
                  )}
                  <OctoTooltip>
                    <div>
                      Selected files will be included with your prompt.
                      <ul className='mt-2 list-disc list-inside'>
                        <li>
                          Use arrow keys <ShortcutDisplay shortcut={['up', 'down']} /> to navigate the selected files
                          list.
                        </li>
                        <li>
                          Press <ShortcutDisplay shortcut={['r', '[1-9]']} /> or{' '}
                          <ShortcutDisplay shortcut={['delete', 'backspace']} /> to remove a file.
                        </li>
                      </ul>
                    </div>
                  </OctoTooltip>
                </div>
              </div>
            </div>
          </CollapsibleTrigger>

          <CollapsibleContent className='flex-1 flex flex-col overflow-hidden'>
            <ScrollArea className='flex-1 border-0'>
              <div className='p-2'>
                {projectTabId && (
                  <SelectedFilesList
                    ref={ref}
                    onRemoveFile={(fileId: number) => {
                      removeSelectedFile(fileId)
                    }}
                    className='w-full'
                    projectTabId={projectTabId}
                  />
                )}
              </div>
            </ScrollArea>
          </CollapsibleContent>
        </Collapsible>
      </div>
    )
  }
)

CollapsibleSelectedFilesList.displayName = 'CollapsibleSelectedFilesList'
