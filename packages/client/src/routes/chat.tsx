import { ChangeEvent, KeyboardEvent, ClipboardEvent, useEffect, useMemo, useRef, useState, useCallback } from 'react';
import React from 'react';
import { createFileRoute } from '@tanstack/react-router';
import { MessageSquareIcon, PlusIcon, Check, X, Edit2, Trash2, Expand, Settings2Icon, Copy, GitFork, Trash } from 'lucide-react';
import { toast } from 'sonner';
import { Message } from "@ai-sdk/react";

import { useAIChat } from '@/hooks/use-ai-chat';
import { useChatModelParams } from '@/components/chat/hooks/use-chat-model-params';
import { useActiveChatId } from '@/hooks/api/use-state-api';
import { SlidingSidebar } from '@/components/sliding-sidebar';
import { useGetChats, useDeleteChat, useUpdateChat, useCreateChat, useGetModels, useDeleteMessage, useForkChatFromMessage } from '@/hooks/api/use-chat-api';
import { AiSdkOptions, Chat } from '@/hooks/generated';
import { cn } from '@/lib/utils';
import {
  Command, CommandEmpty, CommandInput, CommandItem, CommandList, Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, ScrollArea, Select, SelectContent, SelectItem, SelectTrigger, SelectValue, Textarea, Card,
  Button,
  Popover,
  PopoverTrigger,
  PopoverContent,
  Switch,
  Input,
  Label,
  Slider,
} from '@ui';
import { MarkdownRenderer } from "@/components/markdown-renderer";
import { useCopyClipboard } from "@/hooks/utility-hooks/use-copy-clipboard";
import { useSettings } from "@/hooks/api/global-state/selectors";
import { APIProviders } from 'shared/src/schemas/provider-key.schemas';
import { useChatModelControl } from '@/components/chat/hooks/use-chat-model-control';
import { useDebounceCallback } from '@/hooks/utility-hooks/use-debounce';
import { PROVIDER_SELECT_OPTIONS } from '@/constants/providers-constants';
import { useSynchronizedState } from '@/hooks/api/global-state/global-state-utility-hooks';

// --- Model Settings Popover ---

export function ModelSettingsPopover() {
  const [open, setOpen] = useState(false);
  const {
    settings,
    setTemperature,
    setMaxTokens,
    setTopP,
    setFreqPenalty,
    setPresPenalty,
    isTempDisabled,
  } = useChatModelParams();

  // Use synchronized state hooks for debounced updates
  const [temperature, updateTemperature] = useSynchronizedState(settings.temperature ?? 0.7, setTemperature, 300, isTempDisabled);
  const [maxTokens, updateMaxTokens] = useSynchronizedState(settings.maxTokens ?? 100000, setMaxTokens);
  const [topP, updateTopP] = useSynchronizedState(settings.topP ?? 0.9, setTopP);
  const [freqPenalty, updateFreqPenalty] = useSynchronizedState(settings.frequencyPenalty ?? 0, setFreqPenalty);
  const [presPenalty, updatePresPenalty] = useSynchronizedState(settings.presencePenalty ?? 0, setPresPenalty);

  // Using useCallback for handlers, although potentially overkill for simple updates
  const handleSliderChange = useCallback((updater: (val: number) => void) => (value: number[]) => {
    updater(value[0]);
  }, []);


  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="outline" size="icon" className="h-8 w-8">
          <Settings2Icon className="h-4 w-4" />
          <span className="sr-only">Model Settings</span>
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-80">
        <div className="space-y-4">
          <h4 className="font-medium leading-none mb-3">Model Settings</h4>
          {/* Temperature */}
          <div className="space-y-2">
            <Label htmlFor="temperature">Temperature: {temperature.toFixed(2)}</Label>
            <Slider id="temperature" disabled={isTempDisabled} min={0} max={2} step={0.01} value={[temperature]} onValueChange={handleSliderChange(updateTemperature)} />
          </div>
          {/* Max Tokens */}
          <div className="space-y-2">
            <Label htmlFor="max_tokens">Max Tokens: {maxTokens}</Label>
            <Slider id="max_tokens" min={256} max={4096} step={1} value={[maxTokens]} onValueChange={handleSliderChange(updateMaxTokens)} />
          </div>
          {/* Top P */}
          <div className="space-y-2">
            <Label htmlFor="top_p">Top P: {topP.toFixed(2)}</Label>
            <Slider id="top_p" min={0} max={1} step={0.01} value={[topP]} onValueChange={handleSliderChange(updateTopP)} />
          </div>
          {/* Frequency Penalty */}
          <div className="space-y-2">
            <Label htmlFor="frequency_penalty">Frequency Penalty: {freqPenalty.toFixed(2)}</Label>
            <Slider id="frequency_penalty" min={-2} max={2} step={0.01} value={[freqPenalty]} onValueChange={handleSliderChange(updateFreqPenalty)} />
          </div>
          {/* Presence Penalty */}
          <div className="space-y-2">
            <Label htmlFor="presence_penalty">Presence Penalty: {presPenalty.toFixed(2)}</Label>
            <Slider id="presence_penalty" min={-2} max={2} step={0.01} value={[presPenalty]} onValueChange={handleSliderChange(updatePresPenalty)} />
          </div>

        </div>
      </PopoverContent>
    </Popover>
  );
}

// --- Model Selector ---

type ModelSelectorProps = {
  provider: APIProviders; // Using generated type
  currentModel: string;
  onProviderChange: (provider: APIProviders) => void;
  onModelChange: (modelId: string) => void;
  className?: string;
};

export function ModelSelector({ provider, currentModel, onProviderChange, onModelChange, className }: ModelSelectorProps) {
  const [modelComboboxOpen, setModelComboboxOpen] = useState(false);
  const { data: modelsData, isLoading: isLoadingModels } = useGetModels(provider);

  const modelOptions = useMemo(() => (
    modelsData?.data.map((m) => ({
      id: m.id,
      displayName: m.name,
    })) ?? []
  ), [modelsData]);

  // Auto-select first model if needed
  useEffect(() => {
    const isCurrentModelValid = modelOptions.some(model => model.id === currentModel);
    if ((!currentModel || !isCurrentModelValid) && modelOptions.length > 0) {
      onModelChange(modelOptions[0].id);
    }
  }, [modelOptions, currentModel, onModelChange]);

  // Truncate helper (could be moved to a utils file if used elsewhere)
  const truncateText = (text: string, maxLength = 24): string => {
    return text.length > maxLength ? `${text.slice(0, maxLength - 3)}...` : text;
  };

  const selectedModelName = useMemo(() => {
    return modelOptions.find((m) => m.id === currentModel)?.displayName ?? '';
  }, [modelOptions, currentModel]);

  return (
    <div className={cn("flex gap-4", className)}>
      {/* Provider Selection */}
      <Select value={provider} onValueChange={(val) => onProviderChange(val as APIProviders)}>
        <SelectTrigger>
          <SelectValue placeholder="Select provider" />
        </SelectTrigger>
        <SelectContent>
          {PROVIDER_SELECT_OPTIONS.map((option) => (
            <SelectItem key={option.value} value={option.value}>
              {option.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {/* Model Selection */}
      <Popover open={modelComboboxOpen} onOpenChange={setModelComboboxOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            className="w-full justify-between min-w-[150px]" // Added min-width for consistency
            disabled={isLoadingModels || modelOptions.length === 0}
            aria-label="Select model"
          >
            {isLoadingModels
              ? 'Loading...'
              : modelOptions.length === 0
                ? 'No models'
                : selectedModelName
                  ? truncateText(selectedModelName)
                  : 'Select model'}
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
                  value={model.displayName} // Add value for better search/filtering
                  onSelect={() => {
                    onModelChange(model.id);
                    setModelComboboxOpen(false);
                  }}
                  className="flex flex-col items-start cursor-pointer"
                >
                  <span className="font-medium">{model.displayName}</span>
                </CommandItem>
              ))}
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
    </div>
  );
}


// --- Adaptive Chat Input ---

type AdaptiveChatInputProps = {
  value: string;
  onChange: (value: string) => void;
  onSubmit?: () => void;
  placeholder?: string;
  className?: string;
  title?: string; // Title for the expanded dialog
  disabled?: boolean;
  preserveFormatting?: boolean;
};

export function AdaptiveChatInput({
  value,
  onChange,
  onSubmit,
  placeholder,
  className = "",
  title = "Edit Message",
  disabled = false,
  preserveFormatting = true,
}: AdaptiveChatInputProps) {
  const [localValue, setLocalValue] = useState(value);
  const [isExpanded, setIsExpanded] = useState(false);
  const [expandedValue, setExpandedValue] = useState(value);
  const [isMultiline, setIsMultiline] = useState(false);

  const inputRef = useRef<HTMLInputElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const debouncedOnChange = useDebounceCallback(onChange, 200);

  // Sync local state when the `value` prop changes from parent
  useEffect(() => {
    if (value !== localValue) {
      setLocalValue(value);
      // console.log("[AdaptiveChatInput] Value changed from parent:", { value, localValue })
    }
  }, [value]); // Removed localValue from dependency array

  // Determine if input should be multiline
  useEffect(() => {
    const shouldBeMultiline = value?.includes('\n') || value?.length > 100;
    setIsMultiline(shouldBeMultiline);
  }, [value]);

  // Handler for input changes (updates local state and calls debounced parent onChange)
  const handleLocalChange = useCallback((e: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const newValue = e.target.value;
    setLocalValue(newValue);
    debouncedOnChange(newValue);
  }, [debouncedOnChange]);

  // Paste handler with formatting preservation
  const handlePaste = useCallback((e: ClipboardEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    if (!preserveFormatting) return;
    e.preventDefault();

    const pasteText = e.clipboardData?.getData("text/plain") ?? "";
    const target = e.target as HTMLTextAreaElement | HTMLInputElement;
    let newValue = target.value;
    const start = target.selectionStart ?? newValue?.length;
    const end = target.selectionEnd ?? newValue?.length;

    newValue = newValue.slice(0, start) + pasteText + newValue.slice(end);

    const html = e.clipboardData?.getData("text/html") ?? "";
    // Lightly trim newlines if not pasting code blocks
    if (!html.includes("```")) {
      newValue = newValue
        .split("\n")
        .map((line) => line.trim())
        .join("\n")
        .replace(/\n{3,}/g, "\n\n");
    }

    setLocalValue(newValue);
    onChange(newValue); // Update parent immediately on paste
    if (newValue.includes("\n")) setIsMultiline(true);

    requestAnimationFrame(() => {
      const cursorPos = start + pasteText.length;
      target.setSelectionRange(cursorPos, cursorPos);
      target.focus();
    });
  }, [preserveFormatting, onChange]);

  // Submit handler (reads value directly from ref)
  const triggerSubmit = useCallback(() => {
    const element = isMultiline ? textareaRef.current : inputRef.current;
    const finalValue = element?.value ?? localValue; // Use ref value if available

    // Ensure parent has the latest value before submitting
    if (finalValue !== value) {
      onChange(finalValue);
    }
    setLocalValue(finalValue); // Sync local state too
    onSubmit?.();
  }, [isMultiline, localValue, onChange, onSubmit, value]);


  // Keydown handler (Enter submits if not multiline and Shift is not pressed)
  const handleKeyDown = useCallback((e: KeyboardEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey && !isMultiline) {
      e.preventDefault();
      triggerSubmit();
    }
  }, [isMultiline, triggerSubmit]);

  // Expand/collapse handlers
  const openDialog = useCallback(() => {
    setExpandedValue(localValue); // Use current local value when opening
    setIsExpanded(true);
  }, [localValue]);

  const handleDialogClose = useCallback((open: boolean) => {
    if (!open && expandedValue !== localValue) {
      // If dialog closed and value changed, update parent
      setLocalValue(expandedValue);
      onChange(expandedValue);
    }
    setIsExpanded(open);
  }, [expandedValue, localValue, onChange]);

  const handleExpandedChange = useCallback((e: ChangeEvent<HTMLTextAreaElement>) => {
    setExpandedValue(e.target.value);
  }, []);

  // Base props for input/textarea
  const baseProps = {
    value: localValue,
    onChange: handleLocalChange,
    onKeyDown: handleKeyDown,
    onPaste: handlePaste,
    placeholder,
    disabled,
    spellCheck: false,
    className: cn("pl-10 font-mono w-full", className) // Ensure w-full and move base classes here
  };

  return (
    <div className="relative w-full" id="adaptive-chat-input">
      {isMultiline ? (
        <div className="relative">
          <Textarea
            {...baseProps}
            ref={textareaRef}
            className="pr-8 min-h-[60px] resize-y" // Allow vertical resize
          />
          <Button
            variant="ghost"
            size="icon"
            className="absolute right-1 top-1.5 h-6 w-6 text-muted-foreground hover:text-foreground" // Adjusted positioning and styling
            onClick={openDialog}
            disabled={disabled}
            aria-label="Expand editor"
            title="Expand editor"
          >
            <Expand className="h-4 w-4" />
          </Button>
        </div>
      ) : (
        <Input {...baseProps} ref={inputRef} />
      )}

      {/* Fullscreen Dialog for expanded view */}
      <Dialog open={isExpanded} onOpenChange={handleDialogClose}>
        <DialogContent className="max-w-[90vw] w-full h-[90vh] flex flex-col p-4 sm:p-6">
          <DialogHeader>
            <DialogTitle>{title}</DialogTitle>
          </DialogHeader>
          <div className="flex-1 min-h-0">
            <Textarea
              ref={textareaRef} // Can reuse ref, although interaction is mainly via state here
              value={expandedValue}
              onChange={handleExpandedChange}
              placeholder={placeholder}
              disabled={disabled}
              spellCheck={false}
              className="h-full w-full resize-none font-mono text-sm p-2 border rounded" // Simple styling for dialog textarea
            />
          </div>
          <DialogFooter className="mt-4">
            <Button variant="outline" onClick={() => handleDialogClose(false)}>
              Done
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}


// --- Think Block Parser ---

function parseThinkBlock(content: string) {
  if (!content?.startsWith("<think>")) { // Added nullish check for safety
    return { hasThinkBlock: false, isThinking: false, thinkContent: "", mainContent: content ?? "" };
  }

  const endIndex = content.indexOf("</think>");
  if (endIndex === -1) {
    // No closing tag -> still thinking
    return { hasThinkBlock: true, isThinking: true, thinkContent: content.slice(7), mainContent: "" }; // 7 is length of "<think>"
  }

  // Complete think block found
  return {
    hasThinkBlock: true,
    isThinking: false,
    thinkContent: content.slice(7, endIndex).trim(), // Trim think content
    mainContent: content.slice(endIndex + 8).trimStart(), // 8 is length of "</think>", trim start of main content
  };
}

// --- Chat Message Item ---

// Memoize ChatMessageItem to prevent re-renders if props haven't changed
const ChatMessageItem = React.memo((props: {
  msg: Message; // Using imported Message type
  excluded: boolean;
  rawView: boolean;
  onCopyMessage: (content: string) => void; // Pass content directly
  onForkMessage: (messageId: string) => void;
  onDeleteMessage: (messageId: string) => void;
  onToggleExclude: (messageId: string) => void;
  onToggleRawView: (messageId: string) => void;
}) => {
  const {
    msg, excluded, rawView, onCopyMessage, onForkMessage,
    onDeleteMessage, onToggleExclude, onToggleRawView,
  } = props;

  const { copyToClipboard } = useCopyClipboard(); // Use hook internally for think block copy

  if (!msg.id) {
    console.warn("ChatMessageItem: Message missing ID", msg);
    return null; // Don't render messages without an ID
  }

  const isUser = msg.role === "user";
  const { hasThinkBlock, isThinking, thinkContent, mainContent } = parseThinkBlock(msg.content);

  // Handlers specific to this message instance
  const handleCopy = useCallback(() => onCopyMessage(mainContent || msg.content), [mainContent, msg.content, onCopyMessage]);
  const handleFork = useCallback(() => onForkMessage(msg.id!), [msg.id, onForkMessage]);
  const handleDelete = useCallback(() => onDeleteMessage(msg.id!), [msg.id, onDeleteMessage]);
  const handleToggleExclude = useCallback(() => onToggleExclude(msg.id!), [msg.id, onToggleExclude]);
  const handleToggleRaw = useCallback(() => onToggleRawView(msg.id!), [msg.id, onToggleRawView]);
  const handleCopyThinkText = useCallback(() => copyToClipboard(thinkContent), [copyToClipboard, thinkContent]);


  const MessageWrapper: React.FC<{ children: React.ReactNode }> = ({ children }) => (
    <div className={cn("relative rounded-lg p-3", isUser ? "bg-muted" : "bg-muted/50", excluded && "opacity-50")}>
      {children}
    </div>
  );

  const MessageHeader: React.FC = () => (
    <div className="flex items-center justify-between mb-2">
      <div className="font-semibold text-sm">{isUser ? "You" : "Assistant"}</div>
      <Popover>
        <PopoverTrigger asChild>
          <Button variant="ghost" size="sm" className="text-xs h-6 px-1.5 opacity-70 hover:opacity-100">Options</Button>
        </PopoverTrigger>
        <PopoverContent align="end" side="bottom" className="w-auto p-2">
          <div className="space-y-2">
            <div className="flex items-center gap-1">
              <Button variant="ghost" size="icon" className="h-6 w-6" onClick={handleCopy} title="Copy message"><Copy className="h-3 w-3" /></Button>
              <Button variant="ghost" size="icon" className="h-6 w-6" onClick={handleFork} title="Fork from here"><GitFork className="h-3 w-3" /></Button>
              <Button variant="ghost" size="icon" className="h-6 w-6" onClick={handleDelete} title="Delete message"><Trash className="h-3 w-3" /></Button>
            </div>
            <div className="flex items-center justify-between gap-2 border-t pt-2 text-xs text-muted-foreground">
              <Label htmlFor={`exclude-${msg.id}`} className="flex items-center gap-1 cursor-pointer"><Switch id={`exclude-${msg.id}`} checked={excluded} onCheckedChange={handleToggleExclude} className="scale-75" /> Exclude</Label>
              <Label htmlFor={`raw-${msg.id}`} className="flex items-center gap-1 cursor-pointer"><Switch id={`raw-${msg.id}`} checked={rawView} onCheckedChange={handleToggleRaw} className="scale-75" /> Raw</Label>
            </div>
          </div>
        </PopoverContent>
      </Popover>
    </div>
  );

  if (rawView) {
    return (
      <MessageWrapper>
        <MessageHeader />
        <pre className="whitespace-pre-wrap  font-mono p-2 bg-background/50 rounded text-xs sm:text-sm">
          {msg.content}
        </pre>
      </MessageWrapper>
    );
  }

  return (
    <MessageWrapper>
      <MessageHeader />
      {hasThinkBlock ? (
        <div className="text-sm space-y-2">
          {isThinking ? (
            <div className="p-2 bg-secondary/80 text-secondary-foreground rounded text-xs">
              <div className="font-semibold mb-1">Thinking...</div>
              <div className="animate-pulse opacity-80">{thinkContent || "..."}</div>
            </div>
          ) : (
            <details className="bg-secondary/50 text-secondary-foreground rounded p-2 group">
              <summary className="cursor-pointer text-xs font-semibold list-none group-open:mb-1">
                View Hidden Reasoning
              </summary>
              <div className="mt-1 text-xs whitespace-pre-wrap break-words font-mono bg-background/30 p-1.5 rounded">
                {thinkContent}
              </div>
              <Button variant="ghost" size="sm" onClick={handleCopyThinkText} className="mt-1.5 h-5 px-1 text-xs">
                <Copy className="h-3 w-3 mr-1" /> Copy Reasoning
              </Button>
            </details>
          )}
          <MarkdownRenderer content={mainContent} copyToClipboard={onCopyMessage} />
        </div>
      ) : (
        <MarkdownRenderer content={msg.content} copyToClipboard={onCopyMessage} />
      )}
    </MessageWrapper>
  );
});
ChatMessageItem.displayName = 'ChatMessageItem'; // Add display name for React DevTools


// --- Chat Messages List ---

interface ChatMessagesProps {
  chatId: string | null;
  messages: Message[]; // Using imported Message type
  isLoading: boolean;
  excludedMessageIds?: string[]; // Optional prop
  onToggleExclude: (messageId: string) => void; // Needs to be passed down
  // Consider adding other mutation callbacks if needed directly here
}

export function ChatMessages({ chatId, messages, isLoading, excludedMessageIds = [], onToggleExclude }: ChatMessagesProps) {
  const { copyToClipboard } = useCopyClipboard();
  const excludedSet = useMemo(() => new Set(excludedMessageIds), [excludedMessageIds]);
  const deleteMessageMutation = useDeleteMessage();
  const forkChatMutation = useForkChatFromMessage();
  const [rawMessageIds, setRawMessageIds] = useState<Set<string>>(new Set());
  const { autoScrollEnabled = true } = useSettings();
  const bottomRef = useRef<HTMLDivElement>(null);
  const scrollAreaRef = useRef<HTMLDivElement>(null); // Ref for the ScrollArea viewport

  // Auto-scroll effect
  useEffect(() => {
    if (autoScrollEnabled && bottomRef.current) {
      // Check if user is scrolled up significantly
      const scrollViewport = scrollAreaRef.current?.querySelector(':scope > div[style*="overflow: scroll"]');
      if (scrollViewport) {
        const isScrolledUp = scrollViewport.scrollHeight - scrollViewport.scrollTop - scrollViewport.clientHeight > 150; // Threshold
        if (!isScrolledUp || messages.length <= 2) { // Scroll if near bottom or very few messages
          bottomRef.current.scrollIntoView({ behavior: "smooth", block: 'end' });
        }
      } else {
        bottomRef.current.scrollIntoView({ behavior: "smooth", block: 'end' });
      }
    }
  }, [messages, autoScrollEnabled]); // Rerun when messages change


  const handleCopyMessage = useCallback((content: string) => {
    copyToClipboard(content);
    toast.success("Message copied!");
  }, [copyToClipboard]);

  const handleForkFromMessage = useCallback(async (messageId: string) => {
    if (!chatId) {
      toast.error("Cannot fork: Chat ID not available.");
      return;
    }
    try {
      await forkChatMutation.mutateAsync({
        chatId,
        messageId,
        body: { excludedMessageIds: Array.from(excludedSet) }
      });
      toast.success("Chat forked successfully");
      // Optional: Navigate to the new chat or update UI state
    } catch (error) {
      console.error("Error forking chat:", error);
      toast.error("Failed to fork chat");
    }
  }, [chatId, forkChatMutation, excludedSet]);

  const handleDeleteMessage = useCallback(async (messageId: string) => {
    if (!window.confirm("Are you sure you want to delete this message?")) return;
    try {
      await deleteMessageMutation.mutateAsync(messageId);
      toast.success("Message deleted successfully");
    } catch (error) {
      console.error("Error deleting message:", error);
      toast.error("Failed to delete message");
    }
  }, [deleteMessageMutation]);

  const handleToggleRawView = useCallback((messageId: string) => {
    setRawMessageIds((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(messageId)) newSet.delete(messageId);
      else newSet.add(messageId);
      return newSet;
    });
  }, []);

  // Placeholder or actual implementation for exclude toggle passed from parent
  const handleToggleExclude = useCallback((messageId: string) => {
    onToggleExclude(messageId);
    // Example: Maybe show a toast or visual feedback
    // toast.info(`Message ${excludedSet.has(messageId) ? 'included' : 'excluded'}`);
  }, [onToggleExclude]); // Removed excludedSet dependency if parent handles the state change

  // --- Render Logic ---

  if (!chatId && !isLoading) { // Show "No Chat Selected" only if not loading and no ID
    return (
      <div className="flex-1 flex items-center justify-center p-4">
        <Card className="p-6 max-w-md text-center">
          <MessageSquareIcon className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
          <h3 className="text-lg font-semibold mb-2">No Chat Selected</h3>
          <p className="text-muted-foreground text-sm">
            Select a chat from the sidebar or create a new one to start messaging.
          </p>
        </Card>
      </div>
    );
  }

  if (isLoading && messages.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center p-4">
        <p className="text-sm text-muted-foreground">Loading messages...</p>
      </div>
    );
  }

  if (!isLoading && messages.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center p-4">
        <Card className="p-6 max-w-md text-center">
          <h3 className="text-lg font-semibold mb-2">No messages yet</h3>
          <p className="text-muted-foreground text-sm">
            Start the conversation by typing your message below.
          </p>
        </Card>
      </div>
    );
  }

  return (
    <ScrollArea className="flex-1 h-full" ref={scrollAreaRef}>
      <div className="space-y-4 p-4">
        {messages.map((msg) => (
          <ChatMessageItem
            key={msg.id || `temp-${Math.random()}`} // Use temp key if ID is missing transiently
            msg={msg}
            excluded={excludedSet.has(msg.id!)}
            rawView={rawMessageIds.has(msg.id!)}
            onCopyMessage={handleCopyMessage}
            onForkMessage={handleForkFromMessage}
            onDeleteMessage={handleDeleteMessage}
            onToggleExclude={handleToggleExclude}
            onToggleRawView={handleToggleRawView}
          />
        ))}
        <div ref={bottomRef} className="h-px" /> {/* Sentinel element for scrolling */}
      </div>
    </ScrollArea>
  );
}


// --- Chat Sidebar ---

export function ChatSidebar() {
  const [activeChatId, setActiveChatId] = useActiveChatId();
  const [editingChatId, setEditingChatId] = useState<string | null>(null);
  const [editingTitle, setEditingTitle] = useState('');
  const [visibleCount, setVisibleCount] = useState(50); // Initial visible count

  const scrollAreaRef = useRef<HTMLDivElement>(null);
  const activeChatRef = useRef<HTMLDivElement>(null);

  // API Hooks
  const { data: chatsData, isLoading: isLoadingChats } = useGetChats();
  const deleteChatMutation = useDeleteChat();
  const updateChatMutation = useUpdateChat();
  const createChatMutation = useCreateChat();

  // Memoized sorted chats
  const sortedChats = useMemo(() => {
    const chats: Chat[] = chatsData?.data ?? [];
    // Sort by createdAt descending
    return [...chats].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }, [chatsData]);

  const visibleChats = useMemo(() => sortedChats.slice(0, visibleCount), [sortedChats, visibleCount]);

  const handleCreateNewChat = useCallback(async () => {
    const defaultTitle = `New Chat ${new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
    try {
      const newChat = await createChatMutation.mutateAsync({
        title: defaultTitle,
        // copyExisting: false, // Assuming this is default or handled by API
      });
      // Ensure newChat has an ID (adjust based on actual return type)
      const newChatId = (newChat as Chat)?.id; // Type assertion might be needed
      if (newChatId) {
        setActiveChatId(newChatId);
        toast.success('New chat created');
        setEditingTitle(''); // Clear any lingering edit title
        setEditingChatId(null); // Ensure not in editing mode
      } else {
        throw new Error("Created chat did not return an ID.");
      }
    } catch (error) {
      console.error('Error creating chat:', error);
      toast.error('Failed to create chat');
    }
  }, [createChatMutation, setActiveChatId]);

  const handleDeleteChat = useCallback(async (chatId: string, e: React.MouseEvent) => {
    e.stopPropagation(); // Prevent click from selecting the chat
    if (!window.confirm('Are you sure you want to delete this chat?')) return;
    try {
      await deleteChatMutation.mutateAsync(chatId);
      toast.success("Chat deleted");
      if (activeChatId === chatId) {
        setActiveChatId(null); // Clear active chat if it was deleted
      }
      if (editingChatId === chatId) { // Cancel edit if deleted chat was being edited
        setEditingChatId(null);
        setEditingTitle('');
      }
    } catch (error) {
      console.error('Error deleting chat:', error);
      toast.error("Failed to delete chat");
    }
  }, [deleteChatMutation, activeChatId, setActiveChatId, editingChatId]);

  const startEditingChat = useCallback((chat: Chat, e: React.MouseEvent) => {
    e.stopPropagation(); // Prevent click from selecting the chat
    setEditingChatId(chat.id);
    setEditingTitle(chat.title ?? ''); // Use empty string if title is null/undefined
  }, []);

  const handleUpdateChat = useCallback(async (chatId: string) => {
    if (!editingTitle.trim()) {
      toast.error("Chat title cannot be empty.");
      return; // Prevent saving empty title
    }
    try {
      await updateChatMutation.mutateAsync({
        chatId,
        data: { title: editingTitle },
      });
      toast.success("Chat title updated");
      setEditingChatId(null);
    } catch (error) {
      console.error('Error updating chat:', error);
      toast.error("Failed to update chat title");
    }
  }, [updateChatMutation, editingTitle]);

  const cancelEditing = useCallback((e?: React.MouseEvent) => {
    e?.stopPropagation();
    setEditingChatId(null);
    setEditingTitle('');
  }, []);

  // Scroll active chat into view
  useEffect(() => {
    const viewport = scrollAreaRef.current?.querySelector(':scope > div[style*="overflow: scroll"]');
    if (activeChatRef.current && viewport && viewport.contains(activeChatRef.current)) {
      // Check if the active item is actually within the scroll viewport before scrolling
      activeChatRef.current.scrollIntoView({
        behavior: 'smooth',
        block: 'nearest',
      });
    }
  }, [activeChatId, visibleChats]); // Rerun when active chat or visible list changes

  const handleKeyDownEdit = (e: React.KeyboardEvent<HTMLInputElement>, chatId: string) => {
    if (e.key === 'Enter') {
      handleUpdateChat(chatId);
    } else if (e.key === 'Escape') {
      cancelEditing();
    }
  };

  const handleLoadMore = useCallback(() => {
    setVisibleCount(prev => prev + 50);
  }, []);

  return (
    <SlidingSidebar width={300} icons={{ openIcon: MessageSquareIcon }}>
      <div className="p-2 border-b mb-2 flex flex-col gap-2">
        <Button variant="outline" className="w-full justify-start gap-2" onClick={handleCreateNewChat}>
          <PlusIcon className="h-4 w-4" /> New Chat
        </Button>
        <div className="text-xs text-muted-foreground px-1">Chat History ({sortedChats.length})</div>
      </div>

      <ScrollArea className="flex-1" ref={scrollAreaRef}>
        <div className="px-2 pb-2">
          {isLoadingChats ? (
            <div className="p-4 text-center text-sm text-muted-foreground">Loading chats...</div>
          ) : visibleChats.length === 0 ? (
            <div className="p-4 text-center text-sm text-muted-foreground">No chats yet.</div>
          ) : (
            visibleChats.map((chat) => {
              const isActive = activeChatId === chat.id;
              const isEditing = editingChatId === chat.id;

              return (
                <div
                  key={chat.id}
                  ref={isActive ? activeChatRef : null}
                  onClick={() => !isEditing && setActiveChatId(chat.id)} // Select only if not editing
                  className={cn(
                    'flex items-center p-2 rounded-md group text-sm relative cursor-pointer',
                    'hover:bg-muted dark:hover:bg-muted/50',
                    isActive && 'bg-muted dark:bg-muted/50',
                    isEditing && 'bg-transparent hover:bg-transparent' // Don't highlight background when editing
                  )}
                >
                  {isEditing ? (
                    <div className="flex items-center gap-1 flex-1">
                      <Input
                        autoFocus
                        value={editingTitle}
                        onChange={(e) => setEditingTitle(e.target.value)}
                        className="h-7 text-sm flex-1"
                        onKeyDown={(e) => handleKeyDownEdit(e, chat.id)}
                        onClick={(e) => e.stopPropagation()} // Prevent click through
                      />
                      <Button size="icon" variant="ghost" className="h-6 w-6" onClick={() => handleUpdateChat(chat.id)}><Check className="h-4 w-4" /></Button>
                      <Button size="icon" variant="ghost" className="h-6 w-6" onClick={cancelEditing}><X className="h-4 w-4" /></Button>
                    </div>
                  ) : (
                    <>
                      <span className={cn('flex-1 truncate pr-16', isActive ? 'font-medium' : '')} title={chat.title ?? 'Untitled Chat'}>
                        {chat.title || <span className="italic text-muted-foreground">Untitled Chat</span>}
                      </span>
                      <div className="absolute right-1 top-1/2 transform -translate-y-1/2 flex items-center gap-0.5 opacity-0 group-hover:opacity-100 focus-within:opacity-100 transition-opacity">
                        <Button size="icon" variant="ghost" className="h-6 w-6" onClick={(e) => startEditingChat(chat, e)} title="Rename"><Edit2 className="h-4 w-4" /></Button>
                        <Button size="icon" variant="ghost" className="h-6 w-6 text-destructive/80 hover:text-destructive" onClick={(e) => handleDeleteChat(chat.id, e)} title="Delete"><Trash2 className="h-4 w-4" /></Button>
                      </div>
                    </>
                  )}
                </div>
              );
            })
          )}
          {sortedChats.length > visibleCount && (
            <div className="p-2 mt-2 text-center">
              <Button variant="outline" size="sm" onClick={handleLoadMore}>
                Show More ({sortedChats.length - visibleCount} remaining)
              </Button>
            </div>
          )}
        </div>
      </ScrollArea>
    </SlidingSidebar>
  );
}


// --- Chat Header ---

export function ChatHeader() {
  const [activeChatId] = useActiveChatId();
  const { data: chatsData } = useGetChats(); // Use data, not the whole object unless needed

  // Memoize finding the active chat data
  const activeChat = useMemo(() =>
    chatsData?.data?.find((c) => c.id === activeChatId),
    [chatsData, activeChatId]
  );

  const { provider, setProvider, currentModel, setCurrentModel } = useChatModelControl();

  // Render nothing if no chat is active (or still loading)
  if (!activeChatId) {
    return null; // Or a placeholder/loading state if preferred
  }

  return (
    <div className="flex flex-wrap justify-between items-center gap-y-2 gap-x-4 bg-background px-4 py-2 border-b">
      {/* Left side: Chat Title */}
      <div className="flex-1 min-w-0">
        <span className="font-semibold text-lg truncate" title={activeChat?.title || 'Loading...'}>
          {activeChat?.title || "Loading Chat..."}
        </span>
      </div>

      {/* Right side: Model Controls */}
      <div className="flex items-center gap-2 flex-shrink-0">
        <ModelSelector
          // No className needed if layout handled by parent flex
          provider={provider as APIProviders} // Assert type if hook doesn't guarantee it
          currentModel={currentModel}
          onProviderChange={setProvider}
          onModelChange={setCurrentModel}
        />
        <ModelSettingsPopover />
      </div>
    </div>
  );
}


// --- Chat Page (Route Component) ---

// Define Search Schema for type safety with router search params
// interface ChatSearch { prefill?: boolean } // Example, adjust if needed

export const Route = createFileRoute("/chat")({
  component: ChatPage,
  // validateSearch: (search: Record<string, unknown>): ChatSearch => ({ // Example validation
  //   prefill: Boolean(search.prefill),
  // })
});

function ChatPage() {
  const [activeChatId, setActiveChatId] = useActiveChatId();
  const { settings: modelSettings } = useChatModelParams(); // Get the latest model settings
  // Provide default values directly if settings might be undefined initially
  const provider = modelSettings.provider ?? 'openrouter';
  // --- IMPORTANT: Get model from modelSettings, not a hardcoded default ---
  const model = modelSettings.model; // Use the model selected via useChatModelParams/useChatModelControl

  const {
    messages,
    input,
    handleInputChange: sdkHandleInputChange,
    // handleSubmit: sdkHandleSubmit, // We won't use the hook's default submit directly for form submission
    isLoading: isAiLoading,
    error,
    setInput,
    sendMessage,
    // reload,
    // stop,
  } = useAIChat({
    chatId: activeChatId || '', // Pass empty string if no active chat ID to satisfy type, though hook might handle null better
    // Pass the *current* provider and model from settings
    provider,
    model: model ?? '', // Pass empty string if model is not yet set
    // Pass other relevant settings that might be needed for initialization or context
    systemMessage: 'You are a helpful assistant that can answer questions and help with tasks.',
    // Note: The main model parameters (temp, top_p etc.) are passed *per message* via sendMessage
  });

  // State for excluded messages (remains the same)
  const [excludedMessageIds, setExcludedMessageIds] = useState<string[]>([]);
  const handleToggleExclude = useCallback((messageId: string) => {
    setExcludedMessageIds(prev =>
      prev.includes(messageId)
        ? prev.filter(id => id !== messageId)
        : [...prev, messageId]
    );
  }, []);

  // --- This function correctly updates the input state via the hook's setInput ---
  const handleChatInputChange = useCallback((value: string) => {
    // The useAIChat hook expects a ChangeEvent, but we only have the value.
    // We can directly use the `setInput` function returned by useAIChat.
    setInput(value);
    // sdkHandleInputChange might still be useful if it does more than just setInput,
    // but often setInput is sufficient. If sdkHandleInputChange is needed:
    // if (sdkHandleInputChange) {
    //   const event = { target: { value } } as ChangeEvent<HTMLInputElement>;
    //   sdkHandleInputChange(event);
    // }
  }, [setInput]); // Dependency is setInput

  // --- UPDATE: Modify handleFormSubmit to use sendMessage with modelSettings ---
  const handleFormSubmit = useCallback((e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!input?.trim() || isAiLoading) {
      console.log("Submission prevented: Input empty or AI loading", { input, isAiLoading });
      return;
    }

    // Call the sendMessage function from useAIChat, passing the current input
    // AND the current modelSettings object.
    sendMessage(input, modelSettings);

    // No need to call sdkHandleSubmit directly anymore for this form.
    // setInput('') is handled within sendMessage now.

  }, [input, isAiLoading, sendMessage, modelSettings]); // <-- Add sendMessage and modelSettings dependencies

  const hasActiveChat = !!activeChatId;

  return (
    <div className='flex h-full overflow-hidden'>
      <ChatSidebar />
      <div className='flex-1 flex flex-col min-w-0 h-full'>
        {hasActiveChat && model ? ( // <-- Also check if model is loaded/set
          <>
            <ChatHeader />
            <div className='flex-1 min-h-0 overflow-hidden'>
              <ChatMessages
                chatId={activeChatId}
                messages={messages ?? []}
                isLoading={isAiLoading}
                excludedMessageIds={excludedMessageIds}
                onToggleExclude={handleToggleExclude}
              />
            </div>
            {/* Form submission now correctly triggers the updated handleFormSubmit */}
            <form onSubmit={handleFormSubmit} className='p-2 sm:p-4 border-t bg-background'>
              <div className='flex gap-2 items-end'>
                <AdaptiveChatInput
                  value={input ?? ''}
                  onChange={handleChatInputChange} // Uses setInput via the callback
                  placeholder="Type your message..."
                  disabled={isAiLoading || !model} // Disable if loading or no model selected
                  preserveFormatting
                />
                <Button
                  type="submit"
                  disabled={isAiLoading || !input?.trim() || !model} // Disable if loading, input empty, or no model
                  className="flex-shrink-0"
                  aria-label="Send message"
                >
                  {isAiLoading ? "Sending..." : "Send"}
                </Button>
              </div>
              {error && <p className="text-xs text-destructive mt-1">Error: {error.message}</p>}
            </form>
          </>
        ) : (
          // Show "No Chat Selected" or a loading/initial state if no active chat or model
          <div className='flex-1 flex items-center justify-center p-4'>
            <Card className="p-6 max-w-md text-center">
              <MessageSquareIcon className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
              <h2 className='text-xl font-semibold text-foreground mb-2'>
                {activeChatId ? "Loading Chat..." : "Welcome!"}
              </h2>
              <p className='text-sm text-muted-foreground mb-4'>
                {activeChatId
                  ? "Loading model information and messages."
                  : "Select a chat from the sidebar or start a new conversation."}
              </p>
              {/* Optionally show loading indicator if model is missing but chat id exists */}
              {activeChatId && !model && <p className="text-sm text-muted-foreground">Initializing model...</p>}
            </Card>
          </div>
        )}
      </div>
    </div>
  );
}