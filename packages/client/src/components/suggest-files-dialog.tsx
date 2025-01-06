// packages/client/src/components/suggest-files-dialog.tsx
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { ProjectFile } from "shared"
import { useSelectedFiles } from "@/hooks/use-selected-files"

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
    // Pull in our history-aware selection methods and current selection
    const { selectedFiles, toggleFile, toggleFiles } = useSelectedFiles()

    // (Optional) “Select All” just toggles all suggestions
    function handleSelectAll() {
        toggleFiles(suggestedFiles.map((file) => file.id))
    }

    return (
        <Dialog open={open} onOpenChange={onClose}>
            <DialogContent className="max-w-lg">
                <DialogHeader>
                    <DialogTitle>Recommended Files</DialogTitle>
                    <DialogDescription>
                        Based on your prompt, the system recommends:
                    </DialogDescription>
                </DialogHeader>

                <div className="mt-2 space-y-2 max-h-[300px] overflow-y-auto pr-2">
                    {suggestedFiles.map((file) => {
                        const isSelected = selectedFiles.includes(file.id)
                        return (
                            <div key={file.id} className="flex items-center gap-2">
                                <input
                                    type="checkbox"
                                    checked={isSelected}
                                    onChange={() => toggleFile(file.id)}
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
                    <Button variant="outline" onClick={onClose}>
                        Close
                    </Button>
                    <Button onClick={handleSelectAll}>Select All</Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    )
}