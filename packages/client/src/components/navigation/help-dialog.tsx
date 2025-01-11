import { useHotkeys } from "react-hotkeys-hook"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { formatModShortcut, getModKeySymbol } from "@/lib/platform"
import { Badge } from "@/components/ui/badge"
import { useGlobalStateHelpers } from "@/components/global-state/use-global-state-helpers"

export type HelpDialogProps = {
    open?: boolean
    onOpenChange?: (open: boolean) => void
}

export function HelpDialog({ open = false, onOpenChange }: HelpDialogProps) {
    // const chatTabState = useCurrentChatTabState();
    const { state } = useGlobalStateHelpers()
    useHotkeys("mod+/", (e) => {
        e.preventDefault()
        onOpenChange?.(!open)
    })

    const chatTabStateTabId = state.chatActiveTabId

    if (!chatTabStateTabId) return null
    const chatTabState = chatTabStateTabId && state.chatTabs[chatTabStateTabId]


    if (!chatTabState) return null


    const { provider, model, } = chatTabState



    const modKey = getModKeySymbol()

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>Keyboard Shortcuts</DialogTitle>
                </DialogHeader>
                <div className="space-y-2 p-4">
                    <h3 className="font-semibold mb-2">Global Navigation</h3>
                    <p><Badge>{formatModShortcut('k')}</Badge>: Open command palette</p>
                    <p><Badge> {formatModShortcut('/')}</Badge>: Open this help</p>
                    <p><Badge>{formatModShortcut('f')}</Badge> Focus file search</p>
                    <p><Badge>{formatModShortcut('g')}</Badge> Focus file tree</p>
                    <p><Badge>{formatModShortcut('p')}</Badge> Focus prompts</p>
                    <p><Badge>{formatModShortcut('i')}</Badge> Focus prompt input</p>
                    <p><Badge>V</Badge>: Toggle voice input</p>

                    <h3 className="font-semibold mt-4 mb-2">File Tree Navigation</h3>
                    <p><Badge>↑/↓</Badge>: Navigate files and folders</p>
                    <p><Badge>←/→</Badge>: Collapse/Expand folders</p>
                    <p><Badge>Space</Badge>: Toggle file/folder selection</p>
                    <p><Badge>Enter</Badge>: View file or toggle folder</p>

                    <h3 className="font-semibold mt-4 mb-2">Tab Management</h3>
                    <p><Badge>t + [1-9]</Badge>: Switch to tab</p>

                    <h3 className="font-semibold mt-4 mb-2">Selected Files</h3>
                    <p><Badge>r + [1-9]</Badge>: Remove file from selected list</p>
                    <p><Badge>Delete</Badge>: Remove file from selected list</p>
                    <p><Badge>Backspace</Badge>: Remove file from selected list</p>


                    <h3 className="font-semibold mt-4 mb-2">General Controls</h3>
                    <p><Badge>{formatModShortcut('z')}</Badge>: Undo</p>
                    <p><Badge>{modKey} + ⇧ + Z</Badge>: Redo</p>

                    <h3 className="font-semibold mt-4 mb-2">Selected LLM Provider and Model IDs</h3>
                    {provider && <p><Badge>{provider}</Badge>: {model}</p>}
                </div>
            </DialogContent>
        </Dialog>
    )
}
