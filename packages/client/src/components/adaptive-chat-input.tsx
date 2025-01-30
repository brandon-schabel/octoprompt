import { useState, useRef, useEffect, ChangeEvent, ClipboardEvent, KeyboardEvent } from "react"
import { Expand, Mic, MicOff } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { useWhisperTranscription } from "@/hooks/api/use-whisper-transcription"
import { useHotkeys } from "react-hotkeys-hook"
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

    const inputRef = useRef<HTMLInputElement>(null)
    const textareaRef = useRef<HTMLTextAreaElement>(null)
    const [selectionStart, setSelectionStart] = useState<number | null>(null)
    const [selectionEnd, setSelectionEnd] = useState<number | null>(null)

    const {
        transcript,
        isRecording,
        startRecording,
        stopRecording,
    } = useWhisperTranscription({ debug: false })

    const debouncedOnChange = useDebounce(onChange, 300)

    useHotkeys('v', (evt) => {
        if (evt.type === 'keydown' && !isRecording) {
            startRecording()
        }
        if (evt.type === 'keyup' && isRecording) {
            stopRecording()
        }
    }, { keydown: true, keyup: true }, [isRecording, startRecording, stopRecording])

    const [isHandlingTranscript, setIsHandlingTranscript] = useState(false)
    const latestValueRef = useRef(value)
    useEffect(() => {
        latestValueRef.current = value
    }, [value])

    const lastTranscriptRef = useRef<string | null>(null)

    useEffect(() => {
        if (value !== localValue) {
            setLocalValue(value)
        }
    }, [value])

    const handleValueChange = (newValue: string) => {
        setLocalValue(newValue)
        debouncedOnChange(newValue)
    }

    useEffect(() => {
        if (!transcript ||
            isHandlingTranscript ||
            transcript === lastTranscriptRef.current) {
            return
        }

        setIsHandlingTranscript(true)
        lastTranscriptRef.current = transcript

        try {
            const currentValue = isExpanded ? expandedValue : localValue
            const element = isMultiline ? textareaRef.current : inputRef.current

            const start = element?.selectionStart ?? currentValue.length
            const end = element?.selectionEnd ?? start

            const newValue = currentValue.slice(0, start) + transcript + currentValue.slice(end)

            if (isExpanded) {
                setExpandedValue(newValue)
            }
            handleValueChange(newValue)

            const newPosition = start + transcript.length
            requestAnimationFrame(() => {
                if (element) {
                    element.focus()
                    element.setSelectionRange(newPosition, newPosition)
                }
            })
        } finally {
            setTimeout(() => {
                setIsHandlingTranscript(false)
            }, 100)
        }
    }, [transcript, isExpanded, isMultiline, handleValueChange, expandedValue, localValue])

    useEffect(() => {
        const shouldBeMultiline = value.length > 100 || value.includes('\n')
        setIsMultiline(shouldBeMultiline)
    }, [value])
    const handlePaste =
        (e: ClipboardEvent<HTMLTextAreaElement | HTMLInputElement>) => {
            if (!preserveFormatting) {
                return
            }

            e.preventDefault()

            const pasteText = e.clipboardData?.getData("text/plain") ?? ""
            const target = e.target as HTMLTextAreaElement | HTMLInputElement
            let newValue = target.value

            const start = target.selectionStart ?? newValue.length
            const end = target.selectionEnd ?? newValue.length

            newValue = newValue.slice(0, start) + pasteText + newValue.slice(end)

            const html = e.clipboardData?.getData("text/html") ?? ""
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
                target.setSelectionRange(start + pasteText.length, start + pasteText.length)
                target.focus()
            })
        }

    const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement | HTMLInputElement>) => {
        if (e.key === 'Enter' && !e.shiftKey && !isMultiline) {
            e.preventDefault()
            onSubmit?.()
        }
    }

    const handleExpandedChange = (newValue: string) => {
        setExpandedValue(newValue)
    }

    const handleDialogClose = (open: boolean) => {
        if (!open) {
            handleValueChange(expandedValue)
        }
        setIsExpanded(open)
    }

    const openDialog = () => {
        setExpandedValue(value)
        setIsExpanded(true)
    }

    const renderMicrophoneButton = () => (
        <Popover open={isRecording}>
            <PopoverTrigger asChild>
                <Button
                    variant="ghost"
                    size="icon"
                    className={`h-6 w-6 hover:opacity-100 ${isRecording ? 'bg-red-100 opacity-100' : 'opacity-50'}`}
                    onClick={isRecording ? stopRecording : startRecording}
                    disabled={disabled}
                >
                    {isRecording ? <MicOff className="h-4 w-4 text-red-500" /> : <Mic className="h-4 w-4" />}
                </Button>
            </PopoverTrigger>
            <PopoverContent
                side="top"
                align="start"
                className="w-auto p-2"
            >
                <span className={`text-xs ${isRecording ? 'text-red-500 animate-pulse' : 'text-muted-foreground'}`}>
                    {isRecording ? "Recording in progress... (release V to stop)" : "Press and hold V to record"}
                </span>
            </PopoverContent>
        </Popover>
    )

    const handleSelectionChange = () => {
        if (isHandlingTranscript) return

        const element = isMultiline ? textareaRef.current : inputRef.current
        if (element && document.activeElement === element) {
            setSelectionStart(element.selectionStart)
            setSelectionEnd(element.selectionEnd)
        }
    }

    const handleFocus = () => {
        const element = isMultiline ? textareaRef.current : inputRef.current
        if (element) {
            element.readOnly = false
            handleSelectionChange()
        }
    }

    const baseProps = {
        value: localValue,
        onChange: (e: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
            handleValueChange(e.target.value)
        },
        onKeyDown: handleKeyDown,
        onPaste: handlePaste,
        onSelect: handleSelectionChange,
        onFocus: handleFocus,
        onClick: handleSelectionChange,
        onBlur: handleSelectionChange,
        placeholder,
        disabled,
        spellCheck: false,
    }

    const textareaProps = {
        ...baseProps,
        ref: textareaRef,
    }

    const inputProps = {
        ...baseProps,
        ref: inputRef,
    }

    return (
        <div className="relative w-full" id="adaptive-chat-input">
            {isMultiline ? (
                <div className="relative">
                    <div className="absolute left-2 top-2 z-10">
                        {renderMicrophoneButton()}
                    </div>
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
                    <div className="absolute left-2 top-2 z-10">
                        {renderMicrophoneButton()}
                    </div>
                    <Input
                        {...inputProps}
                        className={`pl-10 font-mono ${className}`}
                    />
                </div>
            )}

            <Dialog open={isExpanded} onOpenChange={handleDialogClose}>
                <DialogContent className="max-w-[90vw] w-full h-[90vh] max-h-[90vh] flex flex-col p-6">
                    <DialogHeader>
                        <DialogTitle>{title}</DialogTitle>
                    </DialogHeader>
                    <div className="flex-1 min-h-0 relative">
                        <div className="absolute left-2 top-2 z-10">
                            {renderMicrophoneButton()}
                        </div>
                        <Textarea
                            {...textareaProps}
                            value={expandedValue}
                            onChange={(e) => handleExpandedChange(e.target.value)}
                            className="h-full resize-none pl-10 font-mono"
                        />
                    </div>
                    <DialogFooter className="mt-4">
                        <Button
                            variant="outline"
                            onClick={() => setIsExpanded(false)}
                        >
                            Done
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    )
}