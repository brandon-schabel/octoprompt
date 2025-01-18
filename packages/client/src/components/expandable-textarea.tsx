import { Expand, Mic, MicOff, Copy, Wand2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { useWhisperTranscription } from "@/hooks/api/use-whisper-transcription"
import { useEffect, useState, useRef, useCallback, forwardRef, useMemo } from "react"
import { useOptimizePrompt } from '@/hooks/api/use-promptimizer'
import { PromptimizerDialog } from './promptimizer-dialog'
import { toast } from "sonner"
import { DotsHorizontalIcon } from "@radix-ui/react-icons"
import { formatShortcut } from "@/lib/shortcuts"

type ExpandableTextareaProps = {
  value: string
  onChange: (value: string) => void
  placeholder?: string
  className?: string
  title?: string
}

export const ExpandableTextarea = forwardRef<HTMLTextAreaElement, ExpandableTextareaProps>(({
  value,
  onChange,
  placeholder,
  className,
  title = "Edit Text",
}, ref) => {
  const [isExpanded, setIsExpanded] = useState(false)
  const [expandedValue, setExpandedValue] = useState(value)
  const internalRef = useRef<HTMLTextAreaElement | null>(null)
  const textareaRef = (ref || internalRef) as React.RefObject<HTMLTextAreaElement>
  const [selectionStart, setSelectionStart] = useState<number | null>(null)
  const [selectionEnd, setSelectionEnd] = useState<number | null>(null)

  // Promptimizer state and mutation
  const [promptimizeDialogOpen, setPromptimizeDialogOpen] = useState(false)
  const [optimizedPrompt, setOptimizedPrompt] = useState("")
  const promptimizeMutation = useOptimizePrompt()

  const handlePromptimize = () => {
    if (!expandedValue.trim()) {
      toast.error("Please enter some text to optimize")
      return
    }
    promptimizeMutation.mutate(expandedValue, {
      onSuccess: (resp) => {
        if (resp.success && resp.optimizedPrompt) {
          setOptimizedPrompt(resp.optimizedPrompt)
          setPromptimizeDialogOpen(true)
        } else {
          toast.error(resp.error || "No optimized prompt returned")
        }
      },
    })
  }

  const handleCopyContent = async () => {
    try {
      await navigator.clipboard.writeText(expandedValue)
      toast.success("Content copied to clipboard")
    } catch (error) {
      toast.error("Failed to copy content")
    }
  }

  const {
    transcript,
    isRecording,
    startRecording,
    stopRecording,
  } = useWhisperTranscription({ debug: false })

  // Whenever transcript updates (new transcription completed),
  // insert it at the current selection.
  useEffect(() => {
    if (transcript) {
      const currentValue = expandedValue
      const start = selectionStart !== null ? selectionStart : currentValue.length
      const end = selectionEnd !== null ? selectionEnd : start
      const newValue = currentValue.slice(0, start) + transcript + currentValue.slice(end)
      setExpandedValue(newValue)
      onChange(newValue)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [transcript])

  useEffect(() => {
    setExpandedValue(value)
  }, [value])

  const handleExpandedChange = (newValue: string) => {
    setExpandedValue(newValue)
    onChange(newValue)
  }

  const handleDialogClose = (open: boolean) => {
    if (!open) {
      onChange(expandedValue)
    }
    setIsExpanded(open)
  }

  const handleSelectionChange = useCallback(() => {
    if (textareaRef.current) {
      setSelectionStart(textareaRef.current.selectionStart)
      setSelectionEnd(textareaRef.current.selectionEnd)
    }
  }, [])

  const placeholderWithShortcut = useMemo(() => {
    return `${placeholder} (${formatShortcut('mod+i')})`
  }, [placeholder])

  const renderMicrophoneButton = () => (
    <Popover open={isRecording}>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          type="button"
          className={`h-6 w-6 hover:opacity-100 ${isRecording ? 'bg-red-100 opacity-100' : 'opacity-50'}`}
          onClick={(e) => {
            e.preventDefault()
            e.stopPropagation()
            isRecording ? stopRecording() : startRecording()
          }}
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
          {isRecording ? "Recording in progress..." : "Click to start recording"}
        </span>
      </PopoverContent>
    </Popover>
  )

  return (
    <div className="relative h-full">
      <Textarea
        ref={textareaRef}
        value={value}
        onChange={(e) => {
          onChange(e.target.value)
          setExpandedValue(e.target.value)
        }}
        onSelect={handleSelectionChange}
        onFocus={handleSelectionChange}
        onClick={handleSelectionChange}
        onKeyDown={(e) => {
          if (e.key === 'Escape') {
            textareaRef.current?.blur();
          }
        }}
        placeholder={placeholderWithShortcut}
        className={`h-full resize-none pr-[120px] ${className}`}
      />
      <div className="absolute right-3 top-2 flex items-center space-x-2 bg-background">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6 opacity-50 hover:opacity-100"
            >
              <DotsHorizontalIcon className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-48">
            <DropdownMenuItem onClick={handleCopyContent}>
              <Copy className="mr-2 h-4 w-4" />
              <span>Copy Content</span>
            </DropdownMenuItem>
            <DropdownMenuItem onClick={handlePromptimize} disabled={promptimizeMutation.isPending}>
              <Wand2 className="mr-2 h-4 w-4" />
              <span>{promptimizeMutation.isPending ? "Optimizing..." : "Promptimize"}</span>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
        <Button
          variant="ghost"
          size="icon"
          type="button"
          className="h-6 w-6 opacity-50 hover:opacity-100"
          onClick={(e) => {
            e.preventDefault()
            e.stopPropagation()
            setIsExpanded(true)
          }}
        >
          <Expand className="h-4 w-4" />
        </Button>
        {renderMicrophoneButton()}
      </div>

      <Dialog open={isExpanded} onOpenChange={handleDialogClose}>
        <DialogContent className="max-w-[90vw] w-full h-[90vh] max-h-[90vh] flex flex-col p-6">
          <DialogHeader>
            <DialogTitle>{title}</DialogTitle>
          </DialogHeader>
          <div className="flex-1 min-h-0 relative">
            <Textarea
              ref={textareaRef}
              value={expandedValue}
              onChange={(e) => handleExpandedChange(e.target.value)}
              onSelect={handleSelectionChange}
              onFocus={handleSelectionChange}
              onClick={handleSelectionChange}
              onKeyDown={(e) => {
                if (e.key === 'Escape') {
                  textareaRef.current?.blur();
                }
              }}
              placeholder={placeholder}
              className="h-full resize-none pr-[120px]"
            />
            <div className="absolute right-3 top-2 flex items-center space-x-2 bg-background">
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6 opacity-50 hover:opacity-100"
                  >
                    <DotsHorizontalIcon className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-48">
                  <DropdownMenuItem onClick={handleCopyContent}>
                    <Copy className="mr-2 h-4 w-4" />
                    <span>Copy Content</span>
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={handlePromptimize} disabled={promptimizeMutation.isPending}>
                    <Wand2 className="mr-2 h-4 w-4" />
                    <span>{promptimizeMutation.isPending ? "Optimizing..." : "Promptimize"}</span>
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
              {renderMicrophoneButton()}
            </div>
          </div>
          <DialogFooter className="mt-4">
            <Button
              type="button"
              variant="outline"
              onClick={(e) => {
                e.preventDefault()
                e.stopPropagation()
                onChange(expandedValue)
                setIsExpanded(false)
              }}
            >
              Done
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Promptimizer Dialog */}
      <PromptimizerDialog
        open={promptimizeDialogOpen}
        onClose={() => setPromptimizeDialogOpen(false)}
        optimizedPrompt={optimizedPrompt}
        onUpdatePrompt={(newPrompt) => {
          setExpandedValue(newPrompt)
          onChange(newPrompt)
        }}
      />
    </div>
  )
})