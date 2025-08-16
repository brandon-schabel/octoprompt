import { forwardRef, useImperativeHandle, useRef, RefObject } from 'react'
import { useHotkeys } from 'react-hotkeys-hook'
import { toast } from 'sonner'
import { ProjectHeader } from './project-header'
import { FileExplorer } from './file-explorer/file-explorer'
import { useSelectedFiles } from '@/hooks/utility-hooks/use-selected-files'
import { useGetProject } from '@/hooks/api/use-projects-api'
import { useActiveProjectTab, useSelectSetting } from '@/hooks/use-kv-local-storage'

export type FilePanelRef = {
  focusSearch: () => void
  focusFileTree: () => void
  focusPrompts: () => void
}

type FilePanelProps = {
  className?: string
}

// TODO: invalidate project files when ai file editor is used (to refresh after it changes files)
export const FilePanel = forwardRef<FilePanelRef, FilePanelProps>(function FilePanel({ className }, ref) {
  // If not passed in, get from store
  const [activeProjectTabState] = useActiveProjectTab()
  const projectId = activeProjectTabState?.selectedProjectId
  const { data: projectData } = useGetProject(activeProjectTabState?.selectedProjectId ?? -1)

  // We still keep references to let parent call `focusSearch`, etc.
  const searchInputRef = useRef<HTMLInputElement>(null)
  const fileTreeRef = useRef<any>(null) // or FileTreeRef
  const selectedFilesListRef = useRef<any>(null)

  const allowSpacebarToSelect = useSelectSetting('useSpacebarToSelectAutocomplete')

  // Access our undo/redo hooks from useSelectedFiles (no more prop drilling)
  const { undo, redo, canUndo, canRedo } = useSelectedFiles()

  // Keyboard shortcuts
  useHotkeys('mod+f', (e) => {
    e.preventDefault()
    searchInputRef.current?.focus()
  })
  useHotkeys('mod+g', (e) => {
    e.preventDefault()
    fileTreeRef.current?.focusTree()
  })
  useHotkeys('mod+z', (e) => {
    e.preventDefault()
    if (canUndo) {
      undo()
      toast.success('Undo: Reverted file selection')
    }
  })
  useHotkeys('shift+mod+z', (e) => {
    e.preventDefault()
    if (canRedo) {
      redo()
      toast.success('Redo: Restored file selection')
    }
  })

  // Expose methods to parent
  useImperativeHandle(ref, () => ({
    focusSearch: () => {
      searchInputRef.current?.focus()
    },
    focusFileTree: () => {
      fileTreeRef.current?.focusTree()
    },
    focusPrompts: () => {
      // Let the parent handle focusing the prompts panel
    }
  }))

  if (!projectId) {
    return (
      <div className={`flex flex-col items-center justify-center h-full p-8 text-center space-y-6 ${className}`}>
        <NoProjectSelectedScreen />
      </div>
    )
  }

  // We pass only references + onFileViewerOpen to the Explorer
  return (
    <div id='outer-area' className={`flex flex-col h-full overflow-hidden ${className}`}>
      <div className='flex flex-col flex-1 min-h-0'>
        {projectData && <ProjectHeader projectData={projectData} />}
        <div className='flex-1 overflow-auto p-4 space-y-6'>
          <FileExplorer
            ref={{
              searchInputRef: searchInputRef as RefObject<HTMLInputElement>,
              fileTreeRef,
              selectedFilesListRef
            }}
            allowSpacebarToSelect={allowSpacebarToSelect}
          />
        </div>
      </div>
    </div>
  )
})

// -------------------------------------------------------------------------
function NoProjectSelectedScreen() {
  return (
    <div className='max-w-md space-y-4'>
      <h3 className='text-lg font-semibold'>No Project Selected</h3>
      <p className='text-muted-foreground'>
        Select a project to start exploring files, or create a new project if you haven't added one yet.
      </p>
    </div>
  )
}
