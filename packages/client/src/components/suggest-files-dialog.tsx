import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { ProjectFile } from "shared";
import { type UseSelectedFileReturn } from "@/hooks/utility-hooks/use-selected-files";
import { useState, useEffect } from "react";

type SuggestedFilesDialogProps = {
    open: boolean;
    onClose: () => void;
    suggestedFiles: ProjectFile[];
    selectedFilesState: UseSelectedFileReturn;
};

export function SuggestedFilesDialog({
    open,
    onClose,
    suggestedFiles,
    selectedFilesState
}: SuggestedFilesDialogProps) {
    const { selectedFiles, selectFiles } = selectedFilesState;
    
    // Local state for dialog selections
    const [localSelectedFiles, setLocalSelectedFiles] = useState<Set<string>>(new Set());

    // Initialize local state when dialog opens
    useEffect(() => {
        if (open) {
            setLocalSelectedFiles(new Set(selectedFiles));
        }
    }, [open, selectedFiles]);

    // Toggle a single file in local state
    const toggleLocalFile = (fileId: string) => {
        setLocalSelectedFiles(prev => {
            const next = new Set(prev);
            if (next.has(fileId)) {
                next.delete(fileId);
            } else {
                next.add(fileId);
            }
            return next;
        });
    };

    // Toggle all suggested files in local state
    const handleSelectAll = () => {
        setLocalSelectedFiles(prev => {
            const next = new Set(prev);
            const allSelected = suggestedFiles.every(file => next.has(file.id));
            
            if (allSelected) {
                // Deselect all suggested files
                suggestedFiles.forEach(file => next.delete(file.id));
            } else {
                // Select all suggested files
                suggestedFiles.forEach(file => next.add(file.id));
            }
            
            return next;
        });
    };

    // Commit changes and close dialog
    const handleClose = () => {
        selectFiles([...localSelectedFiles]);
        onClose();
    };

    return (
        <Dialog open={open} onOpenChange={handleClose}>
            <DialogContent className="max-w-lg">
                <DialogHeader>
                    <DialogTitle>Recommended Files</DialogTitle>
                    <DialogDescription>
                        Based on your prompt, the system recommends:
                    </DialogDescription>
                </DialogHeader>

                <div className="mt-2 space-y-2 max-h-[300px] overflow-y-auto pr-2">
                    {suggestedFiles.map((file) => {
                        const isSelected = localSelectedFiles.has(file.id);
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
                        );
                    })}
                </div>

                <DialogFooter>
                    <Button variant="outline" onClick={handleClose}>
                        Close
                    </Button>
                    <Button onClick={handleSelectAll}>
                        {suggestedFiles.every(file => localSelectedFiles.has(file.id)) 
                            ? "Deselect All" 
                            : "Select All"}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}