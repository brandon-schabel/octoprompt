import { createContext, useContext } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useRef, useState } from 'react';
import { globalStateSchema, GlobalState, createInitialGlobalState, TabState } from 'shared';
import { SERVER_HTTP_ENDPOINT, SERVER_WS_ENDPOINT } from '@/constants/server-constants';

type SetActiveTabMessage = {
    type: 'set_active_tab';
    tabId: string;
};

type NewTabOptions = {
    fromTabId?: string
    displayName?: string
}

export type UseGlobalStateReturn = {
    state: GlobalState | undefined;
    activeTabState: TabState | undefined;
    updateActiveTabStateKey: <K extends keyof TabState>(key: K, valueOrFn: TabState[K] | ((prev: TabState[K]) => TabState[K])) => void;
    updateActiveTab: (partialOrFn: Partial<TabState> | ((prev: TabState) => Partial<TabState>)) => void;
    updateTab: (tabId: string, partial: Partial<TabState>) => void;
    createNewTab: (tabOptions: NewTabOptions | undefined) => void;
    setActiveTab: (tabId: string) => void;
    deleteTab: (tabId: string) => void;
    wsReady: boolean;
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

    function isWebSocketOpen() {
        return wsRef.current && wsRef.current.readyState === WebSocket.OPEN;
    }


    function updateActiveTabStateKey<K extends keyof TabState>(
        key: K,
        valueOrFn: TabState[K] | ((prev: TabState[K]) => TabState[K])
    ) {

        updateActiveTab((prevTab) => {
            const newValue =
                typeof valueOrFn === 'function'
                    ? valueOrFn(prevTab[key])
                    : valueOrFn;


            return { [key]: newValue } as Partial<TabState>;
        });
    }

    function updateActiveTab(
        partialOrFn: Partial<TabState> | ((prev: TabState) => Partial<TabState>)
    ) {

        if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) {
            console.warn("[updateActiveTab] WebSocket not open, cannot send message");
            return;
        }
        if (!state) {
            console.warn("[updateActiveTab] No global state available");
            return;
        }

        const activeTabId = state.activeTabId;
        if (!activeTabId) {
            console.warn("[updateActiveTab] No active tab selected");
            return;
        }

        const currentTabState = state.tabs[activeTabId];
        const finalPartial =
            typeof partialOrFn === 'function'
                ? partialOrFn(currentTabState)
                : partialOrFn;



        const message = {
            type: 'update_tab_partial',
            tabId: activeTabId,
            data: finalPartial,
        };
        wsRef.current.send(JSON.stringify(message));
    }

    function updateTab(tabId: string, partial: Partial<TabState>) {
        if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) {
            console.warn("WebSocket not open, cannot send message");
            return;
        }
        const message = {
            type: 'update_tab_partial',
            tabId,
            data: partial,
        };
        wsRef.current.send(JSON.stringify(message));
    }

    function createNewTab({ fromTabId, displayName }: { fromTabId?: string, displayName?: string } = {}) {
        if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) {
            console.warn("WebSocket not open, cannot send message");
            return;
        }
        if (!state) return;

        const sourceTabId = fromTabId ?? state.activeTabId;
        if (!sourceTabId) return;

        const newTabId = `tab-${Date.now()}`; // or generate a random ID
        const sourceTabState = state.tabs[sourceTabId];

        const newTabData: TabState = {
            ...sourceTabState,
            displayName
        };

        const message = {
            type: 'create_tab',
            tabId: newTabId,
            data: newTabData,
        };
        wsRef.current.send(JSON.stringify(message));

        setActiveTab(newTabId);
    }

    function setActiveTab(tabId: string) {
        if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) {
            console.warn("WebSocket not open, cannot send message");
            return;
        }

        const message: SetActiveTabMessage = {
            type: 'set_active_tab',
            tabId,
        };
        wsRef.current.send(JSON.stringify(message));
    }

    const activeTabState = state?.activeTabId ? state.tabs[state.activeTabId] : undefined;

    function deleteTab(tabId: string) {
        if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) {
            console.warn("WebSocket not open, cannot send message");
            return;
        }
        if (!state) return;

        if (Object.keys(state.tabs).length <= 1) {
            console.warn("Cannot delete the last remaining tab");
            return;
        }

        const message = {
            type: 'delete_tab',
            tabId,
        };
        wsRef.current.send(JSON.stringify(message));

        if (state.activeTabId === tabId) {
            const remainingTabs = Object.keys(state.tabs).filter(id => id !== tabId);
            if (remainingTabs.length > 0) {
                setActiveTab(remainingTabs[0]);
            }
        }
    }

    return {
        state,
        activeTabState,
        updateActiveTabStateKey,
        updateActiveTab,
        updateTab,
        createNewTab,
        setActiveTab,
        deleteTab,
        wsReady
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