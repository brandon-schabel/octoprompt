import { completeTicket, createTicket, getTicketById } from './src/ticket-service'
import { resetTestDatabase } from '@promptliano/storage'
import { createProject } from './src/project-service'

async function testCompleteTicket() {
  try {
    // Setup database
    await resetTestDatabase()

    // Create a test project
    const project = await createProject({
      name: 'Test Project',
      path: '/test'
    })

    // Create a test ticket
    const ticket = await createTicket({
      projectId: project.id,
      title: 'Test Ticket',
      overview: 'This is a test ticket'
    })

    console.log('Created ticket:', ticket.id)

    // Complete the ticket
    const result = await completeTicket(ticket.id)

    console.log('✅ Successfully completed ticket\!')
    console.log('Ticket status:', result.ticket.status)
    console.log('Queue fields cleared:')
    console.log('  - queueId:', result.ticket.queueId)
    console.log('  - queuePriority:', result.ticket.queuePriority)
    console.log('  - queuedAt:', result.ticket.queuedAt)

    process.exit(0)
  } catch (error) {
    console.error('❌ Error completing ticket:', error)
    process.exit(1)
  }
}

testCompleteTicket()
