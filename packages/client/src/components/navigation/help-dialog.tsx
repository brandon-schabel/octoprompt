import { useHotkeys } from "react-hotkeys-hook"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@ui"
import { Badge } from '@ui'
import { ScrollArea } from "@ui"
import { AppShortcutDisplay, ShortcutDisplay } from "../app-shortcut-display"
import { useActiveChatId, useAppSettings, useSelectSetting } from "@/hooks/api/use-kv-api"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@ui/tabs";
import { Link } from "@tanstack/react-router";

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
            <DialogContent className="max-h-[80vh] overflow-y-auto">
                <DialogHeader>
                    <DialogTitle>Help & Information</DialogTitle>
                </DialogHeader>
                <Tabs defaultValue="shortcuts" className="w-full">
                    <TabsList className="grid w-full grid-cols-4">
                        <TabsTrigger value="getting-started">Getting Started</TabsTrigger>
                        <TabsTrigger value="agent">Agent Usage</TabsTrigger>
                        <TabsTrigger value="chat">Chat</TabsTrigger>
                        <TabsTrigger value="shortcuts">Keyboard Shortcuts</TabsTrigger>
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
                                <h3 className="font-semibold mb-2">Using the AI Agent</h3>
                                <p>The AI Agent can help you plan and execute coding tasks. Here's a general workflow:</p>
                                <ol className="list-decimal list-inside space-y-2">
                                    <li>
                                        <strong>Find Files:</strong>
                                        <ul className="list-disc list-inside pl-4 mt-1 space-y-1">
                                            <li>Use the "File Search" (<AppShortcutDisplay shortcut="focus-file-search" />) to manually locate relevant files for your task.</li>
                                            <li>Alternatively, describe your task in the main input area, and the AI can suggest files. Add these to your "Selected Files".</li>
                                        </ul>
                                    </li>
                                    <li>
                                        <strong>Select Prompts (Optional):</strong>
                                        <ul className="list-disc list-inside pl-4 mt-1">
                                            <li>Navigate to the "Prompts" tab and select any relevant prompts that will help guide the AI.</li>
                                        </ul>
                                    </li>
                                    <li>
                                        <strong>Provide User Input:</strong>
                                        <ul className="list-disc list-inside pl-4 mt-1">
                                            <li>Clearly describe the goal or changes you want to achieve in the "User Input" field. Be specific for better results.</li>
                                        </ul>
                                    </li>
                                    <li>
                                        <strong>Initiate Agent Run:</strong>
                                        <ul className="list-disc list-inside pl-4 mt-1">
                                            <li>Once files are selected, prompts (if any) are chosen, and your input is ready, click the "Agent" button underneath the user input.</li>
                                            <li>You'll be taken to a "New Run" tab inside a dialog. Review the overview of included files, prompts, your user input, as well as total input tokens.</li>
                                        </ul>
                                    </li>
                                    <li>
                                        <strong>Start the Run & Review Proposal:</strong>
                                        <ul className="list-disc list-inside pl-4 mt-1">
                                            <li>Click the "Start Run" button.</li>
                                            <li>The agent will first create a plan (a series of tasks).</li>
                                            <li>Then, it will execute these tasks, generating code modifications or new files.</li>
                                            <li>You will be presented with a proposal (a diff) showing all the suggested changes. Review these changes carefully.</li>
                                            <li>In the "Cofnrim" tab You can then choose to apply, modify, or discard the proposed changes.</li>
                                        </ul>
                                    </li>
                                </ol>
                                <p className="mt-3"><strong>Tip:</strong> The more contextually relevant files and clear instructions you provide, the better the agent will perform.</p>
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
                                <p>Let's get your first project set up.</p>

                                <h4 className="font-semibold mt-3 mb-1">1. Add Your Project</h4>
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

                                <h4 className="font-semibold mt-3 mb-1">2. Project Syncing</h4>
                                <p>Once you've added your project, OctoPrompt will automatically sync its files. This allows the application to understand your project's structure and content.</p>

                                <h4 className="font-semibold mt-3 mb-1">3. Searching & Selecting Files (Context)</h4>
                                <p>After syncing, OctoPrompt excels at helping you search for and select the specific files relevant to your task. As you select files, they are added to your "context".</p>
                                <p>You'll see a token count for your current context. Most AI models have a context window limit, and performance can degrade with excessively large contexts. Aim to include only the necessary files to keep your context focused and effective.</p>

                                <h4 className="font-semibold mt-3 mb-1">4. Using Prompts</h4>
                                <p>
                                    OctoPrompt allows you to use a library of prompts to guide the AI. You can access and manage these on the <Link to="/prompts" className="text-blue-500 hover:underline" onClick={() => onOpenChange?.(false)}>Prompts</Link> page.
                                    Prompts can be imported into specific projects, helping you keep your AI interactions organized and tailored to different tasks or codebases.
                                </p>

                                <h4 className="font-semibold mt-3 mb-1">5. AI File Summarization (Optional)</h4>
                                <p>
                                    If you have AI features enabled (by configuring your API keys on the <Link to="/keys" className="text-blue-500 hover:underline" onClick={() => onOpenChange?.(false)}>Keys</Link> page), and you enable file summaries for your project, OctoPrompt will begin to create summaries of your project files.
                                    These summaries are then used as context for various AI operations, such as:
                                </p>
                                <ul className="list-disc list-inside space-y-1 pl-4">
                                    <li>Providing proper context to agent when generating task plans.</li>
                                    <li>Generating task lists for tickets.</li>
                                    <li>Suggesting relevant files based on your input.</li>
                                </ul>
                                <p className="mt-2">You can manage summarization settings on the project's "Summary" page after the project is created.</p>

                                <p className="mt-4">That's it! You're ready to start exploring your codebase with OctoPrompt.</p>
                            </div>
                        </ScrollArea>
                    </TabsContent>
                </Tabs>
            </DialogContent>
        </Dialog>
    )
}