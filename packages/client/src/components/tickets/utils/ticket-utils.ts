import type { TicketWithCount, TicketWithTasks } from "@/hooks/api/use-tickets-api";
import type { TicketTask } from "shared/schema";
import type { Ticket } from "shared/schema";

export function buildTicketContent(
    ticket: Ticket & { tasks?: TicketTask[] },
    tasks?: TicketTask[]
): string {
    let content = '';

    // Title as H1
    content += `# ${ticket.title}\n\n`;

    // Overview section
    if (ticket.overview) {
        content += `## Overview\n${ticket.overview}\n\n`;
    }

    // Metadata section
    content += `## Metadata\n`;
    content += `- **Status:** ${ticket.status.replace('_', ' ').toUpperCase()}\n`;
    content += `- **Priority:** ${ticket.priority.toUpperCase()}\n`;
    content += `- **Created:** ${new Date(ticket.createdAt).toLocaleString()}\n`;
    if (ticket.updatedAt) {
        content += `- **Last Updated:** ${new Date(ticket.updatedAt).toLocaleString()}\n`;
    }
    content += '\n';

    // Tasks section
    const taskList = ticket.tasks || tasks;
    if (taskList && taskList.length > 0) {
        content += `## Tasks\n`;
        taskList.sort((a, b) => a.orderIndex - b.orderIndex)
            .forEach(task => {
                content += task.done ? 
                    `- [x] ${task.content}\n` : 
                    `- [ ] ${task.content}\n`;
            });
        content += '\n';
    }

    return content;
} 