import { useState, useEffect } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Edit, Save, XCircle } from 'lucide-react'
import { LightAsync as SyntaxHighlighter } from 'react-syntax-highlighter'
import { atomOneLight } from 'react-syntax-highlighter/dist/esm/styles/hljs'
import { Textarea } from './ui/textarea'
import { ProjectFile } from 'shared/schema'

type FileViewerDialogProps = {
    open: boolean
    viewedFile: ProjectFile | null
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
    onClose,
    onSave
}: FileViewerDialogProps) {
    const [isEditingFile, setIsEditingFile] = useState(false)
    const [editedContent, setEditedContent] = useState<string>('')

    useEffect(() => {
        if (viewedFile && open) {
            setIsEditingFile(false)
            setEditedContent(viewedFile.content || '')
        }
    }, [viewedFile, open])

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

    if (!viewedFile) return null

    return (
        <Dialog open={open} onOpenChange={(o) => { if (!o) closeFileViewer() }}>
            <DialogContent className="max-w-4xl max-h-[80vh] overflow-auto flex flex-col">
                <DialogHeader>
                    <DialogTitle>{viewedFile.path}</DialogTitle>
                    <DialogDescription>
                        {isEditingFile ? 'Editing mode' : 'View mode'}
                    </DialogDescription>
                </DialogHeader>
                <div className="flex-1 min-h-0 overflow-auto border rounded-md p-2">
                    {!isEditingFile ? (
                        <SyntaxHighlighter
                            language={getLanguageByExtension(viewedFile.extension)}
                            style={atomOneLight}
                            showLineNumbers
                            wrapLongLines
                        >
                            {viewedFile.content || ''}
                        </SyntaxHighlighter>
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
                        {!isEditingFile ? (
                            <Button variant="outline" onClick={() => setIsEditingFile(true)}>
                                <Edit className="mr-2 h-4 w-4" />
                                Edit
                            </Button>
                        ) : (
                            <>
                                <Button variant="outline" onClick={() => {
                                    setIsEditingFile(false)
                                    setEditedContent(viewedFile.content || '')
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