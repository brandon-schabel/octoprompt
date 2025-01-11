# @bnk/websocket-manager-react

A lightweight yet powerful **React** wrapper for managing real-time WebSocket connections in **TypeScript**—optimized for **Bun** and designed to minimize dependencies. This library provides a **strongly-typed**, **modular**, and **well-tested** approach to establishing client-side WebSocket connections, handling incoming/outgoing messages, and seamlessly integrating with React via **hooks** and **context providers**.

## Table of Contents

1. [Introduction](#introduction)  
2. [Key Features](#key-features)  
3. [Installation](#installation)  
4. [Quick Start](#quick-start)  
5. [Usage Examples](#usage-examples)  
   - [Simple Example](#simple-example)  
   - [Advanced React + Bun Example](#advanced-react--bun-example)  
6. [API Documentation](#api-documentation)  
   - [WebSocketClientProvider](#websocketclientprovider)  
   - [useWebSocketClient](#usewebsocketclient)  
   - [ClientWebSocketManager](#clientwebsocketmanager)  
7. [Performance Notes](#performance-notes)  
8. [Configuration & Customization](#configuration--customization)  
9. [Testing](#testing)  
10. [Contributing](#contributing)  
11. [License](#license)

---

## Introduction

**@bnk/websocket-manager-react** is built on top of a generic WebSocket manager library for Bun. It provides a **React**-friendly API for managing client-side WebSocket connections with a focus on:

- **Type Safety**: Define your incoming and outgoing message types, and gain compile-time checks.  
- **Performance**: Leverages [Bun’s](https://bun.sh/) efficient WebSocket implementation for both server and client side (where applicable).  
- **Plug-and-Play Modularity**: Use simple context and hooks to integrate WebSockets seamlessly into React apps.  
- **Minimal External Dependencies**: Aside from React, no heavy dependencies are required.

---

## Key Features

- **Fully Typed**: Pass in your own `BaseServerMessage` and `BaseClientMessage` generics for robust type checking.  
- **React Context**: Easily share the WebSocket instance and connection state (`isOpen`) throughout your component tree.  
- **Configurable Message Handlers**: Map `message.type` to your own handler functions in a well-typed manner.  
- **Lightweight & Performant**: Uses Bun’s built-in capabilities where possible, reducing overhead.  
- **Simple Testing**: Leverages Bun’s native test runner. You can mock WebSocket events and verify message flows.

---

## Installation

Using **Bun**:

```bash
bun add @bnk/websocket-manager-react
```

---

## Quick Start

1. **Create** or **import** your shared message types.  
2. **Configure** the `WebSocketClientProvider` with your server’s WebSocket URL and optional handlers.  
3. **Use** the `useWebSocketClient()` hook in any component to send messages or check the connection status.

---

## Usage Examples

### Simple Example

Below is a minimal setup demonstrating how to connect to a WebSocket server and handle messages in React.

```ts
// shared/types.ts
export interface MyIncomingMessage {
  type: "greeting" | "some_other_type";
  data?: unknown;
}

export interface MyOutgoingMessage {
  type: "send_greeting";
  payload?: unknown;
}
```

```tsx
// App.tsx
import React, { useState } from "react";
import {
  WebSocketClientProvider,
  useWebSocketClient,
  type ClientWebSocketManagerConfig
} from "@bnk/websocket-manager-react";

// 1. Define message handlers
const messageHandlers: ClientWebSocketManagerConfig<MyIncomingMessage, MyOutgoingMessage>["messageHandlers"] = {
  greeting: (msg) => {
    console.log("Received greeting:", msg.data);
  },
  some_other_type: (msg) => {
    console.log("Handling other type:", msg.data);
  },
};

// 2. Provide config for the WebSocket connection
const wsConfig: ClientWebSocketManagerConfig<MyIncomingMessage, MyOutgoingMessage> = {
  url: "ws://localhost:3000",
  debug: true,
  messageHandlers,
};

// 3. Wrap your app in the WebSocketClientProvider
function App() {
  return (
    <WebSocketClientProvider {...wsConfig}>
      <HomePage />
    </WebSocketClientProvider>
  );
}

// 4. Use the hook inside your pages/components
function HomePage() {
  const { isOpen, sendMessage } = useWebSocketClient<MyIncomingMessage, MyOutgoingMessage>();
  const [text, setText] = useState("");

  const handleSend = () => {
    sendMessage({ type: "send_greeting", payload: { text } });
    setText("");
  };

  return (
    <div>
      <h1>WebSocket is {isOpen ? "Open" : "Closed"}</h1>
      <input value={text} onChange={(e) => setText(e.target.value)} />
      <button onClick={handleSend}>Send Greeting</button>
    </div>
  );
}

export default App;
```

### Advanced React + Bun Example

This package pairs perfectly with its sibling **@bnk/websocket-manager** (for the server side). Here’s a summarized flow:

1. **Server (Bun)**:  
   - Set up a `WebSocketManager` using `@bnk/websocket-manager`.  
   - Handle connections and broadcast state updates.

2. **Shared Types** (in a separate `shared` module):  
   - Define your `IncomingServerMessage` and `OutgoingClientMessage`.

3. **React Client**:  
   - Use `@bnk/websocket-manager-react` to establish the connection, manage state with React context, and send messages.

#### Example Snippet

```ts
// shared/index.ts
export interface ChatAppState {
  messageLog: string[];
}

export interface ChatClientMessage {
  type: "chat";
  payload: {
    text: string;
    sender: string;
  };
}

export interface InitialStateServerMessage {
  type: "initial_state";
  data: ChatAppState;
}
export interface StateUpdateServerMessage {
  type: "state_update";
  data: ChatAppState;
}

export type IncomingServerMessage = InitialStateServerMessage | StateUpdateServerMessage;
export type OutgoingClientMessage = ChatClientMessage;
```

```ts
// server/index.ts (Bun)
import { serve } from "bun";
import { WebSocketManager } from "@bnk/websocket-manager";
import {
  ChatAppState,
  IncomingServerMessage,
  OutgoingClientMessage,
} from "shared";

let currentState: ChatAppState = { messageLog: [] };

async function getState(): Promise<ChatAppState> {
  return structuredClone(currentState);
}
async function setState(newState: ChatAppState): Promise<void> {
  currentState = structuredClone(newState);
}

const manager = new WebSocketManager<ChatAppState, IncomingServerMessage>({
  getState,
  setState,
  messageHandlers: [
    {
      type: "chat",
      async handle(ws, message, getState, setState) {
        const state = await getState();
        const entry = `${message.payload.sender}: ${message.payload.text}`;
        state.messageLog.push(entry);
        await setState(state);
      },
    },
  ],
  debug: true,
});

serve({
  port: 3000,
  fetch() {
    return new Response("Hello from Bun!", { status: 200 });
  },
  websocket: {
    open(ws) {
      manager.handleOpen(ws);
    },
    close(ws) {
      manager.handleClose(ws);
    },
    async message(ws, msg) {
      await manager.handleMessage(ws, msg.toString());
      await manager.broadcastState();
    },
  },
});
```

```tsx
// client/chat-websocket-provider.tsx
import React, { useState } from "react";
import {
  WebSocketClientProvider,
  type ClientWebSocketManagerConfig,
} from "@bnk/websocket-manager-react";
import {
  IncomingServerMessage,
  OutgoingClientMessage,
} from "shared";

export function ChatWebSocketProvider({ children }: { children: React.ReactNode }) {
  const [messageLog, setMessageLog] = useState<string[]>([]);

  const messageHandlers: ClientWebSocketManagerConfig<IncomingServerMessage, OutgoingClientMessage>["messageHandlers"] = {
    initial_state: (msg) => setMessageLog(msg.data.messageLog),
    state_update: (msg) => setMessageLog(msg.data.messageLog),
  };

  const wsConfig: ClientWebSocketManagerConfig<IncomingServerMessage, OutgoingClientMessage> = {
    url: "ws://localhost:3000",
    debug: true,
    messageHandlers,
  };

  return (
    <WebSocketClientProvider {...wsConfig}>
      <MessageLogContext.Provider value={{ messageLog, setMessageLog }}>
        {children}
      </MessageLogContext.Provider>
    </WebSocketClientProvider>
  );
}

interface IMessageLogContext {
  messageLog: string[];
  setMessageLog: React.Dispatch<React.SetStateAction<string[]>>;
}
export const MessageLogContext = React.createContext<IMessageLogContext>({
  messageLog: [],
  setMessageLog: () => {},
});
```

---

## API Documentation

### WebSocketClientProvider

A context provider that sets up a **client-side WebSocket** instance when mounted and tears it down when unmounted.

**Generic Types**  
- `<TIncoming>` extends `BaseServerMessage`  
- `<TOutgoing>` extends `BaseClientMessage`

**Props**:  
- `url: string` – The WebSocket server URL.  
- `debug?: boolean` – Enable/disable console logs.  
- `messageHandlers?: { [K in TIncoming["type"]]?: (msg: Extract<TIncoming, { type: K }>) => void }` –  
  A map of handlers keyed by each incoming message type.  
- `onOpen?(): void` – Called when the socket opens.  
- `onClose?(event: CloseEvent): void` – Called when the socket closes.  
- `onError?(event: Event): void` – Called on socket error.

```ts
function WebSocketClientProvider<TIncoming extends BaseServerMessage, TOutgoing extends BaseClientMessage>(
  props: ClientWebSocketManagerConfig<TIncoming, TOutgoing> & {
    children: React.ReactNode;
  }
): JSX.Element;
```

### useWebSocketClient

A hook that gives access to the underlying client manager and some convenience state.

```ts
interface WebSocketClientContextValue {
  manager: ClientWebSocketManager<TIncoming, TOutgoing>;
  isOpen: boolean; 
  sendMessage(msg: TOutgoing): void;
  disconnect(): void;
}

/**
 * Must be used inside a <WebSocketClientProvider> context.
 */
function useWebSocketClient<TIncoming, TOutgoing>(): WebSocketClientContextValue;
```

### ClientWebSocketManager

A class that manages the low-level `WebSocket` connection. Typically you don’t instantiate this manually in your React app; it’s created by `WebSocketClientProvider`.

```ts
interface ClientWebSocketManagerConfig<TIncoming, TOutgoing> {
  url: string;
  debug?: boolean;
  onOpen?: () => void;
  onClose?: (event: CloseEvent) => void;
  onError?: (event: Event) => void;
  messageHandlers?: {
    [K in TIncoming["type"]]?: (message: Extract<TIncoming, { type: K }>) => void;
  };
}

class ClientWebSocketManager<TIncoming, TOutgoing> {
  constructor(config: ClientWebSocketManagerConfig<TIncoming, TOutgoing>);
  public disconnect(): void;
  public sendMessage(msg: TOutgoing): void;
}
```

---

## Performance Notes

- Uses **Bun**’s native `WebSocket` when available for faster I/O and reduced overhead.  
- Minimal external dependencies ensure smaller bundle size and faster startup.  
- The library avoids heavy frameworks or polyfills, relying on modern browser/Bun APIs.

---

## Configuration & Customization

- **Reconnection Logic**: You can implement custom reconnection inside `onClose` if desired.  
- **MessageHandlers**: Extend or alter the `messageHandlers` at any time for more dynamic plug-and-play behavior.  
- **Context Composition**: If you have multiple WebSocket endpoints, you can create multiple instances of `WebSocketClientProvider` with different contexts, or unify them behind a single provider.

---

## Testing

We recommend **Bun**’s test suite for quick and efficient testing:

```bash
bun test
```

**Client Testing**:
- Render your components using a testing library like `@testing-library/react`.  
- Mock the `WebSocket` to simulate incoming messages and test how your handlers respond.  

**Server Testing** (optional context if you also use `@bnk/websocket-manager`):
- You can unit-test each message handler by providing mock `getState` and `setState` functions and verifying state updates.

---

## Contributing

Contributions are welcome! Feel free to open issues, suggest enhancements, or submit PRs for bug fixes. For code style or testing guidelines:

1. **Fork** the repository and create a feature branch.  
2. **Implement** your changes.  
3. **Test** thoroughly using `bun test`.  
4. **Submit** a PR describing your changes.

---

## License

This project is available under the [MIT License](./LICENSE). Please see the license file for details.