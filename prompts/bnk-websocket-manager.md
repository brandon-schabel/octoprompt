# BNK WebSocket Monorepo

A **highly-focused**, **pluggable**, and **well-tested** monorepo for building real-time apps with Bun and TypeScript. This workspace contains two core packages—**@bnk/websocket-manager** (server-side) and **@bnk/websocket-manager-react** (client-side for React)—as well as example projects demonstrating basic and full-stack integrations.

---

## Table of Contents

1. [Introduction](#introduction)  
2. [Packages](#packages)  
   - [@bnk/websocket-manager](#bnkwebsocket-manager)  
   - [@bnk/websocket-manager-react](#bnkwebsocket-manager-react)  
3. [Installation](#installation)  
4. [Examples](#examples)  
   - [Example: Vanilla](#example-vanilla)  
   - [Example: Full-Stack React](#example-full-stack-react)  
5. [Basic Usage Snippet](#basic-usage-snippet)  
6. [Contributing](#contributing)  
7. [License](#license)

---

## Introduction

This monorepo offers a **type-safe**, **performant**, and **modular** solution for **WebSocket** applications built on [Bun](https://bun.sh/). It’s split into two main packages:

- **`@bnk/websocket-manager`**: A server-side manager for maintaining shared application state, broadcasting updates, and handling incoming messages in a strongly-typed manner.
- **`@bnk/websocket-manager-react`**: A lightweight React wrapper for the client, providing hooks and context to handle real-time updates with minimal overhead.

**Why BNK WebSocket Manager?**

- **Type Safety**: Define your incoming/outgoing message types and rely on TypeScript generics for robust compile-time checks.  
- **Performance**: Built for and tested on Bun’s fast WebSocket implementation.  
- **Plug-and-Play**: Use only what you need. Compose and extend handlers on the server side. Integrate seamlessly on the client side with React hooks.  
- **Minimal Dependencies**: Keep things lean—no heavy frameworks or libraries.  
- **Well-Tested**: Each package includes a comprehensive Bun test suite.

---

## Packages

### @bnk/websocket-manager

**Server-side** library for managing application state and broadcasting real-time updates. Features include:

- **Generic State Management**: Plug in any store (in-memory, DB, etc.).  
- **Message Handlers**: Register typed handlers for each message subtype.  
- **Broadcast**: Easily push updated state to all connected clients.  
- **Debuggable**: Use `debug: true` for verbose logs.

See [packages/websocket-manager/README.md](./packages/websocket-manager/README.md) for details.

### @bnk/websocket-manager-react

**Client-side** React utilities for strongly-typed WebSocket connections:

- **WebSocketClientProvider**: Wrap your app to manage one or more WebSocket connections.  
- **useWebSocketClient**: Use the shared connection state and send messages from any component.  
- **Pluggable Handlers**: Match message `type` to a typed handler function.

See [packages/websocket-manager-react/README.md](./packages/websocket-manager-react/README.md) for details.

---

## Installation

Install these packages individually in your Bun projects. For server-side logic:

```bash
bun add @bnk/websocket-manager
```

For React client integration:

```bash
bun add @bnk/websocket-manager-react
```

*(You can also use npm or yarn if you prefer, though Bun is recommended.)*

---

## Examples

This monorepo comes with two example workspaces to demonstrate usage:

### Example: Vanilla

Located at [packages/example-vanilla](./packages/example-vanilla). It sets up a **basic WebSocket server** that also serves the client files:

- **Server**: Uses `@bnk/websocket-manager` to track and broadcast state.  
- **Client**: A minimal HTML/JS example, connecting via a WebSocket.

To run:

```bash
cd packages/example-vanilla
bun run example-bun-server.ts
```

Open `http://localhost:3005` in your browser to see it in action.

### Example: Full-Stack React

Located at [packages/example-fullstack-react](./packages/example-fullstack-react). A **complete** React + Bun setup with:

- **Server**: A Bun server using `@bnk/websocket-manager`.  
- **Client**: A React app using `@bnk/websocket-manager-react`.  
- **Shared Types**: A `shared-types` package so that both server and client share the same message interfaces.

To run:

1. **Server**:

   ```bash
   cd packages/example-fullstack-react/server
   bun run src/index.ts
   ```

   This starts a Bun server on `http://localhost:3007`.

2. **Client**:

   ```bash
   cd ../client
   bun run dev
   ```

   This starts the React dev server on `http://localhost:3006`.

---

## Basic Usage Snippet

Below is a **simplified** example of how the two libraries work together.

<details>
<summary>Server (using <code>@bnk/websocket-manager</code>)</summary>

```ts
import { serve } from "bun";
import { WebSocketManager } from "@bnk/websocket-manager";

interface MyAppState {
  counter: number;
}

interface IncrementMessage {
  type: "increment";
  amount: number;
}

let currentState: MyAppState = { counter: 0 };

function getState(): Promise<MyAppState> {
  return Promise.resolve({ ...currentState });
}
function setState(newState: MyAppState): Promise<void> {
  currentState = { ...newState };
  return Promise.resolve();
}

const manager = new WebSocketManager<MyAppState, IncrementMessage>({
  getState,
  setState,
  messageHandlers: [
    {
      type: "increment",
      async handle(ws, msg, getState, setState) {
        const oldState = await getState();
        oldState.counter += msg.amount;
        await setState(oldState);
        // Optionally broadcast to all clients
        await manager.broadcastState();
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
    },
  },
});
```

</details>

<details>
<summary>Client (React using <code>@bnk/websocket-manager-react</code>)</summary>

```tsx
import React from "react";
import {
  WebSocketClientProvider,
  useWebSocketClient,
} from "@bnk/websocket-manager-react";

interface IncrementMessage {
  type: "increment";
  amount: number;
}
interface StateUpdate {
  type: "state_update";
  data: {
    counter: number;
  };
}

export function App() {
  return (
    <WebSocketClientProvider<StateUpdate, IncrementMessage>
      url="ws://localhost:3000"
      debug={true}
      messageHandlers={{
        state_update: (msg) => {
          console.log("Counter is now:", msg.data.counter);
        },
      }}
    >
      <CounterComponent />
    </WebSocketClientProvider>
  );
}

function CounterComponent() {
  const { sendMessage, isOpen } = useWebSocketClient<StateUpdate, IncrementMessage>();

  const increment = () => {
    sendMessage({ type: "increment", amount: 1 });
  };

  return (
    <div>
      <button onClick={increment} disabled={!isOpen}>
        Increment
      </button>
    </div>
  );
}
```

</details>

---

## License

This project is [MIT Licensed](./LICENSE). Feel free to use, modify, and distribute under the terms of the MIT license.
