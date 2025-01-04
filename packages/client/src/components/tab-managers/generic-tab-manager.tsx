import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Button } from '@/components/ui/button'
import {
    ContextMenu,
    ContextMenuContent,
    ContextMenuItem,
    ContextMenuTrigger,
} from '@/components/ui/context-menu'
import { Input } from '@/components/ui/input'
import { LinkIcon, Plus } from 'lucide-react'
import { useState, useEffect } from 'react'
import { useHotkeys } from 'react-hotkeys-hook'
import { cn } from '@/lib/utils'

type GenericTabManagerProps = {
    /**
     * A record keyed by tabId with a displayName (or however your data is shaped)
     */
    tabs: Record<string, { displayName?: string, linkedProjectTabId?: string }>;

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
     * and chat tabs don't clash, e.g. "t" or "c"
     */
    hotkeyPrefix: string;

    /** Button label for creating new tabs */
    newTabLabel?: string;

    /** Optional heading or placeholder for empty state */
    emptyMessage?: string;

    /** Whether the tab has a link to a project tab */
    hasLink?: boolean;

    /** Optional className for custom styling */
    className?: string;

    /** Optional title to display before the tabs */
    title?: string;
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
    className,
    title,
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
            className={cn("flex flex-col justify-start rounded-none", className)}
        >
            <TabsList className="bg-background justify-start rounded-none">
                {title && <div className="text-xs lg:text-sm px-3 font-semibold flex items-center">{title}</div>}
                {tabIds.map((tabId, index) => {
                    const shortcutNumber = index + 1
                    const showShortcut = shortcutNumber <= 9
                    const displayName = tabs[tabId]?.displayName || tabId
                    const currentTabData = tabs[tabId]
                    const hasLink = !!currentTabData?.linkedProjectTabId
                    // const linkedProject = currentTabData?.linkedProjectTabId ? state?.projectTabs[currentTabData?.linkedProjectTabId] : null
                    return (
                        <ContextMenu key={tabId}>
                            <ContextMenuTrigger>
                                <TabsTrigger value={tabId} className={cn(
                                    "flex items-center gap-2",
                                    "data-[state=active]:bg-indigo-100 dark:data-[state=active]:bg-indigo-950/50",
                                    "data-[state=active]:text-indigo-600 dark:data-[state=active]:text-indigo-400"
                                )}>
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
                                        <div className="flex items-center gap-2">
                                            <span>{displayName}</span>
                                            <span>{hasLink ? <LinkIcon className="h-4 w-4" /> : ''}</span>
                                            {showShortcut && (
                                                <span className="text-xs text-muted-foreground">
                                                    {shortcutNumber}
                                                </span>
                                            )}
                                        </div>
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