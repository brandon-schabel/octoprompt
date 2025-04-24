import { useState } from 'react';
import { useHotkeys } from 'react-hotkeys-hook';
import { cn } from '@/lib/utils';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { InfoTooltip } from './info-tooltip';
import { ShortcutDisplay } from './app-shortcut-display';
import { LinkIcon, Plus, Pencil, Trash2, Settings, Icon } from 'lucide-react';
import {
  DndContext,
  DragEndEvent,
  PointerSensor,
  useSensor,
  useSensors,
  closestCenter,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  useSortable,
  horizontalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

// Import Zustand hooks and selectors
import {
  useCreateProjectTab,
  useSetActiveProjectTab,
  useUpdateProjectTab,
  useDeleteProjectTab,
} from '@/hooks/api/global-state/updaters';
import { useActiveProjectTab, useAllProjectTabs } from '@/hooks/api/global-state/selectors';
import { useCreateProject } from '@/hooks/api/use-projects-api';

// Define props for the simplified component (mainly className now)
export type ProjectsTabManagerProps = {
  className?: string;
};

// Combined and Simplified Component
export function ProjectsTabManager({ className }: ProjectsTabManagerProps) {
  // --- State Management Hooks ---
  const { createProjectTab } = useCreateProjectTab();
  const setActiveProjectTab = useSetActiveProjectTab();
  const updateProjectTab = useUpdateProjectTab();
  const deleteProjectTab = useDeleteProjectTab();

  const { tabData: activeProjectTabState, id: activeTabId } = useActiveProjectTab();
  const tabs = useAllProjectTabs(); // This is Record<string, ProjectTab>

  // --- Component State ---
  const [editingTabName, setEditingTabName] = useState<{ id: string; name: string } | null>(null);
  const [localOrder, setLocalOrder] = useState<string[] | null>(null);
  const [showSettingsDialog, setShowSettingsDialog] = useState(false);
  const [dialogEditingTab, setDialogEditingTab] = useState<string | null>(null);
  const [dialogEditingName, setDialogEditingName] = useState('');

  // --- Data Preparation ---
  const projectId = activeProjectTabState?.selectedProjectId;

  // Calculate initial order based on sortOrder from Zustand state
  const calculateInitialOrder = (): string[] => {
    if (!tabs) return [];
    return Object.keys(tabs).sort((a, b) => {
      const orderA = tabs[a]?.sortOrder ?? Infinity; // Default to end if no sortOrder
      const orderB = tabs[b]?.sortOrder ?? Infinity;
      return orderA - orderB;
    });
  };

  const initialTabOrderFromState = calculateInitialOrder();
  // Use localOrder if set (during drag), otherwise use order from state
  const finalTabOrder = localOrder ?? initialTabOrderFromState;

  // --- Drag and Drop ---
  const sensors = useSensors(useSensor(PointerSensor));

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!tabs || !over || active.id === over.id) return;

    const oldIndex = finalTabOrder.indexOf(active.id as string);
    const newIndex = finalTabOrder.indexOf(over.id as string);
    if (oldIndex === -1 || newIndex === -1) return; // Should not happen

    const newOrder = arrayMove(finalTabOrder, oldIndex, newIndex);

    console.debug('[ProjectsTabManager] handleDragEnd -> New Order:', newOrder);
    setLocalOrder(newOrder); // Update local state immediately for responsiveness

    // Persist the new order to Zustand state
    newOrder.forEach((tabId, index) => {
      // Only update if the order actually changed for this tab
      if (tabs[tabId]?.sortOrder !== index) {
        updateProjectTab(tabId, { sortOrder: index });
      }
    });
  }

  // --- Hotkeys ---
  const hotkeyPrefix = "t"; // Hardcoded for Project Tabs
  for (let i = 1; i <= 9; i++) {
    // eslint-disable-next-line react-hooks/rules-of-hooks
    useHotkeys(`${hotkeyPrefix}+${i}`, () => {
      const targetTabId = finalTabOrder[i - 1];
      if (targetTabId) setActiveProjectTab(targetTabId);
    }, { preventDefault: true }, [finalTabOrder, setActiveProjectTab]); // Add dependencies
  }

  useHotkeys(`${hotkeyPrefix}+tab`, (e) => {
    e.preventDefault();
    if (!activeTabId || finalTabOrder.length < 2) return; // Need at least 2 tabs to cycle
    const currentIndex = finalTabOrder.indexOf(activeTabId);
    if (currentIndex === -1) return; // Active tab not in order? Should not happen
    const nextIndex = (currentIndex + 1) % finalTabOrder.length;
    setActiveProjectTab(finalTabOrder[nextIndex]);
  }, { preventDefault: true }, [activeTabId, finalTabOrder, setActiveProjectTab]); // Add dependencies

  useHotkeys(`${hotkeyPrefix}+shift+tab`, (e) => {
    e.preventDefault();
    if (!activeTabId || finalTabOrder.length < 2) return;
    const currentIndex = finalTabOrder.indexOf(activeTabId);
    if (currentIndex === -1) return;
    const prevIndex = (currentIndex - 1 + finalTabOrder.length) % finalTabOrder.length;
    setActiveProjectTab(finalTabOrder[prevIndex]);
  }, { preventDefault: true }, [activeTabId, finalTabOrder, setActiveProjectTab]); // Add dependencies

  // --- Event Handlers ---
  const handleCreateTab = () => {
    // Pass required fields, ensure projectId is handled if needed
    createProjectTab({ projectId: projectId ?? '', selectedFiles: [] });
  };

  const handleRenameTab = (tabId: string, newName: string) => {
    updateProjectTab(tabId, { displayName: newName });
    setEditingTabName(null);
  };

  const handleDeleteTab = (tabId: string) => {
    // Consider what happens if the active tab is deleted
    // Maybe set the next/previous tab active, or the first one.
    // This logic might reside within the `deleteProjectTab` updater in Zustand.
    deleteProjectTab(tabId);
    // Close dialog if the deleted tab was being edited
    if (dialogEditingTab === tabId) {
      setDialogEditingTab(null);
      setDialogEditingName('');
    }
    // Close settings dialog if no tabs remain
    if (Object.keys(tabs ?? {}).length <= 1) { // Check length *before* potential state update
      setShowSettingsDialog(false);
    }
  };

  // Dialog Rename handlers
  const startDialogRename = (tabId: string) => {
    const currentName = tabs?.[tabId]?.displayName || `Tab ${tabId.substring(0, 4)}`; // Default name
    setDialogEditingTab(tabId);
    setDialogEditingName(currentName);
  };

  const saveDialogRename = () => {
    if (!dialogEditingTab || !tabs) return;
    // Only update if name changed
    if (tabs[dialogEditingTab]?.displayName !== dialogEditingName) {
      updateProjectTab(dialogEditingTab, { displayName: dialogEditingName });
    }
    setDialogEditingTab(null);
    setDialogEditingName('');
  };

  const cancelDialogRename = () => {
    setDialogEditingTab(null);
    setDialogEditingName('');
  };

  // --- Helper Functions ---
  function getTabStats(tabId: string): string {
    const tabData = tabs?.[tabId];
    if (!tabData) return "No data";
    const fileCount = tabData.selectedFiles?.length ?? 0;
    const promptCount = tabData.selectedPrompts?.length ?? 0;
    const userPromptLength = tabData.userPrompt?.length ?? 0;
    return `Files: ${fileCount} | Prompts: ${promptCount} | User Input: ${userPromptLength}`;
  }

  // --- Render Logic ---

  // Empty State
  if (!tabs || Object.keys(tabs).length === 0) {
    return (
      <div className={cn("flex flex-col gap-2 p-2", className)}> {/* Added padding */}
        <Button onClick={handleCreateTab}>
          <Plus className="mr-2 h-4 w-4" /> New Project Tab
        </Button>
        <div className="text-sm text-muted-foreground">No project tabs yet.</div>
      </div>
    );
  }

  // Tooltip Content
  const shortcutInfo = (
    <ul className="list-disc list-inside text-xs space-y-1">
      <li>Navigate between tabs:</li>
      <li className="ml-2">- Next tab: <ShortcutDisplay shortcut={['t', 'tab']} /></li>
      <li className="ml-2">- Previous tab: <ShortcutDisplay shortcut={['t', 'shift', 'tab']} /></li>
      <li className="ml-2">- Quick switch: <ShortcutDisplay shortcut={['t', '[1-9]']} /></li>
      <li>Double-click tab to rename.</li>
      <li>Drag tabs to reorder.</li>
    </ul>
  );

  const titleTooltipContent = (
    <div className="space-y-2 text-sm">
      <p>
        Project Tabs save your selections and input. Use them to manage different contexts within your project.
      </p>
      {shortcutInfo}
    </div>
  );

  // Main Render
  return (
    <>
      <Tabs
        value={activeTabId ?? ""} // Ensure value is always a string
        onValueChange={setActiveProjectTab}
        className={cn("flex flex-col justify-start rounded-none border-b", className)} // Added border-b from original ProjectTabsManager
      // activationMode="manual" // Consider adding if clicking shouldn't activate immediately while dragging
      >
        <TabsList className="h-auto bg-background justify-start rounded-none p-1"> {/* Adjusted padding/height */}
          {/* Title and Settings Button */}
          <div className="text-xs lg:text-sm px-2 font-semibold flex items-center gap-1 mr-2 whitespace-nowrap"> {/* Adjusted padding/gap */}
            Project Tabs
            <InfoTooltip >{titleTooltipContent}</InfoTooltip>
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6"
              onClick={() => setShowSettingsDialog(true)}
              title="Manage Tabs"
            >
              <Settings className="h-4 w-4" />
            </Button>
          </div>

          {/* Sortable Tabs Area */}
          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragEnd={handleDragEnd}
          >
            <SortableContext items={finalTabOrder} strategy={horizontalListSortingStrategy}>
              <div className="flex gap-1"> {/* Add gap for spacing */}
                {finalTabOrder.map((tabId, index) => {
                  const tabData = tabs[tabId];
                  if (!tabData) return null; // Skip if tab data somehow missing
                  const displayName = tabData.displayName || `Tab ${tabId.substring(0, 4)}`;

                  return (
                    <SortableTab
                      key={tabId}
                      tabId={tabId}
                      index={index}
                      displayName={displayName}
                      hasLink={false} // Pass specific prop if needed
                      isEditingInline={editingTabName?.id === tabId}
                      editingInlineName={editingTabName?.name ?? ''}
                      setEditingInlineName={(name) => setEditingTabName({ id: tabId, name })}
                      onSaveInlineRename={handleRenameTab}
                      onCancelInlineRename={() => setEditingTabName(null)}
                      isActive={activeTabId === tabId}
                      hotkeyPrefix={hotkeyPrefix}
                    />
                  );
                })}
              </div>
            </SortableContext>
          </DndContext>

          {/* Add New Tab Button */}
          <div className='ml-2'>
            <Button
              onClick={handleCreateTab}
              size="icon"
              className="w-6 h-6" // Consistent size
              variant="ghost" // Changed variant
              title={`New Project Tab (${hotkeyPrefix}+?)`} // Add tooltip hint if desired
            >
              <Plus className="h-4 w-4" /> {/* Use standard Plus */}
            </Button>
          </div>
        </TabsList>
      </Tabs>

      {/* Settings Dialog */}
      <Dialog open={showSettingsDialog} onOpenChange={setShowSettingsDialog}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Manage Project Tabs</DialogTitle>
          </DialogHeader>
          <div className="mt-4 space-y-2 max-h-[60vh] overflow-y-auto pr-2"> {/* Added max-height scroll */}
            {finalTabOrder.map((tabId) => {
              const tabData = tabs[tabId];
              if (!tabData) return null; // Skip if tab data missing
              const displayName = tabData.displayName || `Tab ${tabId.substring(0, 4)}`;
              const isEditing = dialogEditingTab === tabId;

              // Use the specific rendering logic directly here
              return (
                <div
                  key={tabId}
                  className="group flex items-center justify-between gap-3 px-2 py-1.5 rounded hover:bg-accent/10" // Adjusted padding/hover
                >
                  {/* Left Side: Name and Stats */}
                  <div className="flex flex-col flex-1 truncate min-w-0"> {/* Ensure truncation works */}
                    {isEditing ? (
                      <Input
                        value={dialogEditingName}
                        onChange={(e) => setDialogEditingName(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') saveDialogRename();
                          if (e.key === 'Escape') cancelDialogRename();
                        }}
                        onBlur={saveDialogRename} // Save on blur
                        className="h-7 text-sm" // Adjust size
                        autoFocus
                      />
                    ) : (
                      <span
                        className="truncate font-medium text-sm cursor-pointer" // Make clickable to edit
                        onClick={() => startDialogRename(tabId)}
                        title={displayName} // Show full name on hover
                      >
                        {displayName}
                      </span>
                    )}
                    <span className="text-xs text-muted-foreground truncate" title={getTabStats(tabId)}>
                      {getTabStats(tabId)}
                    </span>
                  </div>

                  {/* Right Side: Action Buttons */}
                  <div className="flex items-center gap-1 opacity-50 group-hover:opacity-100 transition-opacity">
                    {isEditing ? (
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6"
                        onClick={saveDialogRename}
                        title="Save Name"
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                    ) : (
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6"
                        onClick={() => startDialogRename(tabId)}
                        title="Rename Tab"
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                    )}

                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6 text-destructive hover:bg-destructive/10 hover:text-destructive" // Use theme color
                      onClick={() => handleDeleteTab(tabId)}
                      title="Delete Tab"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
          {finalTabOrder.length === 0 && (
            <p className="text-sm text-muted-foreground text-center mt-4">No tabs to manage.</p>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}

// Internal SortableTab Component (Simplified and adapted)
function SortableTab(props: {
  tabId: string;
  index: number;
  displayName: string;
  hasLink: boolean; // Keep if needed, otherwise remove
  isEditingInline: boolean;
  editingInlineName: string;
  setEditingInlineName: (name: string) => void;
  onSaveInlineRename: (tabId: string, newName: string) => void;
  onCancelInlineRename: () => void;
  isActive: boolean;
  hotkeyPrefix: string;
}) {
  const {
    tabId,
    index,
    displayName,
    hasLink,
    isEditingInline,
    editingInlineName,
    setEditingInlineName,
    onSaveInlineRename,
    onCancelInlineRename,
    isActive,
    hotkeyPrefix,
  } = props;

  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: tabId,
  });

  const style: React.CSSProperties = {
    transform: CSS.Translate.toString(transform),
    transition: transition || 'transform 250ms ease', // Ensure transition
    opacity: isDragging ? 0.4 : 1, // Make more obvious when dragging
    zIndex: isDragging ? 10 : 1, // Ensure dragging tab is on top
    cursor: isDragging ? 'grabbing' : 'grab', // Indicate draggable
  };

  const showShortcut = index < 9;
  const shortcutNumber = index + 1;

  const handleSave = () => {
    // Trim and save only if name is not empty and potentially changed
    const trimmedName = editingInlineName.trim();
    if (trimmedName && trimmedName !== displayName) {
      onSaveInlineRename(tabId, trimmedName);
    } else {
      onCancelInlineRename(); // Cancel if empty or unchanged
    }
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        "inline-flex group relative rounded-md", // Add rounding and relative for potential absolute elements later
        // Add focus-visible styles for keyboard navigation/dragging
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
      )}
      {...attributes} // Drag handles applied here
    >
      <TabsTrigger
        value={tabId}
        className={cn(
          'flex-1 flex items-center gap-1.5 px-2.5 py-1.5 h-full text-sm rounded-md', // Adjusted padding/sizing
          'data-[state=active]:bg-primary/10 data-[state=active]:text-primary data-[state=active]:shadow-inner', // Active state styles
          'hover:bg-accent/50', // Hover state
          isDragging ? 'shadow-lg' : '', // Style when dragging
        )}
        onDoubleClick={(e) => {
          e.preventDefault(); // Prevent potential text selection
          setEditingInlineName(displayName); // Start editing with current name
        }}
        // Apply listeners selectively if needed (e.g., only on a drag handle icon)
        // For now, the whole tab is draggable via {...listeners} on the outer div
        {...listeners} // Apply drag listeners here IF the outer div doesn't have them
        // title={`Project Tab: ${displayName}${showShortcut ? ` (Shortcut: ${hotkeyPrefix}+${shortcutNumber})` : ''}`}
        title={displayName} // Simpler title
      >
        {isEditingInline ? (
          <Input
            value={editingInlineName}
            onChange={(e) => setEditingInlineName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleSave();
              if (e.key === 'Escape') onCancelInlineRename();
            }}
            onBlur={handleSave} // Save when focus is lost
            className="h-6 w-28 text-sm" // Adjust size/styling
            autoFocus
            onClick={(e) => e.stopPropagation()} // Prevent trigger activation when clicking input
          />
        ) : (
          <>
            {showShortcut && (
              <Badge
                variant="outline"
                className={cn(
                  "px-1.5 text-xs font-mono",
                  isActive ? "border-primary/50 text-primary" : "text-muted-foreground"
                )}
              >
                {`${hotkeyPrefix}${shortcutNumber}`}
              </Badge>
            )}
            <span className="truncate max-w-[120px]">{displayName}</span> {/* Add truncation */}
            {hasLink && <LinkIcon className="h-3.5 w-3.5 text-muted-foreground flex-shrink-0" />}
          </>
        )}
      </TabsTrigger>
      {/* Optional: Add close button directly on tab ( uncomment if needed)
             <Button
                 variant="ghost"
                 size="icon"
                 className={cn(
                     "absolute top-1/2 right-1 -translate-y-1/2 h-5 w-5 rounded-full opacity-0 group-hover:opacity-100",
                     "hover:bg-muted/50",
                     isActive ? "opacity-100" : "" // Show on active tab too
                 )}
                 onClick={(e) => {
                     e.stopPropagation(); // Prevent tab activation
                     // Add delete handler here: onDeleteTab(tabId);
                 }}
                 title="Close Tab"
             >
                 <X className="h-3 w-3" />
             </Button>
            */}
    </div>
  );
}