import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { InfoTooltip } from '../info-tooltip'
import { LinkIcon, Plus, Pencil, Trash2, Settings, Icon } from 'lucide-react'
import { tabPlus } from '@lucide/lab'
import { useState, ReactNode } from 'react'
import { useHotkeys } from 'react-hotkeys-hook'
import { cn } from '@/lib/utils'
import {
    DndContext,
    DragEndEvent,
    PointerSensor,
    useSensor,
    useSensors,
    closestCenter,
} from '@dnd-kit/core'
import {
    arrayMove,
    SortableContext,
    useSortable,
    horizontalListSortingStrategy,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'

export type GenericTabManagerProps<T = any> = {
    /** A record keyed by tabId with a displayName, etc. */
    tabs: Record<string, T & {
        displayName?: string;
        linkedProjectTabId?: string;
    }> | null;

    /** The currently active tab ID */
    activeTabId: string | null;

    /** Called when the user wants to create a new tab */
    onCreateTab: () => void;

    /** Called when the user selects a tab */
    onSetActiveTab: (tabId: string) => void;

    /** Called when a tab is renamed */
    onRenameTab: (tabId: string, newName: string) => void;

    /** Called when a tab is deleted */
    onDeleteTab: (tabId: string) => void;

    /** Unique prefix for hotkeys so that project tabs & chat tabs don't clash (e.g. "t" or "c") */
    hotkeyPrefix: string;

    /** Button label for creating new tabs */
    newTabLabel?: string;

    /** Optional heading or placeholder for empty state */
    emptyMessage?: string;

    /** Whether the tab has a link to a project tab (true/false) */
    hasLink?: boolean;

    /** Optional className for custom styling */
    className?: string;

    /** Optional title to display before the tabs */
    title?: string;

    /** Optional tooltip message to display next to the title */
    titleTooltip?: ReactNode;

    /** The order in which to display the tabs. Falls back to `Object.keys(tabs)` if omitted. */
    tabOrder?: string[];

    /** Callback when the user drags/reorders tabs. */
    onTabOrderChange?: (newOrder: string[]) => void;

    /** Optional render function for custom dialog content */
    renderDialogContent?: (props: {
        tabId: string;
        isEditing: boolean;
        displayName: string;
        dialogEditingName: string;
        setDialogEditingName: (name: string) => void;
        startDialogRename: (tabId: string) => void;
        saveDialogRename: () => void;
        onDeleteTab: (tabId: string) => void;
    }) => ReactNode;
};

export function GenericTabManager<T = any>({
    tabs,
    activeTabId,
    onCreateTab,
    onSetActiveTab,
    onRenameTab,
    onDeleteTab,
    hotkeyPrefix,
    newTabLabel = 'New Tab',
    emptyMessage = 'No tabs yet.',
    className,
    title,
    titleTooltip,
    tabOrder,
    onTabOrderChange,
    renderDialogContent,
}: GenericTabManagerProps<T>) {
    const [editingTabName, setEditingTabName] = useState<{
        id: string;
        name: string;
    } | null>(null);

    const [localOrder, setLocalOrder] = useState<string[] | null>(null);

    // Settings dialog state
    const [showSettingsDialog, setShowSettingsDialog] = useState(false);
    const [dialogEditingTab, setDialogEditingTab] = useState<string | null>(null);
    const [dialogEditingName, setDialogEditingName] = useState('');

    // If parent doesn't provide a tabOrder, we just use the keys
    const fallbackOrder = tabs ? Object.keys(tabs) : [];
    const initialTabOrderProps = tabOrder && tabOrder.length > 0 ? tabOrder : fallbackOrder;
    const finalTabOrder = localOrder ?? initialTabOrderProps;

    const sensors = useSensors(useSensor(PointerSensor));

    function handleDragEnd(event: DragEndEvent) {
        const { active, over } = event;
        if (!over || active.id === over.id) return;

        const oldIndex = finalTabOrder.indexOf(active.id as string);
        const newIndex = finalTabOrder.indexOf(over.id as string);
        const newOrder = arrayMove(finalTabOrder, oldIndex, newIndex);

        console.debug('[GenericTabManager] handleDragEnd ->', newOrder);
        setLocalOrder(newOrder);
        onTabOrderChange?.(newOrder);
    }

    // Setup hotkeys for t+1..9 or c+1..9
    for (let i = 1; i <= 9; i++) {
        useHotkeys(`${hotkeyPrefix}+${i}`, () => {
            const targetTabId = finalTabOrder[i - 1];
            if (targetTabId) onSetActiveTab(targetTabId);
        });
    }

    // Setup next/prev hotkeys
    useHotkeys(`${hotkeyPrefix}+tab`, (e) => {
        e.preventDefault();
        if (!activeTabId || finalTabOrder.length === 0) return;

        const currentIndex = finalTabOrder.indexOf(activeTabId);
        const nextIndex = (currentIndex + 1) % finalTabOrder.length;
        onSetActiveTab(finalTabOrder[nextIndex]);
    });

    useHotkeys(`${hotkeyPrefix}+shift+tab`, (e) => {
        e.preventDefault();
        if (!activeTabId || finalTabOrder.length === 0) return;

        const currentIndex = finalTabOrder.indexOf(activeTabId);
        const prevIndex = (currentIndex - 1 + finalTabOrder.length) % finalTabOrder.length;
        onSetActiveTab(finalTabOrder[prevIndex]);
    });

    if (!tabs || Object.keys(tabs).length === 0) {
        return (
            <div className="flex flex-col gap-2">
                <Button onClick={onCreateTab}>{`+ ${newTabLabel}`}</Button>
                <div className="text-sm text-muted-foreground">{emptyMessage}</div>
            </div>
        );
    }

    const handleRenameTab = (tabId: string, newName: string) => {
        onRenameTab(tabId, newName);
        setEditingTabName(null);
    };

    // For the dialog-based rename
    const startDialogRename = (tabId: string) => {
        const currentName = tabs?.[tabId]?.displayName || tabId;
        setDialogEditingTab(tabId);
        setDialogEditingName(currentName);
    };
    const saveDialogRename = () => {
        if (!dialogEditingTab) return;
        onRenameTab(dialogEditingTab, dialogEditingName);
        setDialogEditingTab(null);
        setDialogEditingName('');
    };

    return (
        <>
            <Tabs
                value={activeTabId ?? ""}
                onValueChange={onSetActiveTab}
                className={cn("flex flex-col justify-start rounded-none", className)}
            >
                <TabsList className="bg-background justify-start rounded-none">
                    {title && (
                        <div className="text-xs lg:text-sm px-3 font-semibold flex items-center gap-2">
                            {title}
                            {titleTooltip && (
                                <InfoTooltip>
                                    <div className="space-y-2">
                                        <p>{titleTooltip}</p>
                                    </div>
                                </InfoTooltip>
                            )}
                            <Button
                                variant="ghost"
                                size="icon"
                                className="h-6 w-6"
                                onClick={() => setShowSettingsDialog(true)}
                            >
                                <Settings className="h-4 w-4" />
                            </Button>
                        </div>
                    )}

                    {/* SortableContext for the tabs */}
                    <DndContext
                        sensors={sensors}
                        collisionDetection={closestCenter}
                        onDragEnd={handleDragEnd}
                    >
                        <SortableContext items={finalTabOrder} strategy={horizontalListSortingStrategy}>
                            {finalTabOrder.map((tabId, index) => {
                                const displayName = tabs?.[tabId]?.displayName || tabId;
                                const hasLink = !!tabs?.[tabId]?.linkedProjectTabId;
                                return (
                                    <SortableTab
                                        key={tabId}
                                        tabId={tabId}
                                        index={index}
                                        displayName={displayName}
                                        hasLink={hasLink}
                                        editingTabName={editingTabName}
                                        setEditingTabName={setEditingTabName}
                                        handleRenameTab={handleRenameTab}
                                        onDeleteTab={onDeleteTab}
                                        activeTabId={activeTabId}
                                    />
                                );
                            })}
                        </SortableContext>
                    </DndContext>

                    {/* + button to create new tab */}
                    <div className='ml-2'>
                        <Button onClick={onCreateTab} size="icon" className="w-6 h-6 bg-accent/20" variant="link">
                            <Icon iconNode={tabPlus} />
                        </Button>
                    </div>
                </TabsList>
            </Tabs>

            {/* Dialog for managing tab rename/delete in bulk */}
            <Dialog open={showSettingsDialog} onOpenChange={setShowSettingsDialog}>
                <DialogContent className="sm:max-w-lg">
                    <DialogHeader>
                        <DialogTitle>Manage Tabs</DialogTitle>
                    </DialogHeader>
                    <div className="mt-2 space-y-3">
                        {finalTabOrder.map((tabId) => {
                            const displayName = tabs?.[tabId]?.displayName || tabId;
                            const isEditing = dialogEditingTab === tabId;

                            if (renderDialogContent) {
                                return renderDialogContent({
                                    tabId,
                                    isEditing,
                                    displayName,
                                    dialogEditingName,
                                    setDialogEditingName,
                                    startDialogRename,
                                    saveDialogRename,
                                    onDeleteTab,
                                });
                            }

                            return (
                                <div
                                    key={tabId}
                                    className="group flex items-center justify-between gap-3 px-2 py-1 rounded hover:bg-accent/20"
                                >
                                    <div className="flex flex-col truncate">
                                        {isEditing ? (
                                            <Input
                                                value={dialogEditingName}
                                                onChange={(e) => setDialogEditingName(e.target.value)}
                                                onKeyDown={(e) => {
                                                    if (e.key === 'Enter') saveDialogRename();
                                                    if (e.key === 'Escape') {
                                                        setDialogEditingTab(null);
                                                        setDialogEditingName('');
                                                    }
                                                }}
                                                autoFocus
                                            />
                                        ) : (
                                            <span className="truncate font-medium">
                                                {displayName}
                                            </span>
                                        )}
                                    </div>

                                    <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition">
                                        {isEditing ? (
                                            <Button
                                                variant="ghost"
                                                size="icon"
                                                className="h-6 w-6"
                                                onClick={saveDialogRename}
                                                title="Save"
                                            >
                                                <Pencil className="h-3 w-3" />
                                            </Button>
                                        ) : (
                                            <Button
                                                variant="ghost"
                                                size="icon"
                                                className="h-6 w-6"
                                                onClick={() => startDialogRename(tabId)}
                                                title="Rename"
                                            >
                                                <Pencil className="h-3 w-3" />
                                            </Button>
                                        )}

                                        <Button
                                            variant="ghost"
                                            size="icon"
                                            className="h-6 w-6 text-red-500 dark:text-red-400 hover:text-red-600 dark:hover:text-red-300"
                                            onClick={() => onDeleteTab(tabId)}
                                            title="Delete"
                                        >
                                            <Trash2 className="h-3 w-3" />
                                        </Button>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </DialogContent>
            </Dialog>
        </>
    );
}

/**
 * SortableTab is the draggable item that we wrap around each <TabsTrigger>
 */
function SortableTab(props: {
    tabId: string;
    index: number;
    displayName: string;
    hasLink: boolean;
    editingTabName: { id: string; name: string } | null;
    setEditingTabName: React.Dispatch<React.SetStateAction<{ id: string; name: string } | null>>;
    handleRenameTab: (tabId: string, newName: string) => void;
    onDeleteTab: (tabId: string) => void;
    activeTabId: string | null;
}) {
    const {
        tabId,
        index,
        displayName,
        hasLink,
        editingTabName,
        setEditingTabName,
        handleRenameTab,
    } = props;

    const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
        id: tabId,
    });

    const style: React.CSSProperties = {
        transform: CSS.Translate.toString(transform),
        transition,
        opacity: isDragging ? 0.5 : undefined,
    };

    const showShortcut = index < 9;
    const shortcutNumber = index + 1;

    return (
        <div
            ref={setNodeRef}
            style={style}
            {...attributes}
            {...listeners}
            className="inline-flex items-center group relative"
        >
            <TabsTrigger
                value={tabId}
                className={cn(
                    'flex items-center gap-2 px-2 data-[state=active]:bg-accent/20',
                    'data-[state=active]:text-accent-foreground'
                )}
                onDoubleClick={() => setEditingTabName({ id: tabId, name: displayName })}
            >
                {editingTabName?.id === tabId ? (
                    <Input
                        value={editingTabName.name}
                        onChange={(e) =>
                            setEditingTabName({ id: tabId, name: e.target.value })
                        }
                        onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                                handleRenameTab(tabId, editingTabName.name);
                            }
                            if (e.key === 'Escape') {
                                setEditingTabName(null);
                            }
                        }}
                        onBlur={() => handleRenameTab(tabId, editingTabName.name)}
                        className="h-6 w-24"
                        autoFocus
                    />
                ) : (
                    <div className="flex items-center gap-2">
                        {showShortcut && (
                            <Badge className="text-xs text-muted-foreground">
                                {shortcutNumber}
                            </Badge>
                        )}
                        <span>{displayName}</span>
                        {hasLink && <LinkIcon className="h-4 w-4" />}
                    </div>
                )}
            </TabsTrigger>
        </div>
    );
}