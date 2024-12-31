import React, { useMemo, useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandList, CommandInput, CommandEmpty, CommandItem } from "@/components/ui/command";
import {
    Check,
    Edit2,
    Trash2,
    X,
    ChevronsLeft,
    ChevronsRight
} from "lucide-react";
import {
    useGetChats,
    useCreateChat,
    useDeleteChat,
    useUpdateChat,
    useGetModels,
} from '@/hooks/api/use-chat-ai-api';
import { APIProviders, Chat } from 'shared/index';
import { useGlobalStateContext } from '@/components/global-state-context';
import { useChatModelControl } from './hooks/use-chat-model-control';
import { useChatControl } from './hooks/use-chat-state';
import { cn } from '@/lib/utils';

type ChatSidebarProps = {
    modelControl: ReturnType<typeof useChatModelControl>;
    chatControl: ReturnType<typeof useChatControl>;
};

export function ChatSidebar({ modelControl, chatControl }: ChatSidebarProps) {
    const {
        activeChatTabState,
        updateActiveChatTab,
    } = useGlobalStateContext();

    // Local state for new chat creation
    const [newChatTitle, setNewChatTitle] = useState('');

    // For editing titles
    const [editingChatId, setEditingChatId] = useState<string | null>(null);
    const [editingTitle, setEditingTitle] = useState('');

    // Model combobox
    const [modelComboboxOpen, setModelComboboxOpen] = useState(false);

    // Collapsible sidebar
    const [isCollapsed, setIsCollapsed] = useState(false);

    // Draggable toggle button
    const [dragging, setDragging] = useState(false);
    const [mouseDownPos, setMouseDownPos] = useState({ x: 0, y: 0 });
    const [offset, setOffset] = useState({ x: 0, y: 0 });
    const [buttonPosition, setButtonPosition] = useState(() => {
        // Default to about middle-left of the screen:
        if (typeof window !== 'undefined') {
            return { x: 20, y: window.innerHeight / 2 };
        }
        // If server-side rendering, just pick a fallback:
        return { x: 20, y: 300 };
    });

    const DRAG_THRESHOLD = 5; // px distance to consider a movement a drag rather than a click

    const { data: chatsData, isLoading: isLoadingChats } = useGetChats();
    const createChatMutation = useCreateChat();
    const deleteChat = useDeleteChat();
    const updateChat = useUpdateChat();

    const { provider, setProvider, currentModel, setCurrentModel } = modelControl;
    const { data, isLoading: isLoadingModels } = useGetModels(provider);

    const unifiedModels = data?.data ?? [];
    const modelOptions = useMemo(() => {
        return unifiedModels.map((m) => ({
            id: m.id,
            displayName: m.name,
            description: m.description || '',
        }));
    }, [unifiedModels]);

    // Helpers
    const truncateText = (text: string, maxLength = 24) => {
        return text.length > maxLength ? `${text.slice(0, maxLength - 3)}...` : text;
    };

    const generateDefaultTitle = () => `Chat ${new Date().toLocaleTimeString()}`;

    // Handlers
    const handleCreateChat = async () => {
        const chatTitle = newChatTitle.trim() || generateDefaultTitle();
        try {
            const newChat = await createChatMutation.mutateAsync({ title: chatTitle });
            setNewChatTitle('');
            updateActiveChatTab({ activeChatId: newChat.id });
            return newChat;
        } catch (error) {
            console.error('Error creating chat:', error);
            return null;
        }
    };

    const handleDeleteChat = async (chatId: string) => {
        if (!window.confirm('Are you sure you want to delete this chat?')) return;
        try {
            await deleteChat.mutateAsync(chatId);
            if (activeChatTabState?.activeChatId === chatId) {
                updateActiveChatTab({ activeChatId: undefined });
            }
        } catch (error) {
            console.error('Error deleting chat:', error);
        }
    };

    const startEditingChat = (chat: Chat) => {
        setEditingChatId(chat.id);
        setEditingTitle(chat?.title ?? 'No Title');
    };

    const handleUpdateChat = async (chatId: string) => {
        try {
            await updateChat.mutateAsync({
                chatId,
                input: { title: editingTitle },
            });
            setEditingChatId(null);
        } catch (error) {
            console.error('Error updating chat:', error);
        }
    };

    const cancelEditing = () => {
        setEditingChatId(null);
        setEditingTitle('');
    };

    // Draggable Toggle Button: onMouseDown
    const handleMouseDown = (e: React.MouseEvent) => {
        // Record initial positions
        setDragging(true);
        setMouseDownPos({ x: e.clientX, y: e.clientY });
        setOffset({
            x: e.clientX - buttonPosition.x,
            y: e.clientY - buttonPosition.y,
        });
    };

    // Press Escape to close sidebar if open
    useEffect(() => {
        function handleKeyDown(e: KeyboardEvent) {
            if (e.key === 'Escape' && !isCollapsed) {
                setIsCollapsed(true);
            }
        }
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [isCollapsed]);

    // Draggable Toggle Button: Global event listeners
    useEffect(() => {
        const handleMouseMove = (e: MouseEvent) => {
            if (!dragging) return;
            setButtonPosition({
                x: e.clientX - offset.x,
                y: e.clientY - offset.y,
            });
        };

        const handleMouseUp = (e: MouseEvent) => {
            if (!dragging) return;
            setDragging(false);

            // Check if the user actually moved the button enough to be a drag,
            // or if it's basically a click
            const movedX = e.clientX - mouseDownPos.x;
            const movedY = e.clientY - mouseDownPos.y;
            const distance = Math.sqrt(movedX * movedX + movedY * movedY);

            if (distance < DRAG_THRESHOLD) {
                // It's effectively a click => toggle the sidebar
                setIsCollapsed((prev) => !prev);
            }
        };

        window.addEventListener('mousemove', handleMouseMove);
        window.addEventListener('mouseup', handleMouseUp);
        return () => {
            window.removeEventListener('mousemove', handleMouseMove);
            window.removeEventListener('mouseup', handleMouseUp);
        };
    }, [dragging, offset, mouseDownPos]);

    // Derived
    const chats = chatsData?.data ?? [];

    return (
        <>
            {/* Draggable Toggle Button */}
            <Button
                variant="secondary"
                onMouseDown={handleMouseDown}
                style={{
                    position: 'fixed',
                    left: buttonPosition.x,
                    top: buttonPosition.y,
                    transform: 'translateY(-50%)',
                    zIndex: 9999,
                    cursor: dragging ? 'grabbing' : 'grab',
                    padding: '0.5rem',
                    borderRadius: '50%',
                    width: '2.5rem',
                    height: '2.5rem',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    boxShadow: '0 2px 8px rgba(0, 0, 0, 0.15)',
                    transition: 'transform 0.2s, background-color 0.2s'
                }}
                className={cn(
                    "hover:bg-gray-100 dark:hover:bg-gray-800",
                    "active:scale-95",
                    "backdrop-blur-sm bg-opacity-80",
                    "hover:scale-105",
                    isCollapsed ? "bg-white dark:bg-gray-900" : "bg-gray-100 dark:bg-gray-800"
                )}
            >
                {isCollapsed ? (
                    <ChevronsRight className="h-4 w-4" />
                ) : (
                    <ChevronsLeft className="h-4 w-4" />
                )}
            </Button>

            {/* Sidebar container */}
            <div
                id="chat-sidebar"
                className={cn(
                    "fixed top-0 left-0 h-full border-r bg-white dark:bg-gray-900 shadow-md transition-transform duration-300 flex flex-col gap-4",
                    isCollapsed ? "-translate-x-full" : "translate-x-0"
                )}
                style={{ width: 300, zIndex: 1000 }}
            >
                {/* 
                  Close button inside the sidebar (top-right corner).
                  This is another explicit way for the user to close.
                */}
                {!isCollapsed && (
                    <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => setIsCollapsed(true)}
                        className="absolute top-2 right-2"
                    >
                        <X className="h-4 w-4" />
                    </Button>
                )}

                <div className="p-4 flex flex-col gap-4 overflow-y-auto h-full">
                    {/* New Chat Input */}
                    <div className="flex gap-2">
                        <Input
                            value={newChatTitle}
                            onChange={(e) => setNewChatTitle(e.target.value)}
                            placeholder="New chat..."
                            disabled={createChatMutation.isPending}
                        />
                        <Button
                            onClick={handleCreateChat}
                            disabled={createChatMutation.isPending}
                        >
                            +
                        </Button>
                    </div>

                    {/* Provider Selection */}
                    <div className="flex flex-col gap-2">
                        <label className="font-medium">Provider</label>
                        <Select
                            value={provider}
                            onValueChange={(val) => setProvider(val as APIProviders)}
                        >
                            <SelectTrigger>
                                <SelectValue placeholder="Select provider" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="openai">OpenAI</SelectItem>
                                <SelectItem value="openrouter">OpenRouter</SelectItem>
                                <SelectItem value="lmstudio">LM Studio</SelectItem>
                                <SelectItem value="ollama">Ollama</SelectItem>
                                <SelectItem value="xai">XAI</SelectItem>
                                <SelectItem value="gemini">Gemini</SelectItem>
                                <SelectItem value="anthropic">Anthropic</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>

                    {/* Model Selection */}
                    <div className="flex flex-col gap-2">
                        <label className="font-medium">Model</label>
                        <Popover
                            open={modelComboboxOpen}
                            onOpenChange={setModelComboboxOpen}
                        >
                            <PopoverTrigger asChild>
                                <Button
                                    variant="outline"
                                    className="w-full justify-between"
                                    disabled={isLoadingModels || modelOptions.length === 0}
                                >
                                    {isLoadingModels
                                        ? 'Loading models...'
                                        : modelOptions.length === 0
                                            ? 'No models available'
                                            : currentModel
                                                ? truncateText(
                                                    modelOptions.find((m) => m.id === currentModel)?.displayName ?? ''
                                                )
                                                : 'Select a model'}
                                </Button>
                            </PopoverTrigger>
                            <PopoverContent className="p-0 w-[300px]">
                                <Command>
                                    <CommandInput placeholder="Search models..." />
                                    <CommandList>
                                        <CommandEmpty>
                                            {isLoadingModels ? 'Loading models...' : 'No models available.'}
                                        </CommandEmpty>
                                        {modelOptions.map((model) => (
                                            <CommandItem
                                                key={model.id}
                                                onSelect={() => {
                                                    setCurrentModel(model.id);
                                                    setModelComboboxOpen(false);
                                                }}
                                                className="flex flex-col items-start"
                                            >
                                                <div className="font-medium">{model.displayName}</div>
                                                <div className="text-xs text-muted-foreground">
                                                    {model.description}
                                                </div>
                                            </CommandItem>
                                        ))}
                                    </CommandList>
                                </Command>
                            </PopoverContent>
                        </Popover>
                    </div>

                    {/* Chat List */}
                    <ScrollArea className="flex-1">
                        {isLoadingChats ? (
                            <div>Loading chats...</div>
                        ) : (
                            chats.map((chat) => {
                                const isActive = activeChatTabState?.activeChatId === chat.id;
                                return (
                                    <div
                                        key={chat.id}
                                        className={cn(
                                            "flex items-center justify-between p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-md group",
                                            {
                                                'bg-gray-100 dark:bg-gray-800': isActive,
                                            }
                                        )}
                                    >
                                        {editingChatId === chat.id ? (
                                            <div className="flex items-center gap-2 flex-1">
                                                <Input
                                                    value={editingTitle}
                                                    onChange={(e) => setEditingTitle(e.target.value)}
                                                    className="flex-1"
                                                    onKeyDown={(e) => {
                                                        if (e.key === 'Enter') handleUpdateChat(chat.id);
                                                        else if (e.key === 'Escape') cancelEditing();
                                                    }}
                                                />
                                                <Button
                                                    size="icon"
                                                    variant="ghost"
                                                    onClick={() => handleUpdateChat(chat.id)}
                                                >
                                                    <Check className="h-4 w-4" />
                                                </Button>
                                                <Button
                                                    size="icon"
                                                    variant="ghost"
                                                    onClick={cancelEditing}
                                                >
                                                    <X className="h-4 w-4" />
                                                </Button>
                                            </div>
                                        ) : (
                                            <>
                                                <button
                                                    className={cn(
                                                        "w-[120px] text-left truncate",
                                                        isActive ? "font-bold" : ""
                                                    )}
                                                    onClick={() => {
                                                        updateActiveChatTab({ activeChatId: chat.id });
                                                    }}
                                                    title={chat.title ?? 'No Title'}
                                                >
                                                    {chat.title}
                                                </button>
                                                <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                                    <Button
                                                        size="icon"
                                                        variant="ghost"
                                                        onClick={() => startEditingChat(chat)}
                                                    >
                                                        <Edit2 className="h-4 w-4" />
                                                    </Button>
                                                    <Button
                                                        size="icon"
                                                        variant="ghost"
                                                        onClick={() => handleDeleteChat(chat.id)}
                                                    >
                                                        <Trash2 className="h-4 w-4" />
                                                    </Button>
                                                </div>
                                            </>
                                        )}
                                    </div>
                                );
                            })
                        )}
                    </ScrollArea>
                </div>
            </div>
        </>
    );
}