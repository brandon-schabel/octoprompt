import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Badge } from '@/components/ui/badge'
import { GitBranch } from 'lucide-react'
import { SelectedFilesListDisplay } from './selected-files-list-display'
import { GitOperationsPanel } from '../../git-operations-panel'
import { ProjectFileMap } from '@octoprompt/schemas'
import { SelectedFilesListRef } from '../../selected-files-list'
import { useSelectedFiles } from '@/hooks/utility-hooks/use-selected-files'
import { useProjectGitStatus } from '@/hooks/api/use-git-api'
import { useActiveProjectTab } from '@/hooks/use-kv-local-storage'

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
  const [activeProjectTabState] = useActiveProjectTab()
  const projectId = activeProjectTabState?.selectedProjectId
  const { selectedFiles } = useSelectedFiles()
  const { data: gitStatus } = useProjectGitStatus(projectId ?? -1)

  // Count changed files
  const changedFilesCount = gitStatus?.success
    ? [...(gitStatus.data.files?.staged || []), ...(gitStatus.data.files?.unstaged || [])].length
    : 0

  return (
    <Tabs defaultValue='selected-files' className='flex flex-col h-full'>
      <TabsList className='grid w-full grid-cols-2 mb-3'>
        <TabsTrigger value='selected-files' className='flex items-center gap-2'>
          <span>Selected Files</span>
          {selectedFiles.length > 0 && (
            <Badge variant='secondary' className='h-5 px-1.5 text-xs'>
              {selectedFiles.length}
            </Badge>
          )}
        </TabsTrigger>
        <TabsTrigger value='git' className='flex items-center gap-2'>
          <GitBranch className='h-3.5 w-3.5' />
          <span>Git</span>
          {changedFilesCount > 0 && (
            <Badge variant='secondary' className='h-5 px-1.5 text-xs'>
              {changedFilesCount}
            </Badge>
          )}
        </TabsTrigger>
      </TabsList>

      <TabsContent value='selected-files' className='flex-1 min-h-0 mt-0'>
        <SelectedFilesListDisplay
          allFilesMap={allFilesMap}
          selectedFilesListRef={selectedFilesListRef}
          onNavigateToFileTree={onNavigateToFileTree}
        />
      </TabsContent>

      <TabsContent value='git' className='flex-1 min-h-0 mt-0'>
        {projectId && <GitOperationsPanel projectId={projectId} className='h-full' />}
      </TabsContent>
    </Tabs>
  )
}
