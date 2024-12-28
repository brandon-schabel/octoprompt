import React, { useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandList, CommandInput, CommandEmpty, CommandItem } from "@/components/ui/command";
import { Check, Edit2, Trash2, X } from "lucide-react";
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
import clsx from 'clsx';
import { cn } from '@/lib/utils';

type ChatSidebarProps = {
    modelControl: ReturnType<typeof useChatModelControl>;
    chatControl: ReturnType<typeof useChatControl>;
};

export function ChatSidebar({ modelControl, chatControl }: ChatSidebarProps) {
    const {
        state,
        // If you still have multiple chat tabs, you can keep `setActiveChatTab`:
        // setActiveChatTab,
        activeChatTabState,
        updateActiveChatTab,
    } = useGlobalStateContext();

    // Local state for new chat creation
    const [newChatTitle, setNewChatTitle] = useState('');

    // For editing titles in the DB-based chat list (optional)
    const [editingChatId, setEditingChatId] = useState<string | null>(null);
    const [editingTitle, setEditingTitle] = useState('');

    const [modelComboboxOpen, setModelComboboxOpen] = useState(false);

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
    const truncateText = (text: string, maxLength: number = 24) => {
        return text.length > maxLength ? `${text.slice(0, maxLength - 3)}...` : text;
    };

    const generateDefaultTitle = () => `Chat ${new Date().toLocaleTimeString()}`;

    // Event handlers
    const handleCreateChat = async () => {
        const chatTitle = newChatTitle.trim() || generateDefaultTitle();
        try {
            const newChat = await createChatMutation.mutateAsync({ title: chatTitle });
            setNewChatTitle('');
            // If you want to set the new chat ID as the active chat in this tab:
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
            // If you just deleted the active chat, clear or pick another:
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
            await updateChat.mutateAsync({ chatId, input: { title: editingTitle } });
            setEditingChatId(null);
        } catch (error) {
            console.error('Error updating chat:', error);
        }
    };

    const cancelEditing = () => {
        setEditingChatId(null);
        setEditingTitle('');
    };

    // Derived
    const chats = chatsData?.data ?? [];

    return (
        <div className="lg:w-72 xl:w-96 p-4 flex flex-col gap-4 border-r">
            {/* New Chat Input */}
            <div className="flex gap-2 mb-4">
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
            <div className="flex flex-col gap-2 mb-4">
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
            <div className="flex flex-col gap-2 mb-4">
                <label className="font-medium">Model</label>
                <Popover open={modelComboboxOpen} onOpenChange={setModelComboboxOpen}>
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

            {/* List of DB Chats (optional) */}
            <ScrollArea className="flex-1">
                {isLoadingChats ? (
                    <div>Loading chats...</div>
                ) : (
                    chats.map((chat) => {
                        const isActive = activeChatTabState?.activeChatId === chat.id;
                        return (
                            <div
                                key={chat.id}
                                className={cn("flex items-center justify-between p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-md group", {
                                    'bg-gray-100 dark:bg-gray-800': isActive,
                                })}
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
                                            className={`w-[120px] text-left truncate ${isActive ? 'font-bold' : ''
                                                }`}
                                            onClick={() => {
                                                // Instead of using setActiveChatTab(chat.id),
                                                // update the current tab’s activeChatId
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
    );
}