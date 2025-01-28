import React, { useState, useEffect } from "react";
import { Ticket } from "shared/schema";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "../ui/dialog";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../ui/select";
import { Textarea } from "../ui/textarea";
import { useCreateTicket, useUpdateTicket, useUpdateTicketSuggestedFiles, useSuggestFilesForTicket } from "../../hooks/api/use-tickets-api";
import { InfoTooltip } from "../info-tooltip";
import { TicketTasksPanel } from "./ticket-tasks-panel";
import { useGetProjectFiles } from "@/hooks/api/use-projects-api";
import { useCreateProjectTab } from "@/websocket-state/hooks/updaters/websocket-updater-hooks";

interface TicketDialogProps {
    isOpen: boolean;
    onClose: () => void;
    ticket: Ticket | null;     // If non-null, we are editing an existing ticket
    projectId: string;         // The project ID to which the ticket belongs
}

export function TicketDialog({ isOpen, onClose, ticket, projectId }: TicketDialogProps) {
    const createTicket = useCreateTicket();
    const updateTicket = useUpdateTicket();
    const updateSuggestedFiles = useUpdateTicketSuggestedFiles();
    const { data: fileData } = useGetProjectFiles(projectId);
    const createProjectTab = useCreateProjectTab();

    // Local form state
    const [title, setTitle] = useState("");
    const [overview, setOverview] = useState("");
    const [priority, setPriority] = useState<"low" | "normal" | "high">("normal");
    const [status, setStatus] = useState<"open" | "in_progress" | "closed">("open");
    const [selectedFileIds, setSelectedFileIds] = useState<string[]>([]);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const suggestFilesMutation = useSuggestFilesForTicket(ticket?.id ?? "");

    // On open/edit, populate form with existing ticket data or reset
    useEffect(() => {
        if (ticket) {
            setTitle(ticket.title);
            setOverview(ticket.overview ?? "");
            setPriority(ticket.priority as "low" | "normal" | "high");
            setStatus(ticket.status as "open" | "in_progress" | "closed");
            try {
                setSelectedFileIds(JSON.parse(ticket.suggestedFileIds || "[]"));
            } catch {
                setSelectedFileIds([]);
            }
        } else {
            setTitle("");
            setOverview("");
            setPriority("normal");
            setStatus("open");
            setSelectedFileIds([]);
        }
    }, [ticket]);

    async function handleSubmit(e: React.FormEvent) {
        e.preventDefault();
        if (isSubmitting) return;

        setIsSubmitting(true);
        try {
            if (ticket) {
                // Editing existing ticket
                await updateTicket.mutateAsync({
                    ticketId: ticket.id,
                    updates: {
                        title,
                        overview,
                        priority,
                        status,
                    },
                });

                // Also update suggested files if they've changed
                const currentFiles = JSON.parse(ticket.suggestedFileIds || "[]");
                if (JSON.stringify(currentFiles) !== JSON.stringify(selectedFileIds)) {
                    await updateSuggestedFiles.mutateAsync({
                        ticketId: ticket.id,
                        suggestedFileIds: selectedFileIds,
                    });
                }
            } else {
                // Creating a new ticket
                await createTicket.mutateAsync({
                    projectId,
                    title,
                    overview,
                    priority,
                    status,
                    suggestedFileIds: selectedFileIds,
                });
            }
            // Only close on successful submission
            onClose();
        } catch (err) {
            console.error("Failed to save ticket:", err);
            // Don't close on error
        } finally {
            setIsSubmitting(false);
        }
    }

    const handleClose = () => {
        if (!isSubmitting) {
            onClose();
        }
    };

    function toggleFile(fileId: string) {
        setSelectedFileIds((prev) => {
            if (prev.includes(fileId)) {
                return prev.filter((id) => id !== fileId);
            } else {
                return [...prev, fileId];
            }
        });
    }

    // 2) Handle "Suggest Files" response
    async function handleSuggestFiles() {
        if (!ticket) return;
        try {
            const res = await suggestFilesMutation.mutateAsync({ extraUserInput: overview });
            if (res?.recommendedFileIds) {
                setSelectedFileIds(res.recommendedFileIds);
            }
        } catch (err) {
            console.error("Failed to suggest files:", err);
        }
    }

    // 3) Open in Project Tab
    function handleOpenInProjectTab() {
        if (!ticket) return;
        // Build a default userPrompt – e.g. the ticket's title & overview
        const userPrompt = `Ticket: ${ticket.title}\n\n${ticket.overview}`;
        // Or include tasks from <TicketTasksPanel> if you want

        // Actually create the tab:
        createProjectTab({
            projectId: ticket.projectId,
            userPrompt,
            selectedFiles: selectedFileIds,     // from this ticket
            displayName: ticket.title ?? "New Tab"
        });
        // You could also close the dialog if desired:
        onClose();
    }

    return (
        <Dialog
            open={isOpen}
            onOpenChange={(open) => {
                if (!open && !isSubmitting) {
                    handleClose();
                }
            }}
            modal
        >
            <DialogContent
                className="sm:max-w-[650px]"
                onInteractOutside={(e) => {
                    e.preventDefault();
                }}
                onEscapeKeyDown={(e) => {
                    if (isSubmitting) {
                        e.preventDefault();
                    }
                }}
            >
                <DialogHeader>
                    <DialogTitle className="flex space-x-2 items-center">
                        <span>{ticket ? "Edit Ticket" : "Create New Ticket"}</span>
                        <InfoTooltip className="max-w-xs">
                            Providing a detailed overview helps auto-generate tasks & file suggestions!
                        </InfoTooltip>
                    </DialogTitle>
                </DialogHeader>

                <form onSubmit={handleSubmit} className="space-y-4 mt-4">
                    <div className="flex flex-col gap-2 md:flex-row">
                        <div className="w-full space-y-2">
                            <label htmlFor="title" className="text-sm font-medium">
                                Title
                            </label>
                            <Input
                                id="title"
                                value={title}
                                onChange={(e) => setTitle(e.target.value)}
                                required
                            />
                        </div>
                        <div className="w-full space-y-2">
                            <label htmlFor="priority" className="text-sm font-medium">
                                Priority
                            </label>
                            <Select
                                value={priority}
                                onValueChange={(val) => setPriority(val as "low" | "normal" | "high")}
                            >
                                <SelectTrigger>
                                    <SelectValue placeholder="Select priority" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="low">Low</SelectItem>
                                    <SelectItem value="normal">Medium</SelectItem>
                                    <SelectItem value="high">High</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="w-full space-y-2">
                            <label htmlFor="status" className="text-sm font-medium">
                                Status
                            </label>
                            <Select
                                value={status}
                                onValueChange={(val) => setStatus(val as "open" | "in_progress" | "closed")}
                            >
                                <SelectTrigger>
                                    <SelectValue placeholder="Select status" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="open">Open</SelectItem>
                                    <SelectItem value="in_progress">In Progress</SelectItem>
                                    <SelectItem value="closed">Closed</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                    </div>

                    <div className="space-y-2">
                        <label htmlFor="overview" className="text-sm font-medium">
                            Overview
                        </label>
                        <Textarea
                            id="overview"
                            value={overview}
                            onChange={(e) => setOverview(e.target.value)}
                            placeholder="Provide a detailed overview to help auto-generate tasks and file suggestions..."
                        />
                    </div>

                    {/* Multi-select checkboxes for suggested files */}
                    {/* <div className="space-y-2"> */}
                    {/* <label className="text-sm font-medium flex items-center gap-2">
                            Suggested Files
                            <InfoTooltip>
                                Select files relevant to this ticket. Or auto-fetch suggestions below.
                            </InfoTooltip>
                        </label> */}
                    {/* <div className="flex items-center gap-2"> */}
                    {/* <Button
                                type="button"
                                variant="secondary"
                                onClick={handleSuggestFiles}
                                disabled={!ticket || suggestFilesMutation.isPending}
                            >
                                {suggestFilesMutation.isPending ? "Suggesting..." : "Suggest"}
                            </Button> */}
                    {/* 
                            {ticket && (
                                <Button
                                    type="button"
                                    variant="outline"
                                    onClick={handleOpenInProjectTab}
                                    title="Open a new project tab with these files"
                                >
                                    Open in Project Tab
                                </Button>
                            )} */}
                    {/* </div> */}
                    {/* <ScrollArea className="h-48 border rounded-md mt-1">
                            <div className="p-2">
                                {allFiles.map((file) => {
                                    const checked = selectedFileIds.includes(file.id);
                                    return (
                                        <label key={file.id} className="flex items-center gap-2 py-1">
                                            <Checkbox
                                                checked={checked}
                                                onCheckedChange={() => toggleFile(file.id)}
                                            />
                                            <span className="text-sm">{file.path}</span>
                                        </label>
                                    );
                                })}
                            </div>
                        </ScrollArea> */}
                    {/* </div> */}

                    {/* Render tasks panel only if editing an existing ticket */}
                    {ticket && (
                        <TicketTasksPanel ticketId={ticket.id} overview={overview} />
                    )}

                    <div className="flex justify-end space-x-2">
                        <Button
                            type="button"
                            variant="outline"
                            onClick={handleClose}
                            disabled={isSubmitting}
                        >
                            Cancel
                        </Button>
                        <Button
                            type="submit"
                            disabled={isSubmitting}
                        >
                            {isSubmitting ? "Saving..." : ticket ? "Update" : "Create"}
                        </Button>
                    </div>
                </form>
            </DialogContent>
        </Dialog>
    );
}