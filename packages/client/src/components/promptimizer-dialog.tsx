import { useEffect } from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@ui"
import { Button } from '@ui'

interface PromptimizerDialogProps {
    open: boolean
    onClose: () => void
    optimizedPrompt: string
    onUpdatePrompt?: (newPrompt: string) => void
}

export function PromptimizerDialog({
    open,
    onClose,
    optimizedPrompt,
    onUpdatePrompt,
}: PromptimizerDialogProps) {

    useEffect(() => {
    }, [open])

    const handleUpdatePrompt = () => {
        if (!optimizedPrompt.trim()) return
        onUpdatePrompt?.(optimizedPrompt)
        onClose()
    }

    return (
        <Dialog open={open} onOpenChange={onClose}>
            <DialogContent className="max-w-lg">
                <DialogHeader>
                    <DialogTitle>Optimized Prompt</DialogTitle>
                    <DialogDescription>
                        Promptimizer suggests the following improvements:
                    </DialogDescription>
                </DialogHeader>

                <div className="mt-2 space-y-2">
                    <textarea
                        className="w-full h-40 p-2 border rounded focus:outline-none text-sm"
                        readOnly
                        value={optimizedPrompt}
                    />
                </div>

                <DialogFooter>
                    <Button variant="outline" onClick={onClose}>
                        Close
                    </Button>
                    <Button onClick={handleUpdatePrompt}>
                        Update Prompt
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    )
}