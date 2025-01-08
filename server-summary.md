### Summary

- **Imports**:
  - `serve` from `bun`: Used to create an HTTP server.
  - `join` and `statSync` from `node:path` and `node:fs`: For file path manipulation and file system operations.
  - `router` from `server-router`: For handling HTTP routes.
  - Various route files (`chat-routes`, `project-routes`, etc.): Define API endpoints.
  - `globalStateSchema` from `shared`: For validating global state.
  - `wsManager` and `WebSocketData` from `@/websocket/websocket-manager`: For WebSocket management.
  - `json` from `@bnk/router`: For JSON responses.

- **Exported Functions**:
  - `instantiateServer`: Initializes and starts the server with WebSocket and HTTP routing capabilities.
    - **Usage**: Call this function to start the server with optional configuration (e.g., port).

- **Key Functions**:
  - `serveStatic`: Serves static files from the `client-dist` directory and handles 404s by serving `index.html`.
    - **Usage**: Called internally to serve static assets and handle client-side routing.

- **Server Configuration**:
  - **Ports**: `DEV_PORT` (3000) for development, `PROD_PORT` (3579) for production.
  - **Environment Check**: Determines the port based on the `DEV` environment variable.

- **Server Behavior**:
  - **Base URL (`/`)**: Serves `index.html`.
  - **WebSocket (`/ws`)**: Handles WebSocket upgrades and assigns a unique client ID.
  - **API Endpoints**:
    - `/api/health`: Returns a health check response.
    - `/api/state`: Handles GET (fetch state) and POST (update state) requests.
  - **Static Files**: Serves files like JS, CSS, images, etc., from `client-dist`.
  - **Client-Side Routing**: Serves `index.html` for frontend routes like `/projects` and `/chat`.

- **WebSocket Management**:
  - **Events**: Handles `open`, `close`, and `message` events using `wsManager`.

- **Server Initialization**:
  - The server starts automatically if the file is run directly (`import.meta.main`).

### Usage Example

```javascript
import { instantiateServer } from './path-to-this-file';

// Start the server with default configuration
instantiateServer();

// Start the server with a custom port
instantiateServer({ port: 4000 });
```
