import { useState, useEffect, useRef, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Check, Edit2, Icon, MessageSquareIcon, Trash2, X, PlusIcon } from "lucide-react";
import { tab as tabIcon } from '@lucide/lab';
import { Badge } from '@/components/ui/badge';
import {
    useGetChats,
    useDeleteChat,
    useUpdateChat,
    useCreateChat,
} from '@/hooks/api/use-chat-api';
import { Chat } from 'shared/index';
import { cn } from '@/lib/utils';
import { SlidingSidebar } from '../sliding-sidebar';
import { useUpdateActiveChatTab, useSetActiveChatTab } from '@/zustand/updaters';
import { useActiveChatTab, useAllChatTabs } from '@/zustand/selectors';
import { toast } from 'sonner';

export function ChatSidebar() {
    const updateActiveChatTab = useUpdateActiveChatTab();
    const setActiveChatTab = useSetActiveChatTab();
    const { tabData: activeChatTabState, id: activeChatTabId } = useActiveChatTab();
    const allChatTabs = useAllChatTabs();

    const [editingChatId, setEditingChatId] = useState<string | null>(null);
    const [editingTitle, setEditingTitle] = useState('');
    const [visibleCount, setVisibleCount] = useState(50);
    const scrollAreaRef = useRef<HTMLDivElement>(null);
    const activeChatRef = useRef<HTMLDivElement>(null);

    const { data: chatsData, isLoading: isLoadingChats } = useGetChats();
    const deleteChat = useDeleteChat();
    const updateChat = useUpdateChat();
    const createChat = useCreateChat();

    const sortedChats = useMemo(() => {
        const chats: Chat[] = chatsData ?? [];
        return [...chats].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    }, [chatsData]);

    const visibleChats = useMemo(() => {
        return sortedChats.slice(0, visibleCount);
    }, [sortedChats, visibleCount]);

    async function handleCreateNewChat() {
        const defaultTitle = `Chat ${new Date().toLocaleTimeString()}`;
        try {
            const newChat = await createChat.mutateAsync({
                title: defaultTitle,
                copyExisting: false,
            });
            updateActiveChatTab({ activeChatId: newChat.id });
            toast.success('New chat created');
        } catch (error) {
            console.error('Error creating chat:', error);
            toast.error('Failed to create chat');
        }
        setEditingTitle('');
    }

    async function handleDeleteChat(chatId: string) {
        if (!window.confirm('Are you sure you want to delete this chat?')) return;
        try {
            await deleteChat.mutateAsync(chatId);
            if (activeChatTabState?.activeChatId === chatId) {
                updateActiveChatTab({ activeChatId: undefined });
            }
        } catch (error) {
            console.error('Error deleting chat:', error);
        }
    }

    function startEditingChat(chat: Chat) {
        setEditingChatId(chat.id);
        setEditingTitle(chat.title ?? 'No Title');
    }

    async function handleUpdateChat(chatId: string) {
        try {
            await updateChat.mutateAsync({
                chatId,
                input: { title: editingTitle },
            });
            setEditingChatId(null);
        } catch (error) {
            console.error('Error updating chat:', error);
        }
    }

    function cancelEditing() {
        setEditingChatId(null);
        setEditingTitle('');
    }

    useEffect(() => {
        const viewport = scrollAreaRef.current?.querySelector(':scope > div[style*="overflow: scroll"]');
        if (activeChatRef.current && viewport) {
            activeChatRef.current.scrollIntoView({
                behavior: 'smooth',
                block: 'nearest',
            });
        }
    }, [activeChatTabState?.activeChatId, visibleChats]);

    console.log('chats', sortedChats);

    return (
        <SlidingSidebar
            width={340}
            icons={{
                openIcon: MessageSquareIcon
            }}
        >
            <div className="p-2 border-b mb-2">
                <Button
                    variant="outline"
                    className="w-full justify-start gap-2"
                    onClick={handleCreateNewChat}
                >
                    <PlusIcon className="h-4 w-4" /> New Chat
                </Button>
            </div>

            <ScrollArea className="flex-1 mt-2" ref={scrollAreaRef}>
                <div className="text-xl font-bold px-2 mb-2">
                    Chat History
                </div>
                {isLoadingChats ? (
                    <div>Loading chats...</div>
                ) : (
                    visibleChats.map((chat) => {
                        const isActive = activeChatTabState?.activeChatId === chat.id;

                        const chatTabEntries = Object.entries(allChatTabs).filter(
                            ([, tabData]) => tabData.activeChatId === chat.id
                        );
                        const sortedChatTabs = chatTabEntries.sort(
                            ([, aData], [, bData]) => (aData.sortOrder || 0) - (bData.sortOrder || 0)
                        );

                        return (
                            <div
                                key={chat.id}
                                ref={isActive ? activeChatRef : null}
                                className={cn(
                                    'flex items-center p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-md group',
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
                                        <div className="flex items-center gap-2 flex-1">
                                            <button
                                                className={cn(
                                                    'max-w-[180px] w-full text-left truncate',
                                                    isActive ? 'font-bold' : ''
                                                )}
                                                onClick={() => {
                                                    updateActiveChatTab({ activeChatId: chat.id });
                                                }}
                                                title={chat.title ?? 'No Title'}
                                            >
                                                {chat.title}
                                            </button>
                                            {sortedChatTabs.length > 0 && (
                                                <div className="flex gap-1">
                                                    {sortedChatTabs.map(([tabId]) => {
                                                        const indexOfTabData = Object.keys(allChatTabs).indexOf(tabId);
                                                        const tabNumber = indexOfTabData + 1;

                                                        return (
                                                            <Badge
                                                                key={tabId}
                                                                className="flex items-center gap-1 px-2 py-0.5 cursor-pointer hover:bg-accent"
                                                                onClick={(e) => {
                                                                    e.stopPropagation();
                                                                    setActiveChatTab(tabId);
                                                                }}
                                                            >
                                                                <Icon iconNode={tabIcon} className="w-3 h-3" />
                                                                <span className="text-xs">{tabNumber}</span>
                                                            </Badge>
                                                        )
                                                    })}
                                                </div>
                                            )}
                                        </div>
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
                {sortedChats.length > visibleCount && (
                    <div className="p-2 text-center">
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setVisibleCount(prev => prev + 50)}
                        >
                            Show More
                        </Button>
                    </div>
                )}
            </ScrollArea>
        </SlidingSidebar>
    );
}