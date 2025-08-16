import React, { useMemo } from 'react'
import { Button } from '@promptliano/ui'
import { Skeleton } from '@promptliano/ui'
import { Copy, Code, FileText } from 'lucide-react'
import { cn } from '@/lib/utils'
import { toast } from 'sonner'
import { useGetProjectFiles } from '@/hooks/api/use-projects-api'
import { useCopyClipboard } from '@/hooks/utility-hooks/use-copy-clipboard'
import { useActiveProjectTab } from '@/hooks/use-kv-local-storage'
import { getEditorUrl } from '@/utils/editor-urls'

interface FileDisplayItemProps {
  fileId: string
  projectId: number
  projectRoot?: string
  className?: string
}

export function FileDisplayItem({ fileId, projectId, projectRoot = '', className }: FileDisplayItemProps) {
  const { copyToClipboard } = useCopyClipboard()
  const [projectTabState] = useActiveProjectTab()
  const preferredEditor = projectTabState?.preferredEditor ?? 'vscode'

  // Fetch project files
  const { data: filesResponse, isLoading } = useGetProjectFiles(projectId)

  // Find the file by ID
  const file = useMemo(() => {
    if (!filesResponse?.data) return null

    // The fileId might be a string representation of a number or a path
    // Try to find by ID first (if it's a number)
    const numericId = Number(fileId)
    if (!isNaN(numericId)) {
      return filesResponse.data.find((f: any) => f.id === numericId)
    }

    // Otherwise try to find by path
    return filesResponse.data.find((f: any) => f.path === fileId)
  }, [filesResponse, fileId])

  // Extract file name from path
  const fileName = useMemo(() => {
    if (!file) return fileId // Fallback to showing the ID
    const parts = file.path.split('/')
    return parts[parts.length - 1] || file.path
  }, [file, fileId])

  // Get directory path
  const dirPath = useMemo(() => {
    if (!file) return ''
    const parts = file.path.split('/')
    parts.pop() // Remove file name
    return parts.join('/')
  }, [file])

  const handleCopyPath = async () => {
    const pathToCopy = file ? (projectRoot ? `${projectRoot}/${file.path}` : file.path) : fileId

    copyToClipboard(pathToCopy, {
      successMessage: 'File path copied to clipboard',
      errorMessage: 'Failed to copy file path'
    })
  }

  const handleOpenInEditor = () => {
    if (!file) {
      toast.error('File not found')
      return
    }

    const fullPath = projectRoot ? `${projectRoot}/${file.path}` : file.path
    const editorUrl = getEditorUrl(preferredEditor, fullPath)
    window.open(editorUrl, '_blank', 'noopener,noreferrer')
  }

  if (isLoading) {
    return (
      <div className={cn('p-2 rounded bg-muted/50', className)}>
        <Skeleton className='h-4 w-full mb-1' />
        <Skeleton className='h-3 w-2/3' />
      </div>
    )
  }

  return (
    <div
      className={cn(
        'group flex items-center justify-between p-2 rounded bg-muted/50 hover:bg-muted/70 transition-colors',
        className
      )}
    >
      <div className='flex items-start gap-2 min-w-0 flex-1'>
        <FileText className='h-4 w-4 mt-0.5 text-muted-foreground flex-shrink-0' />
        <div className='min-w-0 flex-1'>
          <div className='font-mono text-xs font-medium truncate' title={fileName}>
            {fileName}
          </div>
          {dirPath && (
            <div className='text-xs text-muted-foreground truncate' title={dirPath}>
              {dirPath}
            </div>
          )}
        </div>
      </div>

      <div className='flex gap-1 ml-2 opacity-0 group-hover:opacity-100 transition-opacity'>
        <Button size='icon' variant='ghost' className='h-6 w-6' onClick={handleCopyPath} title='Copy file path'>
          <Copy className='h-3 w-3' />
        </Button>
        {file && (
          <Button
            size='icon'
            variant='ghost'
            className='h-6 w-6'
            onClick={handleOpenInEditor}
            title={`Open in ${preferredEditor}`}
          >
            <Code className='h-3 w-3' />
          </Button>
        )}
      </div>
    </div>
  )
}
