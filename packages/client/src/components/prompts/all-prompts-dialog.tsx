import React, { useEffect, useState, useMemo } from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { useGetAllPrompts } from "@/hooks/api/use-prompts-api" // a new custom hook or simply re-use the same if you have it
import { AlertCircle } from "lucide-react"
import { Prompt } from "shared"
import { toast } from "sonner"

interface PromptsDialogAllProps {
    open: boolean;
    onClose: () => void;
    selectedProjectId: string | null;
}

export function PromptsDialogAll({
    open,
    onClose,
    selectedProjectId,
}: PromptsDialogAllProps) {
    const { data, isLoading, error } = useGetAllPrompts();
    const [searchTerm, setSearchTerm] = useState("");

    const prompts: Prompt[] = data?.prompts || [];

    // Filter and sort
    const filteredPrompts = useMemo(() => {
        const lower = searchTerm.toLowerCase();
        return prompts
            .filter((p) =>
                p.name.toLowerCase().includes(lower) || p.content.toLowerCase().includes(lower)
            )
            .sort((a, b) => a.name.localeCompare(b.name)); // alphabetical
    }, [prompts, searchTerm]);

    /**
     * Example: 
     * A function to add a prompt to the project (server route: /api/projects/:projectId/prompts/:promptId)
     * We'll do an optimistic approach or just call fetch.
     */
    async function handleAddPromptToProject(promptId: string) {
        if (!selectedProjectId) {
            toast.error("No project selected!");
            return;
        }
        try {
            const res = await fetch(`/api/projects/${selectedProjectId}/prompts/${promptId}`, {
                method: "POST",
            });
            if (!res.ok) {
                toast.error("Failed to add prompt to project");
                return;
            }
            toast.success("Prompt added to project!");
            // optionally call `sendMessage` or any other approach to update globalState
        } catch (err) {
            console.error(err);
            toast.error("Error adding prompt to project");
        }
    }

    return (
        <Dialog open={open} onOpenChange={onClose}>
            <DialogContent className="max-w-xl">
                <DialogHeader>
                    <DialogTitle>All Prompts</DialogTitle>
                    <DialogDescription>
                        Search any existing prompt and add them to the project
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
                        {filteredPrompts.map((prompt) => (
                            <div key={prompt.id} className="flex items-center justify-between gap-2 p-1 hover:bg-muted/50 rounded">
                                <div className="flex flex-col">
                                    <span className="font-medium text-sm">{prompt.name}</span>
                                    <span className="text-xs text-muted-foreground line-clamp-2">
                                        {prompt.content.slice(0, 100)}...
                                    </span>
                                </div>
                                <Button
                                    size="sm"
                                    onClick={() => void handleAddPromptToProject(prompt.id)}
                                >
                                    Add
                                </Button>
                            </div>
                        ))}
                    </div>
                </div>

                <DialogFooter>
                    <Button variant="outline" onClick={onClose}>Close</Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}