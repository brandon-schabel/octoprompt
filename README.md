# OctoPrompt

Software Toolkit For Rapidly Building Codebases Using AI

## Introduction

If you've worked with LLMs and code you know how much quality drops off with more code in the context. OctoPrompt helps with quality dropoff by helping you find and select the files from your codebase for your desired changes. OctoPrompt is a dev tool without AI first, and uses AI to enhance its abilities. The long term goal of OctoPrompt is to make building codebases with AI as easy as possible and to increasingly automate the manual work of planning changes, editing code, and testing the result.

## Quick Start

If you have [Bun](https://bun.sh/) installed then I'd recommend downloading the prebuilt Server/UI Bundle.

[Download OctoPrompt's Latest Prebuilt Bun Server and UI Bundle](https://github.com/brandon-schabel/octoprompt/releases/download/v0.5.3/octoprompt-0.5.3-bun-bundle.zip)

[Download OctoPrompt For MacOS arm64 Binary - M1 and Newer](https://github.com/brandon-schabel/octoprompt/releases/download/v0.5.3/octoprompt-0.5.3-macos-arm64.zip)

[Download OctoPrompt For Windows x64 Binary](https://github.com/brandon-schabel/octoprompt/releases/download/v0.5.3/octoprompt-0.5.3-windows-x64.zip)

[Download OctoPrompt For Linux x64 Binary](https://github.com/brandon-schabel/octoprompt/releases/download/v0.5.3/octoprompt-0.5.3-linux-x64.zip)

> Once you have downloaded OctoPrompt for your platform please read "Running Binaries", especially for MacOS

[View More Releases and Downloads](https://github.com/brandon-schabel/octoprompt/releases)

Don't have Bun but have NPM? Install Bun using NPM: `npm install -g bun`

Don't have NPM or Bun? Install Bun with curl on Mac/Linux `curl -fsSL https://bun.sh/install | bash` on Windows Powershell: `powershell -c "irm bun.sh/install.ps1 | iex"`

Extract the zip file and cd into the extracted zip file and run the OctoPrompt server.

```bash
cd octoprompt-0.5.3-bun-bundle && bun run start
```

[View Your Local OctoPrompt UI](http://localhost:3579/)

## OctoPrompt Project Overview page

![octoprompt-0-5-0-project-overview](https://github.com/user-attachments/assets/f92680e4-2877-488a-b336-79533c3999d4)

---

## Zero Config Dev Environment Setup

### Step 1 - Clone OctoPrompt

```bash
git clone https://github.com/brandon-schabel/octoprompt
```

### Step 2 - Install Bun with NPM

Note: Only needed if Bun isn't already installed.

```bash
cd octoprompt && npm install -g bun
```

### Step 3 - Install Repo Packages

```bash
bun i
```

### Step 4 - Start Server and Client

```bash
bun run dev
```

View the [Dev UI here](http://localhost:5173)

> If a file or folder doesn't show up that you need to show up, you can adjust your gitignore and/or update `packages/server/src/constants/file-sync-options.ts` file or your `.gitignore`

## Running Binaries

### Running on Linux

On Linux you should be able to just navigate to the octoprompt binary file in the terminal and run it for example:

```bash
cd ~/Downloads/octoprompt-v0.5.3
```

Run the linux binary file:

```bash
./octoprompt
```

### Running on MacOS

Currently I don't have MacOS code signing, so it just says the binary is damaged, but really it is quarntined. In order to run the binary on Mac you would have to do the following

```bash
cd ~/Downloads/octoprompt-v0.5.3
```

Then run to remove the quarantine:

```bash
sudo xattr -r -d com.apple.quarantine ./octoprompt
```

Finally  you can run the Octoprompt app by running the binary file as you normally would

```bash
./octoprompt
```

### Running on Windows

After downloading and extracting the appropriate zip file (e.g., `octoprompt-v0.5.3-windows-x64.zip`), open Command Prompt or PowerShell.

Navigate to the extracted folder. For example, if you extracted it to your Downloads folder:

```batch
cd %USERPROFILE%\Downloads\octoprompt-v0.5.3-windows-x64
```

Or using PowerShell:

```powershell
cd $env:USERPROFILE\Downloads\octoprompt-v0.5.3-windows-x64
```

Then, run the executable:

```batch
.\octoprompt.exe
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

Throwing in an entire codebase into LLMs will get you diminishing retuns as the codebase grows, however with OctoPrompt Your code will never be too complex. Instead of taking the spray and pray approach, OctoPrompt helps users be quick but precise with the built-in tools. OctoPrompt takes advantage of AI agents to perform everyday tasks with built in coding, planning, file summarization, and file search. OctoPrompt will help you maximize the quality of the code results from the AI models you're working with by providing the models with the precise context they need.

Save, manage, and include all your favorite prompts with the built-in prompt manager. Copy all context to clipboard with a single click to use with any AI API provider or use OctoPrompt built-in chat to use API Providers like OpenRouter, OpenAI or fast inference providers like Groq. OctoPrompt is an AI sandbox for your codebase and allows you to make architectural changes to your code faster than before, all without the hassle of an agent running up your API bill running around your repo. OctoPrompt works completely without AI models as well, it is a great AI context builder without the use of agents. Using OctoPrompt to build out context works really well because you are providing the AI with all the context it needs, but not overloading it with things it doesn't need - other tools suggest loading your repo into context which can be costly if using API and diminishes model output quality.

Thank you for checking out the project. If you have any questions please feel free to reach out and support Open Source by leaving a star.

You are always in control of your data. By default, everything runs locally, and the AI features are entirely optional, however you can run the AI features locally using on machine providers like Ollama and LM Studio. OctoPrompt AI can generate file summaries, plan tasks, and help with context-aware suggestions. If not, you still benefit from OctoPrompt's local file watchers, built-in ticket system, quick file searching, and prompt management.

## Key User Features

### **🏛️ Project Management View**

Manage and sync multiple projects in OctoPrompt. In the Projects view you can open several tabs, and each tab will hold its own state. This allows you to build multiple features in parallel or even just quickly switch between projects. OctoPrompt will always persist the state, even on page reload, because saving your work is important.

### **🛠️ Context Building Tools**

OctoPrompt has a great file search and file picking interface. As you pick files you will see files populate in the "Selected Files", and everything you add including files, prompts, and of course user input will be counted toward the context and you will be informed of how many tokens you are using. Context length is important for improved accuracy and cost, so you want to provide just what is needed.

### **🤖🕵️‍♂️ AI Agents**

OctoPrompt implements various AI features to help you deal with increasingly complex codebases. As codebases grow they can be hard to manage. OctoPrompt creates short summaries of every file in the codebase to build a solid understanding of the codebase. Using this knowledgebase it can help generate tasks for your tickets, suggest files to select based on your "user input".

### **🎟️ Ticket and Task Planning**

Write a ticket with an overview and let AI generate the ticket tasks for you. Because OctoPrompt has a built-in file summarization agent, it can use the full project summary context to help plan your next big feature.

### **💬 Built-In AI Chat**

Chat with any AI model. Configure and get started with using AI Chats built right into OctoPrompt, OctoPrompt supports numerous providers, and can support just about anything thanks to OctoPrompt using [AI SDK](https://sdk.vercel.ai/docs)

### **📚 Prompt Library**

Save your favorite prompts directly into OctoPrompt and import them into any project. This allows you to import and use prompts in any project. Importing prompts into project just creates an association so things don't get cluttered between projects.

### **⌨️ Key Bindings**

Quickly navigate through the navigation using keyboard commands, use the help button in the top right corner to view the available hotkeys.

## Features For Nerds

### **📝 Bun Server with OpenAPI Spec**

No guessing about what is going on, every OctoPrompt endpoint can be test using the [Swagger Endpoint](http://localhost:3147/swagger)

### **🏠 Local-First**

Operates entirely on your local machine—no mandatory cloud dependencies—letting you keep your data where you want it. Run OctoPrompt on your machine, and use local AI Models with Ollama or LM Studio

### **🔌 Customizable**

Built with proven technologies such as Bun, Hono, Open API, Zod, React, TanStack Router, ShadCN & Radix, Tailwind, Vite. OctoPrompt is a great platform to either extend or even build your own project on. Please share anything you build I would be interested :)

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

OctoPrompt has a built-in chat, experiment with different LLMs, get help with your programming problems.

![octoprompt-chat-page](https://github.com/user-attachments/assets/1a82618c-6e52-4956-92ef-95170447beb9)

### Project View

Select Files, Prompts, and Provide Instructions

![octoprompt-projects-view](https://github.com/user-attachments/assets/53f76bf9-c730-45f0-a602-59c845b6ff9d)

### Copy File Or Folder Contents, Summaries, and File Structures (Project Page)

With LLMs context is everything, sometimes you just need the file structured, sometimes you need the entire folder contents, copy whatever you need

![octoprompt-project-copy-folder-summary](https://github.com/user-attachments/assets/fa1f8a05-d6c9-41b0-b368-06e17931af07)

### AI File Suggestions (Project Page)

Let AI take the wheel and have it provide you suggested files based on your user input. This feature will take in your full project summary into considerdation and suggest files to you.

![octoprompt-suggested-files-view](https://github.com/user-attachments/assets/9a955bcd-d58c-40c3-90f0-b06c1e3a2582)

### Project Summary Page

Project summary page which has various settings for configuring which files should and shouldn't be summarized. For example
if you have large documents in your file you should exclude them. They likely wont get summarized anyway because they would likely
exceed the context limit, but better safe than sorry.

![octoprompt-project-summary-page](https://github.com/user-attachments/assets/1212a7eb-7a58-489d-b206-adca83e7f811)

### View Project Compiled Summary (Project Summary Page)

View the compiled full project summary in the projects summary page, used in the file suggestions and task generation.

![octoprompt-project-summary-overview-dialog](https://github.com/user-attachments/assets/e99c11ff-280e-4af7-b12e-6725dea16d5c)

### Prompt Management Page

Save and manage all your prompts on the prompt management page. Prompts are configured per project to not over crowd project prompts.

![octoprompt-prompts-page](https://github.com/user-attachments/assets/01777d7f-86d2-4aac-bd06-d1377971def1)

### Provider Keys Page

Save your API keys for each provider. Set limits on your API keys, set reasonable limits especially for development.

![octoprompt-provider-keys-page](https://github.com/user-attachments/assets/4869df1b-c1f6-4f7e-a5da-b3a584c0d178)

### Project Tickets Management Page

Use the ticket management page to plan your next features, tickets are scope per project.

![octoprompt-tickets-overview](https://github.com/user-attachments/assets/9950ae1e-3770-40a7-bb63-cddd2f3c03eb)

### Auto Generate Tasks (Tickets Page)

Generate tasks with AI with project specfic context using the full project summaries.

![octoprompt-generated-tasks-ticket-dialog](https://github.com/user-attachments/assets/b4d42880-1a36-4043-8ebc-6fe1c094cf76)

### Keyboard Shortcuts Dialog

Selected the wrong folder? Undo your select with `control/cmd + z` and redo with `control/cmd + shift +z`. Find other shortcuts in the top right of the app, there is a "?" which brings up a Dialog with various shortcuts that can be used throughout OctoPrompt

![octoprompt-keyboard-shortcuts-help-dialog](https://github.com/user-attachments/assets/cee0ecf2-21b0-4822-91cf-06f691258b88)

## Videos

<https://github.com/user-attachments/assets/dcdc4d34-fb67-4ec8-9544-426f7fe95eec>

---

### Start Client/Server Separately

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

## Usage Instructions

### IMPORTANT - Configure Your Provider Keys

#### In Order to use AI features you must configure providers keys and potentially your model config

If you choose to enable AI features, click the **"Keys"** button in the navbar and configure each provider key.  
For example:  
![Xnapper-2025-01-13-20 25 41](https://github.com/user-attachments/assets/3b87ca3e-3182-4271-8235-b98477f182ac)

Then select the appropriate provider. OpenRouter is recommended because it will give you access to many providers and models, however OctoPrompt supports other API Providers direct.
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

- **Open** your web client at [localhost:5173](http://localhost:5173).
- Click "Chat" in the Navbar.
- Click the chat icon and **New Chat** in the top-left.
- **Type** a question — OctoPrompt will respond in real-time. If you have a project synced, it can reference your local files in its responses.

Configure your model defaults for the OctoPrompt AI Features

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
cd dist/octoprompt-0.5.3-macos
```

then run the binary file for your platforms directory:

```bash
./octoprompt
```

## Contributing

We welcome all contributions—whether you're fixing a bug, adding a feature, or improving docs.  
General guidelines:

1. **Fork & Clone**
2. **Create** a new feature branch
3. **Implement** & Test
4. **Open** a Pull Request

Let's make OctoPrompt even better together!

---

## License

OctoPrompt is **open-source** under the [MIT License](./LICENSE). See [LICENSE](./LICENSE) for more details.

---

### Need Help or Have Questions?

Join our **[OctoPrompt Discord](https://discord.gg/dTSy42g8bV)** community for real-time support, feature requests, or casual chit-chat.

Stay local, stay customizable, and have fun building with **OctoPrompt**! Enjoy!
