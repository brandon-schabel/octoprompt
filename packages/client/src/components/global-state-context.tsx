import { createContext, useContext } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useRef, useState } from 'react';
import { globalStateSchema, GlobalState, createInitialGlobalState, TabState } from 'shared';
import { SERVER_HTTP_ENDPOINT, SERVER_WS_ENDPOINT } from '@/constants/server-constants';



export type UseGlobalStateReturn = {
    // The entire state
    state: GlobalState | undefined;
    wsReady: boolean;

    /** Project tabs */
    createProjectTab: () => void;
    setActiveProjectTab: (tabId: string) => void;
    updateProjectTab: (tabId: string, partial: Partial<GlobalState['projectTabs'][string]>) => void;
    deleteProjectTab: (tabId: string) => void;
    updateActiveProjectTab: (partialOrFn: Partial<GlobalState['projectTabs'][string]> | ((prev: GlobalState['projectTabs'][string]) => Partial<GlobalState['projectTabs'][string]>)) => void;

    /** Chat tabs */
    createChatTab: () => void;
    setActiveChatTab: (tabId: string) => void;
    updateChatTab: (tabId: string, partial: Partial<GlobalState['chatTabs'][string]>) => void;
    deleteChatTab: (tabId: string) => void;
    updateActiveChatTab: (partialOrFn: Partial<GlobalState['chatTabs'][string]> | ((prev: GlobalState['chatTabs'][string]) => Partial<GlobalState['chatTabs'][string]>)) => void;

    /** Current tab states */
    activeProjectTabState: GlobalState['projectTabs'][string] | undefined;
    activeChatTabState: GlobalState['chatTabs'][string] | undefined;

    updateActiveProjectTabStateKey: <K extends keyof TabState>(key: K, valueOrFn: TabState[K] | ((prev: TabState[K]) => TabState[K])) => void;
};

export function useInitializeGlobalState(): UseGlobalStateReturn {
    const [wsReady, setWsReady] = useState(false); // <-- track readiness
    const queryClient = useQueryClient();
    const wsRef = useRef<WebSocket | null>(null);

    const { data: state } = useQuery({
        queryKey: ['globalState'],
        queryFn: async (): Promise<GlobalState> => {
            const res = await fetch(SERVER_HTTP_ENDPOINT + '/api/state');
            const data = await res.json();
            return globalStateSchema.parse(data);
        },
        staleTime: Infinity,
        gcTime: Infinity,
        refetchOnWindowFocus: false,
        refetchOnMount: false,
        refetchOnReconnect: false,
        initialData: createInitialGlobalState()
    });

    const activeProjectTabState = state?.projectActiveTabId ? state?.projectTabs[state?.projectActiveTabId] : undefined;
    const activeChatTabState = state?.chatActiveTabId ? state?.chatTabs[state?.chatActiveTabId] : undefined;

    useEffect(() => {
        const ws = new WebSocket(`${SERVER_WS_ENDPOINT}/ws`);
        wsRef.current = ws;

        ws.onopen = () => {

            setWsReady(true);
        };

        ws.onmessage = (event) => {

            const message = JSON.parse(event.data);


            if (message.type === 'state_update') {

                const newState = globalStateSchema.parse(message.data);
                queryClient.setQueryData(['globalState'], newState);
            }
        };

        ws.onclose = () => {

            wsRef.current = null;
            setWsReady(false);
        };

        ws.onerror = (error) => {
            console.error('[WebSocket] Connection error:', error);
        };

        return () => {

            ws.close();
        };
    }, [queryClient]);


    function updateActiveProjectTabStateKey<K extends keyof TabState>(
        key: K,
        valueOrFn: TabState[K] | ((prev: TabState[K]) => TabState[K])
    ) {

        updateActiveProjectTab((prevTab) => {
            const newValue =
                typeof valueOrFn === 'function'
                    ? valueOrFn(prevTab[key])
                    : valueOrFn;


            return { [key]: newValue } as Partial<TabState>;
        });
    }

    function updateActiveProjectTab(
        partialOrFn: Partial<TabState> | ((prev: TabState) => Partial<TabState>)
    ) {

        if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) {
            console.warn("[updateActiveProjectTab] WebSocket not open, cannot send message");
            return;
        }
        if (!state) {
            console.warn("[updateActiveProjectTab] No global state available");
            return;
        }

        const activeProjectTabId = state.projectActiveTabId;
        if (!activeProjectTabId) {
            console.warn("[updateActiveProjectTab] No active tab selected");
            return;
        }

        const currentProjectTabState = state.projectTabs[activeProjectTabId];
        const finalPartial =
            typeof partialOrFn === 'function'
                ? partialOrFn(currentProjectTabState)
                : partialOrFn;




        const message = {
            type: 'update_project_tab_partial',
            tabId: activeProjectTabId,
            partial: finalPartial
        };
        console.log(message)


        wsRef.current?.send(JSON.stringify(message));
    }

    function updateActiveChatTab(
        partialOrFn: Partial<GlobalState['chatTabs'][string]> | ((prev: GlobalState['chatTabs'][string]) => Partial<GlobalState['chatTabs'][string]>)
    ) {
        if (!isWebSocketOpen() || !state) {
            console.warn("[updateActiveChatTab] WebSocket not open or no state available");
            return;
        }

        const activeChatTabId = state.chatActiveTabId;
        if (!activeChatTabId) {
            console.warn("[updateActiveChatTab] No active chat tab selected");
            return;
        }

        const currentChatTabState = state.chatTabs[activeChatTabId];
        const finalPartial =
            typeof partialOrFn === 'function'
                ? partialOrFn(currentChatTabState)
                : partialOrFn;

        const message = {
            type: 'update_chat_tab',
            tabId: activeChatTabId,
            data: finalPartial
        };
        wsRef.current?.send(JSON.stringify(message));
    }

    function createProjectTab() {
        if (!isWebSocketOpen() || !state) return;

        const sourceTabId = state.projectActiveTabId;
        if (!sourceTabId) return;

        const newTabId = `project-tab-${Date.now()}`;
        const sourceTabState = state.projectTabs[sourceTabId];

        const message = {
            type: 'create_project_tab',
            tabId: newTabId,
            data: {
                ...sourceTabState,
                displayName: `Project Tab ${Object.keys(state.projectTabs).length + 1}`
            }
        };
        wsRef.current?.send(JSON.stringify(message));
        setActiveProjectTab(newTabId);
    }

    function setActiveProjectTab(tabId: string) {
        if (!isWebSocketOpen()) return;

        const message = {
            type: 'set_active_project_tab',
            tabId
        };
        wsRef.current?.send(JSON.stringify(message));
    }

    function updateProjectTab(tabId: string, partial: Partial<GlobalState['projectTabs'][string]>) {
        if (!isWebSocketOpen()) return;

        const message = {
            type: 'update_project_tab',
            tabId,
            data: partial
        };
        wsRef.current?.send(JSON.stringify(message));
    }

    function deleteProjectTab(tabId: string) {
        if (!isWebSocketOpen() || !state) return;

        if (Object.keys(state.projectTabs).length <= 1) {
            console.warn("Cannot delete the last remaining project tab");
            return;
        }

        const message = {
            type: 'delete_project_tab',
            tabId
        };
        wsRef.current?.send(JSON.stringify(message));

        // Switch to another tab if deleting the active one
        if (state.projectActiveTabId === tabId) {
            const remainingTabs = Object.keys(state.projectTabs).filter(id => id !== tabId);
            if (remainingTabs.length > 0) {
                setActiveProjectTab(remainingTabs[0]);
            }
        }
    }

    // Chat tab management functions
    function createChatTab() {
        if (!isWebSocketOpen() || !state) return;

        const sourceTabId = state.chatActiveTabId;
        if (!sourceTabId) return;

        const newTabId = `chat-tab-${Date.now()}`;
        const sourceTabState = state.chatTabs[sourceTabId];

        const message = {
            type: 'create_chat_tab',
            tabId: newTabId,
            data: {
                ...sourceTabState,
                messages: [], // Start with empty messages
                displayName: `Chat ${Object.keys(state.chatTabs).length + 1}`
            }
        };
        wsRef.current?.send(JSON.stringify(message));
        setActiveChatTab(newTabId);
    }

    function setActiveChatTab(tabId: string) {
        if (!isWebSocketOpen()) return;

        const message = {
            type: 'set_active_chat_tab',
            tabId
        };
        wsRef.current?.send(JSON.stringify(message));
    }

    function updateChatTab(tabId: string, partial: Partial<GlobalState['chatTabs'][string]>) {
        if (!isWebSocketOpen()) return;

        const message = {
            type: 'update_chat_tab',
            tabId,
            data: partial
        };
        wsRef.current?.send(JSON.stringify(message));
    }

    function deleteChatTab(tabId: string) {
        if (!isWebSocketOpen() || !state) return;

        if (Object.keys(state.chatTabs).length <= 1) {
            console.warn("Cannot delete the last remaining chat tab");
            return;
        }

        const message = {
            type: 'delete_chat_tab',
            tabId
        };
        wsRef.current?.send(JSON.stringify(message));

        // Switch to another tab if deleting the active one
        if (state.chatActiveTabId === tabId) {
            const remainingTabs = Object.keys(state.chatTabs).filter(id => id !== tabId);
            if (remainingTabs.length > 0) {
                setActiveChatTab(remainingTabs[0]);
            }
        }
    }

    // Helper function for WebSocket checks
    function isWebSocketOpen(): boolean {
        if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) {
            console.warn("WebSocket not open, cannot send message");
            return false;
        }
        return true;
    }

    return {
        state,
        wsReady,
        createProjectTab,
        setActiveProjectTab,
        updateProjectTab,
        deleteProjectTab,
        createChatTab,
        setActiveChatTab,
        updateChatTab,
        deleteChatTab,
        updateActiveProjectTab,
        updateActiveChatTab,
        activeProjectTabState,
        activeChatTabState,
        updateActiveProjectTabStateKey
    };
}



/** Context which consumes the above hooks */
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
        throw new Error("useGlobalStateContext must be used within a GlobalStateProvider");
    }
    return context;
}