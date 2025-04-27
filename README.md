# OctoPrompt

OctoPrompt Development Tool that allows you to use LLMs with your codebase efficiently. OctoPrompt helps you find the files you need quickly, and will detect file changes and use an agent to summarize files to help you plan tickets and tasks, suggest files to add to your context. There is also a built in prompt manager to save all your favorite prompts. Copy all files, prompts, and your request to clipboard with a single click to use with any AI API provider or use OctoPrompt built in chat to use API Providers like OpenRouter, OpenAI or fast inference providers like Groq. OctoPrompt is an AI sandbox for your code and allows you to make architectural changes to your code faster than before, all without the hassle an agent running up your API bill running around your repo. OctoPrompt is designed to help you with everything from planning tickets and tasks, to picking the files you need, choosing prompts to add to your context and packing that up to use with any API provider. OctoPrompt works completely without AI models as is very useful even without configuring any models.

Thank you for checkout out the project. If you have any questions please feel free to reach out and support Open Source by leaving a star.

## Introduction

At its core, you **open a code project**, and the server attaches **file watchers** to that project. You can optionally use an AI agent to **summarize your code files**, while another built-in agent helps you create **tickets** (like a lightweight JIRA) for new features, bug fixes, or any task you need. The AI-driven file summaries allow the ticket agent to create context-aware tasks. A third agent can suggest which specific files are needed to accomplish a ticket.

This workflow is particularly handy for **planning**:

1. **Summarize** your files to build context
2. **Create** a feature or bugfix ticket
3. **Generate** a list of tasks relevant to your codebase
4. **Copy** the tasks or code references with one click to paste them wherever you need—ChatGPT, Cursor, or any LLM interface.

You are always in control of your data. By default, everything runs locally, and the AI features are entirely optional, however you can run the AI features locally using on machine providers like Ollama and LM Studio. OctoPrompt AI can generate file summaries, plan tasks, and help with context-aware suggestions. If not, you still benefit from OctoPrompt’s local file watchers, built-in ticket system, quick file searching, and prompt management.

---

## Quick Start

### Step 1 - Clone OctoPrompt

```bash
git clone https://github.com/brandon-schabel/octoprompt
```

### Step 2 - Install Bun with NPM

Note: Only needed if Bun isn't already installed.

```bash
cd octoprompt && npm install -g bun
```

### Step 3 - Run Setup to Initialize DB

```bash
bun run setup
```

### Step 4 - Start Server and Client

```bash
bun run dev
```

Quick links:
[UI](http://localhost:5173)
[Server Base](http://localhost:3147)
[Swagger UI](http://localhost:3147/swagger)
[Open API Spec Endpoint](http://localhost:3147/doc)

> **Tip:** Even without setting up AI keys, you can still manage projects, create tickets, and explore OctoPrompt’s local file summarization functionality (if you skip AI usage, no external calls will be made).
> If a file or folder doesn't show up that you need to show up, you can adjust the inclusion and exlusion settings in the `packages/server/src/services/file-sync-service.ts` file.

---

## Key User Features

**🛠️ Context Building Tools**
  OctoPrompt has a great file search and file picking interface. As you pick files you will see file populate in the "Selected Files", and everything you add including fils, prompts, and of course user input will be counted toward the context and you will be informed of how many tokens you are using. Context length is important for improved accuracy and cost, so you want to provide just what is needed.

- **🎟️ Ticket and Task Planning**
  Write a ticket with an overview and let AI generate the ticket tasks for you. Because OctoPrompt has a built in file summarization agent, it can use the full project summary context to help plan your next big feature.

- **💬 Built In AI Chat**
  Configure and get start with using AI Chats  built right into OctoPrompt, OctoPrompt supports numerous providers, and can support just about anything thanks to OctoPrompt using [AI SDK](https://sdk.vercel.ai/docs)

- **📚 Prompt Library**
  Save your favorite prompts directly into OctoPrompt and import them into any project. This allows you to import and use prompts in any project. Importing prompts into project just creates an association so things don't get cluttered between projects.

- **🔥 High Performance**  
  Uses **Bun** on the backend for top-notch speed with minimal overhead. Avoids heavy libraries and leans on built-in APIs with heavy lift from Hono and Zod.

## Features For the Nerds

- **📝 Bun Server with OpenAPI Spec**
  No guessing about what is going on, every OctoPrompt endpoint can be test using the [Swagger Endpoint](http://localhost:3147/swagger)

- **🏠 Local-First**  
  Operates entirely on your local machine—no mandatory cloud dependencies—letting you keep your data where you want it. Run OctoPrompt on your machine, and use local AI Models with Ollam or LM Studio

- **🔌 Customizable**  
  Built with proven technologies such as  Bun, Hono, Open API, Zod, React, TanStack Router, ShadCN & Radix, Tailwind, Zustand, Vite. OctoPrompt is a great platform to either extend or even build your own project on. Please share anything you build I would be interested :)

- **🛟 Type Safe & Modular**  
  Written in TypeScript with full Zod validation. Flexible architecture to easily customize or extend functionality.

## Screenshots

### Project View, select files, prompts, and provid instructions

![tickets-1](https://github.com/user-attachments/assets/43f08ccd-6ae7-4325-a531-1438c3cf214c)

### View all tickets for your project

![tickets-2](https://github.com/user-attachments/assets/784cb82b-44d9-40e5-8692-d7d814afa5e1)

### Auto Generate a list of tasks based on the overview provided

![tickets-3](https://github.com/user-attachments/assets/ecac1202-ffda-4456-94ad-bd04edbcde95)

### Copy the contents of the ticket to your clipboard, in various formats

![tickets-4](https://github.com/user-attachments/assets/2de8190b-ff4c-4712-91a3-5ca59a129fc7)

### Chat with LLMs

![Xnapper-2024-12-26-13 55 19](https://github.com/user-attachments/assets/c234a42a-336e-4b9e-82c8-bec7e88ab570)

## Videos

<https://github.com/user-attachments/assets/dcdc4d34-fb67-4ec8-9544-426f7fe95eec>

---


2. **Start the development servers**:

From the root of the repo, you can start both the client and server together:

```bash
bun run dev
```

#### Start Client/Server Separately

- **Server Only** from the root (runs on port 3147):

```bash
bun run dev:server
```

- **Client Only** from the root (runs on port 5173):
Note: this will generate the `openapi-ts` client, the server must be running first.

```bash
bun run dev:client
```

The client is available at [http://localhost:5173](http://localhost:5173)  
The server is available at [http://localhost:3147](http://localhost:3147)

---

## IMPORTANT - Configure Your Provider Keys

If you choose to enable AI features, click the **"Keys"** button in the navbar and configure each provider key.  
For example:  
![Xnapper-2025-01-13-20 25 41](https://github.com/user-attachments/assets/3b87ca3e-3182-4271-8235-b98477f182ac)

## Configure your model defaults for the OctoPrompt AI Features

The default AI model configurations for various services are maintained in the file [shared/constants/model-default-configs.ts](./packages/shared/constants/model-default-configs.ts). This file centralizes settings such as the model to use, the response temperature, and the provider for each AI-related service, with more configurations to come.

---

## Production Build

OctoPrompt is designed with a streamlined production build process where the client is bundled and served directly from the server.

### Build Process

1. **Client Build**
   - The client's Vite configuration (`vite.config.ts`) is set up to output the production build to `../server/client-dist`
   - This means the built client files will be directly available to the server for serving static content
   - All test files are automatically excluded from the production build

2. **Server Build**  
   The server's build process (`build.ts`) handles several key steps:
   - Builds the client first and includes it in the server distribution
   - Bundles the server as a minimized JS bundle
   - Creates and migrates a fresh SQLite database for production
   - Generates platform-specific standalone executables for:
     - Linux (x64)
     - macOS (x64, arm64)
     - Windows (x64)
   - Creates distributable zip archives for each platform

### Running Production Build

To create a production build:

```bash
# From the root directory
cd packages/server
bun run build
```

The build process will:

1. Clear the previous dist directory  
2. Build the client and copy it to the server's static files directory  
3. Bundle the server with the client files  
4. Create platform-specific executables  
5. Package everything into distributable zip files  

The final builds will be available in `packages/server/dist/`, with separate zip files for each supported platform.

Each distribution includes:

- The standalone server executable
- Pre-migrated SQLite database
- Built client files (served automatically by the server)

---

## Usage Examples

Below are some ways you might interact with OctoPrompt once it’s up and running.

### 1. Simple Local Chat

- **Open** your web client at [localhost:5173](http://localhost:5173).
- Click "Chat" in the Navbar.
- Click **New Chat** in the top-right corner.
- **Type** a question—OctoPrompt will respond in real-time. If you have a project synced, it can reference your local files in its responses.

### 2. File Summaries & Suggestions

- In the **Projects** section, select or create a project.  
- Sync your codebase by pressing **Sync**.  
- OctoPrompt automatically watches for file changes.  
- Switch to **Chat** and link your project.  
- Type a code-related question—OctoPrompt will gather context from your local files and suggest relevant snippets.

### 3. Advanced Configuration

- Edit watchers and ignore patterns under **Project Summarization**.  
- Manage code providers (like OpenAI, Anthropic, or local LLMs) under **Keys**.  
- Tweak user prompts or create new ones for specialized workflows—e.g., test generation or advanced code refactoring.

---

## API Documentation (High-Level)

OctoPrompt consists of **TypeScript** modules on both the client and server side. Here’s a quick overview:

### Server Modules

1. **Router & Plugins** (e.g., `server-router.ts`)  
   - Responsible for request routing, including **CORS** and **Error Handling**.

2. **Service Layer** (e.g., `project-service.ts`, `file-sync-service.ts`, etc.)  
   - Encapsulates logic for project management, file watching, summarization, and prompt optimization.

3. **Sync Engine based on WebSockets**  
   - Provides real-time updates for file changes or chat messages.

4. **Model Providers**  
   - Integrates with local or external LLMs to fulfill queries and summarizations.

### Client Modules

1. **Routes** (React + TypeScript)  
   - `projects.tsx`, `chat.tsx`, `keys.tsx`, etc.  
   - Each route uses a tab-based UI for your projects and chats.

2. **Hooks** (API + Utility)  
   - Reusable for data fetching (`useGetProjects`, `useGetKeys`) and local UI state management (`useSelectedFiles`).

3. **Global State**  
   - Managed via shared context and React’s modern features, giving you a single source of truth.

### Additional Notables

- **Promptimizer**  
  Fine-tunes user inputs for more accurate or concise model queries.  
- **File Summaries**  
  Summaries stored locally in the DB. Combines with watchers for continuous updates.

---

## Performance Notes

- **Bun** is used for the server to minimize overhead and speed up file operations.  
- Uses streaming responses for chat messages—no large in-memory buffers.  
- Minimal external libraries, leaning on built-in Node/Bun capabilities whenever possible.

---

## Configuration & Customization

- **Local-First**: By default, everything runs on your local environment. You decide if/when to bring in cloud APIs.  
- **File Watchers**: Add patterns to ignore or allow certain files. Summaries update automatically.  
- **Custom Prompts**: Create specialized prompts for your tasks. Share them with your teammates if you like.  
- **Editor Links**: Use your favorite editor (VSCode, WebStorm, etc.) by configuring open-file links in the UI.
- **Audio Input**: While OctoPrompt supports audio input, something like [SuperWhisper]("https://superwhisper.com/") works better since it can accessed anywhere.

---

## Testing

OctoPrompt is set up with **Bun’s native test runner** on the server side:

- Run tests once:

  ```bash
  bun test
  ```

- Run tests in watch mode:

  ```bash
  bun test --watch
  ```

Feel free to add your own client tests (e.g., React testing libraries) or integrate with any test tools you prefer.

---

## Contributing

We welcome all contributions—whether you’re fixing a bug, adding a feature, or improving docs.  
General guidelines:

1. **Fork & Clone**  
2. **Create** a new feature branch  
3. **Implement** & Test  
4. **Open** a Pull Request

Let’s make OctoPrompt even better together!

---

## License

OctoPrompt is **open-source** under the [MIT License](./LICENSE). See [LICENSE](./LICENSE) for more details.

---

### Need Help or Have Questions?

Join our **[OctoPrompt Discord](https://discord.gg/dTSy42g8bV)** community for real-time support, feature requests, or casual chit-chat.

Stay local, stay customizable, and have fun building with **OctoPrompt**! Enjoy!
