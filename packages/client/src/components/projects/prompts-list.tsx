import { useState, useRef, useEffect, KeyboardEvent, forwardRef, useImperativeHandle } from 'react'
import { Button } from '@/components/ui/button'
import { Eye, Pencil, Trash } from 'lucide-react'
import { AlertDialog, AlertDialogTrigger, AlertDialogContent, AlertDialogHeader, AlertDialogFooter, AlertDialogTitle, AlertDialogCancel, AlertDialogAction } from '@/components/ui/alert-dialog'
import { Checkbox } from '@/components/ui/checkbox'
import { ProjectFile } from 'shared'
import { FileViewerDialog } from '@/components/file-viewer-dialog'
import { PromptListResponse } from '@/hooks/api/use-prompts-api'
import { ScrollArea } from '../ui/scroll-area'
import { FormatTokenCount } from '../format-token-count'
import { cn } from '@/lib/utils'
import { formatModShortcut } from '@/lib/platform'

export type PromptsListRef = {
    focusPrompts: () => void;
}

interface PromptsListProps {
    promptData?: PromptListResponse | null
    selectedPrompts: string[]
    onSelectPrompt: (id: string, checked: boolean) => void
    onEditPrompt: (id: string) => void
    onDeletePrompt: (id: string) => void
    onCreatePrompt: () => void
    onUpdatePrompt: (promptId: string, updates: { name: string; content: string }) => void
    onNavigateToInput?: () => void
    onNavigateLeft?: () => void
    className?: string
}

export const PromptsList = forwardRef<PromptsListRef, PromptsListProps>(({
    promptData,
    selectedPrompts,
    onSelectPrompt,
    onEditPrompt,
    onDeletePrompt,
    onCreatePrompt,
    onUpdatePrompt,
    onNavigateToInput,
    onNavigateLeft,
    className = '',
}, ref) => {
    const [focusedIndex, setFocusedIndex] = useState<number>(-1);
    const promptRefs = useRef<(HTMLDivElement | null)[]>([]);
    const [viewedPrompt, setViewedPrompt] = useState<ProjectFile | null>(null)

    const handleKeyDown = (e: KeyboardEvent<HTMLDivElement>, index: number, promptId: string) => {
        switch (e.key) {
            case 'ArrowDown':
                e.preventDefault();
                if (promptData?.prompts && index < promptData.prompts.length - 1) {
                    setFocusedIndex(index + 1);
                } else if (onNavigateToInput) {
                    // If we're at the last item, navigate to input
                    onNavigateToInput();
                }
                break;
            case 'ArrowUp':
                e.preventDefault();
                if (index > 0) {
                    setFocusedIndex(index - 1);
                }
                break;
            case 'ArrowLeft':
                e.preventDefault();
                onNavigateLeft?.();
                break;
            case ' ':
                e.preventDefault();
                onSelectPrompt(promptId, !selectedPrompts.includes(promptId));
                break;
            case 'Enter':
                e.preventDefault();
                handleOpenPromptViewer(promptData!.prompts[index] as ProjectFile);
                break;
            case 'Escape':
                e.preventDefault();
                e.currentTarget.blur();
                setFocusedIndex(-1);
                break;
        }
    };

    useEffect(() => {
        if (focusedIndex >= 0 && promptRefs.current[focusedIndex]) {
            promptRefs.current[focusedIndex]?.focus();
        }
    }, [focusedIndex]);

    const handleOpenPromptViewer = (prompt: ProjectFile) => {
        setViewedPrompt({
            ...prompt,
            path: prompt.name,
            extension: '.txt' // Prompts are treated as text files
        })
    }

    const handleClosePromptViewer = () => {
        setViewedPrompt(null)
    }

    const handleSavePrompt = (newContent: string) => {
        if (viewedPrompt) {
            onUpdatePrompt(viewedPrompt.id, {
                name: viewedPrompt.name,
                content: newContent
            })
        }
    }

    useImperativeHandle(ref, () => ({
        focusPrompts: () => {
            if (promptData?.prompts && promptData.prompts.length > 0) {
                setFocusedIndex(0);
            }
        }
    }), [promptData?.prompts]);

    return (
        <>
            <div className={`border rounded-lg h-full flex flex-col ${className}`}>
                <div className="flex-shrink-0 flex flex-row items-center justify-between p-4 border-b">
                    <div>
                        <div className="text-md font-medium">Project Prompts <span className="hidden lg:inline text-muted-foreground">({formatModShortcut('p')})</span></div>
                        <div className="hidden lg:text-xs text-muted-foreground">
                            Press Space to select, Enter to view
                        </div>
                    </div>
                    <Button onClick={onCreatePrompt} size='sm'>
                        <span className="mr-2">+</span>
                        New
                    </Button>
                </div>
                <div className='flex-1 relative min-h-0'>
                    {promptData?.prompts && promptData.prompts.length > 0 ? (
                        <ScrollArea className="h-full">
                            <div className="space-y-2 p-4">
                                {promptData.prompts.map((prompt, index) => (
                                    <div
                                        key={prompt.id}
                                        ref={el => promptRefs.current[index] = el}
                                        className={cn(
                                            "flex items-center justify-between rounded-md p-1 hover:bg-muted/50 group",
                                            focusedIndex === index && "bg-accent"
                                        )}
                                        tabIndex={0}
                                        onFocus={() => setFocusedIndex(index)}
                                        onKeyDown={(e) => handleKeyDown(e, index, prompt.id)}
                                    >
                                        <div className="flex items-center space-x-3 min-w-0">
                                            <Checkbox
                                                checked={selectedPrompts.includes(prompt.id)}
                                                onCheckedChange={(checked) => onSelectPrompt(prompt.id, !!checked)}
                                            />
                                            <div className="flex items-center space-x-2 min-w-0">
                                                <span className="font-medium truncate">{prompt.name}</span>
                                                <FormatTokenCount tokenContent={prompt.content ?? ''} />
                                            </div>
                                        </div>
                                        <div className="flex items-center space-x-1 flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
                                            <Button
                                                variant="ghost"
                                                size="icon"
                                                onClick={() => handleOpenPromptViewer(prompt as ProjectFile)}
                                            >
                                                <Eye className="h-4 w-4" />
                                            </Button>
                                            <Button
                                                size="icon"
                                                variant="ghost"
                                                onClick={() => onEditPrompt(prompt.id)}
                                            >
                                                <Pencil className="h-4 w-4" />
                                            </Button>
                                            <AlertDialog>
                                                <AlertDialogTrigger asChild>
                                                    <Button size="icon" variant="ghost">
                                                        <Trash className="h-4 w-4 text-destructive" />
                                                    </Button>
                                                </AlertDialogTrigger>
                                                <AlertDialogContent>
                                                    <AlertDialogHeader>
                                                        <AlertDialogTitle>Delete Prompt</AlertDialogTitle>
                                                    </AlertDialogHeader>
                                                    <p className="text-sm text-muted-foreground">
                                                        Are you sure you want to delete the prompt "{prompt.name}"?
                                                    </p>
                                                    <AlertDialogFooter>
                                                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                                                        <AlertDialogAction onClick={() => onDeletePrompt(prompt.id)}>
                                                            Delete
                                                        </AlertDialogAction>
                                                    </AlertDialogFooter>
                                                </AlertDialogContent>
                                            </AlertDialog>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </ScrollArea>
                    ) : (
                        <p className="text-sm text-muted-foreground">No prompts yet. Create one above.</p>
                    )}
                </div>
            </div>

            <FileViewerDialog
                open={!!viewedPrompt}
                viewedFile={viewedPrompt}
                onClose={handleClosePromptViewer}
                onSave={(newContent) => handleSavePrompt(newContent)}
            />
        </>
    )
})