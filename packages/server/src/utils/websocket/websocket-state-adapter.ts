import { GlobalState, InboundMessage, validateIncomingMessage, createInitialGlobalState, globalStateSchema } from "shared";
import { allWebsocketHandlers } from "./websocket-handlers";
import { BackendWebSocketManager, FileWebSocketAdapter, MessageHandler } from "@bnk/backend-websocket-manager";

const STATE_FILE_PATH = "./data/websocket-state.json";

const websocketFileAdapter = new FileWebSocketAdapter<GlobalState>({
    filePath: STATE_FILE_PATH,
    debug: true,
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
    const bnkWsManager = new BackendWebSocketManager<GlobalState, InboundMessage>({
        defaultState: createInitialGlobalState(),
        adapter: websocketFileAdapter,
        
        messageHandlers: [...allWebsocketHandlers] as MessageHandler<GlobalState, InboundMessage>[],
        validateMessage: validateIncomingMessage,
        debug: true
    });

    // Load the initial state from the adapter
    const { state: initialGlobalState } = await websocketFileAdapter.load();

    return {
        bnkWsManager,
        initialGlobalState
    };
}

export const { bnkWsManager: websocketStateAdapter, initialGlobalState } = await instantiateWebsocketStateAdapter();





