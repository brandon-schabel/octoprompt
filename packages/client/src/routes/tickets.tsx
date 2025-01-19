import React from "react";
import { createFileRoute } from "@tanstack/react-router";
import { TicketList } from "../components/tickets/ticket-list";
import { TicketDialog } from "../components/tickets/ticket-dialog";
import { TicketEmptyState } from "../components/tickets/ticket-empty-state";
import { Button } from "../components/ui/button";
import { Plus } from "lucide-react";
import { Ticket } from "shared/schema";
import { useListTickets } from "../hooks/api/use-tickets-api";
import { useGlobalStateHelpers } from "../components/global-state/use-global-state-helpers";
import { useGetProject } from "@/hooks/api/use-projects-api";

export const Route = createFileRoute("/tickets")({
    component: TicketsPage,
});

function TicketsPage() {
    const [selectedTicket, setSelectedTicket] = React.useState<Ticket | null>(null);
    const [isDialogOpen, setIsDialogOpen] = React.useState(false);

    // Grab active project ID from global state
    const { activeProjectTabState } = useGlobalStateHelpers();
    const projectId = activeProjectTabState?.selectedProjectId ?? "";

    const { data: projectData, isPending: isProjectLoading, error: projectError } = useGetProject(projectId);

    // Query for tickets
    const { data, isLoading, error } = useListTickets(projectId);
    const tickets = data?.tickets ?? [];

    function handleOpenDialog(ticket?: Ticket) {
        setSelectedTicket(ticket || null);
        setIsDialogOpen(true);
    }

    if (!projectId) {
        return (
            <div className="p-4">
                <h2 className="text-xl font-bold">No project selected</h2>
                <p>Select a project to view tickets.</p>
            </div>
        );
    }

    if (isLoading || isProjectLoading) return <div className="p-4">Loading tickets...</div>;
    if (error || projectError) return <div className="p-4 text-red-500">Error loading tickets</div>;

    return (
        <div className="p-4 space-y-4">
            {/* Page Header */}
            <div className="flex items-center justify-between">
                <h2 className="text-2xl font-bold">
                    Tickets for {projectData.project?.name}
                </h2>
                <Button onClick={() => handleOpenDialog()}>
                    <Plus className="mr-2 h-4 w-4" />
                    New Ticket
                </Button>
            </div>

            {/* If there are no tickets, show empty state. Otherwise, show TicketList. */}
            {tickets.length === 0 ? (
                <TicketEmptyState onCreateTicket={() => handleOpenDialog()} />
            ) : (
                <TicketList
                    tickets={tickets}
                    selectedTicket={selectedTicket}
                    onSelectTicket={(ticket) => handleOpenDialog(ticket)}
                />
            )}

            {/* Dialog for creating or editing a ticket */}
            <TicketDialog
                isOpen={isDialogOpen}
                onClose={() => {
                    setIsDialogOpen(false);
                    setSelectedTicket(null);
                }}
                ticket={selectedTicket}
                projectId={projectId}
            />
        </div>
    );
}

export default TicketsPage;

