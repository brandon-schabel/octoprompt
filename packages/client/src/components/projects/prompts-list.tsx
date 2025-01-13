import { forwardRef, useState, useRef, useEffect, KeyboardEvent, useImperativeHandle } from 'react'
import { Button } from '@/components/ui/button'
import { Eye, Pencil, Trash } from 'lucide-react'
import { AlertDialog, AlertDialogTrigger, AlertDialogContent, AlertDialogHeader, AlertDialogFooter, AlertDialogTitle, AlertDialogCancel, AlertDialogAction } from '@/components/ui/alert-dialog'
import { Checkbox } from '@/components/ui/checkbox'
import { FileViewerDialog } from '@/components/navigation/file-viewer-dialog'
import { ScrollArea } from '../ui/scroll-area'
import { FormatTokenCount } from '../format-token-count'
import { cn } from '@/lib/utils'
import { formatModShortcut } from '@/lib/platform'
import { ProjectFile } from 'shared'
import { useGetProjectPrompts, useCreatePrompt, useUpdatePrompt, useDeletePrompt } from '@/hooks/api/use-prompts-api'
import { PromptDialog } from '@/components/projects/prompt-dialog'
import { useForm } from 'react-hook-form'
import { z } from 'zod'
import { toast } from 'sonner'
import { zodResolver } from '@hookform/resolvers/zod'
import { promptSchema } from '@/components/projects/utils/projects-utils'
import { useGlobalStateHelpers } from '../global-state/use-global-state-helpers'

export type PromptsListRef = {
    focusPrompts: () => void;
}

interface PromptsListProps {
    projectTabId: string
    className?: string
}

export const PromptsList = forwardRef<PromptsListRef, PromptsListProps>(({
    projectTabId,
    className = '',
}, ref) => {
    // Access global state
    const { state, updateProjectTabState } = useGlobalStateHelpers()
    const projectTab = state?.projectTabs[projectTabId]
    const selectedPrompts = projectTab?.selectedPrompts || []
    const selectedProjectId = projectTab?.selectedProjectId || ''

    // Fetch the actual prompt data from the server
    const { data: promptData } = useGetProjectPrompts(selectedProjectId)
    const prompts = promptData?.prompts || []

    // Mutations
    const createPromptMutation = useCreatePrompt()
    const updatePromptMutation = useUpdatePrompt()
    const deletePromptMutation = useDeletePrompt()

    // local UI state
    const [focusedIndex, setFocusedIndex] = useState<number>(-1)
    const promptRefs = useRef<(HTMLDivElement | null)[]>([])
    const [viewedPrompt, setViewedPrompt] = useState<ProjectFile | null>(null)

    // For prompt dialog (create/edit)
    const [promptDialogOpen, setPromptDialogOpen] = useState(false)
    const [editPromptId, setEditPromptId] = useState<string | null>(null)

    // Our form for creating/updating
    const promptForm = useForm<z.infer<typeof promptSchema>>({
        resolver: zodResolver(promptSchema),
        defaultValues: {
            name: '',
            content: '',
        },
    })

    // ---------------
    // Create prompt
    // ---------------
    const handleCreatePrompt = async (values: z.infer<typeof promptSchema>) => {
        if (!selectedProjectId) return
        const result = await createPromptMutation.mutateAsync({
            ...values,
            projectId: selectedProjectId,
        })
        if (result.success && result.prompt) {
            toast.success('Prompt created successfully')
            promptForm.reset()
            setPromptDialogOpen(false)
        }
    }

    // ---------------
    // Update prompt
    // ---------------
    const handleUpdatePrompt = async (updates: { name: string; content: string }) => {
        if (!editPromptId) return
        await updatePromptMutation.mutateAsync({
            id: editPromptId,
            updates,
        })
        toast.success('Prompt updated successfully')
        setPromptDialogOpen(false)
    }

    // ---------------
    // Delete prompt
    // ---------------
    const handleDeletePrompt = async (promptId: string) => {
        await deletePromptMutation.mutateAsync(promptId)
        toast.success('Prompt deleted successfully')
    }

    // When user clicks Pencil icon, load the existing name/content
    useEffect(() => {
        if (!editPromptId) {
            promptForm.reset()
            return
        }
        const found = prompts.find((p) => p.id === editPromptId)
        if (found) {
            promptForm.setValue('name', found.name || '')
            promptForm.setValue('content', found.content || '')
        } else {
            promptForm.reset()
        }
    }, [editPromptId, prompts, promptForm])

    // Keyboard navigation
    const handleKeyDown = (e: KeyboardEvent<HTMLDivElement>, index: number, promptId: string) => {
        switch (e.key) {
            case 'ArrowDown':
                e.preventDefault();
                if (index < prompts.length - 1) setFocusedIndex(index + 1);
                break;
            case 'ArrowUp':
                e.preventDefault();
                if (index > 0) setFocusedIndex(index - 1);
                break;
            case ' ':
                e.preventDefault();
                // Toggle selection
                updateProjectTabState(projectTabId, (prev) => {
                    const isSelected = prev.selectedPrompts.includes(promptId)
                    const newSelected = isSelected
                        ? prev.selectedPrompts.filter(p => p !== promptId)
                        : [...prev.selectedPrompts, promptId]
                    return { selectedPrompts: newSelected }
                })
                break;
            case 'Enter':
                e.preventDefault();
                handleOpenPromptViewer(prompts[index] as ProjectFile);
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
            extension: '.txt'
        })
    }

    const handleClosePromptViewer = () => setViewedPrompt(null)

    const handleSavePrompt = (newContent: string) => {
        if (!viewedPrompt) return
        // In a real app, you'd call the update API here or update local state
        console.log('handleSavePrompt, new content = ', newContent)
    }

    // Expose a focus method
    useImperativeHandle(ref, () => ({
        focusPrompts: () => {
            if (prompts.length > 0) setFocusedIndex(0);
        }
    }), [prompts]);

    return (
        <>
            <div className={`border rounded-lg h-full flex flex-col ${className}`}>
                <div className="flex-shrink-0 flex flex-row items-center justify-between p-4 border-b">
                    <div>
                        <div className="text-md font-medium">
                            Project Prompts <span className="hidden lg:inline text-muted-foreground">({formatModShortcut('p')})</span>
                        </div>
                        <div className="hidden lg:text-xs text-muted-foreground">
                            Press Space to select, Enter to view
                        </div>
                    </div>
                    <Button
                        size='sm'
                        onClick={() => {
                            setEditPromptId(null)
                            promptForm.reset()
                            setPromptDialogOpen(true)
                        }}
                    >
                        <span className="mr-2">+</span>
                        New
                    </Button>
                </div>

                <div className='flex-1 relative min-h-0 '>
                    {prompts.length > 0 ? (
                        <ScrollArea className="h-full">
                            <div className="space-y-2 p-4 w-96">
                                {prompts.map((prompt, index) => (
                                    <div
                                        key={prompt.id}
                                        // @ts-ignore
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
                                                onCheckedChange={(checked) => {
                                                    updateProjectTabState(projectTabId, (prev) => {
                                                        const isSelected = prev.selectedPrompts.includes(prompt.id)
                                                        const newSelected = isSelected
                                                            ? prev.selectedPrompts.filter(p => p !== prompt.id)
                                                            : [...prev.selectedPrompts, prompt.id]
                                                        return { selectedPrompts: newSelected }
                                                    })
                                                }}
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
                                                onClick={() => {
                                                    setEditPromptId(prompt.id)
                                                    setPromptDialogOpen(true)
                                                }}
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
                                                        <AlertDialogAction
                                                            onClick={() => handleDeletePrompt(prompt.id)}
                                                        >
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
                        <p className="text-sm text-muted-foreground p-4">No prompts yet. Create one above.</p>
                    )}
                </div>
            </div>

            {/* A "viewer" dialog for prompts, if needed */}
            <FileViewerDialog
                open={!!viewedPrompt}
                viewedFile={viewedPrompt}
                onClose={handleClosePromptViewer}
                onSave={handleSavePrompt}
            />

            {/* Prompt dialog for create/update */}
            <PromptDialog
                open={promptDialogOpen}
                editPromptId={editPromptId}
                promptForm={promptForm}
                handleCreatePrompt={handleCreatePrompt}
                handleUpdatePrompt={handleUpdatePrompt}
                createPromptPending={createPromptMutation.isPending}
                updatePromptPending={updatePromptMutation.isPending}
                onClose={() => setPromptDialogOpen(false)}
            />
        </>
    )
})