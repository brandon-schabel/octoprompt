import { useHotkeys } from "react-hotkeys-hook"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@ui"
import { Badge } from '@ui'
import { ScrollArea } from "@ui"
import { AppShortcutDisplay, ShortcutDisplay } from "../app-shortcut-display"
import { useActiveChatId, useAppSettings, useSelectSetting } from "@/hooks/api/use-kv-api"

export type HelpDialogProps = {
    open?: boolean
    onOpenChange?: (open: boolean) => void
}

export function HelpDialog({ open = false, onOpenChange }: HelpDialogProps) {
    const [activeChatId] = useActiveChatId();

    // Get model info from global settings
    const provider = useSelectSetting('provider');
    const model = useSelectSetting('model');

    // Toggle help dialog with mod + /
    useHotkeys("mod+/", (e) => {
        e.preventDefault()
        onOpenChange?.(!open)
    })

    if (!activeChatId) return null

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-h-[80vh] overflow-y-auto">
                <DialogHeader>
                    <DialogTitle>Keyboard Shortcuts</DialogTitle>
                </DialogHeader>
                <ScrollArea className="h-full pr-4">
                    <div className="space-y-2 p-4">
                        <h3 className="font-semibold mb-2">Global Navigation</h3>
                        <p><AppShortcutDisplay shortcut="open-command-palette" />: Open command palette</p>
                        <p><AppShortcutDisplay shortcut="open-help" />: Open this help</p>
                        <p><AppShortcutDisplay shortcut="focus-file-search" />: Focus file search</p>
                        <p><AppShortcutDisplay shortcut="focus-file-tree" />: Focus file tree</p>
                        <p><AppShortcutDisplay shortcut="focus-prompts" />: Focus prompts</p>
                        <p><AppShortcutDisplay shortcut="focus-prompt-input" />: Focus prompt input</p>

                        <h3 className="font-semibold mt-4 mb-2">File Search & Autocomplete</h3>
                        <p><ShortcutDisplay shortcut={['up', 'down']} delimiter=" / "></ShortcutDisplay>: Navigate through suggestions</p>
                        <p><ShortcutDisplay shortcut={['enter', 'space']} delimiter=" / " />: Select highlighted file</p>
                        <p><ShortcutDisplay shortcut={['right']} />: Preview highlighted file</p>
                        <p><AppShortcutDisplay shortcut="close-suggestions" />: Close suggestions</p>

                        <h3 className="font-semibold mt-4 mb-2">File Tree Navigation</h3>
                        <p><ShortcutDisplay shortcut={['up', 'down']} delimiter=" / " />: Navigate items</p>
                        <p><ShortcutDisplay shortcut={['left', 'right']} delimiter=" / " />: Collapse/Expand folders</p>
                        <p><AppShortcutDisplay shortcut="select-file" />: Toggle file/folder selection</p>
                        <p><AppShortcutDisplay shortcut="select-folder" />: View file or toggle folder</p>

                        <h3 className="font-semibold mt-4 mb-2">Selected Files</h3>
                        <p><ShortcutDisplay shortcut={['r', '[1-9]']} />: Remove file from selected list</p>
                        <p><ShortcutDisplay shortcut={['delete', 'backspace']} delimiter=" / " />: Remove file</p>

                        <h3 className="font-semibold mt-4 mb-2">General Controls</h3>
                        <p><AppShortcutDisplay shortcut="undo" />: Undo</p>
                        <p><AppShortcutDisplay shortcut="redo" />: Redo</p>

                        <h3 className="font-semibold mt-4 mb-2">Selected LLM Provider and Model IDs</h3>
                        {provider && (
                            <p>
                                <Badge>{provider}</Badge>: {model}
                            </p>
                        )}
                    </div>
                </ScrollArea>
            </DialogContent>
        </Dialog>
    )
}