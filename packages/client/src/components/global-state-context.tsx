import { createContext, useContext } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useRef, useState } from 'react';
import {
    globalStateSchema,
    GlobalState,
    createInitialGlobalState,
    ProjectTabState,
    ChatTabState,
    LinkSettings,
    linkSettingsSchema,
} from 'shared';
import { SERVER_HTTP_ENDPOINT, SERVER_WS_ENDPOINT } from '@/constants/server-constants';
import { v4 as uuidv4 } from 'uuid';

export type PartialOrFn<T> = Partial<T> | ((prev: T) => Partial<T>);

export type UseGlobalStateReturn = {
    // The entire state
    state: GlobalState | undefined;
    wsReady: boolean;

    /** Generic Updaters */
    updateGlobalStateKey: <K extends keyof GlobalState>(
        key: K,
        partialOrFn: PartialOrFn<GlobalState[K]>
    ) => void;
    updateSettings: (partialOrFn: PartialOrFn<GlobalState['settings']>) => void;

    /** Project tabs */
    createProjectTab: () => void;
    setActiveProjectTab: (tabId: string) => void;
    updateProjectTab: (tabId: string, partial: Partial<ProjectTabState>) => void;
    deleteProjectTab: (tabId: string) => void;
    updateActiveProjectTab: (partialOrFn: PartialOrFn<ProjectTabState>) => void;
    updateProjectTabState: (tabId: string, partialOrFn: PartialOrFn<ProjectTabState>) => void;

    /** Chat tabs */
    createChatTab: (options?: {
        cleanTab?: boolean;
        model?: string;
        provider?: string;
        title?: string;
    }) => void;
    setActiveChatTab: (tabId: string) => void;
    updateChatTab: (tabId: string, partial: Partial<ChatTabState>) => void;
    deleteChatTab: (tabId: string) => void;
    updateActiveChatTab: (partialOrFn: PartialOrFn<ChatTabState>) => void;
    updateChatTabState: (tabId: string, partialOrFn: PartialOrFn<ChatTabState>) => void;

    /** Current tab states */
    activeProjectTabState: ProjectTabState | undefined;
    activeChatTabState: ChatTabState | undefined;

    /** Linking Helpers */
    linkChatTabToProjectTab: (chatTabId: string, projectTabId: string, settings?: Partial<LinkSettings>) => void;
    unlinkChatTab: (chatTabId: string) => void;
    updateChatLinkSettings: (chatTabId: string, partialSettings: Partial<LinkSettings>) => void;

    /** Project Tab State Helpers */
    updateActiveProjectTabStateKey: <K extends keyof ProjectTabState>(
        key: K,
        valueOrFn: ProjectTabState[K] | ((prev: ProjectTabState[K]) => ProjectTabState[K])
    ) => void;
};

export function useInitializeGlobalState(): UseGlobalStateReturn {
    const [wsReady, setWsReady] = useState(false);
    const queryClient = useQueryClient();
    const wsRef = useRef<WebSocket | null>(null);

    const { data: state } = useQuery({
        queryKey: ['globalState'],
        queryFn: async (): Promise<GlobalState> => {
            const res = await fetch(`${SERVER_HTTP_ENDPOINT}/api/state`);
            const parsed = await res.json();
            return globalStateSchema.parse(parsed);
        },
        staleTime: Infinity,
        gcTime: Infinity,
        refetchOnWindowFocus: false,
        refetchOnMount: false,
        refetchOnReconnect: false,
        initialData: createInitialGlobalState(),
    });

    const activeProjectTabState = state?.projectActiveTabId
        ? state.projectTabs[state.projectActiveTabId]
        : undefined;
    const activeChatTabState = state?.chatActiveTabId
        ? state.chatTabs[state.chatActiveTabId]
        : undefined;

    useEffect(() => {
        const ws = new WebSocket(`${SERVER_WS_ENDPOINT}/ws`);
        wsRef.current = ws;

        ws.onopen = () => setWsReady(true);
        ws.onclose = () => {
            wsRef.current = null;
            setWsReady(false);
        };
        ws.onerror = (err) => console.error('[WebSocket] Error:', err);

        ws.onmessage = (event) => {
            const msg = JSON.parse(event.data);
            if (msg.type === 'state_update') {
                const newState = globalStateSchema.parse(msg.data);
                queryClient.setQueryData(['globalState'], newState);
            }
        };

        return () => {
            ws.close();
        };
    }, [queryClient]);

    /** Helpers */
    function canProceed(): boolean {
        if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) {
            console.warn('WebSocket not open, cannot send message');
            return false;
        }
        if (!state) {
            console.warn('No state loaded yet, cannot proceed');
            return false;
        }
        return true;
    }

    function sendWSMessage(msg: object) {
        if (canProceed()) {
            wsRef.current!.send(JSON.stringify(msg));
        }
    }

    function getPartial<T>(prev: T, partialOrFn: PartialOrFn<T>): Partial<T> {
        return typeof partialOrFn === 'function' ? partialOrFn(prev) : partialOrFn;
    }

    /** 1) Generic Updaters */
    function updateGlobalStateKey<K extends keyof GlobalState>(
        key: K,
        partialOrFn: PartialOrFn<GlobalState[K]>
    ) {
        if (!canProceed() || !state) return;
        const currentValue = state[key];
        if (currentValue === undefined) return;

        const finalPartial = getPartial(currentValue, partialOrFn);

        sendWSMessage({
            type: 'update_global_state_key', // Your backend must handle this
            data: {
                key,
                partial: finalPartial,
            },
        });
    }

    function updateSettings(partialOrFn: PartialOrFn<GlobalState['settings']>) {
        updateGlobalStateKey('settings', partialOrFn);
    }

    /** 2) Project Tabs */
    function updateActiveProjectTab(partialOrFn: PartialOrFn<ProjectTabState>) {
        if (!canProceed() || !state?.projectActiveTabId) return;
        const { projectActiveTabId, projectTabs } = state;
        const currentTab = projectTabs[projectActiveTabId];
        const finalPartial = getPartial(currentTab, partialOrFn);

        // Keep using the old "type" to avoid breaking your backend:
        sendWSMessage({
            type: 'update_project_tab_partial',
            tabId: projectActiveTabId,
            partial: finalPartial,
        });
    }

    function updateProjectTab(tabId: string, partial: Partial<ProjectTabState>) {
        if (!canProceed()) return;
        sendWSMessage({
            type: 'update_project_tab',
            tabId,
            data: partial,
        });
    }

    function updateProjectTabState(tabId: string, partialOrFn: PartialOrFn<ProjectTabState>) {
        if (!canProceed() || !state) return;
        const currentState = state.projectTabs[tabId];
        if (!currentState) return;

        const finalPartial = getPartial(currentState, partialOrFn);
        sendWSMessage({
            type: 'update_project_tab_partial',
            tabId,
            partial: finalPartial,
        });
    }

    function updateActiveProjectTabStateKey<K extends keyof ProjectTabState>(
        key: K,
        valueOrFn: ProjectTabState[K] | ((prev: ProjectTabState[K]) => ProjectTabState[K])
    ) {
        updateActiveProjectTab((prevTab) => {
            const newValue = typeof valueOrFn === 'function' ? valueOrFn(prevTab[key]) : valueOrFn;
            return { [key]: newValue };
        });
    }

    function createProjectTab() {
        if (!canProceed() || !state?.projectActiveTabId) return;
        const newTabId = `project-tab-${uuidv4()}`;
        const sourceTabId = state.projectActiveTabId;
        const sourceTabState = state.projectTabs[sourceTabId];

        sendWSMessage({
            type: 'create_project_tab',
            tabId: newTabId,
            data: {
                ...sourceTabState,
                displayName: `Project Tab ${Object.keys(state.projectTabs).length + 1}`,
            },
        });

        setActiveProjectTab(newTabId);
    }

    function deleteProjectTab(tabId: string) {
        if (!canProceed() || !state) return;

        if (Object.keys(state.projectTabs).length <= 1) {
            console.warn('Cannot delete the last remaining project tab');
            return;
        }

        sendWSMessage({
            type: 'delete_project_tab',
            tabId,
        });

        if (state.projectActiveTabId === tabId) {
            const remainingTabs = Object.keys(state.projectTabs).filter((id) => id !== tabId);
            if (remainingTabs.length > 0) {
                setActiveProjectTab(remainingTabs[0]);
            }
        }
    }

    function setActiveProjectTab(tabId: string) {
        if (!canProceed()) return;
        sendWSMessage({
            type: 'set_active_project_tab',
            tabId,
        });
    }

    /** 3) Chat Tabs (same approach) */
    function updateActiveChatTab(partialOrFn: PartialOrFn<ChatTabState>) {
        if (!canProceed() || !state?.chatActiveTabId) return;
        const { chatActiveTabId, chatTabs } = state;
        const currentTab = chatTabs[chatActiveTabId];
        const finalPartial = getPartial(currentTab, partialOrFn);

        sendWSMessage({
            type: 'update_chat_tab',
            tabId: chatActiveTabId,
            data: finalPartial,
        });
    }

    function updateChatTab(tabId: string, partial: Partial<ChatTabState>) {
        if (!canProceed()) return;
        sendWSMessage({
            type: 'update_chat_tab',
            tabId,
            data: partial,
        });
    }

    function updateChatTabState(tabId: string, partialOrFn: PartialOrFn<ChatTabState>) {
        if (!canProceed() || !state) return;
        const currentTab = state.chatTabs[tabId];
        if (!currentTab) return;

        const finalPartial = getPartial(currentTab, partialOrFn);
        sendWSMessage({
            type: 'update_chat_tab',
            tabId,
            data: finalPartial,
        });
    }

    function createChatTab(options?: {
        cleanTab?: boolean;
        model?: string;
        provider?: string;
        title?: string;
    }) {
        if (!canProceed() || !state?.chatActiveTabId) return;
        const newTabId = `chat-tab-${uuidv4()}`;
        const sourceTabId = state.chatActiveTabId;
        const sourceTabState = state.chatTabs[sourceTabId];

        let messageData = {
            ...sourceTabState,
            displayName: options?.title || `Chat ${Object.keys(state.chatTabs).length + 1}`,
            model: options?.model ?? sourceTabState.model,
            provider: options?.provider ?? sourceTabState.provider,
        };

        if (options?.cleanTab) {
            messageData = {
                ...messageData,
                messages: [],
                activeChatId: undefined,
                excludedMessageIds: [],
                linkSettings: {
                    includePrompts: false,
                    includeSelectedFiles: false,
                    includeUserPrompt: false,
                },
                linkedProjectTabId: null,
            };
        } else {
            messageData = {
                ...messageData,
                messages: [],
            };
        }

        sendWSMessage({
            type: 'create_chat_tab',
            tabId: newTabId,
            data: messageData,
        });

        setActiveChatTab(newTabId);
    }

    function deleteChatTab(tabId: string) {
        if (!canProceed() || !state) return;

        if (Object.keys(state.chatTabs).length <= 1) {
            console.warn('Cannot delete the last remaining chat tab');
            return;
        }

        sendWSMessage({
            type: 'delete_chat_tab',
            tabId,
        });

        if (state.chatActiveTabId === tabId) {
            const remainingTabs = Object.keys(state.chatTabs).filter((id) => id !== tabId);
            if (remainingTabs.length > 0) {
                setActiveChatTab(remainingTabs[0]);
            }
        }
    }

    function setActiveChatTab(tabId: string) {
        if (!canProceed()) return;
        sendWSMessage({
            type: 'set_active_chat_tab',
            tabId,
        });
    }

    /** 4) Linking Helpers */
    function linkChatTabToProjectTab(
        chatTabId: string,
        projectTabId: string,
        settings?: Partial<LinkSettings>
    ) {
        if (!canProceed()) return;
        const partial = {
            linkedProjectTabId: projectTabId,
            linkSettings: {
                includeSelectedFiles: settings?.includeSelectedFiles ?? true,
                includePrompts: settings?.includePrompts ?? true,
                includeUserPrompt: settings?.includeUserPrompt ?? true,
            },
        };

        sendWSMessage({
            type: 'update_chat_tab',
            tabId: chatTabId,
            data: partial,
        });
    }

    function unlinkChatTab(chatTabId: string) {
        if (!canProceed()) return;
        sendWSMessage({
            type: 'update_chat_tab',
            tabId: chatTabId,
            data: {
                linkedProjectTabId: null,
                linkSettings: undefined,
            },
        });
    }

    function updateChatLinkSettings(chatTabId: string, partialSettings: Partial<LinkSettings>) {
        if (!canProceed() || !state) return;
        const existing = state.chatTabs[chatTabId]?.linkSettings ?? {};
        const merged = { ...existing, ...partialSettings };
        linkSettingsSchema.parse(merged); // optionally validate

        sendWSMessage({
            type: 'update_chat_tab',
            tabId: chatTabId,
            data: { linkSettings: merged },
        });
    }

    return {
        state,
        wsReady,

        // Generic Updaters
        updateGlobalStateKey,
        updateSettings,

        // Projects
        createProjectTab,
        setActiveProjectTab,
        updateProjectTab,
        deleteProjectTab,
        updateActiveProjectTab,
        updateProjectTabState,

        // Chats
        createChatTab,
        setActiveChatTab,
        updateChatTab,
        deleteChatTab,
        updateActiveChatTab,
        updateChatTabState,

        // Current tab states
        activeProjectTabState,
        activeChatTabState,

        // Linking
        linkChatTabToProjectTab,
        unlinkChatTab,
        updateChatLinkSettings,

        // Specific project helper
        updateActiveProjectTabStateKey,
    };
}

const GlobalStateContext = createContext<UseGlobalStateReturn | null>(null);

export function GlobalStateProvider({ children }: { children: React.ReactNode }) {
    const global = useInitializeGlobalState();
    return (
        <GlobalStateContext.Provider value={global}>
            {children}
        </GlobalStateContext.Provider>
    );
}

export function useGlobalStateContext(): UseGlobalStateReturn {
    const context = useContext(GlobalStateContext);
    if (!context) {
        throw new Error('useGlobalStateContext must be used within a GlobalStateProvider');
    }
    return context;
}