import { Badge } from '@promptliano/ui'
import { SelectedFilesListDisplay } from './selected-files-list-display'
import { ProjectFileMap } from '@promptliano/schemas'
import { SelectedFilesListRef } from '../../selected-files-list'
import { useSelectedFiles } from '@/hooks/utility-hooks/use-selected-files'

interface TabbedSidebarPanelProps {
  allFilesMap: ProjectFileMap
  selectedFilesListRef: React.RefObject<SelectedFilesListRef>
  onNavigateToFileTree: () => void
}

export function TabbedSidebarPanel({
  allFilesMap,
  selectedFilesListRef,
  onNavigateToFileTree
}: TabbedSidebarPanelProps) {
  const { selectedFiles } = useSelectedFiles()

  // return

  return (
    <div className='flex flex-col h-full'>
      <div className='flex-1 min-h-0'>
        <SelectedFilesListDisplay
          allFilesMap={allFilesMap}
          selectedFilesListRef={selectedFilesListRef}
          onNavigateToFileTree={onNavigateToFileTree}
        />
      </div>
    </div>
  )
}
