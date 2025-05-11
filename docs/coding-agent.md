# User Guide: The OctoPrompt Coding Agent

Welcome to the OctoPrompt Coding Agent guide! This powerful feature is designed to assist you by automating coding tasks, planning changes, and even generating code modifications based on your instructions and the context you provide from your project.

`[SCREENSHOT: Overview of the Project Screen highlighting where the "Agent" button might be, perhaps near the user input field]`

## Table of Contents

1.  [What is the Coding Agent?](#1-what-is-the-coding-agent)
2.  [How the Coding Agent Works](#2-how-the-coding-agent-works)
    * [Context is Key](#context-is-key)
    * [The Two-Step Process: Planning and Coding](#the-two-step-process-planning-and-coding)
3.  [Initiating the Agent: The Agent Control Dialog](#3-initiating-the-agent-the-agent-control-dialog)
4.  [Navigating the Agent Control Dialog](#4-navigating-the-agent-control-dialog)
    * [Run ID Selector and Management](#run-id-selector-and-management)
    * [New Job Tab](#new-job-tab)
    * [Logs & Data Tab](#logs--data-tab)
    * [Confirm Tab](#confirm-tab)
5.  [Step-by-Step: Using the Coding Agent](#5-step-by-step-using-the-coding-agent)
6.  [Reviewing and Applying Changes](#6-reviewing-and-applying-changes)
7.  [Tips for Best Results](#7-tips-for-best-results)
8.  [Important Considerations](#8-important-considerations)

---

## 1. What is the Coding Agent?

The OctoPrompt Coding Agent is an AI-powered assistant integrated into your workspace. It takes your natural language instructions, selected project files, and chosen prompts to:

* **Understand your goals:** Deciphers what you want to achieve in your codebase.
* **Plan tasks:** Breaks down complex requests into a series of specific, actionable steps.
* **Generate code:** Proposes new code or modifications to existing files.
* **Propose changes:** Presents all suggested modifications for your review before any changes are made to your actual files.

Think of it as an intelligent pair programmer that can help you tackle refactoring, feature implementation, and other coding tasks more efficiently. You are always in control, as the agent will not modify your codebase without your explicit confirmation.

---

## 2. How the Coding Agent Works

Understanding the agent's workflow helps you use it more effectively.

### Context is Key

The agent's performance heavily relies on the quality and specificity of the context you provide. This includes:

* **Selected Files:** The specific project files you choose that are relevant to the task.
* **Selected Prompts:** Any pre-defined prompt templates you select to guide the AI's behavior or output style.
* **User Input:** Your primary instruction or description of the task you want the agent to perform, written in the "User Input" field on the project page.
* **Project Summaries (if enabled):** If file summarization is active for your project, the agent can leverage these summaries for a broader understanding of your codebase, aiding in more accurate planning and file suggestions.

`[SCREENSHOT: Project page view showing selected files, selected prompts, and the user input field clearly marked as the context for the agent.]`

### The Two-Step Process: Planning and Coding

Behind the scenes, the agent typically follows a multi-stage process:

1.  **Planning Phase:**
    * You initiate an agent run with your gathered context.
    * A specialized "Planning Agent" analyzes your request and the provided file information.
    * It creates a structured plan, breaking down your goal into a series of specific tasks (e.g., "modify function X in file Y.ts," "create new file Z.ts with specified content"). This plan is crucial for guiding the next phase.

2.  **Execution Phase (Coding Agent):**
    * For each task in the generated plan, a "Coding Agent" takes over.
    * It receives the specific task instruction and the content of the target file (if it's an existing file).
    * The Coding Agent then generates the necessary code modifications or the content for a new file.

3.  **Proposal:**
    * Once all tasks are processed, the agent compiles all proposed changes (additions, modifications, deletions).
    * These are presented to you in the "Confirm" tab of the Agent Control Dialog for your review.

4.  **Confirmation (Your Role):**
    * You carefully review the proposed changes.
    * If satisfied, you confirm, and only then does the agent write the changes directly to your file system. Otherwise, you can discard them.

---

## 3. Initiating the Agent: The Agent Control Dialog

To start working with the Coding Agent:

1.  Navigate to the **Project Screen** for the project you want to work on.
2.  **Gather your context:**
    * Select the relevant files from the File Panel.
    * Choose any guiding prompts from the Prompt Overview Panel.
    * Clearly describe your task or objective in the "User Input" text area.
3.  Click the **<Bot /> Agent** button. This button is typically located underneath the "User Input" field.

`[SCREENSHOT: Close-up of the "User Input" field and the "Agent" button beneath it.]`

Clicking this button opens the **Agent Control Dialog**, which is your main interface for managing and interacting with agent runs.

---

## 4. Navigating the Agent Control Dialog

The Agent Control Dialog is a tabbed interface that allows you to start new agent jobs, monitor their progress, and review their proposed changes.

`[SCREENSHOT: Overview of the Agent Control Dialog, showing the title, Run ID selector (if applicable), and the three main tabs: "New Job", "Logs & Data", "Confirm".]`

At the top of the dialog (when not on the "New Job" tab initially), you'll often find tools to manage and select previous agent runs:

### Run ID Selector and Management

* **Run ID Dropdown/Selector:** Allows you to select a previous agent run to view its logs, data, or proposed changes (if not yet confirmed). Each run is identified by a unique ID.
    `[SCREENSHOT: Close-up of the Run ID selector, perhaps with a few example IDs in the dropdown.]`
* **<Copy /> Copy Run ID:** Copies the ID of the currently selected run to your clipboard.
* **<RefreshCw /> Refresh Logs & Data:** Manually fetches the latest logs and data for the selected run. This is useful if you are monitoring a run in progress or want to ensure you have the latest information.
* **<Trash2 /> Delete Run:** Permanently deletes the selected agent run, including its logs and any unconfirmed proposed changes. A confirmation will be required.

### New Job Tab

This is typically the default tab when you first open the Agent Control Dialog to start a new task.

`[SCREENSHOT: The "New Job" tab of the Agent Control Dialog, showing sections for User Input, Selected Prompts, Selected Files, and Total Tokens.]`

**Purpose:** To review the context you've prepared and initiate a new agent run.

**What it shows:**

* **Agent Instructions / User Input:** A read-only view of the text you entered in the "User Input" field.
* **Selected Prompts:** A list of the prompts you've chosen to guide the agent.
* **Selected Files:** A list of the files you've selected as context.
* **Token Input Estimate:** An estimated count of the tokens that will be consumed by the AI model for this context. This helps you manage potential costs and stay within model limits.

**Action:**

* **<Bot /> Start Agent Run button:** Located at the bottom of this tab. Clicking this button sends all the displayed context to the AI agent to begin the planning and execution process.
    * You'll usually be switched automatically to the "Logs & Data" tab to monitor progress.
    * A new unique **Run ID** will be generated for this job.

### Logs & Data Tab

This tab becomes active once an agent run starts, or if you select a past run using the Run ID selector.

`[SCREENSHOT: The "Logs & Data" tab, showing the "Viewing Logs" / "Viewing Raw Data" switch, and an example of log entries.]`

**Purpose:** To monitor the agent's live progress, review historical logs, and inspect the raw data associated with a run.

**Key Features:**

* **Log/Data View Switch:**
    * **Viewing Logs (Default):** Displays a live stream of log entries from the agent's execution. This provides insights into its decision-making process, current task, any errors encountered, and general progress. Logs typically include timestamps, log levels (info, warn, error), and messages.
    * **Viewing Raw Data:** Toggling the switch allows you to see the complete JSON object representing the agent run's state. This includes the detailed task plan generated by the Planning Agent, file contents used, and other metadata. This view is primarily for debugging or deeper analysis if you need to understand the agent's internal data structures.
* **Log Display Area:** Shows formatted log entries or the raw JSON data.
* **Status Indicators:** You might see indicators if the agent is currently running (e.g., a spinning icon).

### Confirm Tab

This tab is where you review the changes proposed by the agent after it has completed its execution phase.

`[SCREENSHOT: The "Confirm" tab, showing a list of files with proposed changes. Highlight icons for New File, Modified File, Deleted File, line change counts, and the "Preview" button.]`

**Purpose:** To carefully examine all proposed code modifications, additions, or deletions before applying them to your project.

**What it shows:**

* A list of files that the agent proposes to change.
* For each file, you'll typically see:
    * **File Path:** The path to the file within your project.
    * **Change Type Icon:**
        * **<FilePlus /> (Green):** Indicates a new file will be created.
        * **<FileEdit /> (Blue):** Indicates an existing file will be modified.
        * **<FileMinus /> (Red):** Indicates an existing file will be deleted (Note: agent deletion capabilities might vary).
    * **Line Change Counts:** For modified files, you'll often see a summary of lines added and removed (e.g., `+10 -5`). For new files, it will show lines added. For deleted files, lines removed.
* **<Eye /> Preview button:** For each file in the list, clicking this button opens a detailed view of the proposed changes.
    * For **modified files:** A diff viewer will show the exact additions and deletions, highlighting the changes between the original content and the agent's proposed version.
    * For **new files:** The full content of the proposed new file will be displayed.
    * For **deleted files:** It might show the content of the file that is proposed for deletion.
    `[SCREENSHOT: Example of the Diff Viewer in a dialog after clicking "Preview" for a modified file.]`

**Action:**

* **<CheckCircle /> Confirm & Apply Changes button:** If, after reviewing all proposed changes, you are satisfied and want to apply them to your actual project files, click this button.
    * **This is the action that writes changes to your file system.**
    * A success message will usually appear, and the changes will be reflected in your project.
* **Closing the Dialog:** If you are not satisfied with the proposed changes or want to discard them, simply close the Agent Control Dialog or navigate to another tab. The changes will **not** be applied unless you explicitly click the "Confirm & Apply Changes" button.

---

## 5. Step-by-Step: Using the Coding Agent

1.  **Open Your Project:** Navigate to the Project Screen in OctoPrompt.
2.  **Prepare Context:**
    * In the **File Panel**, select the files that are most relevant to the task you want the agent to perform.
    * In the **Prompt Overview Panel**, select any pre-defined prompts that might help guide the AI (e.g., coding style, output format).
    * In the **User Input** text area, write a clear and specific description of what you want the agent to do. For example:
        * "Refactor the `getUserData` function in `user-service.ts` to use async/await instead of promises."
        * "Create a new React component named `UserProfileCard.tsx` that accepts a user object and displays their name, email, and avatar. Also, create a basic Storybook story for this component."
        * "Add JSDoc comments to all public methods in `api-handler.js`."
3.  **Initiate Agent:** Click the **<Bot /> Agent** button (usually found below the User Input field). The Agent Control Dialog will open.
4.  **Review and Start (New Job Tab):**
    * The dialog will open to the **New Job** tab.
    * Verify that your User Input, Selected Prompts, and Selected Files are correctly listed.
    * Check the **Token Input Estimate**.
    * Click the **<Bot /> Start Agent Run** button.
5.  **Monitor Progress (Logs & Data Tab):**
    * You will likely be switched to the **Logs & Data** tab automatically.
    * Observe the log stream to see the agent's progress. It will indicate planning stages, which files it's working on, and any significant actions or errors.
    * If the agent seems stuck or you want more detail, you can switch to "Viewing Raw Data" (though logs are usually more user-friendly for monitoring).
    * The agent will go through its planning and execution phases. This may take some time depending on the complexity of the task and the number of files involved.
6.  **Await Completion:** Wait for the agent to indicate that it has finished processing all tasks. The logs should reflect this, and the UI might update to show the run as completed.

---

## 6. Reviewing and Applying Changes (Confirm Tab)

Once the agent has completed its run:

1.  **Navigate to Confirm Tab:** If not already there, click on the **Confirm** tab in the Agent Control Dialog.
2.  **Examine Proposed Changes:**
    * You'll see a list of files the agent intends to create, modify, or delete.
    * For each file:
        * Note the **change type icon** (<FilePlus />, <FileEdit />, <FileMinus />).
        * Note the **line change counts**.
        * Click the **<Eye /> Preview** button.
            * For modifications, carefully review the highlighted diffs. Ensure the changes are correct, safe, and align with your expectations.
            * For new files, review the entire generated content.
            * For deletions, confirm you want the file removed.
3.  **Make Your Decision:**
    * **If you approve all changes:** Click the **<CheckCircle /> Confirm & Apply Changes** button. The agent will write these modifications to your project files on your computer.
    * **If you do NOT approve the changes:** Simply close the Agent Control Dialog or navigate away. No changes will be made to your files. You can then refine your input/context and start a new agent run if desired.

`[SCREENSHOT: The "Confirm & Apply Changes" button clearly visible and perhaps highlighted.]`

---

## 7. Tips for Best Results

* **Be Specific in Your "User Input":** Clearly articulate the goal. The more precise your instructions, the better the agent can plan and execute. Instead of "Fix this file," try "In `calculator.ts`, refactor the `add` function to handle an array of numbers as input instead of just two numbers, and ensure it returns the correct sum."
* **Provide Focused Context:**
    * Select only the files directly relevant to the task. Including too many unrelated files can confuse the agent and increase token usage.
    * Use prompts that are relevant to the desired outcome (e.g., a prompt for a specific coding style if that's important).
* **Iterate:** If the first run doesn't produce perfect results, review the logs and the agent's plan (if viewable in raw data). Refine your user input, adjust selected files/prompts, and try again. AI interaction is often an iterative process.
* **Break Down Large Tasks:** For very complex changes, consider breaking them down into smaller, more manageable sub-tasks and running the agent for each one.
* **Review Carefully:** Always thoroughly review the proposed changes in the "Confirm" tab before applying them. The agent is a tool to assist you, but the final responsibility for the code rests with you.

---

## 8. Important Considerations

* **You Are in Control:** The OctoPrompt Coding Agent will **never** make changes to your files without your explicit action of clicking the "<CheckCircle /> Confirm & Apply Changes" button.
* **API Key Configuration:** The Coding Agent relies on AI models. Ensure your API keys for the relevant AI providers (e.g., OpenRouter, OpenAI) are correctly configured on the "Keys" page in OctoPrompt. Without valid keys, AI features will not function.
* **Model Configuration:** The default AI models and settings used by the agent (e.g., for planning or coding) are typically defined in configuration files within OctoPrompt (e.g., `shared/constants/model-default-configs.ts`, specifically variables like `HIGH_MODEL_CONFIG`). While UI controls for these might be limited initially, advanced users might be aware of these configurations.
* **Token Usage:** AI models consume tokens based on the input context (files, prompts, your instructions) and the output they generate. Be mindful of the "Token Input Estimate" to manage potential costs with your AI provider.

---

By understanding how the Coding Agent works and following these guidelines, you can leverage its power to enhance your development workflow in OctoPrompt. Happy coding!