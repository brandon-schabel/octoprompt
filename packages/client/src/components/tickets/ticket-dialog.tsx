import React, { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@ui";
import { Button } from "@ui";
import { Input } from '@ui';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@ui";
import { Textarea } from "@ui";
import { useCreateTicket, useUpdateTicket, useSuggestFilesForTicket } from "../../hooks/api/use-tickets-api";
import { OctoTooltip } from "../octo/octo-tooltip";
import { TicketTasksPanel } from "./ticket-tasks-panel";
import type { TicketWithTasks } from "@/generated";

interface TicketDialogProps {
    isOpen: boolean;
    onClose: () => void;
    ticketWithTasks: TicketWithTasks | null;
    projectId: string;
}


export function TicketDialog({ isOpen, onClose, ticketWithTasks: ticketWithTasks, projectId }: TicketDialogProps) {
    const createTicket = useCreateTicket(projectId);
    const updateTicket = useUpdateTicket(projectId);

    const [title, setTitle] = useState("");
    const [overview, setOverview] = useState("");
    const [priority, setPriority] = useState<"low" | "normal" | "high">("normal");
    const [status, setStatus] = useState<"open" | "in_progress" | "closed">("open");
    const [selectedFileIds, setSelectedFileIds] = useState<string[]>([]);
    const [isSubmitting, setIsSubmitting] = useState(false);

    useEffect(() => {
        if (ticketWithTasks) {
            setTitle(ticketWithTasks.ticket.title);
            setOverview(ticketWithTasks.ticket.overview ?? "");
            setPriority(ticketWithTasks.ticket.priority as "low" | "normal" | "high");
            setStatus(ticketWithTasks.ticket.status as "open" | "in_progress" | "closed");
            try {
                setSelectedFileIds(JSON.parse(ticketWithTasks.ticket.suggestedFileIds || "[]"));
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
    }, [ticketWithTasks]);

    async function handleSubmit(e: React.FormEvent) {
        e.preventDefault();
        if (isSubmitting) return;

        setIsSubmitting(true);
        try {
            if (ticketWithTasks) {
                // Editing existing ticket
                await updateTicket.mutateAsync({
                    ticketId: ticketWithTasks.ticket.id,
                    updates: {
                        title,
                        overview,
                        priority,
                        status,
                    },
                });
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
                        <span>{ticketWithTasks ? "Edit Ticket" : "Create New Ticket"}</span>
                        <OctoTooltip className="max-w-xs">
                            Providing a detailed overview helps auto-generate tasks & file suggestions!
                        </OctoTooltip>
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
                    {ticketWithTasks && (
                        <TicketTasksPanel ticketId={ticketWithTasks.ticket.id} overview={overview} />
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
                            {isSubmitting ? "Saving..." : ticketWithTasks ? "Update" : "Create"}
                        </Button>
                    </div>
                </form>
            </DialogContent>
        </Dialog>
    );
}