import { useState, useEffect, useMemo } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@promptliano/ui'
import { Button, Tabs, TabsContent, TabsList, TabsTrigger, Skeleton } from '@promptliano/ui'
import { Edit, Save, XCircle, Copy, FileText, FileCode, Expand, Minimize2, GitBranch } from 'lucide-react'
import { LightAsync as SyntaxHighlighter } from 'react-syntax-highlighter'
import { Textarea } from '@promptliano/ui'
import { MarkdownRenderer } from '@/components/markdown-renderer'
import { LazyMonacoEditor } from '@/components/lazy-monaco-editor'
import { LazyMonacoDiffViewer } from '@/components/lazy-monaco-diff-viewer'
import { DiffViewer } from '@/components/file-changes/diff-viewer'
import { useCopyClipboard } from '@/hooks/utility-hooks/use-copy-clipboard'
import { Switch } from '@promptliano/ui'
import { useSelectSetting } from '@/hooks/use-kv-local-storage'
import { ProjectFile } from '@promptliano/schemas'
import * as themes from 'react-syntax-highlighter/dist/esm/styles/hljs'
import { useUpdateFileContent } from '@/hooks/api/use-projects-api'
import { useProjectGitStatus, useFileDiff } from '@/hooks/api/use-git-api'
import { toast } from 'sonner'

type FileViewerDialogProps = {
  open: boolean
  viewedFile?: ProjectFile
  markdownText?: string
  onClose?: () => void
  onSave?: (content: string) => Promise<void> | void
  filePath?: string
  projectId?: number
  startInEditMode?: boolean
  startInDiffMode?: boolean
}

import { getFileLanguage } from '@/lib/file-utils'

function getLanguageByExtension(extension?: string): string {
  if (!extension) return 'plaintext'
  const ext = extension.toLowerCase()
  const languageMap: Record<string, string> = {
    '.ts': 'typescript',
    '.tsx': 'typescript',
    '.js': 'javascript',
    '.jsx': 'javascript',
    '.json': 'json',
    '.html': 'html',
    '.css': 'css',
    '.scss': 'scss',
    '.less': 'less',
    '.md': 'markdown',
    '.py': 'python',
    '.java': 'java',
    '.cpp': 'cpp',
    '.c': 'c',
    '.cs': 'csharp',
    '.php': 'php',
    '.rb': 'ruby',
    '.go': 'go',
    '.rs': 'rust',
    '.kt': 'kotlin',
    '.swift': 'swift',
    '.yaml': 'yaml',
    '.yml': 'yaml',
    '.xml': 'xml',
    '.sql': 'sql',
    '.sh': 'shell',
    '.bash': 'shell',
    '.zsh': 'shell',
    '.dockerfile': 'dockerfile',
    '.txt': 'plaintext'
  }
  return languageMap[ext] || 'plaintext'
}

export function FileViewerDialog({
  open,
  viewedFile,
  markdownText: markdownText,
  onClose,
  onSave,
  filePath,
  projectId,
  startInEditMode = false,
  startInDiffMode = false
}: FileViewerDialogProps) {
  const [isEditingFile, setIsEditingFile] = useState(false)
  const [editedContent, setEditedContent] = useState<string>('')
  const [showRawMarkdown, setShowRawMarkdown] = useState(false)
  const [isFullscreen, setIsFullscreen] = useState(false)
  const [activeTab, setActiveTab] = useState<'content' | 'diff'>('content')
  const [diffViewMode, setDiffViewMode] = useState<'unstaged' | 'staged'>('unstaged')
  const [diffViewType, setDiffViewType] = useState<'monaco' | 'simple'>('monaco')

  const { copyToClipboard } = useCopyClipboard()
  const isDarkMode = useSelectSetting('theme') === 'dark'
  const codeThemeDark = useSelectSetting('codeThemeDark')
  const codeThemeLight = useSelectSetting('codeThemeLight')

  const updateFileContent = useUpdateFileContent()

  // Git status and diff hooks
  const { data: gitStatus } = useProjectGitStatus(projectId, open && !!projectId)
  const gitFileStatus = useMemo(() => {
    if (!gitStatus || !viewedFile) return null
    return (gitStatus as any).data?.files?.find((f: any) => f.path === viewedFile.path)
  }, [gitStatus, viewedFile])

  const hasGitChanges = gitFileStatus && gitFileStatus.status !== 'unchanged'
  const hasStaged =
    gitStatus && viewedFile ? (gitStatus as any).data?.staged?.includes(viewedFile.path) : false
  const hasUnstaged = gitFileStatus ? !gitFileStatus.staged : false

  // File diff data
  const {
    data: diffData,
    isLoading: diffLoading,
    error: diffError
  } = useFileDiff(
    projectId,
    viewedFile?.path,
    { staged: diffViewMode === 'staged' },
    open && activeTab === 'diff' && !!projectId && !!viewedFile
  )

  const selectedSyntaxTheme = useMemo(() => {
    const themeName = isDarkMode ? codeThemeDark : codeThemeLight
    // @ts-ignore
    return themes[themeName] ?? themes.atomOneLight
  }, [isDarkMode, codeThemeDark, codeThemeLight])

  useEffect(() => {
    if (open) {
      setIsEditingFile(startInEditMode && !!viewedFile && !!projectId)
      setEditedContent(viewedFile?.content || markdownText || '')
      setIsFullscreen(false)
      // Set initial tab based on startInDiffMode and whether file has changes
      if (startInDiffMode && hasGitChanges) {
        setActiveTab('diff')
        // Set initial diff view mode based on what's available
        setDiffViewMode(hasUnstaged ? 'unstaged' : 'staged')
      } else {
        setActiveTab('content')
      }
    }
  }, [viewedFile, markdownText, open, startInEditMode, projectId, startInDiffMode, hasGitChanges, hasUnstaged])

  // Handle F11 key for fullscreen toggle
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'F11' && open) {
        event.preventDefault()
        setIsFullscreen((prev) => !prev)
      }
    }

    if (open) {
      document.addEventListener('keydown', handleKeyDown)
      return () => document.removeEventListener('keydown', handleKeyDown)
    }
  }, [open])

  const closeFileViewer = () => {
    setIsEditingFile(false)
    setEditedContent('')
    setIsFullscreen(false)
    onClose?.()
  }

  const saveFileEdits = () => {
    if (viewedFile && editedContent !== viewedFile.content && projectId) {
      updateFileContent.mutate({
        projectId,
        fileId: viewedFile.id,
        content: editedContent
      })
    } else if (onSave) {
      // Fallback to the original onSave prop for backward compatibility
      onSave(editedContent)
    }
  }

  const copyContent = async () => {
    const content = viewedFile?.content || markdownText || ''
    copyToClipboard(content, {
      successMessage: 'Content copied to clipboard',
      errorMessage: 'Failed to copy content'
    })
  }

  const copyPath = async (fullPath: boolean = false) => {
    if (!viewedFile?.path) return
    const path = fullPath ? `${window.location.origin}/${viewedFile.path}` : viewedFile.path
    copyToClipboard(path, {
      successMessage: `${fullPath ? 'Full' : 'Relative'} path copied to clipboard`,
      errorMessage: 'Failed to copy path'
    })
  }

  const toggleFullscreen = () => {
    setIsFullscreen(!isFullscreen)
  }

  if (!viewedFile && !markdownText) return null

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        if (!o) closeFileViewer()
      }}
    >
      <DialogContent
        className={`${
          isFullscreen ? 'w-screen h-screen max-w-none max-h-none m-0 p-0 rounded-none' : 'max-w-[96rem] max-h-[80vh]'
        } overflow-auto flex flex-col`}
      >
        <DialogHeader className={isFullscreen ? 'p-4' : ''}>
          <div className='flex items-center justify-between'>
            <DialogTitle>{viewedFile?.path || 'Text View'}</DialogTitle>
            <div className='flex items-center gap-2'>
              <Button
                variant='outline'
                size='sm'
                onClick={toggleFullscreen}
                className='flex items-center gap-2'
                title={isFullscreen ? 'Exit fullscreen' : 'Enter fullscreen'}
              >
                {isFullscreen ? <Minimize2 className='h-4 w-4' /> : <Expand className='h-4 w-4' />}
                {isFullscreen ? 'Exit Fullscreen' : 'Fullscreen'}
              </Button>
              <Button variant='outline' size='sm' onClick={() => copyContent()} className='flex items-center gap-2'>
                <FileText className='h-4 w-4' />
                Copy Content
              </Button>
              {viewedFile?.path && (
                <>
                  <Button
                    variant='outline'
                    size='sm'
                    onClick={() => copyPath(false)}
                    className='flex items-center gap-2'
                  >
                    <FileCode className='h-4 w-4' />
                    Copy Path
                  </Button>
                  <Button
                    variant='outline'
                    size='sm'
                    onClick={() => copyPath(true)}
                    className='flex items-center gap-2'
                  >
                    <Copy className='h-4 w-4' />
                    Copy Full Path
                  </Button>
                </>
              )}
            </div>
          </div>
          <DialogDescription className='flex items-center justify-between'>
            <span>{isEditingFile ? 'Editing mode' : 'View mode'}</span>
            {markdownText && !isEditingFile && (
              <div className='flex items-center gap-2'>
                <span className='text-sm'>Show Raw</span>
                <Switch checked={showRawMarkdown} onCheckedChange={setShowRawMarkdown} />
              </div>
            )}
          </DialogDescription>
        </DialogHeader>
        {/* Show file content editor */}
        {viewedFile && projectId ? (
          hasGitChanges ? (
            <Tabs
              value={activeTab}
              onValueChange={(v) => setActiveTab(v as 'content' | 'diff')}
              className='flex-1 flex flex-col min-h-0'
            >
              <TabsList className='grid w-full grid-cols-2'>
                <TabsTrigger value='content'>Current File</TabsTrigger>
                <TabsTrigger value='diff' className='flex items-center gap-2'>
                  <GitBranch className='h-4 w-4' />
                  Git Changes
                </TabsTrigger>
              </TabsList>

              <TabsContent value='content' className='flex-1 min-h-0 mt-4'>
                <div className={`h-full overflow-auto border rounded-md ${isFullscreen ? 'p-2 mx-4' : 'p-2'}`}>
                  {!isEditingFile ? (
                    // @ts-ignore
                    <SyntaxHighlighter
                      language={getLanguageByExtension(viewedFile?.extension)}
                      style={selectedSyntaxTheme}
                      showLineNumbers
                      wrapLongLines
                    >
                      {viewedFile?.content || ''}
                    </SyntaxHighlighter>
                  ) : (
                    <div className='h-full relative'>
                      <LazyMonacoEditor
                        value={editedContent}
                        onChange={(value) => setEditedContent(value || '')}
                        language={getLanguageByExtension(viewedFile?.extension)}
                        height={isFullscreen ? 'calc(100vh - 300px)' : '300px'}
                        onSave={saveFileEdits}
                      />
                    </div>
                  )}
                </div>
              </TabsContent>

              <TabsContent value='diff' className='flex-1 min-h-0 mt-4 flex flex-col'>
                {hasStaged && hasUnstaged && (
                  <Tabs
                    value={diffViewMode}
                    onValueChange={(v) => setDiffViewMode(v as 'unstaged' | 'staged')}
                    className='mb-2'
                  >
                    <TabsList className='grid w-full grid-cols-2'>
                      <TabsTrigger value='unstaged'>Unstaged Changes</TabsTrigger>
                      <TabsTrigger value='staged'>Staged Changes</TabsTrigger>
                    </TabsList>
                  </Tabs>
                )}

                <div className='mb-2 flex items-center justify-between'>
                  <Tabs value={diffViewType} onValueChange={(v) => setDiffViewType(v as 'monaco' | 'simple')}>
                    <TabsList>
                      <TabsTrigger value='monaco'>Side-by-side</TabsTrigger>
                      <TabsTrigger value='simple'>Unified</TabsTrigger>
                    </TabsList>
                  </Tabs>

                  <Button
                    variant='outline'
                    size='sm'
                    onClick={async () => {
                      if (!diffData?.diff) return
                      try {
                        await navigator.clipboard.writeText(diffData.diff)
                        toast.success('Diff copied to clipboard')
                      } catch (error) {
                        toast.error('Failed to copy diff')
                      }
                    }}
                    disabled={!diffData?.diff}
                  >
                    <Copy className='h-4 w-4 mr-2' />
                    Copy Diff
                  </Button>
                </div>

                <div className='flex-1 overflow-auto'>
                  {diffLoading && <Skeleton className='w-full h-full' />}

                  {diffError && <div className='text-red-500 p-4'>Failed to load diff: {diffError.message}</div>}

                  {diffData?.diff && !diffLoading && !diffError && (
                    <>
                      {diffViewType === 'monaco' ? (
                        <div className='h-full'>
                          {(() => {
                            const parseDiff = (diff: string) => {
                              const lines = diff.split('\n')
                              const original: string[] = []
                              const modified: string[] = []

                              let inDiffSection = false

                              for (const line of lines) {
                                if (line.startsWith('@@')) {
                                  inDiffSection = true
                                  continue
                                }

                                if (!inDiffSection) continue

                                if (line.startsWith('-') && !line.startsWith('---')) {
                                  original.push(line.substring(1))
                                } else if (line.startsWith('+') && !line.startsWith('+++')) {
                                  modified.push(line.substring(1))
                                } else if (line.startsWith(' ')) {
                                  original.push(line.substring(1))
                                  modified.push(line.substring(1))
                                }
                              }

                              return {
                                original: original.join('\n'),
                                modified: modified.join('\n')
                              }
                            }
                            const { original, modified } = parseDiff(diffData.diff)
                            return (
                              <div className='relative h-full'>
                                <Button
                                  variant='outline'
                                  size='sm'
                                  className='absolute top-2 left-2 z-10 bg-background/95 backdrop-blur'
                                  onClick={async () => {
                                    try {
                                      await navigator.clipboard.writeText(original)
                                      toast.success('Original code copied to clipboard')
                                    } catch (error) {
                                      toast.error('Failed to copy original code')
                                    }
                                  }}
                                >
                                  <Copy className='h-4 w-4 mr-2' />
                                  Copy Original
                                </Button>
                                <LazyMonacoDiffViewer
                                  original={original}
                                  modified={modified}
                                  language={getLanguageByExtension(viewedFile?.extension)}
                                  height={isFullscreen ? 'calc(100vh - 400px)' : '400px'}
                                />
                              </div>
                            )
                          })()}
                        </div>
                      ) : (
                        <div className='max-h-full overflow-auto'>
                          <pre className='text-xs p-2 bg-muted rounded font-mono'>{diffData.diff}</pre>
                        </div>
                      )}
                    </>
                  )}

                  {diffData?.diff === '' && !diffLoading && !diffError && (
                    <div className='text-muted-foreground p-4 text-center'>No changes in {diffViewMode} area</div>
                  )}
                </div>
              </TabsContent>
            </Tabs>
          ) : (
            <div className={`flex-1 min-h-0 overflow-auto border rounded-md ${isFullscreen ? 'p-2 mx-4' : 'p-2'}`}>
              {!isEditingFile ? (
                // @ts-ignore
                <SyntaxHighlighter
                  language={getLanguageByExtension(viewedFile?.extension)}
                  style={selectedSyntaxTheme}
                  showLineNumbers
                  wrapLongLines
                >
                  {viewedFile?.content || ''}
                </SyntaxHighlighter>
              ) : (
                <div className='flex-1 min-h-0 relative'>
                  <LazyMonacoEditor
                    value={editedContent}
                    onChange={(value) => setEditedContent(value || '')}
                    language={getLanguageByExtension(viewedFile?.extension)}
                    height={isFullscreen ? 'calc(100vh - 300px)' : '300px'}
                    onSave={saveFileEdits}
                  />
                </div>
              )}
            </div>
          )
        ) : (
          /* Fallback for markdown content or files without versioning */
          <div className={`flex-1 min-h-0 overflow-auto border rounded-md ${isFullscreen ? 'p-2 mx-4' : 'p-2'}`}>
            {markdownText ? (
              showRawMarkdown ? (
                <div className='relative my-2 overflow-x-auto break-words'>
                  <button
                    onClick={() => copyToClipboard(markdownText)}
                    className={`
                      absolute top-2 right-2 text-xs px-2 py-1 border rounded shadow z-10
                      ${
                        isDarkMode
                          ? 'bg-neutral-800 text-neutral-100 hover:bg-neutral-700'
                          : 'bg-neutral-50 text-neutral-900 hover:bg-neutral-200'
                      }
                    `}
                    title='Copy code'
                  >
                    Copy
                  </button>
                  {/* @ts-ignore */}
                  <SyntaxHighlighter language='markdown' style={selectedSyntaxTheme} showLineNumbers wrapLongLines>
                    {markdownText}
                  </SyntaxHighlighter>
                </div>
              ) : (
                <MarkdownRenderer content={markdownText} copyToClipboard={copyToClipboard} />
              )
            ) : viewedFile ? (
              // @ts-ignore
              <SyntaxHighlighter
                language={getLanguageByExtension(viewedFile?.extension)}
                style={selectedSyntaxTheme}
                showLineNumbers
                wrapLongLines
              >
                {viewedFile?.content || ''}
              </SyntaxHighlighter>
            ) : null}
          </div>
        )}
        <DialogFooter className={`mt-4 flex justify-between ${isFullscreen ? 'p-4' : ''}`}>
          <div className='flex gap-2'>
            {/* Show edit controls for files */}
            {viewedFile && !isEditingFile && activeTab === 'content' && (
              <Button variant='outline' onClick={() => setIsEditingFile(true)}>
                <Edit className='mr-2 h-4 w-4' />
                Edit
              </Button>
            )}
            {isEditingFile && (
              <>
                <Button
                  variant='outline'
                  onClick={() => {
                    setIsEditingFile(false)
                    setEditedContent(viewedFile?.content || '')
                  }}
                  disabled={updateFileContent.isPending}
                >
                  <XCircle className='mr-2 h-4 w-4' />
                  Cancel
                </Button>
                <Button variant='default' onClick={saveFileEdits} disabled={updateFileContent.isPending}>
                  <Save className='mr-2 h-4 w-4' />
                  {updateFileContent.isPending ? 'Saving...' : 'Save'}
                </Button>
              </>
            )}
          </div>
          <Button variant='outline' onClick={closeFileViewer}>
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
