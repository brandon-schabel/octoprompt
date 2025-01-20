# OctoPrompt

Welcome to **OctoPrompt**—your local-first, fully customizable chat-based code companion. Built on **Bun** (for blazing-fast server performance) and **React** (for a modern and responsive frontend), OctoPrompt is designed to make your dev life easier without bogging down your system. Because everything runs locally, you have complete control over your data and can fine-tune functionality to suit your needs.

## Key Features

- **Local-First**  
  Operates primarily on your local machine—no mandatory cloud dependencies—letting you keep your data where you want it.

- **Type Safe & Modular**  
  Written in TypeScript (both client and server). Flexible architecture to easily customize or extend functionality.

- **High Performance**  
  Uses **Bun** on the backend for top-notch speed with minimal overhead. Avoids heavy libraries and leans on built-in APIs.

- **Batteries Included**  
  Chat management, file watchers, prompts, code summarization, and more. Instantly ready for local dev tasks.

- **Customizable**  
  Extensible plugin-based design. Add or remove features, tweak watchers, or build your own modules.



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

---

## Project Setup

Below are the instructions for getting started with **OctoPrompt**. We use **Bun** for both installation and serving.

### Prerequisite

Make sure you have [Bun](https://bun.sh) installed.

#### macOS/Linux

```bash
curl -fsSL https://bun.sh/install | bash
```

#### Windows (PowerShell)

```bash
powershell -c "irm bun.sh/install.ps1 | iex"
```

### Installation & Setup

1. **Install dependencies and setup the project**:

   ```bash
   # Install all workspace dependencies
   bun install

   # Run the setup script (sets up database and other requirements)
   bun run setup
   ```

2. **Start the development servers**:
   From the root of the repo, you can start both the client and server together:

   ```bash
   bun run dev
   ```

   ### Start Client/Server Seperately
   
   #### Start just the client (runs on port 5173)
   
   ```bash
   
   bun run client:dev
   ```

   #### Start just the server (runs on port 3000)

   ```bash
   bun run server:dev
   ```

   The client will be available at [http://localhost:5173](http://localhost:5173)  

   The server will be available at [http://localhost:3000](http://localhost:3000)


## IMPORTANT - Configure Your Provider Keys
For the Providers you'll want to use you'll need to click the "Keys" button in the navbar and configure each of your provider keys. 
For example:
![Xnapper-2025-01-13-20 25 41](https://github.com/user-attachments/assets/3b87ca3e-3182-4271-8235-b98477f182ac)

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
- Click "Chat" in the Navbar
- Click **New Chat** in the top right of the Navbar to top right.  
- **Type** a question—OctoPrompt will respond in real-time, referencing your local files if you have them synced.

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

OctoPrompt consists of **TypeScript** modules both on the client and server side. Here’s a quick overview:

### Server Modules

1. **Router & Plugins** (e.g., `server-router.ts`)  
   - Responsible for request routing, including **CORS** and **Error Handling**.

2. **Service Layer** (e.g., `project-service.ts`, `file-sync-service.ts`, etc.)  
   - Encapsulates logic for project management, file watching, summarization, and prompt optimization.

3. **WebSocket Manager**  
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
- **Editor Links**: Use your favorite editor (VSCode, WebStorm, etc.) by configuring the open-file links in the UI.

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
