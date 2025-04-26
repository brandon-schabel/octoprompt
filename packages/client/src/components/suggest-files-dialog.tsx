import { useEffect, useState } from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@ui"
import { Button } from '@ui'
import { useSelectedFiles } from "@/hooks/utility-hooks/use-selected-files"
import { ProjectFile } from "@/hooks/generated"

type SuggestedFilesDialogProps = {
    open: boolean
    onClose: () => void
    suggestedFiles: ProjectFile[]
}

export function SuggestedFilesDialog({
    open,
    onClose,
    suggestedFiles,
}: SuggestedFilesDialogProps) {
    // Access the selectedFiles + ability to commit new selection
    const { selectedFiles, selectFiles } = useSelectedFiles()

    // Keep a local Set of IDs while this dialog is open
    const [localSelectedFiles, setLocalSelectedFiles] = useState<Set<string>>(new Set())

    // When the dialog *opens*, initialize local selection from the global store
    useEffect(() => {
        if (open) {
            setLocalSelectedFiles(new Set(selectedFiles))
        }
    }, [open, selectedFiles])

    // Toggles a single file in local state
    const toggleLocalFile = (fileId: string) => {
        setLocalSelectedFiles((prev) => {
            const next = new Set(prev)
            if (next.has(fileId)) {
                next.delete(fileId)
            } else {
                next.add(fileId)
            }
            return next
        })
    }

    // Toggle *all* suggested files in local state
    const handleSelectAll = () => {
        setLocalSelectedFiles((prev) => {
            const next = new Set(prev)
            // Check if all suggestions are already selected
            const allSelected = suggestedFiles.every((f) => next.has(f.id))

            if (allSelected) {
                // If all are selected, then deselect them
                suggestedFiles.forEach((f) => next.delete(f.id))
            } else {
                // Otherwise select them all
                suggestedFiles.forEach((f) => next.add(f.id))
            }
            return next
        })
    }

    // Commit local selection => global store, then close
    const handleDialogClose = () => {
        selectFiles([...localSelectedFiles]) // commit
        onClose()
    }

    return (
        <Dialog open={open} onOpenChange={handleDialogClose}>
            <DialogContent className="max-w-lg">
                <DialogHeader>
                    <DialogTitle>Recommended Files</DialogTitle>
                    <DialogDescription>
                        Based on your prompt, the system recommends:
                    </DialogDescription>
                </DialogHeader>

                <div className="mt-2 space-y-2 max-h-[300px] overflow-y-auto pr-2">
                    {suggestedFiles.map((file) => {
                        const isSelected = localSelectedFiles.has(file.id)
                        return (
                            <div key={file.id} className="flex items-center gap-2">
                                <input
                                    type="checkbox"
                                    checked={isSelected}
                                    onChange={() => toggleLocalFile(file.id)}
                                />
                                <div className="text-sm leading-tight break-all">
                                    <div className="font-medium">{file.name}</div>
                                    <div className="text-xs text-muted-foreground">{file.path}</div>
                                </div>
                            </div>
                        )
                    })}
                </div>

                <DialogFooter>
                    <Button variant="outline" onClick={handleDialogClose}>
                        Close
                    </Button>
                    <Button onClick={handleSelectAll}>
                        {suggestedFiles.every((file) => localSelectedFiles.has(file.id))
                            ? "Deselect All"
                            : "Select All"}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    )
}