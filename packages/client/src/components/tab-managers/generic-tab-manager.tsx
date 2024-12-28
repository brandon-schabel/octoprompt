import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Button } from '@/components/ui/button'
import {
    ContextMenu,
    ContextMenuContent,
    ContextMenuItem,
    ContextMenuTrigger,
} from '@/components/ui/context-menu'
import { Input } from '@/components/ui/input'
import { Plus } from 'lucide-react'
import { useState, useEffect } from 'react'
import { useHotkeys } from 'react-hotkeys-hook'

type GenericTabManagerProps = {
    /**
     * A record keyed by tabId with a displayName (or however your data is shaped)
     */
    tabs: Record<string, { displayName?: string }>;

    /** The currently active tab ID */
    activeTabId: string | null;

    /** If the WebSocket or other initialization is ready */
    isReady: boolean;

    /** Called when the user wants to create a new tab */
    onCreateTab: () => void;

    /** Called when the user selects a tab */
    onSetActiveTab: (tabId: string) => void;

    /** Called when a tab is renamed */
    onRenameTab: (tabId: string, newName: string) => void;

    /** Called when a tab is deleted */
    onDeleteTab: (tabId: string) => void;

    /**
     * Unique prefix for hotkeys so that project tabs
     * and chat tabs don’t clash, e.g. "t" or "c"
     */
    hotkeyPrefix: string;

    /** Button label for creating new tabs */
    newTabLabel?: string;

    /** Optional heading or placeholder for empty state */
    emptyMessage?: string;
};

export function GenericTabManager({
    tabs,
    activeTabId,
    isReady,
    onCreateTab,
    onSetActiveTab,
    onRenameTab,
    onDeleteTab,
    hotkeyPrefix,
    newTabLabel = 'New Tab',
    emptyMessage = 'No tabs yet.',
}: GenericTabManagerProps) {
    const [editingTabName, setEditingTabName] = useState<{ id: string; name: string } | null>(null)

    const tabIds = Object.keys(tabs ?? {})

    // Setup hotkeys
    for (let i = 1; i <= 9; i++) {
        useHotkeys(`${hotkeyPrefix}+${i}`, () => {
            const targetTabId = tabIds[i - 1]
            if (targetTabId) onSetActiveTab(targetTabId)
        })
    }

    // If not ready
    if (!isReady) {
        return <div>Connecting...</div>
    }

    // If no tabs exist
    if (tabIds.length === 0) {
        return (
            <div className="flex flex-col gap-2">
                <Button onClick={onCreateTab}>{`+ ${newTabLabel}`}</Button>
                <div className="text-sm text-muted-foreground">{emptyMessage}</div>
            </div>
        )
    }

    const handleRenameTab = (tabId: string, newName: string) => {
        onRenameTab(tabId, newName)
        setEditingTabName(null)
    }

    return (
        <Tabs
            value={activeTabId ?? ''}
            onValueChange={(val) => onSetActiveTab(val)}
            className="flex flex-col justify-start rounded-none"
        >
            <TabsList className="bg-background justify-start rounded-none">
                {tabIds.map((tabId, index) => {
                    const shortcutNumber = index + 1
                    const showShortcut = shortcutNumber <= 9
                    const displayName = tabs[tabId]?.displayName || tabId

                    return (
                        <ContextMenu key={tabId}>
                            <ContextMenuTrigger>
                                <TabsTrigger value={tabId} className="flex items-center gap-2">
                                    {editingTabName?.id === tabId ? (
                                        <Input
                                            value={editingTabName.name}
                                            onChange={(e) => setEditingTabName({ id: tabId, name: e.target.value })}
                                            onKeyDown={(e) => {
                                                if (e.key === 'Enter') {
                                                    handleRenameTab(tabId, editingTabName.name)
                                                }
                                                if (e.key === 'Escape') {
                                                    setEditingTabName(null)
                                                }
                                            }}
                                            onBlur={() => handleRenameTab(tabId, editingTabName.name)}
                                            className="h-6 w-24"
                                            autoFocus
                                        />
                                    ) : (
                                        <>
                                            <span>{displayName}</span>
                                            {showShortcut && (
                                                <span className="text-xs text-muted-foreground">
                                                    {shortcutNumber}
                                                </span>
                                            )}
                                        </>
                                    )}
                                </TabsTrigger>
                            </ContextMenuTrigger>
                            <ContextMenuContent>
                                <ContextMenuItem
                                    onClick={() =>
                                        setEditingTabName({
                                            id: tabId,
                                            name: displayName,
                                        })
                                    }
                                >
                                    Rename
                                </ContextMenuItem>
                                <ContextMenuItem
                                    onClick={() => onDeleteTab(tabId)}
                                    className="text-red-500 dark:text-red-400"
                                >
                                    Delete
                                </ContextMenuItem>
                            </ContextMenuContent>
                        </ContextMenu>
                    )
                })}

                {/* Button for creating new tabs */}
                <div>
                    <Button onClick={onCreateTab} size="icon" className="w-6 h-6 ml-2">
                        <Plus />
                    </Button>
                </div>
            </TabsList>
        </Tabs>
    )
}