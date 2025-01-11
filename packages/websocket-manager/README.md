# @bnk/websocket-manager

**@bnk/websocket-manager** is a modular, extensible, and strongly-typed WebSocket manager for Bun-based servers, designed to handle a variety of real-time use cases with minimal overhead. This package leverages Bun’s native `ServerWebSocket`, offering a customizable, pluggable architecture to manage application state and broadcast changes to connected clients.

## Key Features

- **Strong Typing**: Uses TypeScript generics and advanced types (`BaseMessage`, `MessageHandler`) to ensure type safety for state and message handling.
- **Pluggable Architecture**: Register multiple message handlers for different message types. Each handler deals with its own piece of state logic.
- **Easy State Management**: Provide `getState` and `setState` functions, allowing you to store and retrieve state from a DB, in-memory object, or any other storage.
- **Broadcast Support**: Broadcast updated state to all connected clients using `broadcastState()`.
- **Debug-Ready**: Pass `debug: true` in the configuration to enable verbose logging.
- **Testable by Design**: Written with testability in mind; easily mock `getState`, `setState`, or individual message handlers within Bun’s test suite.

## Installation

```bash
# Using Bun
bun add @bnk/websocket-manager

# Or, if you are mixing with npm/yarn, you can also do:
npm install @bnk/websocket-manager
# yarn add @bnk/websocket-manager
```

## Basic Usage

Below is a minimal example of how to use **@bnk/websocket-manager**. This example sets up an in-memory state and a single message handler for demonstration.

### 1. Create Your State and Handlers

```ts
// my-app-state.ts
export interface MyAppState {
  counter: number;
}

// my-message-types.ts
import { BaseMessage } from "@bnk/websocket-manager";

export interface IncrementMessage extends BaseMessage {
  type: "increment";
  amount: number;
}

// Optionally combine multiple messages into a union
export type MyAppMessage = IncrementMessage;
```

```ts
// my-message-handlers.ts
import { MessageHandler } from "@bnk/websocket-manager";
import { MyAppState, MyAppMessage } from "./my-message-types";

// A simple handler to increment a counter in the state
export const incrementHandler: MessageHandler<MyAppState, MyAppMessage> = {
  type: "increment",
  async handle(ws, message, getState, setState) {
    const state = await getState();
    state.counter += message.amount;
    await setState(state);
  },
};

export const myHandlers = [incrementHandler];
```

### 2. Set Up Your WebSocket Manager

```ts
// websocket-manager-setup.ts
import { WebSocketManager } from "@bnk/websocket-manager";
import { MyAppState, MyAppMessage } from "./my-message-types";
import { myHandlers } from "./my-message-handlers";

// In-memory example state
let currentState: MyAppState = { counter: 0 };

const getState = async (): Promise<MyAppState> => {
  // Return a clone to simulate immutable reads
  return structuredClone(currentState);
};

const setState = async (newState: MyAppState): Promise<void> => {
  // Simulate saving newState to a DB or in-memory store
  currentState = structuredClone(newState);
};

// Create the manager
export const myWebSocketManager = new WebSocketManager<MyAppState, MyAppMessage>({
  getState,
  setState,
  messageHandlers: myHandlers,
  debug: true, // optional
});
```

### 3. Integrate with a Bun Server

```ts
// bun-server.ts
import { serve } from "bun";
import { myWebSocketManager } from "./websocket-manager-setup";

serve({
  port: 3000,
  fetch(req: Request) {
    return new Response("Hello from Bun server!", { status: 200 });
  },
  websocket: {
    open(ws) {
      myWebSocketManager.handleOpen(ws);
    },
    close(ws) {
      myWebSocketManager.handleClose(ws);
    },
    async message(ws, msg) {
      // Handle the incoming message
      await myWebSocketManager.handleMessage(ws, msg.toString());
      
      // Optionally broadcast updated state to all clients
      await myWebSocketManager.broadcastState();
    },
  }
});

console.log("Server running at http://localhost:3000");
```

### 4. Sending Messages from the Client

From the browser (or another WebSocket client), connect and send an `increment` message:

```ts
const ws = new WebSocket("ws://localhost:3000");

ws.onopen = () => {
  ws.send(JSON.stringify({ type: "increment", amount: 5 }));
};

ws.onmessage = (event) => {
  console.log("Server says:", event.data);
};
```

## Advanced Usage

### Multiple Message Handlers

You can define multiple handlers to deal with different message subtypes. Each handler is matched by its `type` field.  
In more complex applications, create separate modules for different domains (e.g., user chat, project management, etc.) and then combine all handlers into one array:

```ts
const allHandlers = [
  ...chatHandlers,
  ...projectHandlers,
  // etc...
];

const manager = new WebSocketManager({
  getState,
  setState,
  messageHandlers: allHandlers,
});
```

### Broadcasting State

Whenever your state changes, you can call `manager.broadcastState()` to push the updated state to all connected clients. Internally, this calls `getState()`, serializes it, and sends it to each active WebSocket connection.

### Debug Logging

Set `debug: true` in the manager config to see detailed logs of connections, closures, and message parsing. This is helpful for troubleshooting and development.

### Heartbeats & Connection Stability

If you’re building a high-availability or production-grade system, you may also implement a heartbeat or ping/pong mechanism. This can help detect stale connections. See the [test suite](./src/generic-websocket-manager.test.ts) for an example of using a heartbeat interval.

## Testing

**@bnk/websocket-manager** is built for straightforward testing with Bun. Key points:

- **Mocking**: You can mock out `getState` and `setState` for unit tests.
- **Handlers**: Each message handler is testable as a standalone function since it just needs `getState`, `setState`, and a mocked WebSocket.
- **Integration**: Combine all handlers, start a test Bun server, and run integration tests to ensure messages flow as expected.

A sample test file is included in `src/generic-websocket-manager.test.ts`, showcasing how to verify:

1. Incoming messages are parsed and handled.
2. State is updated correctly.
3. WebSocket connections open and close as expected.

To run tests:

```bash
bun test src/
```

## Contributing

Feel free to open issues or pull requests to improve **@bnk/websocket-manager**. Whether it’s a feature request, bug fix, or documentation enhancement, all contributions are welcome.

## License

This project is licensed under the [MIT License](./LICENSE).

---

**@bnk/websocket-manager** aims to give you a solid foundation for real-time WebSocket applications using Bun, with minimal friction and maximum flexibility. If you find this library helpful, consider sharing feedback and improvements!
