import { useCreateChatTab, useSetActiveChatTab, useUpdateChatTab, useDeleteChatTab } from '@/websocket-state/hooks/updaters/websocket-updater-hooks'
import { GenericTabManager } from './generic-tab-manager'
import { ShortcutDisplay } from '../app-shortcut-display'
import { Input } from '../ui/input'
import { Button } from '../ui/button'
import { Pencil, Trash2 } from 'lucide-react'
import { type ReactNode } from 'react'
import { useActiveChatTab, useAllChatTabs } from '@/websocket-state/hooks/selectors/websocket-selectors'

type DialogContentProps = {
    tabId: string;
    isEditing: boolean;
    displayName: string;
    dialogEditingName: string;
    setDialogEditingName: (name: string) => void;
    startDialogRename: (tabId: string) => void;
    saveDialogRename: () => void;
    onDeleteTab: (tabId: string) => void;
}

type ChatTab = {
    provider: string;
    model: string;
    input: string;
    messages: { id: string; role: string; content: string }[];
    displayName?: string;
    lmStudioUrl?: string;
    sortOrder?: number;
}

export function ChatTabManager() {
    const { id: activeTabId } = useActiveChatTab()
    const createChatTab = useCreateChatTab()
    const setActiveChatTab = useSetActiveChatTab()
    const updateChatTab = useUpdateChatTab()
    const deleteChatTab = useDeleteChatTab()
    const tabs = useAllChatTabs()

    // Sort tabs by sortOrder
    const tabIdsSorted = Object.keys(tabs).sort((a, b) => {
        const orderA = tabs[a].sortOrder ?? 0
        const orderB = tabs[b].sortOrder ?? 0
        return orderA - orderB
    })

    const handleTabOrderChange = (newOrder: string[]) => {
        console.debug('[ChatTabManager] handleTabOrderChange ->', newOrder)
        newOrder.forEach((tabId, index) => {
            updateChatTab(tabId, { sortOrder: index })
        })
    }

    const shortcutInfo = (
        <ul>
            <li>Navigate between tabs:</li>
            <li>- Next tab: <ShortcutDisplay shortcut={['c', 'tab']} /></li>
            <li>- Previous tab: <ShortcutDisplay shortcut={['c', 'shift', 'tab']} /></li>
            <li>- Quick switch: <ShortcutDisplay shortcut={['c', '[1-9]']} /></li>
        </ul>
    )

    const renderDialogContent = ({
        tabId,
        isEditing,
        displayName,
        dialogEditingName,
        setDialogEditingName,
        startDialogRename,
        saveDialogRename,
        onDeleteTab,
    }: DialogContentProps): ReactNode => {
        const tab = tabs[tabId]
        const provider = tab?.provider || 'Not set'
        const model = tab?.model || 'Not set'

        return (
            <div
                key={tabId}
                className="group flex items-center justify-between gap-3 px-2 py-1 rounded hover:bg-accent/20"
            >
                {/* Left side: name and settings */}
                <div className="flex flex-col truncate">
                    {isEditing ? (
                        <Input
                            value={dialogEditingName}
                            onChange={(e) => setDialogEditingName(e.target.value)}
                            onKeyDown={(e) => {
                                if (e.key === 'Enter') saveDialogRename()
                                if (e.key === 'Escape') {
                                    setDialogEditingName('')
                                }
                            }}
                            autoFocus
                        />
                    ) : (
                        <span className="truncate font-medium">
                            {displayName}
                        </span>
                    )}
                    <div className="text-xs text-muted-foreground space-y-1">
                        <div>Provider: {provider}</div>
                        <div>Model: {model}</div>
                    </div>
                </div>

                {/* Right side: rename/delete icons */}
                <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition">
                    {isEditing ? (
                        <Button
                            variant="ghost"
                            size="icon"
                            className="h-6 w-6"
                            onClick={saveDialogRename}
                            title="Save"
                        >
                            <Pencil className="h-3 w-3" />
                        </Button>
                    ) : (
                        <Button
                            variant="ghost"
                            size="icon"
                            className="h-6 w-6"
                            onClick={() => startDialogRename(tabId)}
                            title="Rename"
                        >
                            <Pencil className="h-3 w-3" />
                        </Button>
                    )}

                    <Button
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6 text-red-500 dark:text-red-400 hover:text-red-600 dark:hover:text-red-300"
                        onClick={() => onDeleteTab(tabId)}
                        title="Delete"
                    >
                        <Trash2 className="h-3 w-3" />
                    </Button>
                </div>
            </div>
        )
    }

    return (
        <GenericTabManager<ChatTab>
            tabs={tabs as Record<string, ChatTab>}
            activeTabId={activeTabId ?? null}
            onCreateTab={createChatTab}
            onSetActiveTab={setActiveChatTab}
            onRenameTab={(tabId, newName) => updateChatTab(tabId, { displayName: newName })}
            onDeleteTab={deleteChatTab}
            hotkeyPrefix="c"
            newTabLabel="New Chat Tab"
            emptyMessage="No chat tabs yet."
            className="border-b"
            title="Chat Tabs"
            titleTooltip={
                <div className="space-y-2">
                    <p>
                        Chat Tabs store your conversation settings. Drag to reorder, or use the shortcuts below.
                    </p>
                    {shortcutInfo}
                </div>
            }
            tabOrder={tabIdsSorted}
            onTabOrderChange={handleTabOrderChange}
            renderDialogContent={renderDialogContent}
        />
    )
}