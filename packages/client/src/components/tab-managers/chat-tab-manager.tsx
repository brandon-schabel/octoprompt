import { useGlobalStateContext } from '../global-state-context'
import { GenericTabManager } from './generic-tab-manager'

export function ChatTabManager() {
    const {
        state,
        wsReady,
        createChatTab,
        setActiveChatTab,
        updateChatTab,
        deleteChatTab,
    } = useGlobalStateContext()

    const tabs = state?.chatTabs ?? {}
    const activeTabId = state?.chatActiveTabId ?? null

    return (
        <GenericTabManager
            // @ts-ignore - TODO: fix types, need to make sure the link icon is not specific to projects
            tabs={tabs}
            activeTabId={activeTabId}
            isReady={wsReady}
            onCreateTab={createChatTab}
            onSetActiveTab={setActiveChatTab}
            onRenameTab={(tabId, newName) => updateChatTab(tabId, { displayName: newName })}
            onDeleteTab={deleteChatTab}
            hotkeyPrefix="c"
            newTabLabel="New Chat Tab"
            emptyMessage="No chat tabs yet."
            className='border-b'
            title='Chat Tabs'
        />
    )
}