import  type { MessageHandler } from "../websocket-types";

/**
 * This is the union of all messages we handle.
 * In this simplified example, we only have one message type.
 */
export type CounterMessage = {
    type: "increment_counter";
    amount: number;
};

/**
 * Our global state includes a single numeric counter.
 */
export interface MyAppState {
    counter: number;
}

/**
 * A handler that increments the counter by the specified amount.
 */
export const incrementCounterHandler: MessageHandler<MyAppState, CounterMessage> = {
    type: "increment_counter" as const,

    async handle(ws, message, getState, setState) {
        const state = await getState();
        state.counter += message.amount;
        await setState(state);
    },
};

/**
 * Export an array of all handlers for your domain.
 * If there were multiple message types, each would get its own handler
 * and they'd all be bundled here.
 */
export const counterHandlers = [incrementCounterHandler];