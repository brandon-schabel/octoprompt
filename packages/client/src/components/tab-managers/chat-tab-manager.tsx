import { useGlobalStateHelpers } from '../global-state/use-global-state-helpers'
import { GenericTabManager } from './generic-tab-manager'

export function ChatTabManager() {
    const {
        state,
        isOpen,
        createChatTab,
        setActiveChatTab,
        updateChatTab,
        deleteChatTab,
    } = useGlobalStateHelpers()

    const tabs = state?.chatTabs ?? {}
    const activeTabId = state?.chatActiveTabId ?? null

    return (
        <GenericTabManager
            // @ts-ignore - TODO: fix types, need to make sure the link icon is not specific to projects
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
            className='border-b'
            title='Chat Tabs'
            titleTooltip="Chat Tabs allow you to use different settings between different chat sessions. 
            Provider and Model settings are saved on the tab, and not the individual chats. 
            You can access your different chats by clicking the floating chat icon.
            "
        />
    )
}