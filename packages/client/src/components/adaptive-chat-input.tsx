import { useState, useRef, useEffect, ChangeEvent, ClipboardEvent, KeyboardEvent } from "react"
import { Expand, Mic, MicOff } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { useDebounce } from "@/hooks/utility-hooks/use-debounce"
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogFooter,
} from "@/components/ui/dialog"
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from "@/components/ui/popover"

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
    className = "",
    title = "Edit Message",
    disabled = false,
    preserveFormatting = true,
}: AdaptiveChatInputProps) {
    const [localValue, setLocalValue] = useState(value)
    const [isExpanded, setIsExpanded] = useState(false)
    const [expandedValue, setExpandedValue] = useState(value)
    const [isMultiline, setIsMultiline] = useState(false)

    // Input/textarea refs for direct value reads
    const inputRef = useRef<HTMLInputElement>(null)
    const textareaRef = useRef<HTMLTextAreaElement>(null)

    // Debounced parent onChange
    // (You can remove or reduce the delay if you want changes to be more instantaneous)
    const debouncedOnChange = useDebounce(onChange, 300)

    // Keep track of the last transcript used
    const [isHandlingTranscript, setIsHandlingTranscript] = useState(false)
    const lastTranscriptRef = useRef<string | null>(null)

    // Always sync localValue when parent `value` changes
    useEffect(() => {
        if (value !== localValue) {
            setLocalValue(value)
            console.log("[AdaptiveChatInput] Value changed from parent:", { value, localValue })
        }
    }, [value])

    // Check if text is long or multiline => switch to multi-line mode
    useEffect(() => {
        const shouldBeMultiline = value?.length > 100 || value?.includes('\n')
        setIsMultiline(shouldBeMultiline)
    }, [value])

    // Force an immediate change to localValue + parent
    const handleValueChange = (newValue: string) => {
        console.log("[AdaptiveChatInput] handleValueChange:", { newValue, oldValue: localValue })
        setLocalValue(newValue)
        
        // Call parent's onChange immediately for more responsive UI
        onChange(newValue)
        
        // Also keep the debounced version for performance with rapid typing
        debouncedOnChange(newValue)
    }

    // Intercept paste if preserveFormatting is true
    const handlePaste = (e: ClipboardEvent<HTMLTextAreaElement | HTMLInputElement>) => {
        if (!preserveFormatting) {
            return
        }
        e.preventDefault()

        const pasteText = e.clipboardData?.getData("text/plain") ?? ""
        const target = e.target as HTMLTextAreaElement | HTMLInputElement
        let newValue = target.value

        const start = target.selectionStart ?? newValue?.length
        const end = target.selectionEnd ?? newValue?.length

        newValue = newValue.slice(0, start) + pasteText + newValue.slice(end)

        const html = e.clipboardData?.getData("text/html") ?? ""
        // If the paste doesn't contain code fences, lightly trim newlines
        if (!html.includes("```")) {
            newValue = newValue
                .split("\n")
                .map((line) => line.trim())
                .join("\n")
                .replace(/\n{3,}/g, "\n\n")
        }
        handleValueChange(newValue)

        if (newValue.includes("\n")) {
            setIsMultiline(true)
        }
        requestAnimationFrame(() => {
            const cursorPos = start + pasteText.length
            target.setSelectionRange(cursorPos, cursorPos)
            target.focus()
        })
    }

    // We do a direct read from the ref to ensure the latest typed text
    const handleEnterPress = (e: KeyboardEvent<HTMLTextAreaElement | HTMLInputElement>) => {
        e.preventDefault()
        // whichever ref is actually in use
        const element = isMultiline ? textareaRef.current : inputRef.current
        const finalValue = element?.value ?? localValue

        console.log("[AdaptiveChatInput] handleEnterPress with finalValue:", finalValue);

        // Make sure parent sees the final typed text right away
        onChange(finalValue)
        setLocalValue(finalValue)

        // Now we can call onSubmit. The parent has the latest text.
        onSubmit?.()
    }

    // Decide if we trigger submit on Enter
    const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement | HTMLInputElement>) => {
        // If multiline is false, then hitting Enter means "submit"
        if (e.key === 'Enter' && !e.shiftKey && !isMultiline) {
            handleEnterPress(e)
        }
    }

    // Expand/collapse large editor
    const openDialog = () => {
        setExpandedValue(value)
        setIsExpanded(true)
    }
    const handleDialogClose = (open: boolean) => {
        if (!open) {
            // user closed the expanded dialog => ensure local + parent are updated
            handleValueChange(expandedValue)
        }
        setIsExpanded(open)
    }

    const handleExpandedChange = (newValue: string) => {
        setExpandedValue(newValue)
    }

    // Common props for input or textarea
    const baseProps = {
        value: localValue,
        onChange: (e: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
            const newValue = e.target.value;
            // Update local state
            setLocalValue(newValue);
            // Call parent immediately for responsive UI
            onChange(newValue);
            // Also keep debounced version for performance
            debouncedOnChange(newValue);
        },
        onKeyDown: handleKeyDown,
        onPaste: handlePaste,
        placeholder,
        disabled,
        spellCheck: false,
    }

    // For selection/focus tracking
    const [selectionStart, setSelectionStart] = useState<number | null>(null)
    const [selectionEnd, setSelectionEnd] = useState<number | null>(null)
    const isUserFocus = useRef(false)

    const handleSelectionChange = () => {
        if (isHandlingTranscript) return
        const element = isMultiline ? textareaRef.current : inputRef.current
        if (element && document.activeElement === element) {
            setSelectionStart(element.selectionStart)
            setSelectionEnd(element.selectionEnd)
        }
    }

    const handleFocus = () => {
        isUserFocus.current = true
        handleSelectionChange()
    }
    const handleBlur = () => {
        isUserFocus.current = false
        handleSelectionChange()
    }

    const inputProps = {
        ...baseProps,
        ref: inputRef,
        onFocus: handleFocus,
        onSelect: handleSelectionChange,
        onClick: handleSelectionChange,
        onBlur: handleBlur,
    }
    const textareaProps = {
        ...baseProps,
        ref: textareaRef,
        onFocus: handleFocus,
        onSelect: handleSelectionChange,
        onClick: handleSelectionChange,
        onBlur: handleBlur,
    }



    return (
        <div className="relative w-full" id="adaptive-chat-input">
            {isMultiline ? (
                <div className="relative">

                    <Textarea
                        {...textareaProps}
                        className={`pl-10 pr-8 min-h-[60px] font-mono ${className}`}
                    />
                    <Button
                        variant="ghost"
                        size="icon"
                        className="absolute right-2 top-2 h-6 w-6 opacity-50 hover:opacity-100"
                        onClick={openDialog}
                        disabled={disabled}
                    >
                        <Expand className="h-4 w-4" />
                    </Button>
                </div>
            ) : (
                <div className="relative">
                    <Input
                        {...inputProps}
                        className={`pl-10 font-mono ${className}`}
                    />
                </div>
            )}

            {/* Fullscreen Dialog for expanded view */}
            <Dialog open={isExpanded} onOpenChange={handleDialogClose}>
                <DialogContent className="max-w-[90vw] w-full h-[90vh] max-h-[90vh] flex flex-col p-6">
                    <DialogHeader>
                        <DialogTitle>{title}</DialogTitle>
                    </DialogHeader>
                    <div className="flex-1 min-h-0 relative">
                        <Textarea
                            {...textareaProps}
                            value={expandedValue}
                            onChange={(e) => handleExpandedChange(e.target.value)}
                            className="h-full resize-none pl-10 font-mono"
                        />
                    </div>
                    <DialogFooter className="mt-4">
                        <Button variant="outline" onClick={() => setIsExpanded(false)}>
                            Done
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    )
}