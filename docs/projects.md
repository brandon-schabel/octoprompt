# User Guide: Project Screen

Welcome to the Project Screen! This is your central hub for managing and interacting with your coding projects. Here, you can organize your work into tabs, select files, and work with AI-powered prompts.

`[SCREENSHOT: Overview of the entire Project Screen with a project loaded, showing the Tab Manager, File Panel, and Prompt Panel]`

## Table of Contents

1. [Understanding the Layout](#understanding-the-layout)
2. [Getting Started](#getting-started)
   - [Welcome Message](#welcome-message)
   - [No Projects Yet?](#no-projects-yet)
   - [No Tabs Yet?](#no-tabs-yet)
   - [No Active Tab Selected?](#no-active-tab-selected)
3. [Project Tabs Manager](#project-tabs-manager)
   - [Creating a New Tab](#creating-a-new-tab)
   - [Switching Between Tabs](#switching-between-tabs)
   - [Renaming Tabs](#renaming-tabs)
     - [Inline Renaming](#inline-renaming)
     - [Renaming via Manage Tabs Dialog](#renaming-via-manage-tabs-dialog)
   - [Reordering Tabs](#reordering-tabs)
   - [Managing Tabs (Settings Dialog)](#managing-tabs-settings-dialog)
   - [Deleting Tabs](#deleting-tabs)
   - [Tab Shortcuts](#tab-shortcuts)
4. [File Panel (Left Side)](#file-panel-left-side)
   - [Project Header](#project-header)
     - [Project Information](#project-information)
     - [Active Tab Details & Actions](#active-tab-details--actions)
     - [Navigation Links](#navigation-links)
     - [Project Settings](#project-settings)
   - [File Explorer](#file-explorer)
   - [File Selection Actions](#file-selection-actions)
5. [Prompt Overview Panel (Right Side)](#prompt-overview-panel-right-side)

---

## 1. Understanding the Layout

The Project Screen is divided into a few key areas:

- **Project Tabs Manager (Top):** Allows you to create, switch, rename, reorder, and manage different "tabs." Each tab saves its own context, like selected files and prompt inputs.
- **File Panel (Left):** Displays information about the currently active project and its file structure. You can explore directories, search for files, and select files for analysis or interaction.
- **Prompt Overview Panel (Right):** This is where you'll interact with AI prompts, view results, and manage your prompt history related to the selected files in the active tab.

The File Panel and Prompt Overview Panel are within a resizable area, allowing you to adjust their widths to your preference.

`[SCREENSHOT: Project screen highlighting the three main areas: Tabs Manager, File Panel, Prompt Panel]`

---

## 2. Getting Started

### Welcome Message

If it's your first time visiting the Project Screen, you'll see a welcome message.

`[SCREENSHOT: Welcome dialog box]`

Simply click "Got it" to dismiss this message. It won't appear again.

### No Projects Yet?

If you haven't created or opened any projects, the screen will prompt you to create one.

`[SCREENSHOT: "No Tabs Yet" view when there are no projects, showing the "Create a Project" button]`

- Click the **"+ Create a Project"** button to get started.

### No Tabs Yet?

If you have projects but haven't created any tabs for the currently selected project, you'll see a message encouraging you to create your first tab.

`[SCREENSHOT: "No Tabs Yet" view, showing the message and "+ Create a Tab" button]`

- Click the **"+ Create a Tab"** button. This will create a new tab associated with your current project (usually the first project in your list if multiple exist).

### No Active Tab Selected?

If you have tabs but haven't selected one to be active, the main area will be empty.

`[SCREENSHOT: "No Active Tab" view, showing the message "No active tab selected."]`

- Click on any tab in the **Project Tabs Manager** at the top to activate it.

---

## 3. Project Tabs Manager

The Project Tabs Manager is located at the top of the screen. It helps you organize your work into different contexts or sessions within a project.

`[SCREENSHOT: The Project Tabs Manager bar with a few tabs open]`

### Creating a New Tab

You can create a new tab in two ways:

1. **If no tabs exist:**
   - Click the **"+ New Project Tab"** button in the main view.
     `[SCREENSHOT: The "+ New Project Tab" button when no tabs are present]`
2. **If tabs already exist:**
   - Click the **plus icon (+)** button located at the right end of the tabs list in the Project Tabs Manager.
     `[SCREENSHOT: The small plus icon (+) at the end of the tab list]`

A new tab will be created. If you don't have an active project selected, you might be prompted or it might use a default project. The new tab will typically be named "Tab [ID]" by default.

**Note:** A tab can only be created if a project is active. If no project is selected, the "New Project Tab" button might be disabled or show an error.

### Switching Between Tabs

- **Click** on any tab in the manager to make it active. The content of the File Panel and Prompt Overview Panel will update to reflect the context of the selected tab.
- The active tab is usually highlighted.

`[SCREENSHOT: Tabs Manager with one tab clearly highlighted as active]`

### Renaming Tabs

You can rename tabs to better reflect their purpose.

#### Inline Renaming

1. **Double-click** on the tab name in the Project Tabs Manager.
2. The tab name will become an editable input field.
   `[SCREENSHOT: A tab in inline edit mode with the name highlighted in an input field]`
3. Type the new name.
4. Press **Enter** to save or **click outside** the input field. Press **Escape** to cancel.

#### Renaming via Manage Tabs Dialog

See [Managing Tabs (Settings Dialog)](#managing-tabs-settings-dialog).

### Reordering Tabs

You can change the order of your tabs:

1. **Click and hold** on a tab.
2. **Drag** the tab to the desired position in the tab list.
3. **Release** the mouse button.

`[SCREENSHOT: Animation or sequence showing a tab being dragged and dropped to a new position]`

The order is saved automatically.

### Managing Tabs (Settings Dialog)

For more advanced tab management, use the "Manage Project Tabs" dialog:

1. Click the **Settings icon (gear)** next to the "Project Tabs" title in the Tabs Manager.
   `[SCREENSHOT: The "Settings" (gear) icon in the Tabs Manager]`
2. The "Manage Project Tabs" dialog will open.
   `[SCREENSHOT: The "Manage Project Tabs" dialog showing a list of tabs with their details and action buttons]`

In this dialog, you can:

- **View all tabs:** Each tab is listed with its name and statistics (number of selected files, prompts, and user input length).
- **Rename a tab:**
  - Click on the tab name you wish to change. It will become an editable input field.
  - Type the new name and press **Enter** or click the **Pencil icon** that appears.
  - Alternatively, click the **Pencil icon** next to the tab name to enter edit mode.
- **Delete a tab:** Click the **Trash icon** next to the tab you want to remove (a confirmation will appear).

### Deleting Tabs

You can delete tabs from the "Manage Project Tabs" dialog as described above, or directly from the [Project Header](#active-tab-details--actions) if the tab is active.

### Tab Shortcuts

Use these keyboard shortcuts for quick tab navigation:

- **Next Tab:** `t` + `Tab`
- **Previous Tab:** `t` + `Shift` + `Tab`
- **Switch to Specific Tab (1-9):** `t` + `[1-9]` (e.g., `t` + `1` for the first tab, `t` + `2` for the second, etc.)

A tooltip is available by hovering over the **question mark icon** next to "Project Tabs" for a reminder of these shortcuts.
`[SCREENSHOT: Tooltip showing the tab shortcuts]`

---

## 4. File Panel (Left Side)

When a project and an active tab are selected, the File Panel on the left side of the screen becomes populated.

`[SCREENSHOT: The File Panel filled with Project Header and File Explorer]`

### Project Header

The top section of the File Panel is the Project Header. It provides information and actions related to the current project and active tab.

`[SCREENSHOT: Close-up of the Project Header area]`

#### Project Information

- **Project Name:** Displayed prominently. Hover over the name to see the full project path.
  `[SCREENSHOT: Project name with tooltip showing full path and copy icons]`
- **Copy Project Path:** While hovering over the project name, a tooltip appears. Click the **Copy icon** next to the path to copy it to your clipboard.
- **Copy Project ID:** In the same tooltip, you can also copy the Project ID.
- **Project Path (truncated):** A truncated version of the project path is displayed below the name for quick reference.

#### Active Tab Details & Actions

Below the project information, if an active tab is selected, its details are shown:

`[SCREENSHOT: Active tab name displayed in Project Header with edit/delete icons visible on hover]`

- **Tab Icon & Name:** The name of the currently active project tab is displayed (e.g., "Unnamed Tab" or a custom name you've set).
- **Rename Active Tab:**
  1. Click directly on the tab name.
  2. It will become an editable input field. Type the new name.
  3. Press **Enter** to save or click outside. Press **Escape** to cancel.
  4. Alternatively, hover over the tab name and click the **Pencil icon** that appears to start editing.
- **Delete Active Tab:**
  1. Hover over the tab name.
  2. Click the **Trash icon** that appears.
  3. A confirmation dialog will ask if you're sure you want to delete the tab.
     `[SCREENSHOT: Delete tab confirmation dialog]`
  4. Click "Delete" to confirm or "Cancel".

#### Navigation Links

Quick links to other related sections:

- **Tickets:** Navigates to the Tickets page for this project. If there are open tickets, a badge with the count will be displayed.
  `[SCREENSHOT: "Tickets" link with a notification badge]`
- **Summarization:** Navigates to the Project Summarization page.

#### Project Settings

- Click the **Project Settings button (often a gear or sliders icon)** to open the settings dialog for the current project. (Details of project settings are covered in a separate guide).
  `[SCREENSHOT: Project Settings button in the Project Header]`

### File Explorer

Below the Project Header, the File Explorer allows you to:

`[SCREENSHOT: The File Explorer section showing a directory tree and search bar]`

- **Search Files:** Use the search bar to quickly find files within your project.
- **Browse Directories:** Expand and collapse folders to navigate your project's file structure.
- **Select Files:** Click on files to select them. Selected files are typically used as context for the prompts in the Prompt Overview Panel.
- **View Selected Files:** A list of currently selected files is usually displayed.

### File Selection Actions

Keyboard shortcuts for managing file selections:

- **Focus Search Bar:** `Cmd/Ctrl` + `F`
- **Focus File Tree:** `Cmd/Ctrl` + `G`
- **Undo File Selection:** `Cmd/Ctrl` + `Z`
- **Redo File Selection:** `Cmd/Ctrl` + `Shift` + `Z` or `Cmd/Ctrl` + `Y`

---

## 5. Prompt Overview Panel (Right Side)

The Prompt Overview Panel is located on the right side of the screen. This is where you will:

`[SCREENSHOT: The Prompt Overview Panel, perhaps with some example prompt elements or a placeholder message]`

- **Enter Prompts:** Type your questions or instructions for the AI.
- **Manage Prompts:** Select from saved prompts or create new ones.
- **View AI Responses:** See the output generated by the AI based on your selected files and prompt.
- **Interact with Results:** Depending on the feature, you might be able to apply changes, ask follow-up questions, etc.

The specific functionalities within this panel will depend on the tasks you are performing.

---

This guide should help you navigate and utilize the Project Screen effectively. If you have further questions, please refer to specific feature documentation or contact support.
