# User Guide: Provider Keys Page

Welcome to the Provider Keys Page! This section of OctoPrompt is crucial for unlocking the full suite of AI-powered features. Here, you'll manage the API keys that connect OctoPrompt to various external and local AI model providers.

`[SCREENSHOT: Overview of the entire Provider Keys Page, showing the selection dropdown, input field, and list of any saved keys]`

## Table of Contents

1. [Understanding Provider Keys](#understanding-provider-keys)
    * [What are API Keys?](#what-are-api-keys)
    * [Why Does OctoPrompt Need Them?](#why-does-octoprompt-need-them)
    * [Local vs. External Providers](#local-vs-external-providers)
2. [Accessing the Provider Keys Page](#accessing-the-provider-keys-page)
3. [Page Layout](#page-layout)
    * [Provider Selection](#provider-selection)
    * [API Key Input](#api-key-input)
    * [Action Buttons](#action-buttons)
    * [Provider Information](#provider-information)
    * [Saved Keys List](#saved-keys-list)
4. [Supported AI Providers](#supported-ai-providers)
5. [Obtaining API Keys](#obtaining-api-keys)
6. [Managing Your Keys](#managing-your-keys)
    * [Adding a New API Key](#adding-a-new-api-key)
    * [Viewing Saved Keys](#viewing-saved-keys)
    * [Copying an API Key](#copying-an-api-key)
    * [Deleting an API Key](#deleting-an-api-key)
7. [Using Local Providers](#using-local-providers)
8. [Important Considerations](#important-considerations)

---

## 1. Understanding Provider Keys

### What are API Keys?

API (Application Programming Interface) keys are unique codes that applications use to authenticate and authorize requests to external services. In the context of OctoPrompt, these keys allow the application to securely communicate with AI model providers. Think of them as a password that OctoPrompt uses to tell an AI provider that it has permission to use its services on your behalf.

### Why Does OctoPrompt Need Them?

OctoPrompt leverages powerful Large Language Models (LLMs) from various providers to offer advanced features such as:

* **AI File Suggestions:** Get intelligent recommendations for files relevant to your current task.
* **File Summarization:** Automatically generate summaries for your project files to build a knowledge base.
* **AI-Powered Task Generation:** Let AI assist in breaking down tickets into actionable tasks.
* **Built-in AI Chat:** Interact with different LLMs directly within OctoPrompt.

To use these external AI services, OctoPrompt needs the respective API keys you provide. Without them, AI features that rely on these providers won't be available.

### Local vs. External Providers

* **External Providers:** These are services like OpenAI, OpenRouter, Anthropic, Google, etc., that host powerful AI models. You'll typically need an account and an API key from them, and usage might incur costs depending on the provider's pricing.
* **Local Providers:** Services like Ollama or LM Studio allow you to run AI models directly on your own machine. For these, you might not need an "API key" in the traditional sense to be pasted into OctoPrompt, but you'll need to have the local service running and configured. OctoPrompt can then interact with them, often without any external an API key entry on this page.

---

## 2. Accessing the Provider Keys Page

You can typically find the Provider Keys page via a dedicated "Keys" or "API Keys" link in the main navigation menu or settings area of OctoPrompt.

`[SCREENSHOT: Main navigation bar highlighting the "Keys" link/button]`

The direct path for the keys page is `/keys`.

---

## 3. Page Layout

The Provider Keys page is designed to be straightforward for managing your connections to AI services.

`[SCREENSHOT: Annotated screenshot of the Provider Keys page highlighting each section: Provider Selection, API Key Input, Add Button, Provider Description/Link, and Saved Keys List]`

### Provider Selection

* **Dropdown Menu:** A selectable list of all AI providers that OctoPrompt supports. You'll choose a provider from this list before adding or modifying its key.

    `[SCREENSHOT: Close-up of the "Select provider" dropdown, possibly expanded to show a few provider names]`

### API Key Input

* **Text Field:** Once a provider is selected (unless it's a local provider that doesn't require a key in this interface), this field is where you'll paste the API key obtained from the provider. For security, the key is typically masked (displays as dots or asterisks).
* **Placeholder Text:** This field might show "Enter API key" or specific instructions like "No API Key needed, but might need local config" if a local provider is selected.

    `[SCREENSHOT: Close-up of the API key input field, perhaps with a masked key entered or the placeholder text for a local provider]`

### Action Buttons

* **Add Button:** After selecting a provider and entering its key, click this button to save the key to OctoPrompt. This button will be disabled if the necessary information (provider and key, if required) isn't provided.

### Provider Information

* When you select a provider from the dropdown, a brief description and a direct link to the provider's website or API key page may appear. This helps you quickly find where to get a key or learn more about the service.

    `[SCREENSHOT: Area below the input field showing the provider description and a clickable link like "Get your OpenAI key here"]`

### Saved Keys List

* **Display Area:** If you've already added keys, they will be listed in this section. Each entry typically shows:
  * The Provider Name (e.g., OpenAI, OpenRouter).
  * A partially masked version of the API key (e.g., "••••••••key1234") for security and identification.
  * Action buttons for each key (e.g., Copy, Delete).

    `[SCREENSHOT: List of a few saved keys, showing provider names, masked keys, and action buttons like "Copy" and "Delete"]`

---

## 4. Supported AI Providers

OctoPrompt supports a range of AI providers to give you flexibility. As of the latest information, these include:

* **OpenRouter:** Recommended for access to a wide variety of models from different providers through a single API key.
* **OpenAI:** For accessing models like GPT-4, GPT-3.5-turbo, etc.
* **Anthropic:** For accessing Claude models.
* **Google Gemini:** For accessing Google's Gemini family of models.
* **XAI:** For accessing models from xAI.
* **Groq:** Known for fast inference speeds.
* **Local Providers (Free!):**
  * **Ollama:** Run open-source models locally.
  * **LM Studio:** Discover, download, and run local LLMs.

*(This list may be updated in newer versions of OctoPrompt. Always refer to the provider selection dropdown on the page for the most current list.)*

---

## 5. Obtaining API Keys

To use most external AI providers, you'll need to create an account on their respective websites and generate an API key.

Here are links to the API key pages for some of the commonly used providers:

* **OpenRouter:** [https://openrouter.ai/settings/keys](https://openrouter.ai/settings/keys)
* **OpenAI:** [https://platform.openai.com/api-keys](https://platform.openai.com/api-keys)
* **Anthropic (Claude Models):** [https://console.anthropic.com/settings/keys](https://console.anthropic.com/settings/keys)
* **Google Gemini:** [https://aistudio.google.com/app/apikey](https://aistudio.google.com/app/apikey)
* **XAI:** [https://console.x.ai](https://console.x.ai)
* **Groq:** [https://console.groq.com/keys](https://console.groq.com/keys)

**General Steps to Obtain an API Key (will vary by provider):**

1. Visit the provider's website using the links above.
2. Sign up for an account or log in if you already have one.
3. Navigate to their API section, developer portal, or account settings. Look for options like "API Keys," "Access Tokens," or "Credentials."
4. Generate a new API key. You might be asked to name the key for your reference.
5. **Important:** Copy the generated API key immediately and store it securely. Some providers will only show you the key once.
6. Return to the OctoPrompt Provider Keys page to add it.

**Note:** Be mindful of any usage costs associated with API keys from external providers. Set limits on your provider's platform if possible, especially during development or testing.

---

## 6. Managing Your Keys

### Adding a New API Key

1. Navigate to the **Provider Keys** page in OctoPrompt.
2. Click on the **"Select provider"** dropdown menu.
    `[SCREENSHOT: Provider dropdown menu being clicked]`
3. Choose the AI provider for which you have an API key.
    `[SCREENSHOT: A provider (e.g., "OpenAI") being selected from the dropdown]`
4. Once the provider is selected, paste your API key into the **API key input field**.
    `[SCREENSHOT: API key being pasted into the input field for the selected provider]`
5. Click the **"Add"** button.
    `[SCREENSHOT: "Add" button being clicked, with provider selected and key entered]`
6. If successful, the key will appear in the "Saved Keys List" below. A confirmation message may also appear briefly.
    `[SCREENSHOT: New key appearing in the saved keys list with a success toast/message]`

### Viewing Saved Keys

All successfully added API keys are displayed in a list on the Provider Keys page. Each entry will show the provider's name and a partially hidden version of the key (e.g., `••••••••key1234`) for quick identification.

`[SCREENSHOT: A list showing multiple saved keys for different providers]`

### Copying an API Key

If you need to copy the full API key you've previously saved (for example, to use it in another application or for verification), OctoPrompt provides a convenient way to do so without re-typing it.

1. In the "Saved Keys List," locate the key you wish to copy.
2. Hover over the key entry. A **Copy icon** (usually resembling two overlapping pages) should appear or become more prominent.
    `[SCREENSHOT: Mouse hovering over a saved key, highlighting the copy icon]`
3. Click the **Copy icon**.
4. The full API key will be copied to your clipboard. A confirmation message like "API key copied to clipboard" should appear.
    `[SCREENSHOT: Confirmation message/toast after clicking the copy icon]`

### Deleting an API Key

If you no longer want OctoPrompt to use a specific API key, or if a key has been compromised, you can delete it.

1. In the "Saved Keys List," locate the key you wish to delete.
2. Click the **"Delete"** button (often a trash can icon or red button) associated with that key entry.
    `[SCREENSHOT: "Delete" button next to a saved key being clicked]`
3. A confirmation prompt may appear to ensure you don't accidentally delete a key. Confirm the deletion.
4. The key will be removed from the list and OctoPrompt will no longer use it.

---

## 7. Using Local Providers

For providers like **Ollama** or **LM Studio**, the process is slightly different as they run on your local machine.

* **No API Key Entry in OctoPrompt:** You typically don't need to enter an API key on this OctoPrompt "Provider Keys" page for these local providers. The placeholder text in the API key field will usually indicate this (e.g., "No API Key needed, but might need local config").
* **Ensure Local Service is Running:** The most important step is to have the local AI service (Ollama server, LM Studio) installed, configured with your desired models, and running on your computer.
* **OctoPrompt Configuration:** OctoPrompt will then connect to these local services, often at a default local address (e.g., `http://localhost:11434` for Ollama). You might need to configure the specific model to use within OctoPrompt's chat settings or other relevant sections.

Refer to the OctoPrompt documentation on Chat or specific AI features, as well as the documentation for Ollama or LM Studio, for detailed setup instructions.

`[SCREENSHOT: Placeholder image or note indicating that local providers like Ollama/LM Studio are selected but might not require a key in this interface, perhaps with a small note about ensuring the local service is running.]`

---

## 8. Important Considerations

* **Security:** Treat your API keys like passwords. Do not share them publicly or commit them to version control (e.g., in a public GitHub repository). OctoPrompt stores them locally on your machine.
* **One Key Per Provider:** You generally add one API key per provider. If you update a key, you might need to delete the old one and add the new one.
* **Usage Costs:** Be aware of the pricing models for any external AI providers you use. Monitor your usage on the provider's platform to avoid unexpected charges.
* **Troubleshooting:** If AI features are not working, ensure:
  * The correct API key is added for the selected provider.
  * The key is active and has not expired or been revoked on the provider's platform.
  * Your account with the provider has sufficient credits or is within usage limits.
  * For local providers, ensure the local service is running and accessible.
* **Local LLMs in Chat:** Even if you don't add any keys for external providers, you can often still use local LLMs (via Ollama or LM Studio) within the OctoPrompt chat feature. Adding keys for providers like OpenAI or OpenRouter primarily unlocks *additional* features like file summarizations and AI-assisted file/task suggestions across the application.

---

This guide should help you effectively manage your provider keys in OctoPrompt. For further assistance, refer to the OctoPrompt help dialogs or community support channels.
