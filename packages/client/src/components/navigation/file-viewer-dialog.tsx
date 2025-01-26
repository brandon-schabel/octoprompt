import { useState, useEffect } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Edit, Save, XCircle } from 'lucide-react'
import { LightAsync as SyntaxHighlighter } from 'react-syntax-highlighter'
import * as themes from 'react-syntax-highlighter/dist/esm/styles/hljs'
import { Textarea } from '@/components/ui/textarea'
import { ProjectFile } from 'shared/schema'
import { MarkdownRenderer } from '@/components/markdown-renderer'
import { useCopyClipboard } from '@/hooks/utility-hooks/use-copy-clipboard'
import { Switch } from '@/components/ui/switch'
import { useSettings } from '../global-state/websocket-selector-hoooks'

type FileViewerDialogProps = {
    open: boolean
    viewedFile?: ProjectFile | null
    markdownText?: string
    onClose?: () => void
    onSave?: (content: string) => void
}

function getLanguageByExtension(extension?: string): string {
    if (!extension) return 'plaintext'
    switch (extension) {
        case '.ts':
        case '.tsx':
            return 'typescript'
        case '.js':
        case '.jsx':
            return 'javascript'
        case '.md':
        case '.txt':
            return 'markdown'
        default:
            return 'plaintext'
    }
}

export function FileViewerDialog({
    open,
    viewedFile,
    markdownText: markdownText,
    onClose,
    onSave
}: FileViewerDialogProps) {
    const [isEditingFile, setIsEditingFile] = useState(false)
    const [editedContent, setEditedContent] = useState<string>('')
    const [showRawMarkdown, setShowRawMarkdown] = useState(false)
    const settings = useSettings()

    const isDarkMode = settings?.theme === "dark"
    // @ts-ignore
    const selectedTheme = isDarkMode ? themes[settings?.codeThemeDark] : themes[settings?.codeThemeLight]
    const { copyToClipboard } = useCopyClipboard()

    useEffect(() => {
        if (open) {
            setIsEditingFile(false)
            setEditedContent(viewedFile?.content || markdownText || '')
        }
    }, [viewedFile, markdownText, open])

    const closeFileViewer = () => {
        setIsEditingFile(false)
        setEditedContent('')
        onClose?.()
    }

    const saveFileEdits = () => {
        if (viewedFile && editedContent !== viewedFile.content) {
            onSave?.(editedContent)
        }
        setIsEditingFile(false)
    }


    if (!viewedFile && !markdownText) return null

    return (
        <Dialog open={open} onOpenChange={(o) => { if (!o) closeFileViewer() }}>
            <DialogContent className="max-w-4xl max-h-[80vh] overflow-auto flex flex-col">
                <DialogHeader>
                    <DialogTitle>{viewedFile?.path || 'Text View'}</DialogTitle>
                    <DialogDescription className="flex items-center justify-between">
                        <span>{isEditingFile ? 'Editing mode' : 'View mode'}</span>
                        {markdownText && !isEditingFile && (
                            <div className="flex items-center gap-2">
                                <span className="text-sm">Show Raw</span>
                                <Switch
                                    checked={showRawMarkdown}
                                    onCheckedChange={setShowRawMarkdown}
                                />
                            </div>
                        )}
                    </DialogDescription>
                </DialogHeader>
                <div className="flex-1 min-h-0 overflow-auto border rounded-md p-2">
                    {!isEditingFile ? (
                        markdownText ? (
                            showRawMarkdown ? (
                                <div className="relative my-2 overflow-x-auto break-words">
                                    <button
                                        onClick={() => copyToClipboard(markdownText)}
                                        className={`
                                            absolute top-2 right-2 text-xs px-2 py-1 border rounded shadow z-10
                                            ${isDarkMode
                                                ? "bg-neutral-800 text-neutral-100 hover:bg-neutral-700"
                                                : "bg-neutral-50 text-neutral-900 hover:bg-neutral-200"
                                            }
                                        `}
                                        title="Copy code"
                                    >
                                        Copy
                                    </button>
                                    {/* @ts-ignore */}
                                    <SyntaxHighlighter
                                        language="markdown"
                                        style={selectedTheme}
                                        showLineNumbers
                                        wrapLongLines
                                    >
                                        {markdownText}
                                    </SyntaxHighlighter>
                                </div>
                            ) : (
                                <MarkdownRenderer
                                    content={markdownText}
                                    isDarkMode={isDarkMode}
                                    themeStyle={selectedTheme}
                                    copyToClipboard={copyToClipboard}
                                />
                            )
                        ) : (
                            // @ts-ignore
                            <SyntaxHighlighter
                                language={getLanguageByExtension(viewedFile?.extension)}
                                style={selectedTheme}
                                showLineNumbers
                                wrapLongLines
                            >
                                {viewedFile?.content || ''}
                            </SyntaxHighlighter>
                        )
                    ) : (
                        <Textarea
                            value={editedContent}
                            onChange={(e) => setEditedContent(e.target.value)}
                            className="w-full h-full min-h-[300px]"
                        />
                    )}
                </div>
                <DialogFooter className="mt-4 flex justify-between">
                    <div className="flex gap-2">
                        {!isEditingFile && viewedFile && (
                            <Button variant="outline" onClick={() => setIsEditingFile(true)}>
                                <Edit className="mr-2 h-4 w-4" />
                                Edit
                            </Button>
                        )}
                        {isEditingFile && (
                            <>
                                <Button variant="outline" onClick={() => {
                                    setIsEditingFile(false)
                                    setEditedContent(viewedFile?.content || '')
                                }}>
                                    <XCircle className="mr-2 h-4 w-4" />
                                    Cancel
                                </Button>
                                <Button variant="default" onClick={saveFileEdits}>
                                    <Save className="mr-2 h-4 w-4" />
                                    Save
                                </Button>
                            </>
                        )}
                    </div>
                    <Button variant="outline" onClick={closeFileViewer}>
                        Close
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    )
}