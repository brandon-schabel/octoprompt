# User Guide: Chat Screen

Welcome to the Chat Screen! This is your interactive space for communicating directly with various Large Language Models (LLMs). Here, you can manage multiple chat sessions, configure model parameters, and get assistance with your coding questions or other tasks.

`[SCREENSHOT: Overview of the entire Chat Screen with an active chat, showing the Chat Sidebar, Chat Header, Message Display Area, and Chat Input Area]`

## Table of Contents

1. [Understanding the Layout](#understanding-the-layout)
2. [Getting Started](#getting-started)
    * [No Chats Yet?](#no-chats-yet)
    * [No Active Chat Selected?](#no-active-tab-selected)
3. [Chat Sidebar (Left Panel)](#chat-sidebar-left-panel)
    * [Creating a New Chat](#creating-a-new-chat)
    * [Switching Between Chats](#switching-between-chats)
    * [Renaming Chats](#renaming-chats)
    * [Deleting Chats](#deleting-chats)
    * [Loading More Chats](#loading-more-chats)
4. [Chat Header (Top Bar)](#chat-header-top-bar)
    * [Toggling the Chat Sidebar](#toggling-the-chat-sidebar)
    * [Active Chat Title](#active-chat-title)
    * [Model Settings](#model-settings)
5. [Model Settings Popover](#model-settings-popover)
    * [Selecting an AI Provider](#selecting-an-ai-provider)
    * [Selecting an AI Model](#selecting-an-ai-model)
    * [Adjusting Temperature](#adjusting-temperature)
    * [Adjusting Max Tokens](#adjusting-max-tokens)
    * [Adjusting Top P](#adjusting-top-p)
    * [Adjusting Frequency Penalty](#adjusting-frequency-penalty)
    * [Adjusting Presence Penalty](#adjusting-presence-penalty)
6. [Message Display Area (Center)](#message-display-area-center)
    * [User and Assistant Messages](#user-and-assistant-messages)
    * [Message Options](#message-options)
        * [Copy Message](#copy-message)
        * [Fork Chat from Message](#fork-chat-from-message)
        * [Delete Message](#delete-message)
        * [Exclude Message from Context](#exclude-message-from-context)
        * [Toggle Raw View](#toggle-raw-view)
    * [Viewing Hidden Reasoning (Think Blocks)](#viewing-hidden-reasoning-think-blocks)
    * [Markdown Rendering](#markdown-rendering)
    * [Auto-Scrolling](#auto-scrolling)
7. [Chat Input Area (Bottom)](#chat-input-area-bottom)
    * [Typing and Sending Messages](#typing-and-sending-messages)
    * [Adaptive Input Field](#adaptive-input-field)
    * [Provider and Model Information](#provider-and-model-information)
    * [Error Display](#error-display)
8. [Using Context from the Project Screen](#using-context-from-the-project-screen)

---

## 1. Understanding the Layout

The Chat Screen is organized into a few primary areas:

* **Chat Sidebar (Left Panel):** Lists all your chat conversations. You can create new chats, switch between existing ones, rename them, and delete them. This panel can be toggled open or closed.
* **Chat Header (Top Bar):** Displays the title of the currently active chat and provides access to Model Settings. It also contains the button to toggle the Chat Sidebar.
* **Message Display Area (Center):** This is the main part of the screen where your conversation with the AI is displayed. Messages from you and the AI assistant appear here.
* **Chat Input Area (Bottom):** Where you type your messages to send to the AI. It also shows information about the current AI provider and model being used.

`[SCREENSHOT: Chat screen highlighting the four main areas: Chat Sidebar, Chat Header, Message Display Area, and Chat Input Area]`

---

## 2. Getting Started

### No Chats Yet?

If you haven't started any conversations, the Chat Sidebar will be empty, and the main area will prompt you to begin.

`[SCREENSHOT: "No Chats Yet" view, showing an empty sidebar and a message in the main area encouraging the user to create a new chat, possibly highlighting the "New Chat" button.]`

* Click the **"+ New Chat"** button in the Chat Sidebar to start your first conversation.

### No Active Chat Selected?

If you have existing chats but haven't selected one, the Message Display Area and Chat Input Area will be inactive, prompting you to select a chat.

`[SCREENSHOT: View when no chat is active, showing a message like "No Chat Selected" or "Select a chat from the sidebar or create a new one."]`

* Click on any chat in the **Chat Sidebar** to activate it and view its contents.

---

## 3. Chat Sidebar (Left Panel)

The Chat Sidebar, located on the left, helps you manage all your chat conversations.

`[SCREENSHOT: The Chat Sidebar populated with several chat entries, one highlighted as active.]`

### Creating a New Chat

1. Click the **"+ New Chat"** button at the top of the Chat Sidebar.
    `[SCREENSHOT: Close-up of the "+ New Chat" button in the Chat Sidebar.]`
2. A new chat will be created, usually with a default title (e.g., "New Chat [timestamp]"). It will become the active chat.
3. The new chat will automatically appear in the sidebar, and you can start typing messages immediately.

### Switching Between Chats

* Simply **click** on any chat title in the Chat Sidebar.
* The Message Display Area and Chat Input Area will update to show the conversation and settings for the selected chat.
* The currently active chat is typically highlighted in the sidebar.

### Renaming Chats

You can rename chats for better organization:

1. Hover over the chat title you wish to rename in the Chat Sidebar.
2. Action icons will appear. Click the **Edit icon (pencil)**.
    `[SCREENSHOT: A chat item in the sidebar on hover, showing the Edit (pencil) and Delete (trash) icons. The Edit icon is highlighted.]`
3. The chat title will become an editable input field. Type the new name.
    `[SCREENSHOT: A chat title in the sidebar in inline edit mode with an input field and Save (check) / Cancel (X) buttons.]`
4. Press **Enter** or click the **Save icon (checkmark)** to save the new name. Click the **Cancel icon (X)** or press **Escape** to cancel.

### Deleting Chats

To remove a chat conversation:

1. Hover over the chat title you wish to delete in the Chat Sidebar.
2. Action icons will appear. Click the **Delete icon (trash can)**.
    `[SCREENSHOT: A chat item in the sidebar on hover, with the Delete (trash) icon highlighted.]`
3. A confirmation dialog will appear. Click "Delete" to permanently remove the chat, or "Cancel" to keep it.
    `[SCREENSHOT: Confirmation dialog for deleting a chat.]`
    **Note:** Deleting a chat is permanent and cannot be undone.

### Loading More Chats

If you have a large number of chats, they might not all be displayed initially.

* If there are more chats to load, a **"Show More"** button will appear at the bottom of the chat list.
    `[SCREENSHOT: The "Show More" button at the bottom of the Chat Sidebar list.]`
* Click this button to load and display additional older chats.

---

## 4. Chat Header (Top Bar)

The Chat Header is located at the top of the main chat area. It provides information and controls related to the active chat.

`[SCREENSHOT: The Chat Header area, showing the sidebar toggle button, active chat title, and Model Settings button.]`

### Toggling the Chat Sidebar

* Click the **MessageSquareText icon (looks like a speech bubble with lines)** on the left side of the Chat Header to show or hide the Chat Sidebar.
    `[SCREENSHOT: The sidebar toggle icon in the Chat Header.]`
    This is useful for maximizing the space available for viewing messages.

### Active Chat Title

* The name of the currently selected chat is displayed prominently in the center of the Chat Header.
    `[SCREENSHOT: The active chat title displayed in the center of the Chat Header.]`
* If no chat is selected, it might display "No Chat Selected" or a similar message.

### Model Settings

* On the right side of the Chat Header, click the **Settings icon (gear)** to open the Model Settings Popover. This is only visible if a chat is active.
    `[SCREENSHOT: The Model Settings (gear) icon in the Chat Header.]`
* This allows you to configure the AI model and its parameters for the current chat session.

---

## 5. Model Settings Popover

The Model Settings Popover allows you to fine-tune the AI's behavior for the active chat.

`[SCREENSHOT: The Model Settings Popover dialog, showing options for Provider, Model, Temperature, Max Tokens, etc.]`

### Selecting an AI Provider

* **Provider Dropdown:** Choose your desired AI service provider (e.g., OpenRouter, OpenAI, etc.) from this list.
    `[SCREENSHOT: Close-up of the Provider selection dropdown in the Model Settings Popover.]`
  * **Note:** You must have the corresponding API key configured on the "Keys" page for a provider to work. OpenRouter is recommended as it gives access to many models from various providers with a single key.

### Selecting an AI Model

* **Model Dropdown/Search:** Once a provider is selected, this dropdown will populate with the models available from that provider.
    `[SCREENSHOT: Close-up of the Model selection combobox/dropdown in the Model Settings Popover.]`
* You can select a model from the list or type to search for a specific model.
* If no models appear, ensure your API key for the selected provider is correctly set up and that the provider offers models compatible with the application.

### Adjusting Temperature

* **Temperature Slider:** Controls the randomness of the AI's responses. Higher values (e.g., 0.8) make the output more random and creative, while lower values (e.g., 0.2) make it more focused and deterministic.
    `[SCREENSHOT: Close-up of the Temperature slider.]`
* The current temperature value is displayed next to the label.
* Some models may disable temperature settings if they have a fixed temperature.

### Adjusting Max Tokens

* **Max Tokens Slider:** Sets the maximum number of tokens (pieces of words) the AI can generate in a single response. This helps control the length of the AI's answers.
    `[SCREENSHOT: Close-up of the Max Tokens slider.]`

### Adjusting Top P

* **Top P Slider:** An alternative to temperature for controlling randomness. It considers the results of the tokens with the highest probability mass. A common value is 0.9.
    `[SCREENSHOT: Close-up of the Top P slider.]`

### Adjusting Frequency Penalty

* **Frequency Penalty Slider:** Adjusts how much to penalize new tokens based on their existing frequency in the text so far. Positive values decrease the model's likelihood to repeat the same line verbatim.
    `[SCREENSHOT: Close-up of the Frequency Penalty slider.]`

### Adjusting Presence Penalty

* **Presence Penalty Slider:** Adjusts how much to penalize new tokens based on whether they appear in the text so far. Positive values increase the model's likelihood to talk about new topics.
    `[SCREENSHOT: Close-up of the Presence Penalty slider.]`

**Note:** Changes to Model Settings are typically saved locally and applied to the active chat.

---

## 6. Message Display Area (Center)

This is where your conversation unfolds.

`[SCREENSHOT: The Message Display Area filled with a few example messages, showing both user and assistant bubbles.]`

### User and Assistant Messages

* **Your Messages ("You"):** Messages you send are typically displayed on one side (e.g., right) or with a distinct background color.
* **AI Messages ("Assistant"):** Responses from the AI are displayed on the other side or with a different background color.

`[SCREENSHOT: A user message bubble and an assistant message bubble, highlighting their distinct appearances.]`

### Message Options

When you hover over a message (yours or the assistant's), an "Options" button or individual icons may appear, offering several actions:

`[SCREENSHOT: A message bubble on hover, showing the "Options" popover or individual action icons like Copy, Fork, Delete, etc.]`

#### Copy Message

* Click the **Copy icon** to copy the content of that specific message to your clipboard.
    `[SCREENSHOT: The Copy icon within the message options.]`

#### Fork Chat from Message

* Click the **Fork icon (GitFork)** to create a new chat session that branches off from the conversation up to and including this message. This is useful for exploring different paths in a conversation without altering the original.
    `[SCREENSHOT: The Fork icon within the message options.]`

#### Delete Message

* Click the **Delete icon (Trash)** to remove a specific message from the chat. A confirmation will usually be required.
    `[SCREENSHOT: The Delete icon within the message options.]`

#### Exclude Message from Context

* Toggle the **"Exclude" switch** to remove this message (and subsequent messages if it's an assistant response that depends on it) from the context sent to the AI for future turns in *this* chat. This can be useful if a message is irrelevant or misleading for the ongoing conversation.
    `[SCREENSHOT: The "Exclude" switch within the message options.]`
* Excluded messages are often visually dimmed.

#### Toggle Raw View

* Toggle the **"Raw" switch** to see the raw, unformatted content of the message, exactly as it was received from or sent to the AI. This is useful for debugging or seeing the underlying structure if the message contains complex formatting.
    `[SCREENSHOT: The "Raw" switch within the message options. Perhaps show a message in normal view and then in raw view.]`

### Viewing Hidden Reasoning (Think Blocks)

Some AI responses might include a "think block," which contains the AI's reasoning or thought process before generating the final answer.

* If a message contains a think block, it might initially appear as a "Thinking..." animation or a collapsed "View Hidden Reasoning" section.
    `[SCREENSHOT: An assistant message showing a "Thinking..." animation or a "View Hidden Reasoning" summary.]`
* **During generation:** If the AI is still "thinking," you might see a pulsating or animated indicator with partial thoughts.
* **After generation:** Click on "View Hidden Reasoning" or a similar disclosure element to expand and view the detailed thought process.
    `[SCREENSHOT: An expanded "Hidden Reasoning" section within an assistant message, showing the AI's thought process.]`
* You can usually copy the reasoning text separately.

### Markdown Rendering

AI responses are often formatted using Markdown for better readability, including:

* Headings
* Lists (bulleted and numbered)
* Code blocks (with syntax highlighting)
* Bold/italic text
* Links

`[SCREENSHOT: An assistant message demonstrating various markdown elements like a code block, a list, and bold text.]`

### Auto-Scrolling

* As new messages are added, the display area will generally auto-scroll to keep the latest message in view.
* If you scroll up to view older messages, auto-scrolling might temporarily pause to allow you to read. Scrolling back to the bottom usually re-enables it. This behavior might be configurable in application settings.

---

## 7. Chat Input Area (Bottom)

This section at the bottom of the screen is where you compose and send your messages to the AI.

`[SCREENSHOT: The Chat Input Area, showing the text input field, the provider/model info below it, and the send button.]`

### Typing and Sending Messages

1. **Type your message** into the text input field.
    `[SCREENSHOT: Close-up of the text input field with some typed text.]`
2. Press **Enter** (if it's a single-line input and not in multiline mode) or click the **Send icon** (usually a paper airplane) to send your message.
    `[SCREENSHOT: The Send icon button, possibly highlighted or in a sending state.]`

* If the Send button is disabled, it might mean there's no active chat, no input, or an AI response is currently being generated.

### Adaptive Input Field

The chat input field can adapt its size:

* It may start as a **single-line input**.
* If you paste or type text that includes newlines, or if your text exceeds a certain length, it may automatically expand into a **multi-line textarea** to make it easier to edit longer inputs.
    `[SCREENSHOT: The chat input field shown as a single line, and then as a multi-line textarea.]`
* When in multi-line mode, pressing **Enter** will create a new line. To send the message, you'll typically need to click the **Send icon**. (This behavior might vary; some setups use Shift+Enter for newlines and Enter to send in multiline mode).

### Provider and Model Information

* Below the text input field, you'll often see a display of the current **AI provider** (e.g., "openrouter") and the **selected model name** (e.g., "gpt-4o") being used for the active chat.
    `[SCREENSHOT: The provider and model information displayed below the chat input field, with a copy icon for the model ID.]`
* There might be a **copy icon** next to the model name to quickly copy the model ID to your clipboard.

### Error Display

* If an error occurs while sending a message or receiving a response from the AI, an error message will typically be displayed in this area or as a toast notification.
    `[SCREENSHOT: An example error message displayed below the chat input or as a toast.]`

---

## 8. Using Context from the Project Screen

If you navigate to the Chat Screen from the Project Screen using the "Chat with Context" button:

* The selected files, chosen prompts, and your user input from the Project Screen will be compiled.
* This compiled context will be automatically placed into the chat input field of a new or the current chat session.
    `[SCREENSHOT: The chat input field pre-filled with context (e.g., XML-like structure or a summary) that was passed from the Project Screen.]`
* A toast notification might appear confirming "Context loaded into input."
* You can then review or edit this context before sending it as the first message to the AI in the chat.
* This allows you to seamlessly transition from building context in your project to discussing it with an AI.

---

This guide should help you effectively use the Chat Screen. For more advanced configurations or troubleshooting, please refer to specific feature documentation or the application's help resources.
