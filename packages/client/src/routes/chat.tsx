import { ChangeEvent, KeyboardEvent, ClipboardEvent, useEffect, useMemo, useRef, useState, useCallback } from 'react'
import React from 'react'
import { createFileRoute } from '@tanstack/react-router'
import { z } from 'zod'
import { persistListParams } from '@/lib/router/search-middleware'
import {
  MessageSquareIcon,
  PlusIcon,
  Check,
  X,
  Edit2,
  Trash2,
  Settings2Icon,
  Copy,
  GitFork,
  Trash,
  SendIcon,
  MessageSquareText
} from 'lucide-react'
import { toast } from 'sonner'
import { Message } from '@ai-sdk/react'

import { useAIChat } from '@/hooks/api/use-ai-chat'
import { useChatModelParams } from '@/hooks/chat/use-chat-model-params'
import { SlidingSidebar } from '@/components/sliding-sidebar'
import {
  useGetChats,
  useDeleteChat,
  useUpdateChat,
  useCreateChat,
  useDeleteMessage,
  useForkChatFromMessage
} from '@/hooks/api/use-chat-api'
import { Chat, ChatMessage, ChatMessageAttachment } from '@promptliano/schemas'
import { cn } from '@/lib/utils'
import {
  ScrollArea,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Textarea,
  Card,
  Button,
  Popover,
  PopoverTrigger,
  PopoverContent,
  Switch,
  Input,
  Label,
  Slider
} from '@promptliano/ui'
import { MarkdownRenderer } from '@promptliano/ui'
import { useCopyClipboard } from '@/hooks/utility-hooks/use-copy-clipboard'
import { APIProviders, AiSdkOptions } from '@promptliano/schemas'
import { useDebounceCallback } from '@/hooks/utility-hooks/use-debounce'
import { PROVIDER_SELECT_OPTIONS } from '@/constants/providers-constants'
import { useLocalStorage } from '@/hooks/utility-hooks/use-local-storage'
import { useActiveChatId, useSelectSetting, useProjectTabField, useAppSettings } from '@/hooks/use-kv-local-storage'
import { PromptlianoCombobox } from '@/components/promptliano/promptliano-combobox'
import { ErrorBoundary } from '@/components/error-boundary/error-boundary'
import { useGetModels } from '@/hooks/api/use-gen-ai-api'
import {
  ProviderModelSelector,
  ModelSettingsPopover as ReusableModelSettingsPopover
} from '@/components/model-selection'
import { AIErrorDisplay } from '@/components/errors'

export function ModelSettingsPopover() {
  const {
    settings,
    setTemperature,
    setMaxTokens,
    setTopP,
    setFreqPenalty,
    setPresPenalty,
    setProvider,
    setModel,
    isTempDisabled
  } = useChatModelParams()

  const handleSettingsChange = (newSettings: Partial<AiSdkOptions>) => {
    if (newSettings.temperature !== undefined) {
      setTemperature(newSettings.temperature)
    }
    if (newSettings.maxTokens !== undefined) {
      setMaxTokens(newSettings.maxTokens)
    }
    if (newSettings.topP !== undefined) {
      setTopP(newSettings.topP)
    }
    if (newSettings.frequencyPenalty !== undefined) {
      setFreqPenalty(newSettings.frequencyPenalty)
    }
    if (newSettings.presencePenalty !== undefined) {
      setPresPenalty(newSettings.presencePenalty)
    }
  }

  const handleProviderChange = (value: string) => {
    setProvider(value as APIProviders)
  }

  const handleModelChange = (value: string) => {
    setModel(value)
  }

  return (
    <ReusableModelSettingsPopover
      provider={(settings.provider ?? 'openrouter') as APIProviders}
      model={settings.model ?? 'gpt-4o'}
      settings={{
        temperature: settings.temperature ?? 0.7,
        maxTokens: settings.maxTokens ?? 100000,
        topP: settings.topP ?? 0.9,
        frequencyPenalty: settings.frequencyPenalty ?? 0,
        presencePenalty: settings.presencePenalty ?? 0
      }}
      onProviderChange={handleProviderChange}
      onModelChange={handleModelChange}
      onSettingsChange={handleSettingsChange}
      isTempDisabled={isTempDisabled}
    />
  )
}

// ProviderModelSector is now imported from the reusable components

type AdaptiveChatInputProps = {
  value: string
  onChange: (value: string) => void
  onSubmit?: () => void
  placeholder?: string
  className?: string
  title?: string
  disabled?: boolean
  preserveFormatting?: boolean
}

export function AdaptiveChatInput({
  value,
  onChange,
  onSubmit,
  placeholder,
  className = '',
  disabled = false,
  preserveFormatting = true
}: AdaptiveChatInputProps) {
  const [isMultiline, setIsMultiline] = useState(false)
  const lastSavedValueRef = useRef(value)

  // Save to localStorage only when value changes significantly (debounced)
  const saveToLocalStorage = useDebounceCallback((newValue: string) => {
    if (lastSavedValueRef.current !== newValue) {
      lastSavedValueRef.current = newValue
      localStorage.setItem('CHAT_INPUT_VALUE', JSON.stringify(newValue))
    }
  }, 500)

  // Load from localStorage only on mount
  useEffect(() => {
    try {
      const stored = localStorage.getItem('CHAT_INPUT_VALUE')
      if (stored && value === '') {
        const parsed = JSON.parse(stored)
        onChange(parsed)
      }
    } catch (e) {
      // Ignore parse errors
    }
  }, [])

  useEffect(() => {
    const shouldBeMultilineInitially = value?.includes('\n') || (value?.length ?? 0) > 100
    if (shouldBeMultilineInitially !== isMultiline) {
      setIsMultiline(shouldBeMultilineInitially)
    }
  }, [value, isMultiline])

  const handleInputChange = useCallback(
    (e: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
      const newValue = e.target.value
      onChange(newValue)
      saveToLocalStorage(newValue)
    },
    [onChange, saveToLocalStorage]
  )

  const handlePaste = useCallback(
    (e: ClipboardEvent<HTMLInputElement | HTMLTextAreaElement>) => {
      if (!preserveFormatting) return
      e.preventDefault()

      const pasteText = e.clipboardData?.getData('text/plain') ?? ''
      const target = e.target as HTMLTextAreaElement | HTMLInputElement
      let newValue = target.value
      const start = target.selectionStart ?? newValue?.length
      const end = target.selectionEnd ?? newValue?.length

      newValue = newValue.slice(0, start) + pasteText + newValue.slice(end)

      const html = e.clipboardData?.getData('text/html') ?? ''
      if (!html.includes('</code>')) {
        newValue = newValue
          .split('\n')
          .map((line) => line.trim())
          .join('\n')
          .replace(/\n{3,}/g, '\n\n')
      }

      onChange(newValue)

      requestAnimationFrame(() => {
        const cursorPos = start + pasteText.length
        target.setSelectionRange(cursorPos, cursorPos)
        target.focus()
      })
    },
    [preserveFormatting, onChange]
  )

  const triggerSubmit = useCallback(() => {
    onSubmit?.()
  }, [onSubmit])

  const handleKeyDown = useCallback(
    (e: KeyboardEvent<HTMLInputElement | HTMLTextAreaElement>) => {
      if (e.key === 'Enter' && !e.shiftKey && !isMultiline) {
        e.preventDefault()
        triggerSubmit()
      }
    },
    [isMultiline, triggerSubmit]
  )

  const baseProps = {
    value: value,
    onChange: handleInputChange,
    onKeyDown: handleKeyDown,
    onPaste: handlePaste,
    placeholder,
    disabled,
    spellCheck: false,
    className: cn('pl-10 font-mono w-full', className)
  }

  return (
    <div className='relative w-full' id='adaptive-chat-input'>
      {isMultiline ? (
        <Textarea
          {...baseProps}
          rows={1}
          style={{
            // @ts-ignore
            fieldSizing: 'content',
            overflowY: 'auto'
          }}
          className={cn(baseProps.className, 'min-h-[60px]', 'max-h-[250px]', 'pr-8', 'resize-none', 'bg-muted')}
        />
      ) : (
        <Input {...baseProps} className={cn(baseProps.className, 'overflow-hidden whitespace-nowrap')} />
      )}
    </div>
  )
}

function parseThinkBlock(content: string) {
  if (!content?.startsWith('<think>')) {
    return { hasThinkBlock: false, isThinking: false, thinkContent: '', mainContent: content ?? '' }
  }

  const endIndex = content.indexOf('</think>')
  if (endIndex === -1) {
    return { hasThinkBlock: true, isThinking: true, thinkContent: content.slice(7), mainContent: '' }
  }

  return {
    hasThinkBlock: true,
    isThinking: false,
    thinkContent: content.slice(7, endIndex).trim(),
    mainContent: content.slice(endIndex + 8).trimStart()
  }
}

// Extract MessageWrapper outside to prevent recreation on every render
const MessageWrapper: React.FC<{
  children: React.ReactNode
  isUser: boolean
  excluded: boolean
}> = ({ children, isUser, excluded }) => (
  <div
    className={cn('relative rounded-lg p-3 break-words', isUser ? 'bg-muted' : 'bg-muted/50', excluded && 'opacity-50')}
  >
    {children}
  </div>
)

// Extract MessageHeader outside to prevent recreation on every render
const MessageHeader: React.FC<{
  isUser: boolean
  msgId: string | number
  excluded: boolean
  rawView: boolean
  popoverOpen: boolean
  onPopoverChange: (open: boolean) => void
  onCopy: () => void
  onFork: () => void
  onDelete: () => void
  onToggleExclude: () => void
  onToggleRaw: () => void
}> = ({
  isUser,
  msgId,
  excluded,
  rawView,
  popoverOpen,
  onPopoverChange,
  onCopy,
  onFork,
  onDelete,
  onToggleExclude,
  onToggleRaw
}) => (
  <div className='flex items-center justify-between mb-2'>
    <div className='font-semibold text-sm'>{isUser ? 'You' : 'Assistant'}</div>
    <Popover open={popoverOpen} onOpenChange={onPopoverChange}>
      <PopoverTrigger asChild>
        <Button variant='ghost' size='sm' className='text-xs h-6 px-1.5 opacity-70 hover:opacity-100'>
          Options
        </Button>
      </PopoverTrigger>
      <PopoverContent align='end' side='bottom' className='w-auto p-2'>
        <div className='space-y-2'>
          <div className='flex items-center gap-1'>
            <Button variant='ghost' size='icon' className='h-6 w-6' onClick={onCopy} title='Copy message'>
              <Copy className='h-3 w-3' />
            </Button>
            <Button variant='ghost' size='icon' className='h-6 w-6' onClick={onFork} title='Fork from here'>
              <GitFork className='h-3 w-3' />
            </Button>
            <Button variant='ghost' size='icon' className='h-6 w-6' onClick={onDelete} title='Delete message'>
              <Trash className='h-3 w-3' />
            </Button>
          </div>
          <div className='flex items-center justify-between gap-2 border-t pt-2 text-xs text-muted-foreground'>
            <Label htmlFor={`exclude-${msgId}`} className='flex items-center gap-1 cursor-pointer'>
              <Switch
                id={`exclude-${msgId}`}
                checked={excluded}
                onCheckedChange={onToggleExclude}
                className='scale-75'
              />
              Exclude
            </Label>
            <Label htmlFor={`raw-${msgId}`} className='flex items-center gap-1 cursor-pointer'>
              <Switch id={`raw-${msgId}`} checked={rawView} onCheckedChange={onToggleRaw} className='scale-75' />
              Raw
            </Label>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  </div>
)

const ChatMessageItem = React.memo(
  (props: {
    msg: Message
    excluded: boolean
    rawView: boolean
    onCopyMessage: (content: string) => void
    onForkMessage: (messageId: number) => void
    onDeleteMessage: (messageId: number) => void
    onToggleExclude: (messageId: number) => void
    onToggleRawView: (messageId: number) => void
  }) => {
    const { msg, excluded, rawView, onCopyMessage, onForkMessage, onDeleteMessage, onToggleExclude, onToggleRawView } =
      props

    const { copyToClipboard } = useCopyClipboard()
    const [popoverOpen, setPopoverOpen] = useState(false)

    if (!msg.id) {
      console.warn('ChatMessageItem: Message missing ID', msg)
      return null
    }

    const isUser = msg.role === 'user'
    const { hasThinkBlock, isThinking, thinkContent, mainContent } = parseThinkBlock(msg.content)

    const messageId = useMemo(() => {
      const id = Number(msg.id)
      return isNaN(id) ? null : id
    }, [msg.id])

    const handleCopy = useCallback(
      () => onCopyMessage(mainContent || msg.content),
      [mainContent, msg.content, onCopyMessage]
    )
    const handleFork = useCallback(() => {
      if (messageId === null) {
        console.warn('Cannot fork: Invalid message ID', msg.id)
        toast.error('Cannot fork: Invalid message ID')
        return
      }
      onForkMessage(messageId)
    }, [messageId, onForkMessage, msg.id])
    const handleDelete = useCallback(() => {
      if (messageId === null) {
        console.warn('Cannot delete: Invalid message ID', msg.id)
        toast.error('Cannot delete: Invalid message ID')
        return
      }
      onDeleteMessage(messageId)
    }, [messageId, onDeleteMessage, msg.id])
    const handleToggleExclude = useCallback(() => {
      if (messageId === null) {
        console.warn('Cannot toggle exclude: Invalid message ID', msg.id)
        return
      }
      onToggleExclude(messageId)
    }, [messageId, onToggleExclude, msg.id])
    const handleToggleRaw = useCallback(() => {
      if (messageId === null) {
        console.warn('Cannot toggle raw view: Invalid message ID', msg.id)
        return
      }
      onToggleRawView(messageId)
    }, [messageId, onToggleRawView, msg.id])
    const handleCopyThinkText = useCallback(() => copyToClipboard(thinkContent), [copyToClipboard, thinkContent])

    if (rawView) {
      return (
        <MessageWrapper isUser={isUser} excluded={excluded}>
          <MessageHeader
            isUser={isUser}
            msgId={msg.id}
            excluded={excluded}
            rawView={rawView}
            popoverOpen={popoverOpen}
            onPopoverChange={setPopoverOpen}
            onCopy={handleCopy}
            onFork={handleFork}
            onDelete={handleDelete}
            onToggleExclude={handleToggleExclude}
            onToggleRaw={handleToggleRaw}
          />
          <pre className='whitespace-pre-wrap font-mono p-2 bg-background/50 rounded text-xs sm:text-sm overflow-x-auto'>
            {msg.content}
          </pre>
        </MessageWrapper>
      )
    }

    return (
      <MessageWrapper isUser={isUser} excluded={excluded}>
        <MessageHeader
          isUser={isUser}
          msgId={msg.id}
          excluded={excluded}
          rawView={rawView}
          popoverOpen={popoverOpen}
          onPopoverChange={setPopoverOpen}
          onCopy={handleCopy}
          onFork={handleFork}
          onDelete={handleDelete}
          onToggleExclude={handleToggleExclude}
          onToggleRaw={handleToggleRaw}
        />
        {hasThinkBlock ? (
          <div className='text-sm space-y-2'>
            {isThinking ? (
              <div className='p-2 bg-secondary/80 text-secondary-foreground rounded text-xs'>
                <div className='font-semibold mb-1'>Thinking...</div>
                <div className='animate-pulse opacity-80'>{thinkContent || '...'}</div>
              </div>
            ) : (
              <details className='bg-secondary/50 text-secondary-foreground rounded p-2 group'>
                <summary className='cursor-pointer text-xs font-semibold list-none group-open:mb-1'>
                  View Hidden Reasoning
                </summary>
                <div className='mt-1 text-xs whitespace-pre-wrap break-words font-mono bg-background/30 p-1.5 rounded'>
                  {thinkContent}
                </div>
                <Button variant='ghost' size='sm' onClick={handleCopyThinkText} className='mt-1.5 h-5 px-1 text-xs'>
                  <Copy className='h-3 w-3 mr-1' /> Copy Reasoning
                </Button>
              </details>
            )}
            <div className='overflow-x-auto'>
              <MarkdownRenderer content={mainContent} copyToClipboard={onCopyMessage} />
            </div>
          </div>
        ) : (
          <div className='overflow-x-auto'>
            <MarkdownRenderer content={msg.content} copyToClipboard={onCopyMessage} />
          </div>
        )}
      </MessageWrapper>
    )
  }
)
ChatMessageItem.displayName = 'ChatMessageItem'

interface ChatMessagesProps {
  chatId: number | null
  messages: Message[]
  isLoading: boolean
  excludedMessageIds?: number[]
  onToggleExclude: (messageId: number) => void
}

export function ChatMessages({
  chatId,
  messages,
  isLoading,
  excludedMessageIds = [],
  onToggleExclude
}: ChatMessagesProps) {
  const { copyToClipboard } = useCopyClipboard()
  const excludedSet = useMemo(() => new Set<number>(excludedMessageIds), [excludedMessageIds])
  const deleteMessageMutation = useDeleteMessage()
  const forkChatMutation = useForkChatFromMessage()
  const [rawMessageIds, setRawMessageIds] = useState<Set<number>>(new Set())
  const autoScrollEnabled = useSelectSetting('autoScrollEnabled')
  const bottomRef = useRef<HTMLDivElement>(null)
  const scrollAreaRef = useRef<HTMLDivElement>(null)
  const lastMessageCountRef = useRef(0)
  const scrollTimeoutRef = useRef<NodeJS.Timeout | null>(null)

  useEffect(() => {
    // Only scroll if messages have actually changed (new message added)
    if (autoScrollEnabled && bottomRef.current && messages.length !== lastMessageCountRef.current) {
      // Clear any pending scroll
      if (scrollTimeoutRef.current) {
        clearTimeout(scrollTimeoutRef.current)
      }

      // Debounce scrolling to prevent excessive calls during streaming
      scrollTimeoutRef.current = setTimeout(() => {
        const scrollViewport = scrollAreaRef.current?.querySelector(':scope > div[style*="overflow: scroll"]')
        if (scrollViewport) {
          const isScrolledUp =
            scrollViewport.scrollHeight - scrollViewport.scrollTop - scrollViewport.clientHeight > 150
          if (!isScrolledUp || messages.length <= 2) {
            bottomRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' })
          }
        } else {
          bottomRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' })
        }
      }, 100) // 100ms debounce

      lastMessageCountRef.current = messages.length
    }

    // Cleanup timeout on unmount
    return () => {
      if (scrollTimeoutRef.current) {
        clearTimeout(scrollTimeoutRef.current)
      }
    }
  }, [messages.length, autoScrollEnabled]) // Only depend on message count, not entire array

  const handleCopyMessage = useCallback(
    (content: string) => {
      copyToClipboard(content)
      toast.success('Message copied!')
    },
    [copyToClipboard]
  )

  const handleForkFromMessage = useCallback(
    async (messageId: number) => {
      if (!chatId) {
        toast.error('Cannot fork: Chat ID not available.')
        return
      }
      try {
        await forkChatMutation.mutateAsync({
          chatId,
          messageId,
          excludedMessageIds: Array.from(excludedSet)
        })
        toast.success('Chat forked successfully')
      } catch (error) {
        console.error('Error forking chat:', error)
        toast.error('Failed to fork chat')
      }
    },
    [chatId, forkChatMutation, excludedSet]
  )

  const handleDeleteMessage = useCallback(
    async (messageId: number) => {
      if (!window.confirm('Are you sure you want to delete this message?')) return
      try {
        await deleteMessageMutation.mutateAsync({ chatId: chatId ?? -1, messageId })
        toast.success('Message deleted successfully')
      } catch (error) {
        console.error('Error deleting message:', error)
        toast.error('Failed to delete message')
      }
    },
    [deleteMessageMutation]
  )

  const handleToggleRawView = useCallback((messageId: number) => {
    setRawMessageIds((prev) => {
      const newSet = new Set<number>(prev)
      if (newSet.has(messageId)) newSet.delete(messageId)
      else newSet.add(messageId)
      return newSet
    })
  }, [])

  const handleToggleExclude = useCallback(
    (messageId: number) => {
      onToggleExclude(messageId)
    },
    [onToggleExclude]
  )

  if (!chatId && !isLoading) {
    return (
      <div className='flex-1 flex items-center justify-center p-4'>
        <Card className='p-6 max-w-md text-center'>
          <MessageSquareIcon className='mx-auto h-12 w-12 text-muted-foreground mb-4' />
          <h3 className='text-lg font-semibold mb-2'>No Chat Selected</h3>
          <p className='text-muted-foreground text-sm'>
            Select a chat from the sidebar or create a new one to start messaging.
          </p>
        </Card>
      </div>
    )
  }

  if (isLoading && messages.length === 0) {
    return (
      <div className='flex-1 flex items-center justify-center p-4'>
        <p className='text-sm text-muted-foreground'>Loading messages...</p>
      </div>
    )
  }

  if (!isLoading && messages.length === 0) {
    return (
      <div className='flex-1 flex items-center justify-center p-4'>
        <Card className='p-6 max-w-md text-center'>
          <h3 className='text-lg font-semibold mb-2'>No messages yet</h3>
          <p className='text-muted-foreground text-sm'>Start the conversation by typing your message below.</p>
        </Card>
      </div>
    )
  }

  return (
    <ScrollArea className='flex-1 h-full' ref={scrollAreaRef}>
      <div className='space-y-4 p-4'>
        {messages.map((msg) => (
          <ChatMessageItem
            key={msg.id || `temp-${Math.random()}`}
            msg={msg}
            excluded={excludedSet.has(Number(msg.id))}
            rawView={rawMessageIds.has(Number(msg.id))}
            onCopyMessage={handleCopyMessage}
            onForkMessage={handleForkFromMessage}
            onDeleteMessage={handleDeleteMessage}
            onToggleExclude={handleToggleExclude}
            onToggleRawView={handleToggleRawView}
          />
        ))}
        <div ref={bottomRef} className='h-px' />
      </div>
    </ScrollArea>
  )
}

export function ChatSidebar({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) {
  const [activeChatId, setActiveChatId] = useActiveChatId()
  const [editingChatId, setEditingChatId] = useState<number | null>(null)
  const [editingTitle, setEditingTitle] = useState('')
  const [visibleCount, setVisibleCount] = useState(50)

  const scrollAreaRef = useRef<HTMLDivElement>(null)
  const activeChatRef = useRef<HTMLDivElement>(null)

  const { data: chatsData, isLoading: isLoadingChats } = useGetChats()
  const deleteChatMutation = useDeleteChat()
  const updateChatMutation = useUpdateChat()
  const createChatMutation = useCreateChat()

  const sortedChats = useMemo(() => {
    const chats: Chat[] = chatsData?.data ?? []
    return [...chats].sort((a, b) => new Date(b.created).getTime() - new Date(a.created).getTime())
  }, [chatsData])

  const visibleChats = useMemo(() => sortedChats.slice(0, visibleCount), [sortedChats, visibleCount])

  const handleCreateNewChat = useCallback(async () => {
    const defaultTitle = `New Chat ${new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`
    try {
      const newChat = await createChatMutation.mutateAsync({
        title: defaultTitle
      })
      const newChatId = newChat?.data.id
      if (newChatId) {
        setActiveChatId(newChatId)
        toast.success('New chat created')
        setEditingTitle('')
        setEditingChatId(null)
        onClose()
      } else {
        throw new Error('Created chat did not return an ID.')
      }
    } catch (error) {
      console.error('Error creating chat:', error)
      toast.error('Failed to create chat')
    }
  }, [createChatMutation, setActiveChatId, onClose])

  const handleDeleteChat = useCallback(
    async (chatId: number, e: React.MouseEvent) => {
      e.stopPropagation()
      if (!window.confirm('Are you sure you want to delete this chat?')) return
      try {
        await deleteChatMutation.mutateAsync(chatId)
        toast.success('Chat deleted')
        if (activeChatId === chatId) {
          setActiveChatId(null)
        }
        if (editingChatId === chatId) {
          setEditingChatId(null)
          setEditingTitle('')
        }
      } catch (error) {
        console.error('Error deleting chat:', error)
        toast.error('Failed to delete chat')
      }
    },
    [deleteChatMutation, activeChatId, setActiveChatId, editingChatId]
  )

  const startEditingChat = useCallback((chat: Chat, e: React.MouseEvent) => {
    e.stopPropagation()
    setEditingChatId(chat.id)
    setEditingTitle(chat.title ?? '')
  }, [])

  const handleUpdateChat = useCallback(
    async (chatId: number) => {
      if (!editingTitle.trim()) {
        toast.error('Chat title cannot be empty.')
        return
      }
      try {
        await updateChatMutation.mutateAsync({
          chatId,
          data: { title: editingTitle }
        })
        toast.success('Chat title updated')
        setEditingChatId(null)
      } catch (error) {
        console.error('Error updating chat:', error)
        toast.error('Failed to update chat title')
      }
    },
    [updateChatMutation, editingTitle]
  )

  const cancelEditing = useCallback((e?: React.MouseEvent) => {
    e?.stopPropagation()
    setEditingChatId(null)
    setEditingTitle('')
  }, [])

  const handleSelectChat = useCallback(
    (chatId: number) => {
      if (!editingChatId) {
        setActiveChatId(chatId)
        onClose()
      }
    },
    [setActiveChatId, editingChatId, onClose]
  )

  useEffect(() => {
    const viewport = scrollAreaRef.current?.querySelector(':scope > div[style*="overflow: scroll"]')
    if (activeChatRef.current && viewport && viewport.contains(activeChatRef.current)) {
      activeChatRef.current.scrollIntoView({
        behavior: 'smooth',
        block: 'nearest'
      })
    }
  }, [activeChatId, visibleChats])

  const handleKeyDownEdit = (e: React.KeyboardEvent<HTMLInputElement>, chatId: number) => {
    if (e.key === 'Enter') {
      handleUpdateChat(chatId)
    } else if (e.key === 'Escape') {
      cancelEditing()
    }
  }

  const handleLoadMore = useCallback(() => {
    setVisibleCount((prev) => prev + 50)
  }, [])

  return (
    <SlidingSidebar width={300} side='left' isOpen={isOpen} onClose={onClose}>
      {/* Sidebar content  */}
      <div className='p-2 border-b mb-2 flex flex-col gap-2'>
        <Button variant='outline' className='w-full justify-start gap-2' onClick={handleCreateNewChat}>
          <PlusIcon className='h-4 w-4' /> New Chat
        </Button>
        <div className='text-xs text-muted-foreground px-1'>Chat History ({sortedChats.length})</div>
      </div>

      <ScrollArea className='flex-1' ref={scrollAreaRef}>
        <div className='px-2 pb-2'>
          {isLoadingChats ? (
            <div className='p-4 text-center text-sm text-muted-foreground'>Loading chats...</div>
          ) : visibleChats.length === 0 ? (
            <div className='p-4 text-center text-sm text-muted-foreground'>No chats yet.</div>
          ) : (
            visibleChats.map((chat) => {
              const isActive = activeChatId === chat.id
              const isEditing = editingChatId === chat.id

              return (
                <div
                  key={chat.id}
                  ref={isActive ? activeChatRef : null}
                  onClick={() => handleSelectChat(chat.id)}
                  className={cn(
                    'flex items-center p-2 rounded-md group text-sm relative cursor-pointer',
                    'hover:bg-muted dark:hover:bg-muted/50',
                    isActive && 'bg-muted dark:bg-muted/50',
                    isEditing && 'bg-transparent hover:bg-transparent'
                  )}
                >
                  {isEditing ? (
                    <div className='flex items-center gap-1 flex-1'>
                      <Input
                        autoFocus
                        value={editingTitle}
                        onChange={(e) => setEditingTitle(e.target.value)}
                        className='h-7 text-sm flex-1'
                        onKeyDown={(e) => handleKeyDownEdit(e, chat.id)}
                        onClick={(e) => e.stopPropagation()}
                      />
                      <Button size='icon' variant='ghost' className='h-6 w-6' onClick={() => handleUpdateChat(chat.id)}>
                        <Check className='h-4 w-4' />
                      </Button>
                      <Button size='icon' variant='ghost' className='h-6 w-6' onClick={cancelEditing}>
                        <X className='h-4 w-4' />
                      </Button>
                    </div>
                  ) : (
                    <>
                      <span
                        className={cn('flex-1 truncate pr-16', isActive ? 'font-medium' : '')}
                        title={chat.title ?? 'Untitled Chat'}
                      >
                        {chat.title || <span className='italic text-muted-foreground'>Untitled Chat</span>}
                      </span>
                      <div className='absolute right-1 top-1/2 transform -translate-y-1/2 flex items-center gap-0.5 opacity-0 group-hover:opacity-100 focus-within:opacity-100 transition-opacity'>
                        <Button
                          size='icon'
                          variant='ghost'
                          className='h-6 w-6'
                          onClick={(e) => startEditingChat(chat, e)}
                          title='Rename'
                        >
                          <Edit2 className='h-4 w-4' />
                        </Button>
                        <Button
                          size='icon'
                          variant='ghost'
                          className='h-6 w-6 text-destructive/80 hover:text-destructive'
                          onClick={(e) => handleDeleteChat(chat.id, e)}
                          title='Delete'
                        >
                          <Trash2 className='h-4 w-4' />
                        </Button>
                      </div>
                    </>
                  )}
                </div>
              )
            })
          )}
          {sortedChats.length > visibleCount && (
            <div className='p-2 mt-2 text-center'>
              <Button variant='outline' size='sm' onClick={handleLoadMore}>
                Show More ({sortedChats.length - visibleCount} remaining)
              </Button>
            </div>
          )}
        </div>
      </ScrollArea>
    </SlidingSidebar>
  )
}

export function ChatHeader({ onToggleSidebar }: { onToggleSidebar: () => void }) {
  const [activeChatId] = useActiveChatId()
  const { data: chatsData } = useGetChats()

  const activeChat = useMemo(() => chatsData?.data?.find((c) => c.id === activeChatId), [chatsData, activeChatId])

  return (
    <div className='flex items-center justify-between gap-x-4 bg-background px-4 py-2 border-b h-14 w-full max-w-7xl xl:rounded-b xl:border-x'>
      {/* Left: Sidebar Toggle Button */}
      <div className='flex-shrink-0'>
        <Button
          variant='outline'
          size='icon'
          onClick={onToggleSidebar}
          className='h-8 w-8'
          aria-label='Toggle chat sidebar'
        >
          <MessageSquareText className='h-4 w-4' />
        </Button>
      </div>

      {/* Middle: Chat Title (takes up remaining space, centered text, truncated) */}
      <div className='flex-1 min-w-0 text-center'>
        {activeChatId ? (
          <span className='font-semibold text-lg truncate block' title={activeChat?.title || 'Loading...'}>
            {activeChat?.title || 'Loading Chat...'}
          </span>
        ) : (
          <span className='font-semibold text-lg text-muted-foreground'>No Chat Selected</span>
        )}
      </div>

      {/* Right: Model Settings or Placeholder */}
      <div className='flex-shrink-0 w-8'>
        {/* Ensure right side takes up same space as left button */}
        {activeChatId && <ModelSettingsPopover />}
      </div>
    </div>
  )
}

const chatSearchSchema = z.object({
  chatId: z.coerce.number().optional().catch(undefined),
  prefill: z.boolean().optional().default(false).catch(false),
  projectId: z.coerce.number().optional().catch(undefined)
})

export const Route = createFileRoute('/chat')({
  validateSearch: chatSearchSchema,
  component: ChatPage
})

function ChatPage() {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false)

  const [activeChatId] = useActiveChatId()
  const { settings: modelSettings, setModel } = useChatModelParams()
  const provider = modelSettings.provider ?? 'openrouter'
  const model = modelSettings.model
  const { data: modelsData } = useGetModels(provider as APIProviders)
  const [appSettings] = useAppSettings()
  const enableChatAutoNaming = appSettings?.enableChatAutoNaming ?? true
  const { copyToClipboard } = useCopyClipboard()
  const [excludedMessageIds, setExcludedMessageIds] = useState<number[]>([])

  const [initialChatContent, setInitialChatContent] = useLocalStorage<string | null>('initial-chat-content', null)

  useEffect(() => {
    if (activeChatId && !model && modelsData?.data?.[0]) {
      const newModelSelection = modelsData.data[0].id
      console.info('NO MODEL SET, SETTING DEFAULT MODEL', newModelSelection)
      setModel(newModelSelection)
    }
  }, [activeChatId, model, modelsData, setModel])

  const {
    messages,
    input,
    isLoading: isAiLoading,
    error,
    parsedError,
    clearError,
    setInput,
    sendMessage,
    reload
  } = useAIChat({
    // ai sdk uses strings for chatId
    chatId: activeChatId ?? -1,
    provider,
    model: model ?? '',
    systemMessage: 'You are a helpful assistant that can answer questions and help with tasks.',
    enableChatAutoNaming: !!enableChatAutoNaming
  })

  const selectedModelName = useMemo(() => {
    return modelsData?.data?.find((m: any) => m.id === model)?.name ?? model ?? '...'
  }, [modelsData, model])

  const handleToggleExclude = useCallback((messageId: number) => {
    setExcludedMessageIds((prev) =>
      prev.includes(messageId) ? prev.filter((id) => id !== messageId) : [...prev, messageId]
    )
  }, [])

  const handleChatInputChange = useCallback(
    (value: string) => {
      setInput(value)
    },
    [setInput]
  )

  const handleFormSubmit = useCallback(
    async (e: React.FormEvent<HTMLFormElement>) => {
      e.preventDefault()
      if (!input?.trim() || isAiLoading || !activeChatId) {
        return
      }
      try {
        // Clear any previous errors before sending
        clearError()
        await sendMessage(input, { ...modelSettings })
        // Input is cleared by the hook after successful send
      } catch (err) {
        console.error('Error sending message:', err)
        // Error is now handled by the useAIChat hook and displayed via parsedError
      }
    },
    [input, isAiLoading, sendMessage, modelSettings, activeChatId, clearError]
  )

  const hasActiveChat = !!activeChatId

  const toggleSidebar = useCallback(() => setIsSidebarOpen((prev) => !prev), [])

  useEffect(() => {
    if (
      activeChatId &&
      initialChatContent &&
      setInput &&
      (input === '' || input === null) &&
      messages.length === 0 &&
      !isAiLoading
    ) {
      setInput(initialChatContent)
      toast.success('Context loaded into input.')
      setInitialChatContent(null) // Clear from localStorage after setting input
    }
  }, [activeChatId, initialChatContent, messages.length, isAiLoading]) // Remove circular dependencies

  // Cleanup effect to ensure ref is reset if chat changes or content is cleared
  useEffect(() => {
    if (!activeChatId || !initialChatContent) {
      // If chat ID changes or there's no initial content, ensure we're ready for a new load
    }
  }, [activeChatId, initialChatContent])

  return (
    <div className='flex flex-col md:flex-row overflow-hidden h-full'>
      <ChatSidebar isOpen={isSidebarOpen} onClose={() => setIsSidebarOpen(false)} />

      <div className='flex-1 flex flex-col min-w-0 h-full items-center w-full'>
        <ChatHeader onToggleSidebar={toggleSidebar} />

        {hasActiveChat && model ? (
          <>
            <ScrollArea className='flex-1 w-full min-h-0 overflow-y-auto'>
              <div className='mx-auto w-full max-w-[72rem] px-4 pb-4'>
                <ChatMessages
                  chatId={activeChatId}
                  messages={messages ?? []}
                  isLoading={isAiLoading}
                  excludedMessageIds={excludedMessageIds}
                  onToggleExclude={handleToggleExclude}
                />
              </div>
            </ScrollArea>

            <form
              onSubmit={handleFormSubmit}
              className='border-t border-l border-r bg-background/80 backdrop-blur supports-[backdrop-filter]:bg-background/60 pb-[env(safe-area-inset-bottom)] max-w-[80rem] rounded-t-lg shadow-md w-full'
            >
              <div className='mx-auto w-full max-w-[72rem] px-4 pt-2 pb-1 text-xs text-muted-foreground text-center flex items-center justify-center gap-1'>
                Using: {provider} /
                <span className='inline-flex items-center gap-1'>
                  {selectedModelName}
                  {model && (
                    <Button
                      variant='ghost'
                      size='icon'
                      className='h-4 w-4 text-muted-foreground hover:text-foreground'
                      title={`Copy model ID: ${model}`}
                      onClick={() => copyToClipboard(model, { successMessage: 'Model ID copied!' })}
                    >
                      <Copy className='h-3 w-3' />
                    </Button>
                  )}
                </span>
              </div>
              <div className='mx-auto flex w-full max-w-[72rem] items-end gap-2 px-4 py-3'>
                <AdaptiveChatInput
                  value={input ?? ''}
                  onChange={handleChatInputChange}
                  placeholder='Type your message...'
                  preserveFormatting
                  className='flex-grow rounded-lg'
                />
                <Button
                  type='submit'
                  disabled={input?.trim() === ''}
                  size='icon'
                  className='self-end sm:h-10 sm:w-10 flex-shrink-0'
                  aria-label='Send message'
                >
                  {isAiLoading ? '...' : <SendIcon className='h-4 w-4' />}
                </Button>
              </div>
              {parsedError && (
                <div className='mx-auto mb-3 w-full max-w-[72rem] px-4'>
                  <AIErrorDisplay
                    error={parsedError}
                    onRetry={() => {
                      clearError()
                      reload()
                    }}
                    onDismiss={clearError}
                  />
                </div>
              )}
            </form>
          </>
        ) : (
          <div className='flex-1 flex items-center justify-center p-4 w-full'>
            <Card className='p-6 max-w-md text-center'>
              <MessageSquareIcon className='mx-auto h-12 w-12 text-muted-foreground mb-4' />
              <h2 className='text-xl font-semibold text-foreground mb-2'>
                {activeChatId ? 'Loading Chat...' : 'Welcome!'}
              </h2>
              <p className='text-sm text-muted-foreground mb-4'>
                {activeChatId
                  ? 'Loading model information and messages.'
                  : 'Select a chat from the sidebar or start a new conversation.'}
              </p>
              {activeChatId && !model && <p className='text-sm text-muted-foreground'>Initializing model...</p>}
              {!activeChatId && (
                <Button variant='outline' size='sm' onClick={toggleSidebar}>
                  <PlusIcon className='mr-2 h-4 w-4' /> Create or Select Chat
                </Button>
              )}
            </Card>
          </div>
        )}
      </div>
    </div>
  )
}
