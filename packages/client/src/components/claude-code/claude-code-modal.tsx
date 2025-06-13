import { useState, useEffect } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Maximize2, Minimize2, X } from 'lucide-react'
import { ClaudeCodeAgent } from './claude-code-agent'
import { useProjectStore } from '@/stores/project-store'

interface ClaudeCodeModalProps {
  isOpen: boolean
  onClose: () => void
  projectId?: number
  initialPrompt?: string
}

export function ClaudeCodeModal({ isOpen, onClose, projectId: propProjectId, initialPrompt }: ClaudeCodeModalProps) {
  const [isMaximized, setIsMaximized] = useState(false)
  const { activeProject } = useProjectStore()

  // Use prop projectId or fall back to active project
  const projectId = propProjectId || activeProject?.id
  const project = projectId ? activeProject : undefined

  // Reset maximized state when modal opens
  useEffect(() => {
    if (isOpen) {
      setIsMaximized(false)
    }
  }, [isOpen])

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent
        className={`${
          isMaximized ? 'max-w-full w-full h-screen m-0 rounded-none' : 'max-w-4xl w-[90vw] max-h-[80vh]'
        } p-0 overflow-hidden transition-all duration-200`}
      >
        <DialogHeader className='px-6 py-4 border-b flex flex-row items-center justify-between'>
          <DialogTitle className='text-lg font-semibold'>
            Claude Code Assistant
            {project && <span className='ml-2 text-sm text-muted-foreground'>- {project.name}</span>}
          </DialogTitle>
          <div className='flex items-center gap-2'>
            <Button
              variant='ghost'
              size='icon'
              onClick={() => setIsMaximized(!isMaximized)}
              title={isMaximized ? 'Restore' : 'Maximize'}
            >
              {isMaximized ? <Minimize2 className='h-4 w-4' /> : <Maximize2 className='h-4 w-4' />}
            </Button>
            <Button variant='ghost' size='icon' onClick={onClose} title='Close'>
              <X className='h-4 w-4' />
            </Button>
          </div>
        </DialogHeader>

        <div className={`${isMaximized ? 'h-[calc(100vh-73px)]' : 'h-[calc(80vh-73px)]'} overflow-hidden`}>
          <ClaudeCodeAgent
            projectId={projectId}
            projectName={project?.name}
            projectPath={project?.folderPath}
            initialPrompt={initialPrompt}
            className='h-full'
          />
        </div>
      </DialogContent>
    </Dialog>
  )
}
