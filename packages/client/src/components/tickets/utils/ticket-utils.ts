import { Ticket, TicketTask as Task, TicketWithTasks } from 'shared/src/schemas/ticket.schemas'

export function buildTicketContent(ticket: Ticket, tasks?: Task[]): string {
  let content = ''

  // Title as H1
  content += `# ${ticket.title}\n\n`

  // Overview section
  if (ticket.overview) {
    content += `## Overview\n${ticket.overview}\n\n`
  }

  // Metadata section
  content += `## Metadata\n`
  content += `- **Status:** ${ticket.status?.replace('_', ' ').toUpperCase() || 'N/A'}\n`
  content += `- **Priority:** ${ticket.priority?.toUpperCase() || 'N/A'}\n`
  content += `- **Created:** ${new Date(ticket.created).toLocaleString()}\n`
  if (ticket.updated) {
    content += `- **Last Updated:** ${new Date(ticket.updated).toLocaleString()}\n`
  }
  content += '\n'

  // Tasks section
  const taskList = tasks
  if (taskList && taskList.length > 0) {
    content += `## Tasks\n`
    taskList
      .sort((a, b) => a.orderIndex - b.orderIndex)
      .forEach((task) => {
        content += task.done ? `- [x] ${task.content}\n` : `- [ ] ${task.content}\n`
      })
    content += '\n'
  }

  return content
}
