import { useHotkeys } from "react-hotkeys-hook"
import { Dialog, DialogContent, DialogHeader, DialogTitle, Button } from "@ui" // Added Button
import { Badge } from '@ui'
import { ScrollArea } from "@ui"
import { AppShortcutDisplay, ShortcutDisplay } from "../app-shortcut-display"
import { useActiveChatId, useAppSettings, useSelectSetting } from "@/hooks/api/use-kv-api"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@ui/tabs";
import { Link } from "@tanstack/react-router";
import { Bot, Copy, MessageCircleCode, Search, RefreshCw, Trash2, Eye, CheckCircle, FileEdit, FileMinus, FilePlus } from 'lucide-react'; // Added icons

export type HelpDialogProps = {
    open?: boolean
    onOpenChange?: (open: boolean) => void
}

export function HelpDialog({ open = false, onOpenChange }: HelpDialogProps) {
    const [activeChatId] = useActiveChatId();

    // Get model info from global settings
    const provider = useSelectSetting('provider');
    const model = useSelectSetting('model');

    // Toggle help dialog with mod + /
    useHotkeys("mod+/", (e) => {
        e.preventDefault()
        onOpenChange?.(!open)
    })

    if (!activeChatId) return null

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-h-[80vh] min-w-[800px] overflow-y-auto">
                <DialogHeader>
                    <DialogTitle>Help & Information: Keys and Prompts Management</DialogTitle>
                </DialogHeader>
                <Tabs defaultValue="getting-started" className="w-full">
                    <TabsList className="grid w-full grid-cols-6">
                        <TabsTrigger value="getting-started">Getting Started</TabsTrigger>
                        <TabsTrigger value="agent">Agent Usage</TabsTrigger>
                        <TabsTrigger value="chat">Chat</TabsTrigger>
                        <TabsTrigger value="prompts">Prompts</TabsTrigger>
                        <TabsTrigger value="keys">Keys</TabsTrigger>
                        <TabsTrigger value="shortcuts">Shortcuts</TabsTrigger>
                    </TabsList>
                    <TabsContent value="shortcuts">
                        <ScrollArea className="h-[60vh] pr-4">
                            <div className="space-y-2 p-4">
                                <h3 className="font-semibold mb-2">Global Navigation</h3>
                                <p><AppShortcutDisplay shortcut="open-command-palette" />: Open command palette</p>
                                <p><AppShortcutDisplay shortcut="open-help" />: Open this help</p>
                                <p><AppShortcutDisplay shortcut="focus-file-search" />: Focus file search</p>
                                <p><AppShortcutDisplay shortcut="focus-file-tree" />: Focus file tree</p>
                                <p><AppShortcutDisplay shortcut="focus-prompts" />: Focus prompts</p>
                                <p><AppShortcutDisplay shortcut="focus-prompt-input" />: Focus prompt input</p>

                                <h3 className="font-semibold mt-4 mb-2">File Search & Autocomplete</h3>
                                <p><ShortcutDisplay shortcut={['up', 'down']} delimiter=" / "></ShortcutDisplay>: Navigate through suggestions</p>
                                <p><ShortcutDisplay shortcut={['enter', 'space']} delimiter=" / " />: Select highlighted file</p>
                                <p><ShortcutDisplay shortcut={['right']} />: Preview highlighted file</p>
                                <p><AppShortcutDisplay shortcut="close-suggestions" />: Close suggestions</p>

                                <h3 className="font-semibold mt-4 mb-2">File Tree Navigation</h3>
                                <p><ShortcutDisplay shortcut={['up', 'down']} delimiter=" / " />: Navigate items</p>
                                <p><ShortcutDisplay shortcut={['left', 'right']} delimiter=" / " />: Collapse/Expand folders</p>
                                <p><AppShortcutDisplay shortcut="select-file" />: Toggle file/folder selection</p>
                                <p><AppShortcutDisplay shortcut="select-folder" />: View file or toggle folder</p>

                                <h3 className="font-semibold mt-4 mb-2">Selected Files</h3>
                                <p><ShortcutDisplay shortcut={['r', '[1-9]']} />: Remove file from selected list</p>
                                <p><ShortcutDisplay shortcut={['delete', 'backspace']} delimiter=" / " />: Remove file</p>

                                <h3 className="font-semibold mt-4 mb-2">General Controls</h3>
                                <p><AppShortcutDisplay shortcut="undo" />: Undo</p>
                                <p><AppShortcutDisplay shortcut="redo" />: Redo</p>

                                <h3 className="font-semibold mt-4 mb-2">Selected LLM Provider and Model IDs</h3>
                                {provider && (
                                    <p>
                                        <Badge>{provider}</Badge>: {model}
                                    </p>
                                )}
                            </div>
                        </ScrollArea>
                    </TabsContent>
                    <TabsContent value="agent">
                        <ScrollArea className="h-[60vh] pr-4">
                            <div className="space-y-3 p-4 text-sm">
                                <h3 className="font-semibold mb-2">Understanding and Using the AI Agent</h3>
                                <p>The AI Agent (introduced in v0.5.0) automates coding tasks by planning and executing changes based on your instructions and selected context.</p>

                                <h4 className="font-semibold mt-3 mb-1">How the Agent Works:</h4>
                                <ol className="list-decimal list-inside space-y-2">
                                    <li>
                                        <strong>Context Gathering:</strong> You provide the context by selecting relevant project files, choosing guiding prompts, and writing your main task description in the "User Input" field on the project page.
                                    </li>
                                    <li>
                                        <strong>Initiation:</strong> Clicking the <span className="inline-flex items-center px-1.5 py-0.5 border rounded text-xs shadow-sm bg-gradient-to-r from-blue-500/10 via-purple-500/10 to-pink-500/10 border-purple-500/30"><Bot className="inline-block h-3 w-3 mr-1" /> Agent</span> button (underneath the "User Input" field) opens the Agent Control Dialog.
                                    </li>
                                    <li>
                                        <strong>Planning Phase:</strong> Upon starting a run, the system sends your context to a specialized "Planning Agent." This AI analyzes your request and the provided file information to create a structured plan, breaking down the goal into a series of specific tasks (e.g., "modify function X in file Y.ts," "create new file Z.ts with specified content").
                                    </li>
                                    <li>
                                        <strong>Execution Phase (Coding Agent):</strong> For each task in the plan, a "Coding Agent" takes over. It receives the specific task instruction and the content of the target file (if it exists). The Coding Agent then generates the necessary code modifications or new file content.
                                    </li>
                                    <li>
                                        <strong>Proposal:</strong> Once all tasks are processed, the agent presents all proposed changes (additions, modifications, deletions) to you for review in the "Confirm" tab of the Agent Control Dialog.
                                    </li>
                                    <li>
                                        <strong>Confirmation:</strong> You review the proposed changes. If satisfied, you confirm, and the agent writes the changes directly to your file system. Otherwise, you can discard them by closing the dialog or not confirming.
                                    </li>
                                </ol>

                                <h4 className="font-semibold mt-3 mb-1">The Agent Control Dialog:</h4>
                                <p>When you click the "Agent" button, the Agent Control Dialog appears. It has several tabs:</p>
                                <ul className="list-disc list-inside space-y-2 pl-4 mt-1">
                                    <li>
                                        <strong>New Job Tab:</strong>
                                        <ul className="list-circle list-inside pl-4 mt-1 space-y-1">
                                            <li>This is the default tab when initiating a new agent run.</li>
                                            <li>It provides an overview of the context that will be sent to the agent: your user input, the list of selected files, chosen prompts, and an estimated total token count for the input.</li>
                                            <li>Click the <span className="inline-flex items-center px-1.5 py-0.5 border rounded text-xs shadow-sm bg-gradient-to-r from-blue-500 via-purple-500 to-pink-500 text-white"><Bot className="inline-block h-3 w-3 mr-1" /> Start Agent Run</span> button at the bottom to begin the process. You'll be automatically switched to the "Logs & Data" tab.</li>
                                        </ul>
                                    </li>
                                    <li>
                                        <strong>Logs & Data Tab:</strong>
                                        <ul className="list-circle list-inside pl-4 mt-1 space-y-1">
                                            <li>This tab becomes active once an agent run starts or if you select a past run using the Run ID selector at the top of the dialog.</li>
                                            <li>By default, it shows a live stream of logs from the agent's execution, providing insights into its decision-making process, task execution, and any errors encountered.</li>
                                            <li>A toggle switch allows you to switch from "Viewing Logs" to "Viewing Raw Data." The raw data view displays the complete JSON object representing the agent run's state, including the detailed task plan, file contents, and other metadata. This is useful for debugging or deeper analysis.</li>
                                            <li>Use the <span className="inline-flex items-center px-1 py-0.5 border rounded text-xs shadow-sm"><RefreshCw className="inline-block h-3 w-3" /></span> button to refresh logs and data.</li>
                                            <li>The Run ID selector (a dropdown menu) allows you to load logs and data from previous agent runs.</li>
                                            <li>You can copy the current Run ID using the <span className="inline-flex items-center px-1 py-0.5 border rounded text-xs shadow-sm"><Copy className="inline-block h-3 w-3" /></span> button or delete the run using the <span className="inline-flex items-center px-1 py-0.5 border rounded text-xs shadow-sm text-destructive"><Trash2 className="inline-block h-3 w-3" /></span> button.</li>
                                        </ul>
                                    </li>
                                    <li>
                                        <strong>Confirm Tab:</strong>
                                        <ul className="list-circle list-inside pl-4 mt-1 space-y-1">
                                            <li>After the agent has finished processing all tasks and generated code changes, this tab displays the proposed modifications.</li>
                                            <li>You'll see a list of files that will be created, modified, or deleted. Each file entry shows the type of change (e.g., <FilePlus className="inline-block h-3 w-3 text-green-500" />, <FileEdit className="inline-block h-3 w-3 text-blue-500" />, <FileMinus className="inline-block h-3 w-3 text-red-500" />) and line change counts.</li>
                                            <li>For each file, you can click the <span className="inline-flex items-center px-1.5 py-0.5 border rounded text-xs shadow-sm"><Eye className="inline-block h-3 w-3 mr-1" />Preview</span> button to see a diff view highlighting the exact changes (for modifications) or the full content (for new/deleted files).</li>
                                            <li>Review these changes carefully. If you're satisfied, click the <span className="inline-flex items-center px-1.5 py-0.5 border rounded text-xs shadow-sm bg-green-600 text-white"><CheckCircle className="inline-block h-3 w-3 mr-1" /> Confirm & Apply Changes</span> button to write the modifications to your project's files on your computer.</li>
                                            <li>If you don't want to apply the changes, you can simply close the dialog or navigate to another tab. The changes won't be applied unless explicitly confirmed.</li>
                                        </ul>
                                    </li>
                                </ul>
                                <p className="mt-3"><strong>Tip:</strong> Provide clear, specific instructions in the "User Input" and select only the most relevant files and prompts for the best results. The agent's performance depends heavily on the quality and focus of the context you provide.</p>
                            </div>
                        </ScrollArea>
                    </TabsContent>
                    <TabsContent value="chat">
                        <ScrollArea className="h-[60vh] pr-4">
                            <div className="space-y-3 p-4 text-sm">
                                <h3 className="font-semibold mb-2">Chat Functionality</h3>
                                <p>
                                    The chat interface provides a straightforward way to interact directly with various Large Language Models (LLMs).
                                </p>
                                <p>
                                    Currently, it's a basic chat interface allowing you to send messages to an AI and receive responses. The backend supports multiple LLM providers, giving you flexibility in choosing the model that best suits your needs.
                                </p>
                                <p>
                                    We primarily recommend using <a href="https://openrouter.ai/" target="_blank" rel="noopener noreferrer" className="text-blue-500 hover:underline">OpenRouter</a>. OpenRouter aggregates many different providers and models, allowing you to access a wide array of LLMs seamlessly through a single API key. This simplifies configuration and lets you experiment with various models easily.
                                </p>
                                <p>
                                    To configure your provider and model, use the settings icon within the chat interface. You can manage your API keys on the <Link to="/keys" className="text-blue-500 hover:underline" onClick={() => onOpenChange?.(false)}>Keys</Link> page.
                                </p>
                                <h4 className="font-semibold mt-3 mb-1">Key Features:</h4>
                                <ul className="list-disc list-inside space-y-1 pl-4">
                                    <li>Direct conversation with LLMs.</li>
                                    <li>Support for multiple backend providers.</li>
                                    <li>Easy model and provider switching via chat settings.</li>
                                    <li>Context retention within a chat session.</li>
                                    <li>Ability to fork conversations from specific messages.</li>
                                    <li>Option to exclude messages from the context sent to the LLM.</li>
                                </ul>
                            </div>
                        </ScrollArea>
                    </TabsContent>
                    <TabsContent value="getting-started">
                        <ScrollArea className="h-[60vh] pr-4">
                            <div className="space-y-3 p-4 text-sm">
                                <h3 className="font-semibold mb-2">Welcome to OctoPrompt!</h3>

                                <h4 className="font-semibold mt-3 mb-1">1. Setting Up Your Project</h4>
                                <ol className="list-decimal list-inside space-y-1">
                                    <li>Navigate to the <Link to="/projects" className="text-blue-500 hover:underline" onClick={() => onOpenChange?.(false)}>Projects</Link> page.</li>
                                    <li>Click the "New Project" button. This will open the project dialog.</li>
                                    <li>You'll need to provide a name for your project and the **full absolute path** to your project's main folder on your computer.</li>
                                </ol>

                                <h4 className="font-semibold mt-3 mb-1">How to Get the Full Folder Path:</h4>
                                <ul className="list-disc list-inside space-y-1 pl-4">
                                    <li>
                                        <strong>macOS:</strong>
                                        <ul className="list-circle list-inside pl-4 mt-1 space-y-0.5">
                                            <li>Open Finder and navigate to your project folder.</li>
                                            <li>Right-click (or Control-click) on the folder.</li>
                                            <li>While holding down the <ShortcutDisplay shortcut={['Option']} /> key, select "Copy [FolderName] as Pathname".</li>
                                            <li>Alternatively, select the folder, press <ShortcutDisplay shortcut={['Cmd', 'I']} delimiter=" + " /> to open the "Get Info" window, and copy the path from the "Where:" field.</li>
                                        </ul>
                                    </li>
                                    <li>
                                        <strong>Windows:</strong>
                                        <ul className="list-circle list-inside pl-4 mt-1 space-y-0.5">
                                            <li>Open File Explorer and navigate to your project folder.</li>
                                            <li>Click in the address bar at the top; the full path will appear and you can copy it (<ShortcutDisplay shortcut={['Ctrl', 'C']} delimiter=" + " />).</li>
                                            <li>Alternatively, hold <ShortcutDisplay shortcut={['Shift']} />, then right-click on the folder and select "Copy as path".</li>
                                        </ul>
                                    </li>
                                    <li>
                                        <strong>Linux:</strong>
                                        <ul className="list-circle list-inside pl-4 mt-1 space-y-0.5">
                                            <li>Open your terminal.</li>
                                            <li>Navigate to the directory *containing* your project folder using the <code>cd</code> command.</li>
                                            <li>Type <code>readlink -f your_project_folder_name</code> (replace <code>your_project_folder_name</code> with the actual folder name) and press Enter. The full path will be printed.</li>
                                            <li>Alternatively, in most desktop environments, you can drag the folder from your file manager into a terminal window, and it will paste the full path.</li>
                                        </ul>
                                    </li>
                                </ul>
                                <h4 className="font-semibold mt-3 mb-1">2. Understanding the Project Interface</h4>
                                <p>Once your project is synced and you open it, you'll primarily interact with the main project view. This view is typically divided into a few key areas:</p>
                                <ul className="list-disc list-inside space-y-1 pl-4">
                                    <li><strong>File Panel (Left):</strong> This panel contains your project's file structure (File Tree) and a search bar at the top. You can explore and select files here.</li>
                                    <li><strong>Prompt Overview Panel (Right):</strong> This is where you manage prompts for the AI, write your main instructions ("User Input"), and initiate actions with the AI.</li>
                                </ul>

                                <h4 className="font-semibold mt-3 mb-1">3. Finding and Selecting Files (Building Context)</h4>
                                <p>OctoPrompt offers several ways to find and select files to include as context for the AI:</p>
                                <ul className="list-disc list-inside space-y-1 pl-4">
                                    <li>
                                        <strong>File Tree Navigation:</strong> In the File Panel, manually browse your project's directory structure. Click on files or folders to select/deselect them.
                                        Use <ShortcutDisplay shortcut={['up', 'down']} delimiter=" / " /> to navigate items, <ShortcutDisplay shortcut={['space']} /> to toggle selection, and <ShortcutDisplay shortcut={['left', 'right']} delimiter=" / " /> to collapse/expand folders.
                                    </li>
                                    <li>
                                        <strong>Text Search:</strong> Use the "File Search" input field (<AppShortcutDisplay shortcut="focus-file-search" /> or <ShortcutDisplay shortcut={['mod', 'f']} />) located above the File Tree in the File Panel. You can search for files by name or toggle the option to search by content.
                                    </li>
                                    <li>
                                        <strong>AI-Assisted File Search:</strong>
                                        In the Prompt Overview Panel (right side), first type your task description or question into the "User Input" text area.
                                        Then, click the <span className="inline-flex items-center px-1.5 py-0.5 border rounded text-xs shadow-sm"><Search className="inline-block h-3 w-3 mr-1" />Files</span> button (located directly beneath the "User Input" area).
                                        The AI will analyze your input and your project's file summaries (if available) to suggest relevant files. Add these suggestions to your "Selected Files" list.
                                        <em>(Note: This feature requires project file summarization to be enabled for your project, which in turn needs an API key to be configured on the <Link to="/keys" className="text-blue-500 hover:underline" onClick={() => onOpenChange?.(false)}>Keys</Link> page).</em>
                                    </li>
                                </ul>
                                <p className="mt-2">As you select files, they appear in the "Selected Files" list (usually on the right side of the File Panel or in a drawer on smaller screens) and contribute to the total token count for your context. Aim to include only the most relevant files to keep your context focused, effective, and within model limits.</p>

                                <h4 className="font-semibold mt-3 mb-1">4. Selecting and Using Prompts</h4>
                                <p>
                                    In the Prompt Overview Panel (right side), below the token usage bar, you'll find the "Project Prompts" list.
                                    These are reusable instructions or guidelines for the AI. You can select one or multiple prompts from this list by checking the box next to their names.
                                </p>
                                <p>
                                    Selected prompts are combined with your selected files and the text you enter in the "User Input" field to form the complete context sent to the AI.
                                    Use prompts to dictate desired traits of the output, such as coding style, tone, specific formats to follow, or common instructions you use frequently.
                                </p>
                                <p>
                                    You can create new prompts specific to this project, or import prompts from your global library. Manage your global prompt library on the <Link to="/prompts" className="text-blue-500 hover:underline" onClick={() => onOpenChange?.(false)}>Prompts</Link> page.
                                </p>

                                <h4 className="font-semibold mt-3 mb-1">5. Interacting with the AI</h4>
                                <p>Once you've selected your files, chosen your prompts, and written your main request in the "User Input" field in the Prompt Overview Panel, you have a few ways to proceed:</p>
                                <ul className="list-disc list-inside space-y-1 pl-4">
                                    <li>
                                        <strong>Copy All for External Use:</strong> Click the <span className="inline-flex items-center px-1.5 py-0.5 border rounded text-xs shadow-sm"><Copy className="inline-block h-3 w-3 mr-1" /> Copy All</span> button.
                                        This action compiles an XML-formatted string containing all your selected file content, the content of your chosen prompts, and your user input.
                                        You can then paste this comprehensive context into external AI chat interfaces like ChatGPT, Claude, or Gemini. This is particularly useful for complex refactoring tasks or when you prefer the UIs of those services.
                                    </li>
                                    <li>
                                        <strong>Using the AI Agent (Introduced in v0.5.0):</strong> Click the <span className="inline-flex items-center px-1.5 py-0.5 border rounded text-xs shadow-sm bg-gradient-to-r from-blue-500/10 via-purple-500/10 to-pink-500/10 border-purple-500/30"><Bot className="inline-block h-3 w-3 mr-1" /> Agent</span> button.
                                        This initiates an automated workflow. The agent will receive your entire context (files, prompts, user input), create a plan of action, generate code modifications, and then propose these changes to you in a dialog. You can review these changes and choose to apply them to your file system. See the "Agent Usage" tab for a detailed explanation.
                                    </li>
                                    <li>
                                        <strong>Chat with Context:</strong> Click the <span className="inline-flex items-center px-1.5 py-0.5 border rounded text-xs shadow-sm"><MessageCircleCode className="inline-block h-3 w-3 mr-1" /> Chat</span> button.
                                        This takes your current context (selected files, prompts, user input) and starts a new chat session on the "Chat" page, pre-filling the first message with this context. This allows for a more conversational interaction with the LLM regarding the selected materials.
                                    </li>
                                </ul>

                                <h4 className="font-semibold mt-3 mb-1">6. Project Syncing & File Summarization (Optional)</h4>
                                <p>OctoPrompt automatically syncs files when you add or open a project. This allows the application to understand your project's structure and content for search and AI operations.</p>
                                <p>
                                    If you have AI features enabled (by configuring your API keys on the <Link to="/keys" className="text-blue-500 hover:underline" onClick={() => onOpenChange?.(false)}>Keys</Link> page), and you enable file summaries for your project (usually in the project's settings or a dedicated "Summary" page after creation), OctoPrompt will begin to create summaries of your project files.
                                    These summaries are then used as context for various AI operations, such as:
                                </p>
                                <ul className="list-disc list-inside space-y-1 pl-4">
                                    <li>Providing better context to the agent when generating task plans.</li>
                                    <li>Generating task lists for tickets or issues.</li>
                                    <li>Improving the relevance of AI-assisted file suggestions.</li>
                                </ul>
                                <p className="mt-2">You can typically manage summarization settings on the project's dedicated "Summary" page after the project is created.</p>

                                <p className="mt-4">That's it! You're ready to start exploring and working with your codebase using OctoPrompt's AI-assisted features.</p>
                            </div>
                        </ScrollArea>
                    </TabsContent>
                    <TabsContent value="keys">
                        <ScrollArea className="h-[60vh] pr-4">
                            <div className="space-y-3 p-4 text-sm">
                                <h3 className="font-semibold mb-2">Managing API Keys</h3>
                                <p>
                                    The "Keys" page is where you configure and manage the API keys required to access various Large Language Models (LLMs). These keys enable OctoPrompt to utilize external AI services for features like chat, agent runs, and file summarization.
                                </p>
                                <h4 className="font-semibold mt-3 mb-1">Providers and Models:</h4>
                                <p>
                                    <strong>AI Providers</strong> are companies or services that offer access to powerful Large Language Models (LLMs). Think of them as the companies that build and host the AI technology. Examples include OpenAI, Anthropic, and Google.
                                </p>
                                <p>
                                    <strong>Models</strong> are the specific AI programs or algorithms developed by these providers. Each model has different capabilities, strengths, and costs. For example, OpenAI offers models like GPT-4 and GPT-3.5, while Anthropic offers Claude models.
                                </p>
                                <p>
                                    OctoPrompt supports integration with several AI providers. The currently supported providers are:
                                </p>
                                <ul className="list-disc list-inside space-y-1 pl-4">
                                    <li>OpenAI</li>
                                    <li>Anthropic</li>
                                    <li>Google</li>
                                    <li>OpenRouter (an aggregator for many models across different providers)</li>
                                </ul>
                                <p className="mt-3">
                                    <strong>Why You Need API Keys:</strong>
                                    To use the AI features within OctoPrompt, you need to provide API keys obtained directly from the AI providers you wish to use (or from an aggregator like OpenRouter). These keys act as your credentials, allowing OctoPrompt to send requests to the provider's AI models on your behalf and enabling features like chat, code generation, and file analysis. Without a valid API key configured, OctoPrompt cannot access the external AI services.
                                </p>
                                <h4 className="font-semibold mt-3 mb-1">Adding, Editing, and Deleting Keys:</h4>
                                <ul className="list-disc list-inside space-y-1 pl-4">
                                    <li>Navigate to the <Link to="/keys" className="text-blue-500 hover:underline" onClick={() => onOpenChange?.(false)}>Keys</Link> page.</li>
                                    <li>To <strong>Add</strong> a key: Select the provider you want to configure from the dropdown and enter your API key in the input field. Click "Save".</li>
                                    <li>To <strong>Edit</strong> a key: Select the provider whose key you want to edit from the dropdown. The existing key (if any) will be displayed. Modify the key in the input field and click "Save".</li>
                                    <li>To <strong>Delete</strong> a key: Select the provider whose key you want to delete from the dropdown. Click the "Delete" button next to the input field. Confirm the deletion if prompted.</li>
                                </ul>
                                <h4 className="font-semibold mt-3 mb-1">Obtaining API Keys:</h4>
                                <p>
                                    You need to obtain API keys directly from the respective AI providers. Here are links to the documentation or key management pages for some supported providers:
                                </p>
                                <ul className="list-disc list-inside space-y-1 pl-4">
                                    <li><a href="https://platform.openai.com/account/api-keys" target="_blank" rel="noopener noreferrer" className="text-blue-500 hover:underline">OpenAI API Keys</a></li>
                                    <li><a href="https://console.anthropic.com/settings/keys" target="_blank" rel="noopener noreferrer" className="text-blue-500 hover:underline">Anthropic API Keys</a></li>
                                    <li><a href="https://console.cloud.google.com/apis/credentials" target="_blank" rel="noopener noreferrer" className="text-blue-500 hover:underline">Google Cloud API Keys</a></li>
                                    <li><a href="https://openrouter.ai/keys" target="_blank" rel="noopener noreferrer" className="text-blue-500 hover:underline">OpenRouter API Keys</a></li>
                                </ul>
                                <p className="mt-3">
                                    Once you have your API key from the provider, return to the <Link to="/keys" className="text-blue-500 hover:underline" onClick={() => onOpenChange?.(false)}>Keys</Link> page in OctoPrompt to add it.
                                </p>
                            </div>
                        </ScrollArea>
                    </TabsContent>
                    <TabsContent value="prompts">
                        <ScrollArea className="h-[60vh] pr-4">
                            <div className="space-y-3 p-4 text-sm">
                                <h3 className="font-semibold mb-2">Managing Your Prompt Library</h3>
                                <p>
                                    The "Prompts" page is your central hub for creating, organizing, and managing a library of reusable prompts. These prompts can be used to guide the AI in various tasks, ensuring consistency and efficiency in your interactions.
                                </p>

                                <h4 className="font-semibold mt-3 mb-1">The Prompts Page:</h4>
                                <p>
                                    On the <Link to="/prompts" className="text-blue-500 hover:underline" onClick={() => onOpenChange?.(false)}>Prompts</Link> page, you will find a list of all your saved prompts. Each prompt entry typically includes a title and a preview of the prompt content. You can use the search bar to quickly find specific prompts by title or keywords within the content.
                                </p>

                                <h4 className="font-semibold mt-3 mb-1">Creating a New Prompt:</h4>
                                <ol className="list-decimal list-inside space-y-1">
                                    <li>Navigate to the <Link to="/prompts" className="text-blue-500 hover:underline" onClick={() => onOpenChange?.(false)}>Prompts</Link> page.</li>
                                    <li>Click the "New Prompt" button. This will open a dialog or a new page for creating a prompt.</li>
                                    <li>Provide a clear and descriptive title for your prompt.</li>
                                    <li>Enter the prompt content in the designated text area. This is where you craft your instructions, context, and desired output format for the AI.</li>
                                    <li>Click "Save" to add the prompt to your library.</li>
                                </ol>

                                <h4 className="font-semibold mt-3 mb-1">Editing an Existing Prompt:</h4>
                                <ol className="list-decimal list-inside space-y-1">
                                    <li>Navigate to the <Link to="/prompts" className="text-blue-500 hover:underline" onClick={() => onOpenChange?.(false)}>Prompts</Link> page.</li>
                                    <li>Find the prompt you wish to edit in the list.</li>
                                    <li>Click on the prompt entry (or an "Edit" button if available). This will open the prompt in an editing interface.</li>
                                    <li>Modify the title or the content of the prompt as needed.</li>
                                    <li>Click "Save" to update the prompt.</li>
                                </ol>

                                <h4 className="font-semibold mt-3 mb-1">Deleting a Prompt:</h4>
                                <ol className="list-decimal list-inside space-y-1">
                                    <li>Navigate to the <Link to="/prompts" className="text-blue-500 hover:underline" onClick={() => onOpenChange?.(false)}>Prompts</Link> page.</li>
                                    <li>Find the prompt you wish to delete in the list.</li>
                                    <li>Click the "Delete" button (often represented by a trash can icon) associated with the prompt entry.</li>
                                    <li>Confirm the deletion if prompted. Deleting a prompt is permanent.</li>
                                </ol>

                                <h4 className="font-semibold mt-3 mb-1">Organizing Your Prompts:</h4>
                                <p>
                                    While the current version provides a simple list, future updates may include features for better organization, such as: (Note: These features may not be available yet.)
                                </p>
                                <ul className="list-disc list-inside space-y-1 pl-4">
                                    <li>**Tagging/Labeling:** Assigning keywords or categories to prompts for easier filtering and searching.</li>
                                    <li>**Folders/Categories:** Grouping related prompts into folders or categories.</li>
                                    <li>**Sorting Options:** Sorting prompts by creation date, last modified date, or title.</li>
                                </ul>
                                <p className="mt-2">Effective organization will help you quickly find the right prompt for your task as your library grows.</p>

                                <h4 className="font-semibold mt-3 mb-1">Importing Prompts into Projects:</h4>
                                <p>
                                    One of the key features of the prompt library is the ability to import prompts into specific projects. This allows you to curate a set of relevant prompts for each codebase or type of task you work on.
                                </p>
                                <p>
                                    To import prompts into a project:
                                </p>
                                <ol className="list-decimal list-inside space-y-1">
                                    <li>Navigate to the specific project you are working on.</li>
                                    <li>Look for a "Prompts" section or tab within the project interface (usually in the Prompt Overview Panel).</li>
                                    <li>There should be an option to "Import Prompts" or "Add Prompts from Library" (often via a menu or button in the "Project Prompts" header).</li>
                                    <li>Selecting this option will likely open a dialog or a view of your global prompt library.</li>
                                    <li>From this view, you can select the prompts you want to associate with the current project.</li>
                                    <li>Once imported, these prompts will be readily available for use when interacting with the AI within that project's context.</li>
                                </ol>
                                <p className="mt-2">Importing prompts helps keep your project-specific AI interactions focused and efficient, preventing clutter from your entire prompt library.</p>
                            </div>
                        </ScrollArea>
                    </TabsContent>
                </Tabs>
            </DialogContent>
        </Dialog>
    )
}