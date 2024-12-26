# OctoPrompt Usage Guide

Welcome to OctoPrompt, your prompt-building and chat companion designed to streamline and enhance your development workflow. This guide will walk you through every feature, from setting up projects, syncing files, managing prompts, and engaging with chat capabilities via local models or external APIs.

## Overview

OctoPrompt helps you:

- Load and manage projects, including syncing and exploring your code files
- Create, save, and reuse custom prompts
- Interact with a variety of Large Language Models (LLMs) through a chat interface
- Fork chats from specific messages or exclude certain messages to refine context
- Optimize your prompt tokens and keep track of token usage

Use OctoPrompt to streamline code analysis, generate solutions, and integrate intelligence into your development workflow.

---

## Getting Started

### Running the App

Please ensure you have downloaded the correct binary for you platform.
M Series mac need to be using the "macos-arm64" version.
For Linux and Mac: Open a terminal in the root of the directory directory for your platform, run the file for the current version you downloaded.

```bash
./octoprompt-v1.0.6
```

This will start the server at [http://localhost:3579](http://localhost:3579)

For Windows:
I haven't had a chance to try it yet, but you should be able to just run the .exe files in the version compiled for Windows and it should spin up the server on [http://localhost:3579](http://localhost:3579)

## Key Concepts

### Projects & Files

**Projects** represent local codebases or folders that you want to integrate with OctoPrompt. By selecting a project path, you can sync the project to load and view its files within the app. This allows you to quickly reference code segments when building prompts or discussing them with the chat AI.

- **Setting a Project Path**:  
  Open the “Projects” page, click "New Project" (or press `⌘N`), enter the project’s directory path on your local machine.  
  *Note: The path should be accessible to the server.*

- **Syncing a Project**:  
  Once a project is created, select it and click "Sync Files" to load or update the project’s files. Syncing ensures OctoPrompt has the latest version of your code. The app will parse supported file types (`.ts`, `.tsx`, `.js`, `.jsx`, `.md`, `.txt`) and list them, allowing you to select which files to include in your prompts.

- **Selecting Files for Prompts**:  
  After syncing, you can browse the file tree or a tabular view. Select files by checking the box next to them. Selected files can be integrated directly into prompts.

### Prompts

**Prompts** are reusable templates or instructions you craft for the AI. You can create, save, and manage prompts within each project.

- **Creating a Prompt**:  
  Navigate to the "Prompts" section in your selected project. Click "New" and provide a name and content.  
  For example:  
  **Name**: "Summarize Code"  
  **Content**: "Please summarize the functionality of the selected files."

- **Editing & Deleting Prompts**:  
  Use the edit (pencil) or delete (trash) icons next to a prompt. Editing allows you to refine the instructions; deleting removes it from your project.

- **Using Prompts in Chat**:  
  You can select multiple saved prompts and easily include them in your chat context. This is helpful for consistently applying specific instructions or formatting guidance.

---

## Chat Capabilities

### Overview

The chat interface allows you to interact with LLMs to:

- Discuss your code
- Brainstorm feature implementations
- Debug complex issues
- Generate new code snippets

You can supply the chat with:

- **Selected Files**: The chat can read and reason about your chosen code files.
- **Saved Prompts**: Reuse your prompts as part of the conversation context.
- **User Prompt**: Provide an additional custom query or instructions.

All combined, the chat’s context can be prepared as a well-structured message that the AI can process and respond to.

### Choosing a Provider

To use chat, you must set up a provider. There are two main categories:

1. **Local Providers**:
   - **LM Studio**: A local inference server for running LLMs on your machine.  
     *Setup*: Download and run LM Studio locally. Provide the correct model name in the chat settings.
   - **Ollama**: A local LLM inference tool that allows you to run models like Llama locally.  
     *Setup*: Install and run Ollama. Configure the model name in chat settings.

   Using a local provider means no external API calls. It’s ideal for privacy and avoiding API costs.

2. **Remote Providers (API-based)**:
   - **OpenAI**: Use keys from the OpenAI platform (such as GPT-4).
   - **OpenRouter**: Use a single API key to access multiple providers and models via OpenRouter.

   To use these:
   - Acquire an API key from OpenAI or OpenRouter.
   - Go to the “Keys” page in OctoPrompt and add the key.
   - Select the appropriate provider and model in the chat UI.

### Setting Up Keys

If you choose OpenAI or OpenRouter:

- Navigate to the “Keys” page.
- Select the provider from the dropdown.
- Enter your API key.
- Click “Add” to store it securely.

Once added, you can select the provider and model in the chat section.

### Customizing the Chat

**Providers & Models**:  
At the left side panel of the chat page, you’ll see options to select your provider (OpenAI, OpenRouter, LM Studio, Ollama) and choose a model. For LM Studio and Ollama, pick from local models. For OpenAI/OpenRouter, pick a hosted model (like GPT-4).

**Excluding Messages**:  
Sometimes the conversation may drift off-topic. You can exclude certain past messages from the chat’s context to refocus. Toggle “Exclude” on a message, and it won’t be sent to the model in the next request.

**Forking Chats**:  
If you want to explore an alternate conversation path, use the “Fork Chat” feature. This duplicates the conversation up to a certain point or from a certain message, allowing you to try a different approach without losing the original thread.

---

## Token Estimation

For prompts and file contents, OctoPrompt estimates token usage. Tokens roughly represent chunks of text; more tokens mean higher API costs (for OpenAI/OpenRouter) or longer inference times. Keep an eye on token counts to optimize your prompts.

---

## Page-by-Page Functionality

- **Landing Page** (`/`):  
  Introduces the app’s capabilities and lets you quickly jump to “Chat” or “Projects.”
  
- **Projects Page** (`/projects`):  
  Manage all your projects here:
  - **Create New Project**: Press the "New" button or `⌘N`.
  - **Open Project**: Press `⌘O` or click the project in the list.
  - **Sync Files**: Once a project is open, click "Sync Files" to update the file list.
  - **Select Files**: Choose files you want to include in your prompt context.
  
- **Keys Page** (`/keys`):  
  Add or remove API keys for OpenAI or OpenRouter. Once keys are added, they can be selected in chat.

- **Chat Page** (`/chat`):  
  Engage with the chosen LLM:
  - **Select Provider & Model**: On the left sidebar, pick your provider (local or API-based) and model.
  - **Load Prompt & Files**: Add saved prompts and selected project files into the context.
  - **User Prompt**: Type your question or instructions.
  - **Copy Prompt**: Copy the entire context to clipboard if you need it elsewhere.
  - **Transfer to Chat**: Move prepared context directly into the chat input.
  - **Fork Chat**: Create a new chat branch from the current state or a specific message.
  - **Exclude Messages**: Toggle message exclusion to refine context.

---

## Local Models: LM Studio & Ollama

**LM Studio**:  
A desktop application that runs LLMs locally. Once LM Studio is running, configure the same model name in the chat settings. No external API calls are made; it all runs on your machine.

**Ollama**:  
A local inference tool for LLMs. Install Ollama and run it. Configure the model name (e.g., “llama2”). Now your chat requests will be served locally, maintaining full privacy and control over the model.

---

## Troubleshooting

- **No Files Listed After Sync**:  
  Ensure you’ve entered a correct and accessible path. Only supported file types are shown.
- **No Keys for OpenAI/OpenRouter**:  
  Make sure you’ve added an API key in the “Keys” section.
- **Local Providers Not Working**:  
  Verify LM Studio or Ollama is running locally and the model name is correct.

---

## Conclusion

OctoPrompt brings together code context, custom prompts, and flexible chat capabilities, whether through local models or remote APIs. With careful prompt preparation, file inclusion, and provider selection, you can supercharge your development process.

Enjoy building smarter and faster with OctoPrompt!
