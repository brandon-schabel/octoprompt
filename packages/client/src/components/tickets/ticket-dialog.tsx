/* packages/client/src/components/tickets/ticket-dialog.tsx */
import React, { useState, useEffect } from "react";
import { Ticket } from "shared/schema";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "../ui/dialog";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../ui/select";
import { Textarea } from "../ui/textarea";
import { useCreateTicket, useUpdateTicket } from "../../hooks/api/use-tickets-api";
import { InfoTooltip } from "../info-tooltip";
import { TicketTasksPanel } from "./ticket-tasks-panel";

interface TicketDialogProps {
    isOpen: boolean;
    onClose: () => void;
    ticket: Ticket | null;     // If non-null, we are editing an existing ticket
    projectId: string;         // The project ID to which the ticket belongs
}

export function TicketDialog({ isOpen, onClose, ticket, projectId }: TicketDialogProps) {
    const createTicket = useCreateTicket();
    const updateTicket = useUpdateTicket();

    // Local form state
    const [title, setTitle] = useState("");
    const [overview, setOverview] = useState("");
    const [priority, setPriority] = useState<"low" | "normal" | "high">("normal");
    const [status, setStatus] = useState<"open" | "in_progress" | "closed">("open");

    // On open/edit, populate form with existing ticket data or reset
    useEffect(() => {
        if (ticket) {
            setTitle(ticket.title);
            setOverview(ticket.overview ?? "");
            setPriority(ticket.priority as "low" | "normal" | "high");
            setStatus(ticket.status as "open" | "in_progress" | "closed");
        } else {
            setTitle("");
            setOverview("");
            setPriority("normal");
            setStatus("open");
        }
    }, [ticket]);

    async function handleSubmit(e: React.FormEvent) {
        e.preventDefault();
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
            } else {
                // Creating a new ticket
                await createTicket.mutateAsync({
                    projectId,
                    title,
                    overview,
                    priority,
                    status,
                });
            }
            onClose();
        } catch (err) {
            console.error("Failed to save ticket:", err);
        }
    }

    return (
        <Dialog 
            open={isOpen} 
            onOpenChange={(open) => {
                if (!open) onClose();
            }}
            modal
        >
            <DialogContent 
                className="sm:max-w-[650px]" 
                onInteractOutside={(e) => {
                    e.preventDefault();
                }}
            >
                <DialogHeader>
                    <DialogTitle className="flex space-x-2 items-center">
                        <span>{ticket ? "Edit Ticket" : "Create New Ticket"}</span>
                        <InfoTooltip className="max-w-xs">
                            Providing a detailed overview helps auto-generate tasks!
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
                            placeholder="Provide a detailed overview to help auto-generate tasks..."
                        />
                    </div>

                    {/* Render tasks panel only if editing an existing ticket */}
                    {ticket && (
                        <TicketTasksPanel ticketId={ticket.id} overview={overview} />
                    )}

                    <div className="flex justify-end space-x-2">
                        <Button variant="outline" onClick={onClose}>
                            Cancel
                        </Button>
                        <Button type="submit">
                            {ticket ? "Update" : "Create"}
                        </Button>
                    </div>
                </form>
            </DialogContent>
        </Dialog>
    );
}