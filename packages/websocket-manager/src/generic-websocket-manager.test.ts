// packages/websocket-manager/test/generic-websocket-manager.test.ts

import { describe, it, expect, beforeEach, afterEach, mock } from "bun:test";
import { WebSocketManager, type WebSocketManagerConfig } from "../src";
import { type BaseMessage, type MessageHandler } from "../src/websocket-types";

type TestState = {
    value: number;
};

interface IncrementTestMessage extends BaseMessage {
    type: "increment";
    amount: number;
}

type TestMessage = IncrementTestMessage;

describe("WebSocketManager Tests", () => {
    let manager: WebSocketManager<TestState, TestMessage>;
    let mockWs: any;

    beforeEach(() => {
        mockWs = {
            readyState: 1,
            send: mock((data: string) => { }),
            close: mock(() => { })
        };

        const incrementHandler: MessageHandler<TestState, TestMessage> = {
            type: "increment",
            handle: async (ws, message, getState, setState) => {
                const currentState = await getState();
                const updated = { ...currentState, value: currentState.value + message.amount };
                await setState(updated);
            },
        };

        const config: WebSocketManagerConfig<TestState, TestMessage> = {
            getState: async () => ({ value: 0 }),
            setState: async (newState) => { },
            messageHandlers: [incrementHandler],
            debug: false,
        };

        manager = new WebSocketManager(config);
    });

    afterEach(() => {
        manager.stopHeartbeat();
    });

    it("should add a new connection and send initial state", async () => {
        await manager.handleOpen(mockWs);
        expect(manager["connections"].size).toBe(1);

        // Access call count via `.mock.calls`
        expect(mockWs.send.mock.calls.length).toBe(1);
    });

    it("should remove a connection on close", async () => {
        await manager.handleOpen(mockWs);
        await manager.handleClose(mockWs);
        expect(manager["connections"].size).toBe(0);
    });

    it("should handle an incoming message and update state via handler", async () => {
        const getStateSpy = mock(async () => ({ value: 5 }));
        const setStateSpy = mock(async (newState) => { });

        manager["config"].getState = getStateSpy;
        manager["config"].setState = setStateSpy;

        await manager.handleOpen(mockWs);
        const message = JSON.stringify({ type: "increment", amount: 10 });
        await manager.handleMessage(mockWs, message);

        // Check calls via `.mock`
        expect(getStateSpy.mock.calls.length).toBe(3);
        expect(setStateSpy.mock.calls.length).toBe(1); // from handler
        expect(setStateSpy.mock.calls[0][0]).toEqual({ value: 15 });
    });

    it("should use middleware to modify messages before handling", async () => {
        await manager.use(async (msg) => {
            if (msg.type === "increment") {
                return { ...msg, amount: msg.amount * 2 };
            }
            return msg;
        });

        const setStateSpy = mock(async (newState) => { });
        manager["config"].setState = setStateSpy;

        await manager.handleOpen(mockWs);
        await manager.handleMessage(mockWs, JSON.stringify({ type: "increment", amount: 1 }));

        // The final updated state should have used amount=2
        expect(setStateSpy.mock.calls[0][0]).toEqual({ value: 2 });
    });

    it("should handle heartbeat pings if interval is set", async () => {
        manager.stopHeartbeat();
        manager = new WebSocketManager({
            ...manager["config"],
            heartbeatIntervalMs: 10,
            pingTimeoutMs: 50,
        });

        await manager.handleOpen(mockWs);
        await new Promise((resolve) => setTimeout(resolve, 30));

        // Filter mock calls for ping messages
        const pingCalls = mockWs.send.mock.calls.filter(call => {
            try {
                const parsed = JSON.parse(call[0]);
                return parsed.type === "ping";
            } catch {
                return false;
            }
        });
        expect(pingCalls.length).toBeGreaterThan(0);
    });

    it("should handle a pong message", async () => {
        manager.stopHeartbeat();
        manager = new WebSocketManager({
            ...manager["config"],
            heartbeatIntervalMs: 10,
            pingTimeoutMs: 50,
            hooks: {
                onPong: async (ws) => {
                    // Just for coverage
                }
            }
        });

        await manager.handleOpen(mockWs);
        await manager.handleMessage(mockWs, "pong");

        // lastPongTimes should have been updated
        const lastPongMap = manager["lastPongTimes"].get(mockWs);
        expect(typeof lastPongMap).toBe("number");
    });
});