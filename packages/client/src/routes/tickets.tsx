import React from "react";
import { createFileRoute } from "@tanstack/react-router";
import { TicketDialog } from "../components/tickets/ticket-dialog";
import { Button } from "../components/ui/button";
import { Plus } from "lucide-react";
import { useGlobalStateHelpers } from "../components/global-state/use-global-state-helpers";
import { useGetProject } from "@/hooks/api/use-projects-api";
import { TicketListPanel } from "@/components/tickets/ticket-list-panel";
import type { TicketWithCount } from "@/hooks/api/use-tickets-api";

export const Route = createFileRoute("/tickets")({
    component: TicketsPage,
});

function TicketsPage() {
    const [isDialogOpen, setIsDialogOpen] = React.useState(false);
    const [selectedTicket, setSelectedTicket] = React.useState<TicketWithCount | null>(null);

    // Get active project ID from global state
    const { state } = useGlobalStateHelpers();
    const projectId = state.projectTabs[state.projectActiveTabId || ""]?.selectedProjectId ?? null;

    const { data: projectData, isPending: isProjectLoading, error: projectError } = useGetProject(projectId ?? "");

    const handleSelectTicket = React.useCallback((ticket: TicketWithCount) => {
        setSelectedTicket(ticket);
        setIsDialogOpen(true);
    }, []);

    const handleCloseDialog = React.useCallback(() => {
        setIsDialogOpen(false);
        setSelectedTicket(null);
    }, []);

    if (!projectId) {
        return (
            <div className="p-4">
                <h2 className="text-xl font-bold">No project selected</h2>
                <p>Select a project to view tickets.</p>
            </div>
        );
    }

    if (isProjectLoading) return <div className="p-4">Loading project info...</div>;
    if (projectError) return <div className="p-4 text-red-500">Error loading project</div>;

    return (
        <div className="p-4 space-y-4 h-full flex flex-col">
            {/* Page Header */}
            <div className="flex items-center justify-between">
                <h2 className="text-2xl font-bold">
                    Tickets for {projectData?.project?.name}
                </h2>
                <Button onClick={() => setIsDialogOpen(true)}>
                    <Plus className="mr-2 h-4 w-4" />
                    New Ticket
                </Button>
            </div>

            {/* Panel for sorting/filtering tickets, with tasks count, etc. */}
            <div className="flex-1">
                <TicketListPanel 
                    projectTabId={state.projectActiveTabId || "defaultTab"} 
                    onSelectTicket={handleSelectTicket}
                />
            </div>

            {/* Dialog for creating/editing a ticket */}
            <TicketDialog
                isOpen={isDialogOpen}
                onClose={handleCloseDialog}
                ticket={selectedTicket}
                projectId={projectId}
            />
        </div>
    );
}

export default TicketsPage;

