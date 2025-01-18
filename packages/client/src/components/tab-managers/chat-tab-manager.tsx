import { useGlobalStateHelpers } from '../global-state/use-global-state-helpers'
import { GenericTabManager } from './generic-tab-manager'
import { ShortcutDisplay } from '../app-shortcut-display'
import { Input } from '../ui/input'
import { Button } from '../ui/button'
import { Pencil, Trash2 } from 'lucide-react'
import { type ReactNode } from 'react'

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
    provider: "openai" | "openrouter" | "lmstudio" | "ollama" | "xai" | "google_gemini" | "anthropic" | "groq" | "together";
    model: string;
    input: string;
    messages: { id: string; role: "system" | "user" | "assistant"; content: string; }[];
    displayName?: string;
    lmStudioUrl?: string;
}

export function ChatTabManager() {
    const {
        state,
        isOpen,
        createChatTab,
        setActiveChatTab,
        updateChatTab,
        deleteChatTab,
        updateSettings
    } = useGlobalStateHelpers()

    const tabs = state?.chatTabs ?? {}
    const activeTabId = state?.chatActiveTabId ?? null

    const tabOrder = state?.settings.chatTabIdOrder
        ? state.settings.chatTabIdOrder
        : Object.keys(tabs)

    // When user reorders the tabs, store that array in global state:
    const handleTabOrderChange = (newOrder: string[]) => {
        if (activeTabId) {
            updateSettings({
                chatTabIdOrder: newOrder
            })
        }
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
            tabs={tabs}
            activeTabId={activeTabId}
            isReady={isOpen}
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
                        Chat Tabs allow you to use different settings between different chat sessions.
                        Provider and Model settings are saved on the tab, and not the individual chats.
                        You can access your different chats by clicking the floating chat icon. You can click and drag
                        the tabs to reorder them.
                    </p>
                    {shortcutInfo}
                </div>
            }
            tabOrder={tabOrder}
            onTabOrderChange={handleTabOrderChange}
            renderDialogContent={renderDialogContent}
        />
    )
}