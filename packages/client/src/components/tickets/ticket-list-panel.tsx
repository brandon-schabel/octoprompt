import React, { useMemo, useCallback } from "react";
import { useListTicketsWithTasks, useDeleteTicket } from "@/hooks/api/use-tickets-api";
import { useUpdateProjectTabState, } from "@/hooks/api/global-state/updaters";
import { Button } from "@ui";
import { Input } from '@ui';
import { Badge } from "@ui";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@ui";
import { Copy, Filter, FileText, Trash2, ExternalLink } from "lucide-react";
import { ScrollArea } from "@ui";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { buildTicketContent } from "./utils/ticket-utils";
import { Progress } from "@ui";
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from "@ui";
import { useState } from "react";
import { useNavigate } from '@tanstack/react-router';
import { useProjectTab } from "@/hooks/api/global-state/selectors";
import { TicketWithTasks } from "@/hooks/generated";

interface TicketListPanelProps {
    projectTabId: string;
    onSelectTicket?: (ticket: TicketWithTasks) => void;
}

function snippet(text: string, max = 80): string {
    if (!text) return "";
    if (text.length <= max) return text;
    return text.slice(0, max) + "...";
}

const STATUS_COLORS = {
    open: "bg-blue-500/10 text-blue-700 dark:text-blue-400",
    in_progress: "bg-yellow-500/10 text-yellow-700 dark:text-yellow-400",
    closed: "bg-green-500/10 text-green-700 dark:text-green-400",
} as const;

const PRIORITY_COLORS = {
    low: "bg-gray-500/10 text-gray-700 dark:text-gray-400",
    normal: "bg-blue-500/10 text-blue-700 dark:text-blue-400",
    high: "bg-red-500/10 text-red-700 dark:text-red-400",
} as const;

export function TicketListPanel({ projectTabId, onSelectTicket }: TicketListPanelProps) {
    const navigate = useNavigate();
    const updateProjectTabState = useUpdateProjectTabState(projectTabId);
    const tabState = useProjectTab(projectTabId)
    const projectId = tabState?.selectedProjectId || "";

    // Read from the global tabState
    const ticketSearch = tabState?.ticketSearch ?? "";
    const ticketSort = tabState?.ticketSort ?? "created_desc";
    const ticketStatus = tabState?.ticketStatusFilter ?? "all";

    // Update state handlers
    const setTicketSearch = useCallback((val: string) => {
        updateProjectTabState({ ticketSearch: val });
    }, [projectTabId, updateProjectTabState]);

    const setTicketSort = useCallback((val: string) => {
        updateProjectTabState({ ticketSort: val as any });
    }, [projectTabId, updateProjectTabState]);

    const setTicketStatusFilter = useCallback((val: string) => {
        // Reset search when changing status filter
        updateProjectTabState({
            ticketStatusFilter: val as any,
            ticketSearch: ""
        });
    }, [projectTabId, updateProjectTabState]);

    // Load tickets with their tasks from the server
    const { data, isLoading, error } = useListTicketsWithTasks(projectId, ticketStatus);
    const tickets = (data?.ticketsWithTasks ?? []) as TicketWithTasks[];

    // Copy all ticket content
    const handleCopyAll = useCallback(async (e: React.MouseEvent, ticket: TicketWithTasks) => {
        e.stopPropagation();
        try {
            const content = buildTicketContent(ticket.ticket, ticket.tasks);
            await navigator.clipboard.writeText(content);
            toast.success("Copied ticket content!");
        } catch (err) {
            toast.error("Failed to copy ticket content");
            console.error(err);
        }
    }, []);

    // Filter by text
    const filtered = useMemo(() => {
        if (!ticketSearch.trim()) return tickets;
        const lower = ticketSearch.toLowerCase();
        return tickets.filter(t => {
            
            return (
                t.ticket.title.toLowerCase().includes(lower) ||
                t.ticket.overview?.toLowerCase().includes(lower)
            );
        });
    }, [tickets, ticketSearch]);

    // Sort based on ticketSort
    const sorted = useMemo(() => {
        const arr = [...filtered];
        switch (ticketSort) {
            case "created_asc":
                return arr.sort((a, b) => {
                    const aTime = a.ticket.createdAt ? new Date(a.ticket.createdAt).getTime() : 0;
                    const bTime = b.ticket.createdAt ? new Date(b.ticket.createdAt).getTime() : 0;
                    return aTime - bTime;
                });
            case "created_desc":
                return arr.sort((a, b) => {
                    const aTime = a.ticket.createdAt ? new Date(a.ticket.createdAt).getTime() : 0;
                    const bTime = b.ticket.createdAt ? new Date(b.ticket.createdAt).getTime() : 0;
                    return bTime - aTime;
                });
            case "status":
                return arr.sort((a, b) => {
                    const statusOrder = { open: 1, in_progress: 2, closed: 3 };
                    const aStatus = a.ticket.status as keyof typeof statusOrder;
                    const bStatus = b.ticket.status as keyof typeof statusOrder;
                    return (statusOrder[aStatus] || 0) - (statusOrder[bStatus] || 0);
                });
            case "priority":
                return arr.sort((a, b) => {
                    const priorityOrder = { low: 1, normal: 2, high: 3 };
                    const aPriority = a.ticket.priority as keyof typeof priorityOrder;
                    const bPriority = b.ticket.priority as keyof typeof priorityOrder;
                    return (priorityOrder[bPriority] || 2) - (priorityOrder[aPriority] || 2); // default to normal priority
                });
            default:
                return arr;
        }
    }, [filtered, ticketSort]);

    // Copy function
    const copyOverview = useCallback((e: React.MouseEvent, overview: string) => {
        e.stopPropagation();
        navigator.clipboard.writeText(overview).then(() => {
            toast.success("Copied ticket overview!");
        });
    }, []);

    const [ticketToDelete, setTicketToDelete] = useState<TicketWithTasks | null>(null);
    const deleteTicket = useDeleteTicket(projectId);

    const handleDeleteTicket = useCallback(async (e: React.MouseEvent, ticket: TicketWithTasks) => {
        e.stopPropagation();
        setTicketToDelete(ticket);
    }, []);

    const confirmDelete = useCallback(async () => {
        if (!ticketToDelete) return;

        try {
            await deleteTicket.mutateAsync(ticketToDelete.ticket.id);
            toast.success("Ticket deleted successfully");
        } catch (err) {
            toast.error("Failed to delete ticket");
            console.error(err);
        } finally {
            setTicketToDelete(null);
        }
    }, [ticketToDelete, deleteTicket]);

    // Calculate task completion for a ticket
    const getTaskCompletion = useCallback((ticket: TicketWithTasks) => {
        const totalTasks = ticket.tasks.length;
        const completedTasks = ticket.tasks.filter(task => task.done).length;
        const percentage = totalTasks === 0 ? 0 : Math.round((completedTasks / totalTasks) * 100);
        return { completedTasks, totalTasks, percentage };
    }, []);

    return (
        <div className="flex flex-col h-full border rounded-md">
            {/* Toolbar header */}
            <div className="flex items-center gap-2 p-3 border-b">
                <Filter className="mr-1 h-4 w-4 text-muted-foreground" />
                <Input
                    placeholder="Filter tickets..."
                    value={ticketSearch}
                    onChange={(e) => setTicketSearch(e.target.value)}
                    className="max-w-xs"
                />

                <Select value={ticketStatus} onValueChange={setTicketStatusFilter}>
                    <SelectTrigger className="w-[140px] text-sm">
                        <SelectValue placeholder="Status Filter" />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="all">All</SelectItem>
                        <SelectItem value="open">Open</SelectItem>
                        <SelectItem value="in_progress">In Progress</SelectItem>
                        <SelectItem value="closed">Closed</SelectItem>
                    </SelectContent>
                </Select>

                <Select value={ticketSort} onValueChange={setTicketSort}>
                    <SelectTrigger className="w-[140px] text-sm">
                        <SelectValue placeholder="Sort By" />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="created_desc">Newest First</SelectItem>
                        <SelectItem value="created_asc">Oldest First</SelectItem>
                        <SelectItem value="status">Status</SelectItem>
                        <SelectItem value="priority">Priority</SelectItem>
                    </SelectContent>
                </Select>
            </div>

            {/* Main scroll area */}
            <ScrollArea className="flex-1 p-3">
                {isLoading && <p className="text-sm text-muted-foreground">Loading tickets...</p>}
                {error && <p className="text-sm text-red-500">Error loading tickets</p>}
                {!isLoading && !error && sorted.length === 0 && (
                    <p className="text-sm text-muted-foreground">No tickets found.</p>
                )}

                <div className="space-y-2">
                    {sorted.map(ticket => {
                        const { completedTasks, totalTasks, percentage } = getTaskCompletion(ticket);

                        return (
                            <div
                                key={ticket.ticket.id}
                                className="border rounded-md p-3 bg-card hover:bg-card/80 transition-colors cursor-pointer group"
                                onClick={() => onSelectTicket?.(ticket)}
                            >
                                <div className="flex items-center justify-between">
                                    <h2 className="font-semibold">
                                        {ticket.ticket.title}
                                    </h2>
                                    <Badge variant="secondary">
                                        {completedTasks}/{totalTasks} tasks
                                    </Badge>
                                </div>
                                <div className="mt-1 text-sm text-muted-foreground">
                                    {snippet(ticket.ticket.overview ?? "", 100)}
                                </div>
                                <div className="mt-2 mb-2">
                                    <Progress
                                        value={percentage}
                                        variant="fullness"
                                        className="h-1"
                                    />
                                </div>
                                <div className="mt-2 flex items-center justify-between">
                                    <div className="flex items-center gap-2">
                                        <Badge
                                            className={cn(
                                                PRIORITY_COLORS[ticket.ticket.priority as keyof typeof PRIORITY_COLORS] || PRIORITY_COLORS.normal
                                            )}
                                        >
                                            {ticket.ticket.priority || "normal"}
                                        </Badge>
                                        <Badge
                                            className={cn(
                                                STATUS_COLORS[ticket.ticket.status as keyof typeof STATUS_COLORS] || STATUS_COLORS.open
                                            )}
                                        >
                                            {ticket.ticket.status?.replace("_", " ").toUpperCase()}
                                        </Badge>    
                                    </div>
                                    <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                        <Button
                                            variant="ghost"
                                            size="sm"
                                            onClick={(e) => copyOverview(e, ticket.ticket.overview ?? "")}
                                        >
                                            <Copy className="h-4 w-4 mr-1" />
                                            Copy Overview
                                        </Button>
                                        <Button
                                            variant="ghost"
                                            size="sm"
                                            onClick={(e) => handleCopyAll(e, ticket)}
                                        >
                                            <FileText className="h-4 w-4 mr-1" />
                                            Copy All
                                        </Button>
                                        <Button
                                            variant="ghost"
                                            size="sm"
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                navigate({ to: '/projects' });
                                            }}
                                        >
                                            <ExternalLink className="h-4 w-4 mr-1" />
                                            Open in Project Tab
                                        </Button>
                                        <Button
                                            variant="ghost"
                                            size="sm"
                                            className="text-destructive hover:text-destructive"
                                            onClick={(e) => handleDeleteTicket(e, ticket)}
                                        >
                                            <Trash2 className="h-4 w-4 mr-1" />
                                            Delete
                                        </Button>
                                    </div>
                                </div>
                            </div>
                        );
                    })}
                </div>
            </ScrollArea>

            <AlertDialog open={!!ticketToDelete} onOpenChange={(open) => !open && setTicketToDelete(null)}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Are you sure you want to delete this ticket?</AlertDialogTitle>
                        <AlertDialogDescription>
                            This action cannot be undone. This will permanently delete the ticket
                            "{ticketToDelete?.ticket.title}" and all its associated tasks.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction
                            onClick={confirmDelete}
                            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                        >
                            Delete
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </div>
    );
} 