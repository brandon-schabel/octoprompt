/*
 * File: prompts.tsx
 * Purpose: Manages the display, creation, editing, and organization of prompts
 * Key Features:
 * - Lists all prompts with search and filtering
 * - Allows creating, editing, and deleting prompts with undo functionality
 * - Supports categorization, sorting by name or token size
 * - Displays token counts for each prompt
 * - Quick copy functionality for prompt content
 * - Integrates with projects for task creation
 * 
 * Most Recent Changes:
 * - Added quick copy button for prompt content
 * - Added undo functionality for deleted prompts
 * - Added token counting functionality
 * - Added sorting options (alphabetical, size ascending/descending)
 * - Improved error handling
 */

import { createFileRoute } from '@tanstack/react-router'
import { useState, useMemo, useRef } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { toast } from 'sonner'
import { Prompt } from 'shared'
import { useGetPrompts, useCreatePrompt, useUpdatePrompt, useDeletePrompt } from '@/hooks/api/use-prompts-api'
import { useDebounce } from '@/hooks/utility-hooks/use-debounce'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator, DropdownMenuRadioGroup, DropdownMenuRadioItem } from '@/components/ui/dropdown-menu'
import { ArrowDownAZ, ArrowUpDown, Copy, Pencil } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { useCopyClipboard } from '@/hooks/utility-hooks/use-copy-clipboard'
import { Textarea } from '@/components/ui/textarea'
import { ExpandableTextarea } from '@/components/expandable-textarea'

// Utility function to estimate token count
function estimateTokenCount(text: string, charsPerToken: number = 4): number {
    const length = text?.length || 0
    if (length === 0 || charsPerToken <= 0) {
        return 0
    }
    return Math.ceil(length / charsPerToken)
}

// Utility function to format token count
function formatTokenCount(count: number): string {
    if (count >= 1000) {
        return (count / 1000).toFixed(2).replace(/\.?0+$/, '') + 'k'
    }
    return count.toString()
}

// API hooks for prompt management
function usePrompts() {
    const { data, isLoading, error } = useGetPrompts()
    const createPromptMutation = useCreatePrompt()
    const updatePromptMutation = useUpdatePrompt()
    const deletePromptMutation = useDeletePrompt()
    
    // Keep track of recently deleted prompts for undo functionality
    const recentlyDeletedPromptRef = useRef<Prompt | null>(null)

    return {
        prompts: data?.prompts ?? [],
        isLoading,
        error: error?.message ?? null,
        createPrompt: async (data: { name: string; content: string }) => {
            try {
                await createPromptMutation.mutateAsync(data)
                toast.success('Prompt created successfully')
            } catch (err) {
                toast.error('Failed to create prompt')
                throw err
            }
        },
        updatePrompt: async (promptId: string, data: { name?: string; content?: string }) => {
            try {
                await updatePromptMutation.mutateAsync({ promptId, data })
                toast.success('Prompt updated successfully')
            } catch (err) {
                toast.error('Failed to update prompt')
                throw err
            }
        },
        deletePrompt: async (promptId: string) => {
            try {
                // Save the prompt being deleted for potential undo operation
                const promptToDelete = data?.prompts.find(p => p.id === promptId) || null
                recentlyDeletedPromptRef.current = promptToDelete
                
                // Delete the prompt
                await deletePromptMutation.mutateAsync(promptId)
                
                // Show success toast with undo option
                toast.success('Prompt deleted', {
                    action: {
                        label: 'Undo',
                        onClick: async () => {
                            // Recover the deleted prompt if it exists
                            if (recentlyDeletedPromptRef.current) {
                                try {
                                    const recoveredPrompt = recentlyDeletedPromptRef.current
                                    // Use createPrompt to restore the deleted prompt with its original data
                                    await createPromptMutation.mutateAsync({
                                        name: recoveredPrompt.name,
                                        content: recoveredPrompt.content
                                    })
                                    toast.success('Prompt restored successfully')
                                    recentlyDeletedPromptRef.current = null
                                } catch (err) {
                                    toast.error('Failed to restore prompt')
                                }
                            }
                        }
                    },
                    duration: 5000 // Give user extra time to react
                })
            } catch (err) {
                toast.error('Failed to delete prompt')
                throw err
            }
        },
    }
}

export function PromptsPage() {
    const [searchQuery, setSearchQuery] = useState('')
    const debouncedSearch = useDebounce(searchQuery, 300)
    const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false)
    const [selectedPrompt, setSelectedPrompt] = useState<Prompt | null>(null)
    const [sortOrder, setSortOrder] = useState<"alphabetical" | "default" | "size_asc" | "size_desc">("alphabetical")

    const { prompts, isLoading, error, createPrompt, updatePrompt, deletePrompt } = usePrompts()

    // Filter and sort prompts
    const filteredAndSortedPrompts = useMemo(() => {
        // First filter by search query
        const filtered = prompts.filter(prompt =>
            prompt.name.toLowerCase().includes(debouncedSearch.toLowerCase()) ||
            prompt.content.toLowerCase().includes(debouncedSearch.toLowerCase())
        )
        
        // Then sort based on selected order
        let sorted = [...filtered]
        if (sortOrder === "alphabetical") {
            sorted.sort((a, b) => a.name.localeCompare(b.name))
        } else if (sortOrder === "size_desc") {
            sorted.sort((a, b) => estimateTokenCount(b.content) - estimateTokenCount(a.content))
        } else if (sortOrder === "size_asc") {
            sorted.sort((a, b) => estimateTokenCount(a.content) - estimateTokenCount(b.content))
        }
        
        return sorted
    }, [prompts, debouncedSearch, sortOrder])

    return (
        <div className="container mx-auto p-6 space-y-6">
            <div className="flex justify-between items-center">
                <h1 className="text-3xl font-bold">Prompt Management</h1>
                <Button onClick={() => setIsCreateDialogOpen(true)}>
                    Create New Prompt
                </Button>
            </div>

            <div className="flex items-center justify-between">
                <div className="flex items-center space-x-4">
                    <Input
                        placeholder="Search prompts..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="max-w-sm"
                    />
                    <Badge>{filteredAndSortedPrompts.length} Prompts</Badge>
                </div>
                
                <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                        <Button variant="outline" size="sm">
                            <ArrowUpDown className="h-4 w-4 mr-2" />
                            Sort
                        </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                        <DropdownMenuRadioGroup value={sortOrder} onValueChange={(value) => setSortOrder(value as any)}>
                            <DropdownMenuRadioItem value="alphabetical">
                                <ArrowDownAZ className="h-4 w-4 mr-2" />
                                Alphabetical
                            </DropdownMenuRadioItem>
                            <DropdownMenuRadioItem value="size_desc">Largest first</DropdownMenuRadioItem>
                            <DropdownMenuRadioItem value="size_asc">Smallest first</DropdownMenuRadioItem>
                            <DropdownMenuRadioItem value="default">Default order</DropdownMenuRadioItem>
                        </DropdownMenuRadioGroup>
                    </DropdownMenuContent>
                </DropdownMenu>
            </div>

            <Tabs defaultValue="all" className="w-full">
                <TabsList>
                    <TabsTrigger value="all">All Prompts</TabsTrigger>
                    <TabsTrigger value="favorites">Favorites</TabsTrigger>
                    <TabsTrigger value="recent">Recent</TabsTrigger>
                </TabsList>

                <TabsContent value="all" className="space-y-4">
                    {isLoading ? (
                        <div>Loading prompts...</div>
                    ) : error ? (
                        <div>Error loading prompts: {error}</div>
                    ) : (
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                            {filteredAndSortedPrompts.map((prompt) => (
                                <PromptCard
                                    key={prompt.id}
                                    prompt={prompt}
                                    onEdit={() => setSelectedPrompt(prompt)}
                                    onDelete={async () => {
                                        try {
                                            await deletePrompt(prompt.id)
                                        } catch {
                                            // Error is handled in usePrompts
                                        }
                                    }}
                                />
                            ))}
                        </div>
                    )}
                </TabsContent>
            </Tabs>

            {/* Create/Edit Dialog */}
            <PromptDialog
                open={isCreateDialogOpen || !!selectedPrompt}
                onOpenChange={(open) => {
                    if (!open) {
                        setIsCreateDialogOpen(false)
                        setSelectedPrompt(null)
                    }
                }}
                prompt={selectedPrompt}
                onSave={async (data) => {
                    try {
                        if (selectedPrompt) {
                            await updatePrompt(selectedPrompt.id, data)
                        } else {
                            await createPrompt(data)
                        }
                        setIsCreateDialogOpen(false)
                        setSelectedPrompt(null)
                    } catch {
                        // Error is handled in usePrompts
                    }
                }}
            />
        </div>
    )
}

// Prompt Card Component
interface PromptCardProps {
    prompt: {
        id: string
        name: string
        content: string
        createdAt: string | Date
    }
    onEdit: () => void
    onDelete: () => Promise<void>
}

function PromptCard({ prompt, onEdit, onDelete }: PromptCardProps) {
    const { copyToClipboard, status } = useCopyClipboard()
    
    const formatDate = (date: string | Date) => {
        try {
            return typeof date === 'string' 
                ? new Date(date).toLocaleDateString()
                : date.toLocaleDateString()
        } catch (e) {
            return 'Invalid date'
        }
    }
    
    const tokenCount = estimateTokenCount(prompt.content)
    
    // Determine token count color based on size
    const getTokenCountClass = () => {
        if (tokenCount > 3000) return "text-red-500"
        if (tokenCount > 1500) return "text-yellow-500"
        return "text-green-500"
    }

    const handleCopy = async () => {
        await copyToClipboard(prompt.content, {
            successMessage: `Copied "${prompt.name}" prompt content`,
            errorMessage: 'Failed to copy prompt content'
        })
    }

    return (
        <Card>
            <CardHeader>
                <div className="flex justify-between items-start">
                    <CardTitle>{prompt.name}</CardTitle>
                    <span className={`text-xs ${getTokenCountClass()}`}>
                        {formatTokenCount(tokenCount)} tokens
                    </span>
                </div>
                <CardDescription>Created: {formatDate(prompt.createdAt)}</CardDescription>
            </CardHeader>
            <CardContent>
                <p className="text-sm text-muted-foreground line-clamp-3">{prompt.content}</p>
            </CardContent>
            <CardFooter className="flex justify-end space-x-2">
                <Button 
                    variant="ghost" 
                    size="icon" 
                    onClick={handleCopy}
                    title="Copy prompt content"
                    className="h-8 w-8"
                >
                    <Copy className="h-4 w-4" />
                </Button>
                <Button 
                    variant="ghost" 
                    size="icon" 
                    onClick={onEdit}
                    title="Edit prompt"
                    className="h-8 w-8"
                >
                    <Pencil className="h-4 w-4" />
                </Button>
                <Button 
                    variant="destructive" 
                    size="sm" 
                    onClick={onDelete}
                >
                    Delete
                </Button>
            </CardFooter>
        </Card>
    )
}

// Prompt Dialog Component
interface PromptDialogProps {
    open: boolean
    onOpenChange: (open: boolean) => void
    prompt: Prompt | null
    onSave: (data: { name: string; content: string }) => Promise<void>
}

function PromptDialog({ open, onOpenChange, prompt, onSave }: PromptDialogProps) {
    const [name, setName] = useState(prompt?.name ?? '')
    const [content, setContent] = useState(prompt?.content ?? '')
    const [isSubmitting, setIsSubmitting] = useState(false)
    
    const tokenCount = useMemo(() => estimateTokenCount(content), [content])

    // Update form fields when prompt changes
    useMemo(() => {
        if (prompt) {
            setName(prompt.name || '')
            setContent(prompt.content || '')
        } else {
            setName('')
            setContent('')
        }
    }, [prompt])

    const handleSubmit = async () => {
        if (!name.trim()) {
            toast.error('Prompt name is required')
            return
        }
        
        try {
            setIsSubmitting(true)
            await onSave({ name, content })
        } finally {
            setIsSubmitting(false)
        }
    }

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>{prompt ? 'Edit Prompt' : 'Create New Prompt'}</DialogTitle>
                </DialogHeader>
                <div className="space-y-4">
                    <div>
                        <label className="text-sm font-medium">Name</label>
                        <Input
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            placeholder="Enter prompt name..."
                        />
                    </div>
                    <div>
                        <div className="flex justify-between items-center mb-1">
                            <label className="text-sm font-medium">Content</label>
                            <span className={`text-xs ${tokenCount > 3000 ? "text-red-500" : tokenCount > 1500 ? "text-yellow-500" : "text-green-500"}`}>
                                {formatTokenCount(tokenCount)} tokens
                            </span>
                        </div>
                        <ExpandableTextarea
                            value={content}
                            onChange={setContent}
                            className="min-h-[200px]"
                            placeholder="Enter prompt content..."
                            title="Edit Prompt Content"
                        />
                    </div>
                </div>
                <DialogFooter>
                    <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isSubmitting}>
                        Cancel
                    </Button>
                    <Button onClick={handleSubmit} disabled={isSubmitting}>
                        {isSubmitting ? 'Saving...' : prompt ? 'Update' : 'Create'}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    )
}

export const Route = createFileRoute('/prompts')({
    component: PromptsPage,
}) 