# AI Streaming Engine

A powerful abstraction layer for streaming text completions from multiple AI providers through a single unified toolkit.

## Overview

`@bnk/ai` (AI Streaming Engine) provides a flexible, plugin-based abstraction for streaming AI-generated text from multiple providers such as OpenAI, Anthropic, Ollama, etc. The goal is for your application to integrate once, then swap or combine providers at will without modifying your client-side streaming logic.

**Key features**:

- **Unified streaming abstraction**: use one engine in your client code to handle partial message streaming, done signals, and error handling.
- **Plugin-based**: each AI provider is implemented as a plugin that knows how to prepare the request and parse the stream.
- **Simple SSE-based interface**: your app interacts with the engine through a set of handlers (e.g. `onPartial`, `onDone`).
- **Extensible**: easily add new providers by implementing a `ProviderPlugin`.

## How It Works

### Architecture

1. **Your application** calls `createSSEStream(params)` with:
   - **`userMessage`** and optionally a **`systemMessage`**  
   - The desired **plugin** (provider)
   - **Options** you want to pass to the provider (model, temperature, etc.)
   - **Handlers** for partial chunks, done signal, errors, etc.

2. **Inside `createSSEStream`**:
   - The plugin’s `prepareRequest()` method is called, returning a readable stream or reader containing the SSE data from the AI provider.
   - The engine reads SSE lines, calls the plugin’s `parseServerSentEvent()` to extract text chunks, and forwards them to your handlers (`onPartial`, `onDone`, etc.).
   - The engine also returns a **`ReadableStream<Uint8Array>`** which you could pipe back to your clients if desired (for real-time text updates in a browser).

3. **Plugins** (e.g. `OpenAiLikePlugin`, `AnthropicPlugin`) each implement:
   ```ts
   interface ProviderPlugin {
     prepareRequest(params: SSEEngineParams): Promise<ReadableStream<Uint8Array> | ReadableStreamDefaultReader<Uint8Array>>;
     parseServerSentEvent(line: string): string | null;
   }
   ```
   - **`prepareRequest()`** handles how to call the provider’s API and get back a streaming SSE.
   - **`parseServerSentEvent()`** extracts only the text from each SSE chunk, returning `[DONE]` or `null` when appropriate.

### Typical Usage

1. **Install** the package (private or local reference as appropriate):
   ```bash
   # e.g. if you're using bun or npm
   bun add @bnk/ai
   # or
   npm install @bnk/ai
   ```

2. **Import** the engine and plugin(s) you want:
   ```ts
   import { createSSEStream, OpenAiLikePlugin } from '@bnk/ai';

   // Initialize provider
   const plugin = new OpenAiLikePlugin(myOpenAiClient, 'gpt-4');
   ```

3. **Create the stream** and provide handlers:
   ```ts
   const userMessage = "Explain the concept of neural networks.";
   const handlers = {
     onPartial: (chunk) => {
       console.log("Partial chunk:", chunk.content);
     },
     onDone: (final) => {
       console.log("All done:", final.content);
     },
     onError: (error) => {
       console.error("Stream error:", error);
     },
   };

   const stream = await createSSEStream({
     userMessage,
     plugin, // e.g. OpenAiLikePlugin
     handlers,
     options: { model: "gpt-4", temperature: 0.5 }, // any provider-specific options
   });

   // You can also return or pipe this ReadableStream back to your client 
   // for in-browser SSE consumption, or handle it server-side.
   ```

## API

### `createSSEStream(params: SSEEngineParams): Promise<ReadableStream<Uint8Array>>`

Creates a new SSE stream. The `SSEEngineParams` object includes:

- `userMessage: string` – the user’s prompt
- `systemMessage?: string` – an optional system-level instruction
- `plugin: ProviderPlugin` – the provider plugin handling the request
- `options?: Record<string, any>` – any provider-specific options (model, temperature, etc.)
- `handlers: SSEEngineHandlers` – callbacks for partial, done, error, etc.

Example usage:
```ts
await createSSEStream({
  userMessage: "Hello world",
  systemMessage: "You are a helpful assistant",
  plugin: myPlugin,
  options: { model: "myModel", temperature: 0.9 },
  handlers: {
    onPartial: (chunk) => {
      console.log("Partial:", chunk.content);
    },
    onDone: (message) => {
      console.log("Complete:", message.content);
    },
  },
});
```

### Handlers

```ts
interface SSEEngineHandlers {
  onSystemMessage?: (message: SSEMessage) => void;
  onUserMessage?:   (message: SSEMessage) => void;
  onPartial?:       (partial: SSEMessage) => void;
  onDone?:          (fullContent: SSEMessage) => void;
  onError?:         (error: unknown, partialSoFar: SSEMessage) => void;
}
```

- **`onSystemMessage`**: Invoked once if a system message is provided.
- **`onUserMessage`**: Invoked for the user's message.
- **`onPartial`**: Invoked for each streamed chunk of assistant text.
- **`onDone`**: Final callback when the stream is complete or `[DONE]` is encountered.
- **`onError`**: If an error occurs, you get the error plus the text accumulated so far.

### Providers & Plugins

#### Creating a Plugin

To add a new provider, implement:
```ts
import { ProviderPlugin } from "@bnk/ai";

export class MyProviderPlugin implements ProviderPlugin {
  async prepareRequest(params: SSEEngineParams) {
    // 1) Call your provider's SSE or streaming API 
    // 2) Return a ReadableStream or the reader
  }

  parseServerSentEvent(line: string): string | null {
    // Convert SSE line to text chunk or "[DONE]" if the stream ended
  }
}
```
Then pass an instance to the engine via `plugin: new MyProviderPlugin(...)`.

#### Example: `OpenAiLikePlugin`
- Calls OpenAI’s streaming Chat Completions API.
- Returns a stream of SSE lines that the engine processes.

#### Example: `AnthropicPlugin`
- Calls Anthropic’s API.
- Parses its SSE format to gather partial text.

### Extending

You can build your own higher-level logic on top of this engine:
- Save partial responses to a database
- Stream updates to websockets or SSE endpoints
- Provide multiple fallback plugins (e.g., if one fails, switch to another)

## Repository Structure

- **`src/`** – main code for the streaming engine, plugins, and types
- **`src/streaming-engine.ts`** – core `createSSEStream` function
- **`src/streaming-types.ts`** – shared SSE engine types (`SSEEngineParams`, `SSEMessage`, etc.)
- **`src/plugins/`** – plugin implementations for different AI providers
- **`package.json`** – package metadata

## Getting Started

1. Install dependencies:
   ```bash
   bun install
   # or npm install
   ```
2. Build or run tests:
   ```bash
   bun test
   ```

## Contributing

Contributions are welcome! To add a new provider:
1. Create a new plugin in `src/plugins/`.
2. Implement `prepareRequest()` and `parseServerSentEvent()`.
3. Export it in `src/index.ts`.

## License

MIT License (or appropriate license text here)