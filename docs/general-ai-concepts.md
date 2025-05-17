# General AI Concepts in OctoPrompt

This document provides a glossary of common Artificial Intelligence (AI) terms and concepts as they are used within the OctoPrompt application. Understanding these terms will help you make the most of OctoPrompt's AI-powered features.

---

## Agent

In OctoPrompt, an **Agent** is an AI-powered assistant designed to automate and assist with various development tasks. Agents use the context you provide (selected files, prompts, and your instructions) to understand your goals, plan tasks, and even generate or propose code modifications.

**Key Characteristics in OctoPrompt:**

- **Task Automation:** Agents can perform actions like ticket/task planning and code generation.
- **Context-Driven:** Their performance heavily relies on the quality and specificity of the context provided from your project files, prompts, and user input.
- **Planning and Execution:** OctoPrompt utilizes a multi-stage process, often involving a "Planning Agent" to break down requests into steps and a "Coding Agent" to execute those steps (e.g., modifying code).
- **User Confirmation:** Crucially, agents in OctoPrompt propose changes (e.g., code modifications) for your review. No changes are made to your file system without your explicit confirmation.
- **Optional:** AI agent features are entirely optional and can work with local AI models.

_(See also: `docs/coding-agent.md` for a detailed guide on the Coding Agent)_

---

## Context

**Context** refers to the information provided to a Large Language Model (LLM) to help it understand the specific task, query, or domain it needs to operate within. In OctoPrompt, building a comprehensive and relevant context is crucial for achieving accurate and useful AI-generated outputs.

**How Context is Built in OctoPrompt:**

- **Project Files:** You can select specific files or even entire folders from your codebase. OctoPrompt can include the content of these files.
- **User Input:** Your direct instructions, questions, or descriptions of the task you want the AI to perform.
- **Prompts:** Reusable sets of instructions or guidelines that help shape the AI's response style, format, or focus.
- **File Summaries:** OctoPrompt can generate summaries of your project files, creating a knowledge base that the AI can use to understand the broader structure and purpose of your code, even for files not explicitly selected.

**Importance:**

- **Accuracy:** Well-defined context helps the AI provide more relevant and accurate responses.
- **Efficiency:** Providing just the necessary information, without overloading the AI, can lead to faster and more cost-effective results, especially when using API-based models. OctoPrompt helps manage context length and informs you of token usage.

---

## LLM (Large Language Model)

An **LLM** is a type of artificial intelligence model trained on vast amounts of text data to understand, generate, and manipulate human language. LLMs are the "brains" behind many of OctoPrompt's AI features.

**Usage in OctoPrompt:**

- **Chat:** Directly interact with LLMs for coding help, brainstorming, or general queries.
- **File Summarization:** LLMs can create concise summaries of your code files to build a project-wide knowledge base.
- **Task Planning:** AI agents use LLMs to analyze your requests and generate step-by-step plans for tickets or coding tasks.
- **Code Generation/Modification:** LLMs can suggest new code snippets or modifications to existing code based on your instructions and the provided context.

OctoPrompt allows you to connect to various LLMs through different **Providers**, including cloud-based services and locally run models.

---

## Model

An AI **Model** is the specific algorithm or program developed by an AI **Provider**. Each model has different capabilities, strengths, training data, and often, associated costs.

**In OctoPrompt:**

- **Selection:** You can often select specific models to use for different tasks (e.g., in the chat interface or for agent operations). For example, a provider like OpenAI offers models such as GPT-4, GPT-3.5-turbo, etc., while Anthropic offers Claude models.
- **Configuration:** You can adjust parameters for models, such as `temperature` (randomness), `max tokens` (response length), etc., to fine-tune their behavior.
- **Compatibility:** Different models have different context window sizes (the amount of information they can process at once) and capabilities. OctoPrompt helps by showing token counts.
- **Local Models:** OctoPrompt also supports using models run locally via tools like Ollama or LM Studio, which can be free to use.

_(Default model configurations can be found in `shared/constants/model-default-configs.ts` within the OctoPrompt codebase)._

---

## Provider

An AI **Provider** is a company or service that offers access to one or more Large Language Models (LLMs) and other AI technologies. To use the AI features in OctoPrompt that rely on external services, you typically need to configure an API key from the provider.

**Supported Providers in OctoPrompt (Examples):**

- **OpenRouter:** Recommended as it aggregates many different models from various providers, allowing access through a single API key.
- **OpenAI:** Provides models like GPT-4, GPT-3.5, etc.
- **Anthropic:** Known for its Claude models.
- **Google:** Offers models like Gemini.
- **Groq:** Known for fast inference speeds.
- **XAI**

**Local Providers (Free):**
OctoPrompt also supports running AI features entirely locally using on-machine providers:

- **Ollama**
- **LM Studio**

**API Keys:**

- Users manage their API keys on the "Keys" page within OctoPrompt. These keys allow OctoPrompt to make requests to the provider's models on your behalf.
- Using AI features from cloud providers may incur costs based on your usage with that provider.

_(See also: `README.md` section "IMPORTANT - Configure Your Provider Keys" and `packages/client/src/routes/keys.tsx` for UI related to keys)._

---
