import { useState, useEffect, useMemo } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@ui'
import { Button } from '@ui'
import {
  Edit,
  Save,
  XCircle,
  Copy,
  FileText,
  FileCode,
  Expand,
  Minimize2,
  History,
  RotateCcw,
  Clock
} from 'lucide-react'
import { LightAsync as SyntaxHighlighter } from 'react-syntax-highlighter'
import { Textarea } from '@ui'
import { MarkdownRenderer } from '@/components/markdown-renderer'
import { LazyMonacoEditor } from '@/components/lazy-monaco-editor'
import { useCopyClipboard } from '@/hooks/utility-hooks/use-copy-clipboard'
import { Switch } from '@ui'
import { useSelectSetting } from '@/hooks/use-kv-local-storage'
import { ProjectFile, FileVersion } from '@octoprompt/schemas'
import * as themes from 'react-syntax-highlighter/dist/esm/styles/hljs'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@ui'
import { DiffViewer } from '@/components/file-changes/diff-viewer'
import {
  useGetFileVersions,
  useGetFileVersion,
  useUpdateFileContent,
  useRevertFileToVersion
} from '@/hooks/api/use-projects-api'
import { Slider } from '@ui'

type FileViewerDialogProps = {
  open: boolean
  viewedFile?: ProjectFile
  markdownText?: string
  onClose?: () => void
  onSave?: (content: string) => void
  filePath?: string
  projectId?: number
}

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
  projectId
}: FileViewerDialogProps) {
  const [isEditingFile, setIsEditingFile] = useState(false)
  const [editedContent, setEditedContent] = useState<string>('')
  const [showRawMarkdown, setShowRawMarkdown] = useState(false)
  const [isFullscreen, setIsFullscreen] = useState(false)
  const [activeTab, setActiveTab] = useState<'edit' | 'history'>('edit')
  const [selectedHistoryVersion, setSelectedHistoryVersion] = useState<number | null>(null)
  const [showDiff, setShowDiff] = useState(false)

  const { copyToClipboard } = useCopyClipboard()
  const isDarkMode = useSelectSetting('theme') === 'dark'
  const codeThemeDark = useSelectSetting('codeThemeDark')
  const codeThemeLight = useSelectSetting('codeThemeLight')

  // File versioning hooks
  const originalFileId = viewedFile?.originalFileId || viewedFile?.id
  const { data: fileVersions, isLoading: versionsLoading } = useGetFileVersions(projectId || 0, originalFileId || 0)
  const { data: selectedVersionData } = useGetFileVersion(
    projectId || 0,
    originalFileId || 0,
    selectedHistoryVersion || undefined
  )
  const updateFileContent = useUpdateFileContent()
  const revertFileToVersion = useRevertFileToVersion()

  const selectedSyntaxTheme = useMemo(() => {
    const themeName = isDarkMode ? codeThemeDark : codeThemeLight
    // @ts-ignore
    return themes[themeName] ?? themes.atomOneLight
  }, [isDarkMode, codeThemeDark, codeThemeLight])

  useEffect(() => {
    if (open) {
      setIsEditingFile(false)
      setEditedContent(viewedFile?.content || markdownText || '')
      setIsFullscreen(false)
      setActiveTab('edit')
      setSelectedHistoryVersion(null)
      setShowDiff(false)
    }
  }, [viewedFile, markdownText, open])

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
    setActiveTab('edit')
    setSelectedHistoryVersion(null)
    setShowDiff(false)
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
    setIsEditingFile(false)
  }

  const handleRevertToVersion = (version: number) => {
    if (viewedFile && projectId) {
      revertFileToVersion.mutate({
        projectId,
        fileId: viewedFile.id,
        targetVersion: version
      })
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
          isFullscreen ? 'w-screen h-screen max-w-none max-h-none m-0 p-0 rounded-none' : 'max-w-4xl max-h-[80vh]'
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
        {/* Only show tabs for actual files with versioning capability */}
        {viewedFile && projectId ? (
          <Tabs
            value={activeTab}
            onValueChange={(value) => setActiveTab(value as 'edit' | 'history')}
            className='flex-1 flex flex-col min-h-0'
          >
            <TabsList className='grid w-full grid-cols-2'>
              <TabsTrigger value='edit' className='flex items-center gap-2'>
                <Edit className='h-4 w-4' />
                Edit
              </TabsTrigger>
              <TabsTrigger value='history' className='flex items-center gap-2'>
                <History className='h-4 w-4' />
                History
              </TabsTrigger>
            </TabsList>

            <TabsContent value='edit' className='flex-1 min-h-0 mt-4'>
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
            </TabsContent>

            <TabsContent value='history' className='flex-1 min-h-0 mt-4'>
              <div
                className={`flex-1 min-h-0 overflow-auto border rounded-md ${isFullscreen ? 'p-4 mx-4' : 'p-4'} space-y-4`}
              >
                {versionsLoading ? (
                  <div className='flex items-center justify-center p-8'>
                    <div className='text-muted-foreground'>Loading version history...</div>
                  </div>
                ) : fileVersions && fileVersions.data && fileVersions.data.length > 0 ? (
                  <>
                    <div className='flex items-center justify-between mb-4'>
                      <h3 className='text-lg font-semibold'>Version History</h3>
                      {!selectedHistoryVersion && (
                        <div className='text-sm text-muted-foreground'>
                          Click a version below to view its content or compare with current file
                        </div>
                      )}
                    </div>

                    {/* Version list */}
                    <div className='space-y-2 max-h-[200px] overflow-y-auto'>
                      {fileVersions.data.map((version) => (
                        <div
                          key={version.fileId}
                          className={`p-3 border rounded cursor-pointer hover:bg-muted/50 transition-colors ${
                            selectedHistoryVersion === version.version ? 'bg-muted border-primary' : ''
                          }`}
                          onClick={() => {
                            setSelectedHistoryVersion(version.version)
                            // Reset diff view when selecting a new version
                            setShowDiff(false)
                          }}
                        >
                          <div className='flex items-center justify-between'>
                            <div className='flex items-center gap-2'>
                              <Clock className='h-4 w-4 text-muted-foreground' />
                              <span className='font-medium'>Version {version.version}</span>
                              {version.isLatest && (
                                <span className='text-xs bg-green-100 text-green-800 px-2 py-1 rounded-full'>
                                  Latest
                                </span>
                              )}
                            </div>
                            <div className='flex items-center gap-2'>
                              <span className='text-sm text-muted-foreground'>
                                {new Date(version.created).toLocaleString()}
                              </span>
                              {!version.isLatest && (
                                <Button
                                  variant='outline'
                                  size='sm'
                                  onClick={(e) => {
                                    e.stopPropagation()
                                    handleRevertToVersion(version.version)
                                  }}
                                  disabled={revertFileToVersion.isPending}
                                >
                                  <RotateCcw className='h-3 w-3 mr-1' />
                                  Revert
                                </Button>
                              )}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>

                    {/* Instruction when no version is selected */}
                    {!selectedHistoryVersion && fileVersions?.data && fileVersions.data.length > 0 && (
                      <div className='mt-4 p-4 border border-dashed rounded-md text-center text-muted-foreground'>
                        <FileText className='h-6 w-6 mx-auto mb-2' />
                        <p className='text-sm'>Select a version from the list above to view its content</p>
                        <p className='text-xs mt-1'>You can then toggle between content view and diff view</p>
                      </div>
                    )}

                    {/* Content viewer for selected version */}
                    {selectedHistoryVersion && selectedVersionData?.data && (
                      <div className='mt-4'>
                        <div className='flex items-center justify-between mb-2'>
                          <h4 className='text-md font-medium'>
                            Version {selectedHistoryVersion} {showDiff ? 'vs Current File (Diff)' : 'Content'}
                          </h4>
                          <Button
                            variant='outline'
                            size='sm'
                            onClick={() => setShowDiff(!showDiff)}
                            className='flex items-center gap-2'
                          >
                            {showDiff ? (
                              <>
                                <FileText className='h-4 w-4' />
                                Show Content
                              </>
                            ) : (
                              <>
                                <FileCode className='h-4 w-4' />
                                Show Diff
                              </>
                            )}
                          </Button>
                        </div>
                        {showDiff && viewedFile ? (
                          <div className='border rounded-md p-2'>
                            <div className='text-sm text-muted-foreground mb-2 px-2 py-1 bg-muted/30 rounded'>
                              Comparing Version {selectedHistoryVersion} (left) with Current File (right)
                            </div>
                            <DiffViewer oldValue={selectedVersionData.data.content} newValue={viewedFile.content} />
                          </div>
                        ) : (
                          <div className='border rounded-md p-2 max-h-[300px] overflow-auto'>
                            <div className='text-sm text-muted-foreground mb-2 px-2 py-1 bg-muted/30 rounded'>
                              Viewing Version {selectedHistoryVersion} content
                            </div>
                            {/* @ts-ignore */}
                            <SyntaxHighlighter
                              language={getLanguageByExtension(viewedFile?.extension)}
                              style={selectedSyntaxTheme}
                              showLineNumbers
                              wrapLongLines
                            >
                              {selectedVersionData.data.content}
                            </SyntaxHighlighter>
                          </div>
                        )}
                      </div>
                    )}
                  </>
                ) : (
                  <div className='flex items-center justify-center p-8'>
                    <div className='text-muted-foreground'>No version history available</div>
                  </div>
                )}
              </div>
            </TabsContent>
          </Tabs>
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
            {/* Only show edit controls for files with versioning and on edit tab */}
            {viewedFile && projectId && activeTab === 'edit' && !isEditingFile && (
              <Button variant='outline' onClick={() => setIsEditingFile(true)}>
                <Edit className='mr-2 h-4 w-4' />
                Edit
              </Button>
            )}
            {/* Show edit controls for non-versioned files */}
            {viewedFile && !projectId && !isEditingFile && (
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
