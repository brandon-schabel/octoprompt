# Promptliano

[![Website Deployment](https://github.com/brandon-schabel/promptliano/actions/workflows/deploy-website.yml/badge.svg)](https://github.com/brandon-schabel/promptliano/actions/workflows/deploy-website.yml)
[![GitHub Pages](https://img.shields.io/badge/Website-promptliano.com-blue)](https://promptliano.com)

Your AI toolkit for context engineering.

## Introduction

If you've worked with LLMs and code you know how much quality drops off with more code in the context. Promptliano helps with quality dropoff by helping you find and select the files from your codebase for your desired changes. Promptliano is a dev tool without AI first, and uses AI to enhance its abilities. The long term goal of Promptliano is to make building codebases with AI as easy as possible and to increasingly automate the manual work of planning changes, editing code, and testing the result.

## Quick Start

### Option 1: CLI Setup (Recommended)

The easiest way to get started with Promptliano is using our CLI tool:

```bash
npx promptliano@latest
```

This will:
- Download and install the Promptliano server
- Configure MCP for your AI editor (Claude, Cursor, etc.)
- Start the server automatically
- Guide you through creating your first project

> **Note:** Using `@latest` ensures you always run the most recent version. No installation required!

### Option 2: Manual Download

If you prefer to download and run Promptliano manually:

[Download Promptliano's Latest Prebuilt Bun Server and UI Bundle](https://github.com/brandon-schabel/promptliano/releases/download/v0.8.3/promptliano-0.8.3-bun-bundle.zip)

[Download Promptliano For MacOS arm64 Binary - M1 and Newer](https://github.com/brandon-schabel/promptliano/releases/download/v0.8.3/promptliano-0.8.3-macos-arm64.zip)

[Download Promptliano For Windows x64 Binary](https://github.com/brandon-schabel/promptliano/releases/download/v0.8.3/promptliano-0.8.3-windows-x64.zip)

[Download Promptliano For Linux x64 Binary](https://github.com/brandon-schabel/promptliano/releases/download/v0.8.3/promptliano-0.8.3-linux-x64.zip)

> Once you have downloaded Promptliano for your platform please read "Running Binaries", especially for MacOS

[View More Releases and Downloads](https://github.com/brandon-schabel/promptliano/releases)

Don't have Bun but have NPM? Install Bun using NPM: `npm install -g bun`

Don't have NPM or Bun? Install Bun with curl on Mac/Linux `curl -fsSL https://bun.sh/install | bash` on Windows Powershell: `powershell -c "irm bun.sh/install.ps1 | iex"`

Extract the zip file and cd into the extracted zip file and run the Promptliano server.

```bash
cd promptliano-0.8.3-bun-bundle && bun run start
```

### Access Promptliano

[View Your Local Promptliano UI](http://localhost:3579/)

## MCP Setup Quick Start

Connect Promptliano to Claude Desktop or Cursor for AI-powered codebase access.

### Prerequisites

1. Have Promptliano running (`bun run start` or `bun run dev`)
2. Create a project in Promptliano and note the Project ID

### Claude Desktop Setup

1. **Edit config file:**
   - **macOS**: `~/Library/Application Support/Claude/claude_desktop_config.json`
   - **Windows**: `%APPDATA%\Claude\claude_desktop_config.json`

2. **Add Promptliano server:**

```json
{
  "mcpServers": {
    "promptliano": {
      "command": "/absolute/path/to/promptliano/packages/server/mcp-start.sh"
    }
  }
}
```

3. **Restart Claude Desktop**

### Cursor Setup

1. **Open Cursor Settings** → **Features** → **Model Context Protocol**
2. **Add server:**
   - **Name**: `promptliano`
   - **Command**: `/absolute/path/to/promptliano/packages/server/mcp-start.sh`

3. **Restart Cursor**

### Test Connection

Ask Claude/Cursor: _"What files are in this project?"_ or _"Give me a project summary"_

> **Note**: Replace `/absolute/path/to/promptliano` with your actual Promptliano installation path and `YOUR_PROJECT_ID` with your project ID.

For detailed setup instructions, see [MCP-SETUP.md](./MCP-SETUP.md).

## Promptliano Project Overview page

![promptliano-0-5-0-project-overview](https://github.com/user-attachments/assets/f92680e4-2877-488a-b336-79533c3999d4)

---

## Zero Config Dev Environment Setup

### Step 1 - Clone Promptliano

```bash
git clone https://github.com/brandon-schabel/promptliano
```

### Step 2 - Install Bun with NPM

Note: Only needed if Bun isn't already installed.

```bash
cd promptliano && npm install -g bun
```

### Step 3 - Install Repo Packages

```bash
bun i
```

### Step 4 - Start Server and Client

```bash
bun run dev
```

View the [Dev UI here](http://localhost:1420)

> If a file or folder doesn't show up that you need to show up, you can adjust your gitignore and/or update `packages/server/src/constants/file-sync-options.ts` file or your `.gitignore`

## Running Binaries

### Running on Linux

On Linux you should be able to just navigate to the promptliano binary file in the terminal and run it for example:

```bash
cd ~/Downloads/promptliano-v0.8.3
```

Run the linux binary file:

```bash
./promptliano
```

### Running on MacOS

Currently I don't have MacOS code signing, so it just says the binary is damaged, but really it is quarntined. In order to run the binary on Mac you would have to do the following

```bash
cd ~/Downloads/promptliano-v0.8.3
```

Then run to remove the quarantine:

```bash
sudo xattr -r -d com.apple.quarantine ./promptliano
```

Finally you can run the Promptliano app by running the binary file as you normally would

```bash
./promptliano
```

### Running on Windows

After downloading and extracting the appropriate zip file (e.g., `promptliano-v0.8.3-windows-x64.zip`), open Command Prompt or PowerShell.

Navigate to the extracted folder. For example, if you extracted it to your Downloads folder:

```batch
cd %USERPROFILE%\Downloads\promptliano-v0.8.3-windows-x64
```

Or using PowerShell:

```powershell
cd $env:USERPROFILE\Downloads\promptliano-v0.8.3-windows-x64
```

Then, run the executable:

```batch
.\promptliano.exe
```

### Documentation Quick Links

[Projects Screen User Guide](./docs/projects.md)

[General AI Concepts](./docs/general-ai-concepts.md)

[Coding Agent User Guide](./docs/coding-agent.md)

[Chat Screen User Guide](./docs/chat.md)

[Prompts Page User Guide](./docs/prompts.md)

[Provider Keys Page User Guide](./docs/provider-keys.md)

### Other Links

[Server Base](http://localhost:3147)

[Swagger UI](http://localhost:3147/swagger)

[Open API Spec Endpoint](http://localhost:3147/doc)

---

### Repo Management Made Easy

Throwing in an entire codebase into LLMs will get you diminishing retuns as the codebase grows, however with Promptliano Your code will never be too complex. Instead of taking the spray and pray approach, Promptliano helps users be quick but precise with the built-in tools. Promptliano takes advantage of AI agents to perform everyday tasks with built in coding, planning, file summarization, and file search. Promptliano will help you maximize the quality of the code results from the AI models you're working with by providing the models with the precise context they need.

Save, manage, and include all your favorite prompts with the built-in prompt manager. Copy all context to clipboard with a single click to use with any AI API provider or use Promptliano built-in chat to use API Providers like OpenRouter, OpenAI or fast inference providers like Groq. Promptliano is an AI sandbox for your codebase and allows you to make architectural changes to your code faster than before, all without the hassle of an agent running up your API bill running around your repo. Promptliano works completely without AI models as well, it is a great AI context builder without the use of agents. Using Promptliano to build out context works really well because you are providing the AI with all the context it needs, but not overloading it with things it doesn't need - other tools suggest loading your repo into context which can be costly if using API and diminishes model output quality.

Thank you for checking out the project. If you have any questions please feel free to reach out and support Open Source by leaving a star.

You are always in control of your data. By default, everything runs locally, and the AI features are entirely optional, however you can run the AI features locally using on machine providers like Ollama and LM Studio. Promptliano AI can generate file summaries, plan tasks, and help with context-aware suggestions. If not, you still benefit from Promptliano's local file watchers, built-in ticket system, quick file searching, and prompt management.

## Key User Features

### **🏛️ Project Management View**

Manage and sync multiple projects in Promptliano. In the Projects view you can open several tabs, and each tab will hold its own state. This allows you to build multiple features in parallel or even just quickly switch between projects. Promptliano will always persist the state, even on page reload, because saving your work is important.

### **🛠️ Context Building Tools**

Promptliano has a great file search and file picking interface. As you pick files you will see files populate in the "Selected Files", and everything you add including files, prompts, and of course user input will be counted toward the context and you will be informed of how many tokens you are using. Context length is important for improved accuracy and cost, so you want to provide just what is needed.

### **🤖🕵️‍♂️ AI Agents**

Promptliano implements various AI features to help you deal with increasingly complex codebases. As codebases grow they can be hard to manage. Promptliano creates short summaries of every file in the codebase to build a solid understanding of the codebase. Using this knowledgebase it can help generate tasks for your tickets, suggest files to select based on your "user input".

### **🎟️ Ticket and Task Planning**

Write a ticket with an overview and let AI generate the ticket tasks for you. Because Promptliano has a built-in file summarization agent, it can use the full project summary context to help plan your next big feature.

### **💬 Built-In AI Chat**

Chat with any AI model. Configure and get started with using AI Chats built right into Promptliano, Promptliano supports numerous providers, and can support just about anything thanks to Promptliano using [AI SDK](https://sdk.vercel.ai/docs)

### **📚 Prompt Library**

Save your favorite prompts directly into Promptliano and import them into any project. This allows you to import and use prompts in any project. Importing prompts into project just creates an association so things don't get cluttered between projects.

### **⌨️ Key Bindings**

Quickly navigate through the navigation using keyboard commands, use the help button in the top right corner to view the available hotkeys.

## Configuration Options

Promptliano uses a centralized configuration system that allows customization through environment variables.

### Environment Variables

Configure Promptliano behavior by setting these environment variables:

- `NODE_ENV` - Set to `development`, `test`, or `production` (affects server port and behavior)
- `SERVER_PORT` - Override the default server port (default: 3147 for dev, 3579 for production)
- `CLIENT_URL` - Override the client URL (default: <http://localhost:1420>)
- `API_URL` - Override the API URL (default: <http://localhost:3147>)
- `CORS_ORIGIN` - Set custom CORS origin (default: allows localhost and tauri origins)
- `DOMAIN` - Set your domain for CORS configuration

### AI Provider Configuration

- `DEFAULT_MODEL_PROVIDER` - Set the default AI provider for all models (openai, anthropic, google, groq, openrouter, etc.)
- `OLLAMA_BASE_URL` - Override Ollama base URL (default: <http://localhost:11434>)
- `LMSTUDIO_BASE_URL` - Override LMStudio base URL (default: <http://localhost:1234/v1>)

### Default Model Configurations

Promptliano provides three preset model configurations:

- **LOW**: Fast, cost-effective model (10k max tokens)
- **MEDIUM**: Balanced performance (25k max tokens)
- **HIGH**: Maximum capability (50k max tokens)

All models default to using Google's Gemini 2.5 Flash via OpenRouter. You can change the provider and model through the UI or by setting environment variables.

## Features For Nerds

### **📝 Bun Server with OpenAPI Spec**

No guessing about what is going on, every Promptliano endpoint can be test using the [Swagger Endpoint](http://localhost:3147/swagger)

### **🏠 Local-First**

Operates entirely on your local machine—no mandatory cloud dependencies—letting you keep your data where you want it. Run Promptliano on your machine, and use local AI Models with Ollama or LM Studio

### **🔌 Customizable**

Built with proven technologies such as Bun, Hono, Open API, Zod, React, TanStack Router, ShadCN & Radix, Tailwind, Vite. Promptliano is a great platform to either extend or even build your own project on. Please share anything you build I would be interested :)

### **🛟 Type Safe & Modular**

Written in TypeScript with full back-to-front Zod validation. All types are generated from the schemas which are the source of truth for the data/validations. Flexible architecture to easily customize or extend functionality.

### **🔥 High Performance**

Uses **Bun** on the backend for top-notch speed with minimal overhead. Avoids heavy libraries and leans on built-in APIs with heavy lift from Hono and Zod.

## Tech Stack

Thank you to the following projects - and everything that came before

[Bun](https://bun.sh/)
[Hono](https://hono.dev/)
[Swagger W/ OpenAPI](https://swagger.io/)
[Zod](https://zod.dev/)
[AI SDK](https://sdk.vercel.ai/)

### UI Only

[React W/ Vite](https://react.dev/)
[Tanstack Router and Query](https://tanstack.com/)
[Shad CN](https://ui.shadcn.com/)
[Radix UI - Used By ShadCN](https://www.radix-ui.com/)
[Tailwind CSS](https://tailwindcss.com/)

## Screenshots and Descriptions

### Chat with LLMs

Promptliano has a built-in chat, experiment with different LLMs, get help with your programming problems.

![promptliano-chat-page](https://github.com/user-attachments/assets/1a82618c-6e52-4956-92ef-95170447beb9)

### Project View

Select Files, Prompts, and Provide Instructions

![promptliano-projects-view](https://github.com/user-attachments/assets/53f76bf9-c730-45f0-a602-59c845b6ff9d)

### Copy File Or Folder Contents, Summaries, and File Structures (Project Page)

With LLMs context is everything, sometimes you just need the file structured, sometimes you need the entire folder contents, copy whatever you need

![promptliano-project-copy-folder-summary](https://github.com/user-attachments/assets/fa1f8a05-d6c9-41b0-b368-06e17931af07)

### AI File Suggestions (Project Page)

Let AI take the wheel and have it provide you suggested files based on your user input. This feature will take in your full project summary into considerdation and suggest files to you.

![promptliano-suggested-files-view](https://github.com/user-attachments/assets/9a955bcd-d58c-40c3-90f0-b06c1e3a2582)

### Project Summary Page

Project summary page which has various settings for configuring which files should and shouldn't be summarized. For example
if you have large documents in your file you should exclude them. They likely wont get summarized anyway because they would likely
exceed the context limit, but better safe than sorry.

![promptliano-project-summary-page](https://github.com/user-attachments/assets/1212a7eb-7a58-489d-b206-adca83e7f811)

### View Project Compiled Summary (Project Summary Page)

View the compiled full project summary in the projects summary page, used in the file suggestions and task generation.

![promptliano-project-summary-overview-dialog](https://github.com/user-attachments/assets/e99c11ff-280e-4af7-b12e-6725dea16d5c)

### Prompt Management Page

Save and manage all your prompts on the prompt management page. Prompts are configured per project to not over crowd project prompts.

![promptliano-prompts-page](https://github.com/user-attachments/assets/01777d7f-86d2-4aac-bd06-d1377971def1)

### Provider Keys Page

Save your API keys for each provider. Set limits on your API keys, set reasonable limits especially for development.

![promptliano-provider-keys-page](https://github.com/user-attachments/assets/4869df1b-c1f6-4f7e-a5da-b3a584c0d178)

### Project Tickets Management Page

Use the ticket management page to plan your next features, tickets are scope per project.

![promptliano-tickets-overview](https://github.com/user-attachments/assets/9950ae1e-3770-40a7-bb63-cddd2f3c03eb)

### Auto Generate Tasks (Tickets Page)

Generate tasks with AI with project specfic context using the full project summaries.

![promptliano-generated-tasks-ticket-dialog](https://github.com/user-attachments/assets/b4d42880-1a36-4043-8ebc-6fe1c094cf76)

### Keyboard Shortcuts Dialog

Selected the wrong folder? Undo your select with `control/cmd + z` and redo with `control/cmd + shift +z`. Find other shortcuts in the top right of the app, there is a "?" which brings up a Dialog with various shortcuts that can be used throughout Promptliano

![promptliano-keyboard-shortcuts-help-dialog](https://github.com/user-attachments/assets/cee0ecf2-21b0-4822-91cf-06f691258b88)

## Videos

<https://github.com/user-attachments/assets/dcdc4d34-fb67-4ec8-9544-426f7fe95eec>

---

### Start Client/Server Separately

- **Server Only** from the root (runs on port 3147):

```bash
bun run dev:server
```

- **Client Only** from the root (runs on port 1420):

```bash
bun run dev:client
```

The client is available at [http://localhost:1420](http://localhost:1420)  
The server is available at [http://localhost:3147](http://localhost:3147)

---

## Usage Instructions

### IMPORTANT - Configure Your Provider Keys

#### In Order to use AI features you must configure providers keys and potentially your model config

If you choose to enable AI features, click the **"Keys"** button in the navbar and configure each provider key.  
For example:  
![Xnapper-2025-01-13-20 25 41](https://github.com/user-attachments/assets/3b87ca3e-3182-4271-8235-b98477f182ac)

Then select the appropriate provider. OpenRouter is recommended because it will give you access to many providers and models, however Promptliano supports other API Providers direct.
Lastly input the API key from your providers.

#### Supported Providers Keys Pages Links

[OpenRouter](https://openrouter.ai/settings/keys)
[Open AI](https://platform.openai.com/api-keys)
[XAI](https://console.x.ai)
[Google Gemini](https://aistudio.google.com/app/apikey)
[Anthropic - AKA Claude Models](https://console.anthropic.com/settings/keys)
[Groq - Fast Inference](https://console.groq.com/keys)

#### Local Providers (FREE!)

You can always install local models with software like:
[Ollama](https://ollama.com/download)
[LM Studio](https://lmstudio.ai/)

### 1. Simple Local Chat

- **Open** your web client at [localhost:1420](http://localhost:1420).
- Click "Chat" in the Navbar.
- Click the chat icon and **New Chat** in the top-left.
- **Type** a question — Promptliano will respond in real-time. If you have a project synced, it can reference your local files in its responses.

Configure your model defaults for the Promptliano AI Features

The default AI model configurations for various services are maintained in the file [shared/constants/model-default-configs.ts](./packages/shared/constants/model-default-configs.ts). This file centralizes settings such as the model to use, the response temperature, and the provider for each AI-related service, with more configurations to come.

---

## Tauri Desktop App Builds

Promptliano now includes a native desktop app built with Tauri for better performance and OS integration.

### Quick Build Commands

```bash
# Development build (no code signing, local testing only)
./scripts/release-tauri.sh --skip-signing

# Production build (signed & notarized for distribution)
./scripts/release-tauri.sh --universal --notarize
```

### Build Types

1. **Development Build** - Quick builds for testing
   - No code signing required
   - Runs immediately on your machine
   - Output: `tauri-builds/` directory

2. **Production Build** - For distribution
   - Requires Apple Developer certificate (macOS)
   - Creates universal binary (Intel + Apple Silicon)
   - Automatically notarized by Apple
   - Output: `release-bundles/` with platform-specific installers

### Requirements

- **All Platforms**: Rust toolchain (`curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh`)
- **macOS**: Apple Developer account for signing ($99/year)
- **Windows**: Visual Studio Build Tools
- **Linux**: Various system libraries (see Tauri docs)

### Output Files

After building, find your installers in `release-bundles/`:

- **macOS**: `.dmg` files
- **Windows**: `.exe` installer
- **Linux**: `.deb`, `.AppImage`, and `.rpm` packages

For detailed setup instructions, see [docs/TAURI_BUILD_GUIDE.md](./docs/TAURI_BUILD_GUIDE.md).

## Production Build (Server Binaries)

Promptliano is designed with a streamlined production build process where the client is bundled and served directly from the server.

### Build Process

1. **Client Build**
   - The client's Vite configuration (`vite.config.ts`) is set up to output the production build to `../server/client-dist`
   - This means the built client files will be directly available to the server for serving static content
   - All test files are automatically excluded from the production build

2. **Server Build**  
   The server's build process (`build-binaries.ts`) handles several key steps:
   - Builds the client first and includes it in the server distribution
   - Bundles the server as a minimized JS bundle
   - Generates platform-specific standalone executables for:
     - Linux (x64)
     - macOS (arm64, x64 )
     - Windows (x64)
   - Creates distributable zip archives for each platform

### Running Production Build

To create a production build:

```bash
bun run build-binaries
```

then navigate to the built binaries in `/dist` - in this case for MacOS arm64

```bash
cd dist/promptliano-0.8.3-macos
```

then run the binary file for your platforms directory:

```bash
./promptliano
```

## Contributing

We welcome all contributions—whether you're fixing a bug, adding a feature, or improving docs.  
General guidelines:

1. **Fork & Clone**
2. **Create** a new feature branch
3. **Implement** & Test
4. **Open** a Pull Request

Let's make Promptliano even better together!

---

## License

Promptliano is **open-source** under the [MIT License](./LICENSE). See [LICENSE](./LICENSE) for more details.

---

### Need Help or Have Questions?

Join our **[Promptliano Discord](https://discord.gg/Z2nDnVQKKm)** community for real-time support, feature requests, or casual chit-chat.

Stay local, stay customizable, and have fun building with **Promptliano**! Enjoy!
