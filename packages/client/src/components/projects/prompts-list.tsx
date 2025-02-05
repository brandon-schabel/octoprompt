import { forwardRef, useState, useRef, useEffect, KeyboardEvent, useImperativeHandle } from 'react'
import { Button } from '@/components/ui/button'
import { Eye, Pencil, Trash, Plus, ArrowUpDown, ArrowDownAZ } from 'lucide-react'
import { AlertDialog, AlertDialogTrigger, AlertDialogContent, AlertDialogHeader, AlertDialogFooter, AlertDialogTitle, AlertDialogCancel, AlertDialogAction } from '@/components/ui/alert-dialog'
import { Checkbox } from '@/components/ui/checkbox'
import { FileViewerDialog } from '@/components/navigation/file-viewer-dialog'
import { ScrollArea } from '../ui/scroll-area'
import { FormatTokenCount } from '../format-token-count'
import { cn } from '@/lib/utils'
import { ProjectFile } from 'shared'
import { useGetProjectPrompts, useCreatePrompt, useUpdatePrompt, useDeletePrompt } from '@/hooks/api/use-prompts-api'
import { PromptDialog } from '@/components/projects/prompt-dialog'
import { useForm } from 'react-hook-form'
import { z } from 'zod'
import { toast } from 'sonner'
import { zodResolver } from '@hookform/resolvers/zod'
import { promptSchema } from '@/components/projects/utils/projects-utils'
import { useUpdateProjectTabState } from '@/zustand/updaters'
import { PromptsDialogAll } from '../prompts/all-prompts-dialog'
import { DropdownMenu, DropdownMenuContent, DropdownMenuSeparator, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSub, DropdownMenuSubTrigger, DropdownMenuSubContent, DropdownMenuRadioGroup, DropdownMenuRadioItem } from '../ui/dropdown-menu'
import { DotsHorizontalIcon } from '@radix-ui/react-icons'
import { Badge } from '../ui/badge'
import { InfoTooltip } from '../info-tooltip'
import { ShortcutDisplay } from '../app-shortcut-display'
import { useProjectTab } from '@/zustand/selectors'

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
    const updateProjectTabState = useUpdateProjectTabState(projectTabId)
    const projectTab = useProjectTab(projectTabId)
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

    // Sorting
    const [sortOrder, setSortOrder] = useState<"alphabetical" | "default" | "size_asc" | "size_desc">("alphabetical")

    let sortedPrompts = [...prompts]
    if (sortOrder === "alphabetical") {
        sortedPrompts.sort((a, b) => a.name.localeCompare(b.name))
    } else if (sortOrder === "size_desc") {
        sortedPrompts.sort((a, b) => (b.content?.length || 0) - (a.content?.length || 0)) // Sort by size descending
    } else if (sortOrder === "size_asc") {
        sortedPrompts.sort((a, b) => (a.content?.length || 0) - (b.content?.length || 0)) // Sort by size ascending
    }

    const copySelectedPrompts = () => {
        if (!selectedPrompts.length) return
        const allPrompts = selectedPrompts.map(id => {
            const p = promptData?.prompts.find(x => x.id === id)
            return p ? `# ${p.name}\n${p.content}\n` : ""
        }).join("\n")
        navigator.clipboard.writeText(allPrompts)
        toast.success("Copied all selected prompts.")
    }

    /** NEW: state for opening the all-prompts dialog */
    const [allPromptsDialogOpen, setAllPromptsDialogOpen] = useState(false)

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
                updateProjectTabState((prev) => {
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
        // TODO: IMPLEMENT SAVE Prompt
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
            {/* NEW: All Prompts Import Dialog */}
            <PromptsDialogAll
                open={allPromptsDialogOpen}
                onClose={() => setAllPromptsDialogOpen(false)}
                selectedProjectId={selectedProjectId}
            />
            <div className={`border rounded-lg h-full flex flex-col ${className}`}>
                <div className="flex-shrink-0 flex flex-row items-center justify-between p-4 border-b">
                    <div>
                        <div className="text-md font-medium flex items-center gap-2">
                            <span><Badge>{selectedPrompts.length}</Badge> Project Prompts</span>
                            <InfoTooltip>
                                <div className="space-y-2">
                                    <p>Prompts are reusable instructions that will be included with your chat. Each selected prompt will be added to the final prompt sent to the AI.</p>
                                    <p>You can:</p>
                                    <ul>
                                        <li>- Create custom prompts for specific tasks</li>
                                        <li>- Import prompts from other projects</li>
                                        <li>- Select multiple prompts to combine instructions</li>
                                    </ul>
                                    <p className="font-medium mt-2">Keyboard Shortcuts:</p>
                                    <ul>
                                        <li>- <ShortcutDisplay shortcut={['up', 'down']} /> Navigate through prompts</li>
                                        <li>- <ShortcutDisplay shortcut={['space']} /> Select/deselect prompt</li>
                                        <li>- <ShortcutDisplay shortcut={['enter']} /> View prompt content</li>
                                        <li>- <ShortcutDisplay shortcut={['mod', 'p']} /> Focus prompts list</li>
                                    </ul>
                                </div>
                            </InfoTooltip>
                        </div>
                        <div className="hidden lg:text-xs text-muted-foreground">
                            Press Space to select, Enter to view
                        </div>
                    </div>
                    <div className='flex space-x-2'>
                        <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                                <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-8 w-8"
                                >
                                    <DotsHorizontalIcon className="h-4 w-4" />
                                    <span className="sr-only">Actions</span>
                                </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" className="w-48">
                                <DropdownMenuItem onClick={() => {
                                    setEditPromptId(null)
                                    promptForm.reset()
                                    setPromptDialogOpen(true)
                                }}>
                                    <Plus className="mr-2 h-4 w-4" />
                                    <span>New Prompt</span>
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={() => setAllPromptsDialogOpen(true)}>
                                    <Eye className="mr-2 h-4 w-4" />
                                    <span>Import Prompts</span>
                                </DropdownMenuItem>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem onClick={copySelectedPrompts}>
                                    <Pencil className="mr-2 h-4 w-4" />
                                    <span>Copy Selected Prompts</span>
                                </DropdownMenuItem>
                                <DropdownMenuItem
                                    onClick={() => {
                                        updateProjectTabState((prev) => ({
                                            ...prev,
                                            selectedPrompts: []
                                        }))
                                        toast.success('Cleared all selected prompts')
                                    }}
                                    disabled={!selectedPrompts.length}
                                >
                                    <Trash className="mr-2 h-4 w-4" />
                                    <span>Clear Selected</span>
                                </DropdownMenuItem>
                                <DropdownMenuSub>
                                    <DropdownMenuSubTrigger>
                                        <ArrowUpDown className="mr-2 h-4 w-4" />
                                        <span>Sort By</span>
                                    </DropdownMenuSubTrigger>
                                    <DropdownMenuSubContent>
                                        <DropdownMenuRadioGroup value={sortOrder} onValueChange={(value) => {
                                            setSortOrder(value as "alphabetical" | "default" | "size_asc" | "size_desc")
                                        }}>
                                            <DropdownMenuRadioItem value="default">
                                                <ArrowUpDown className="mr-2 h-4 w-4" />
                                                <span>Default</span>
                                            </DropdownMenuRadioItem>
                                            <DropdownMenuRadioItem value="alphabetical">
                                                <ArrowDownAZ className="mr-2 h-4 w-4" />
                                                <span>Alphabetical</span>
                                            </DropdownMenuRadioItem>
                                            <DropdownMenuRadioItem value="size_desc">
                                                <ArrowDownAZ className="mr-2 h-4 w-4" />
                                                <span>Size (Largest First)</span>
                                            </DropdownMenuRadioItem>
                                            <DropdownMenuRadioItem value="size_asc">
                                                <ArrowDownAZ className="mr-2 h-4 w-4" />
                                                <span>Size (Smallest First)</span>
                                            </DropdownMenuRadioItem>
                                        </DropdownMenuRadioGroup>
                                    </DropdownMenuSubContent>
                                </DropdownMenuSub>
                            </DropdownMenuContent>
                        </DropdownMenu>

                    </div>
                </div>

                <div className='flex-1 relative min-h-0 '>
                    {sortedPrompts.length > 0 ? (
                        <ScrollArea className="h-full">
                            <div className="space-y-2 p-4 w-72 md:w-80 lg:w-full">
                                {sortedPrompts.map((prompt, index) => (
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
                                                    updateProjectTabState((prev) => {
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

                                            <DropdownMenu>
                                                <DropdownMenuTrigger asChild>
                                                    <Button
                                                        variant="ghost"
                                                        size="icon"
                                                        className="h-8 w-8"
                                                    >
                                                        <DotsHorizontalIcon className="h-4 w-4" />
                                                    </Button>
                                                </DropdownMenuTrigger>
                                                <DropdownMenuContent align="end" className="w-48">
                                                    <DropdownMenuItem onClick={() => handleOpenPromptViewer(prompt as ProjectFile)}>
                                                        <Eye className="mr-2 h-4 w-4" />
                                                        <span>View Prompt</span>
                                                    </DropdownMenuItem>
                                                    <DropdownMenuItem
                                                        onClick={() => {
                                                            setEditPromptId(prompt.id)
                                                            setPromptDialogOpen(true)
                                                        }}
                                                    >
                                                        <Pencil className="mr-2 h-4 w-4" />
                                                        <span>Edit Prompt</span>
                                                    </DropdownMenuItem>
                                                    <DropdownMenuSeparator />
                                                    <AlertDialog>
                                                        <AlertDialogTrigger asChild>
                                                            <DropdownMenuItem
                                                                onSelect={(e) => e.preventDefault()}
                                                                className="text-destructive focus:text-destructive"
                                                            >
                                                                <Trash className="mr-2 h-4 w-4" />
                                                                <span>Delete Prompt</span>
                                                            </DropdownMenuItem>
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
                                                </DropdownMenuContent>
                                            </DropdownMenu>
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