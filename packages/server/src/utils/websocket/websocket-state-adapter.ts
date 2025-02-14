import { GlobalState, InboundMessage, validateIncomingMessage, createInitialGlobalState, globalStateSchema } from "shared";
import { allWebsocketHandlers } from "./websocket-handlers";
import { SyncEngine, FileWebSocketAdapter, MessageHandler } from "@bnk/sync-engine";

const STATE_FILE_PATH = "./data/websocket-state.json";

const websocketFileAdapter = new FileWebSocketAdapter<GlobalState>({
    filePath: STATE_FILE_PATH,
    validateState: (state) => {
        const result = globalStateSchema.safeParse(state);
        return result.success;
    },
    createInitialState: createInitialGlobalState
});

export const instantiateWebsocketStateAdapter = async () => {
    // Initialize the adapter first
    await websocketFileAdapter.init();

    // Create the BNK manager with the adapter
    const bnkWsManager = new SyncEngine<GlobalState, InboundMessage>({
        defaultState: createInitialGlobalState(),
        adapter: websocketFileAdapter,
        
        messageHandlers: [...allWebsocketHandlers] as MessageHandler<GlobalState, InboundMessage>[],
        validateMessage: validateIncomingMessage,
    });

    // Load the initial state from the adapter
    const { state: initialGlobalState } = await websocketFileAdapter.load();

    return {
        bnkWsManager,
        initialGlobalState
    };
}

export const { bnkWsManager: websocketStateAdapter, initialGlobalState } = await instantiateWebsocketStateAdapter();





