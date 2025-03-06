import React, { useEffect, useState, useMemo } from "react"
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
    DialogFooter
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { AlertCircle } from "lucide-react"
import { toast } from "sonner"
import { Prompt } from "shared"

import { useGetAllPrompts, useGetProjectPrompts, useAddPromptToProject, useRemovePromptFromProject } from "@/hooks/api/use-prompts-api"

interface PromptsDialogAllProps {
    open: boolean
    onClose: () => void
    selectedProjectId: string | null
}

export function PromptsDialogAll({
    open,
    onClose,
    selectedProjectId,
}: PromptsDialogAllProps) {
    const { data, isLoading, error } = useGetAllPrompts()
    const { data: projectPromptData } = useGetProjectPrompts(selectedProjectId ?? "")
    const addPromptToProject = useAddPromptToProject()
    const removePromptFromProject = useRemovePromptFromProject()

    const [searchTerm, setSearchTerm] = useState("")

    const allPrompts = data?.prompts ?? []
    const projectPrompts = projectPromptData?.prompts ?? []

    // Filter & sort
    const filteredPrompts = useMemo(() => {
        const lower = searchTerm.toLowerCase()
        return allPrompts
            .filter((p) =>
                p.name.toLowerCase().includes(lower) || p.content.toLowerCase().includes(lower)
            )
            .sort((a, b) => a.name.localeCompare(b.name))
    }, [allPrompts, searchTerm])

    // Check if a prompt is in the project
    function isPromptInProject(promptId: string): boolean {
        return projectPrompts.some((pp) => pp.id === promptId)
    }

    async function handleAddPromptToProject(promptId: string) {
        if (!selectedProjectId) {
            toast.error("No project selected!")
            return
        }
        try {
            await addPromptToProject.mutateAsync({ promptId, projectId: selectedProjectId })
            toast.success("Prompt added to project!")
        } catch (err: any) {
            toast.error(err.message || "Failed to add prompt to project")
        }
    }

    async function handleRemovePromptFromProject(promptId: string) {
        if (!selectedProjectId) {
            toast.error("No project selected!")
            return
        }
        try {
            await removePromptFromProject.mutateAsync({ promptId, projectId: selectedProjectId })
            toast.success("Prompt removed from project!")
        } catch (err: any) {
            toast.error(err.message || "Failed to remove prompt from project")
        }
    }

    return (
        <Dialog open={open} onOpenChange={onClose}>
            <DialogContent className="max-w-xl">
                <DialogHeader>
                    <DialogTitle>All Prompts</DialogTitle>
                    <DialogDescription>
                        Search or browse existing prompts, and add or remove them from the current project.
                    </DialogDescription>
                </DialogHeader>

                <div className="flex flex-col gap-2">
                    <Input
                        placeholder="Search prompts..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                    />
                    {isLoading && <span>Loading prompts...</span>}
                    {error && (
                        <div className="text-red-500 flex gap-2">
                            <AlertCircle className="h-5 w-5" />
                            Error loading prompts
                        </div>
                    )}

                    <div className="max-h-64 overflow-y-auto border rounded p-2">
                        {filteredPrompts.map((prompt) => {
                            const inProject = isPromptInProject(prompt.id)
                            return (
                                <div
                                    key={prompt.id}
                                    className="flex items-center justify-between gap-2 p-1 hover:bg-muted/50 rounded"
                                >
                                    <div className="flex flex-col">
                                        <span className="font-medium text-sm">{prompt.name}</span>
                                        <span className="text-xs text-muted-foreground line-clamp-2">
                                            {prompt.content.slice(0, 100)}...
                                        </span>
                                    </div>
                                    {inProject ? (
                                        <Button
                                            size="sm"
                                            variant="destructive"
                                            onClick={() => void handleRemovePromptFromProject(prompt.id)}
                                            disabled={removePromptFromProject.isPending}
                                        >
                                            Remove
                                        </Button>
                                    ) : (
                                        <Button
                                            size="sm"
                                            onClick={() => void handleAddPromptToProject(prompt.id)}
                                            disabled={addPromptToProject.isPending}
                                        >
                                            Add
                                        </Button>
                                    )}
                                </div>
                            )
                        })}
                    </div>
                </div>

                <DialogFooter>
                    <Button variant="outline" onClick={onClose}>
                        Close
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    )
}