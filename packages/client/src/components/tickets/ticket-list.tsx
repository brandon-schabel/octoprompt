import { Ticket } from "@/generated";
import { Badge } from '@ui';

interface TicketListProps {
    tickets: Ticket[];
    selectedTicket: Ticket | null;
    onSelectTicket: (ticket: Ticket) => void;
}

export function TicketList({
    tickets,
    selectedTicket,
    onSelectTicket,
}: TicketListProps) {
    // Simple color-mapping for priority or status:
    const priorityColor: Record<string, string> = {
        low: "bg-green-200 text-green-900",
        normal: "bg-yellow-200 text-yellow-900",
        high: "bg-red-200 text-red-900",
    };
    const statusColor: Record<string, string> = {
        open: "bg-blue-200 text-blue-900",
        in_progress: "bg-orange-200 text-orange-900",
        closed: "bg-gray-300 text-gray-700 line-through",
    };

    return (
        <div className="space-y-2">
            {tickets.map((ticket) => {
                const isSelected = selectedTicket?.id === ticket.id;
                const pClass = priorityColor[ticket.priority || "normal"] ?? "bg-muted";
                const sClass = statusColor[ticket.status || "open"] ?? "bg-muted";

                return (
                    <div
                        key={ticket.id}
                        className={`p-4 rounded-md cursor-pointer transition-colors ${isSelected ? "bg-accent" : "bg-card hover:bg-card/80"
                            }`}
                        onClick={() => onSelectTicket(ticket)}
                    >
                        <div className="flex justify-between items-center">
                            <h3 className="font-semibold">{ticket.title}</h3>
                            <div className="space-x-2 flex items-center">
                                <Badge
                                    variant="secondary"
                                    className={`capitalize ${pClass}`}
                                >
                                    {(ticket.priority || "normal") === "normal" ? "medium" : ticket.priority || "normal"}
                                </Badge>
                                <Badge
                                    variant="secondary"
                                    className={`uppercase ${sClass}`}
                                >
                                    {(ticket.status || "open").replace("_", " ")}
                                </Badge>
                            </div>
                        </div>
                        <p className="text-sm text-muted-foreground mt-2">{ticket.overview}</p>
                    </div>
                );
            })}
        </div>
    );
}