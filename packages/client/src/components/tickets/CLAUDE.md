# Tickets Component Architecture

This directory contains the comprehensive ticket and task management UI components for Promptliano's project management system. It follows a hierarchical component structure with clear separation of concerns.

## Overview

The ticket system provides a complete workflow management solution with:

- **Kanban-style ticket boards** with drag-and-drop functionality
- **Rich ticket dialogs** with priority/status management
- **Task management** with auto-generation capabilities
- **Queue integration** for AI-powered task processing
- **Advanced filtering and sorting**
- **Multiple view modes** (list, detail, analytics, queues)

## Component Architecture

```
tickets/
├── ticket-detail-view.tsx           # Main detail view with comprehensive ticket info
├── ticket-dialog.tsx                # Modal for creating/editing tickets
├── ticket-list.tsx                  # Simple ticket list (legacy component)
├── ticket-list-panel.tsx            # Advanced list with filtering and actions
├── tickets-tab-view.tsx             # Basic tab view wrapper
├── tickets-tab-with-sidebar.tsx     # Advanced view with sidebar navigation
├── tickets-sidebar-nav.tsx          # Navigation sidebar for different views
├── ticket-tasks-panel.tsx           # Task management within tickets
├── ticket-attachment-panel.tsx      # File attachment (partially implemented)
├── *-empty-state.tsx               # Various empty state components
└── utils/
    └── ticket-utils.ts              # Utility functions for ticket data
```

## Core Component Patterns

### 1. Ticket Detail View (`ticket-detail-view.tsx`)

The most comprehensive ticket component featuring:

- **Hierarchical information display** with cards and sections
- **Queue integration** with navigation to queue views
- **Real-time task completion tracking** with progress indicators
- **Markdown export functionality** for copying tickets
- **Metadata display** with creation/update times and file counts

```tsx
const STATUS_COLORS = {
  open: 'bg-blue-500/10 text-blue-700 dark:text-blue-400',
  in_progress: 'bg-yellow-500/10 text-yellow-700 dark:text-yellow-400',
  closed: 'bg-green-500/10 text-green-700 dark:text-green-400'
} as const

// Task completion calculation
const completedTasks = ticket.tasks.filter((task) => task.done).length
const completionPercentage = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0
```

**Key Features:**

- Color-coded status and priority badges
- Interactive task checkboxes with real-time updates
- Queue information panel with navigation
- Copy-as-markdown functionality
- Responsive layout with scrollable content

### 2. Ticket Dialog (`ticket-dialog.tsx`)

A sophisticated modal dialog with:

- **Dynamic gradient headers** that change based on ticket status
- **Toggle group selections** for priority and status with visual feedback
- **Character counters** for title and overview fields
- **Keyboard shortcuts** (Cmd+Enter to submit)
- **Integrated task panel** for existing tickets

```tsx
const priorityConfig = {
  high: {
    label: 'High',
    icon: Flame,
    color: 'from-red-500 to-orange-500',
    bgColor: 'bg-red-500/20 dark:bg-red-500/30',
    borderColor: 'border-red-500/50 dark:border-red-400/50',
    textColor: 'text-red-700 dark:text-red-300',
    description: 'Urgent priority'
  }
  // ... other priorities
}
```

**Key Features:**

- Visual priority/status selectors with icons and animations
- Auto-resizing text areas with character limits
- Prevents accidental closure during form submission
- Queue integration for adding tickets to processing queues
- Form validation with loading states

### 3. Ticket List Panel (`ticket-list-panel.tsx`)

Advanced list component with:

- **Multi-dimensional filtering** (text search, status, sort options)
- **State persistence** using local storage hooks
- **Progress indicators** showing task completion
- **Context actions** (copy, delete, navigate)
- **Empty state handling** with helpful messaging

```tsx
// State management with persistent storage
const updateProjectTabState = useUpdateProjectTabState(projectTabId)
const ticketSearch = tabState?.ticketSearch ?? ''
const ticketSort = tabState?.ticketSort ?? 'created_desc'
const ticketStatus = tabState?.ticketStatusFilter ?? 'all'

// Filtering and sorting logic
const filtered = useMemo(() => {
  if (!ticketSearch.trim()) return tickets
  const lower = ticketSearch.toLowerCase()
  return tickets.filter((t) => {
    return t.ticket.title.toLowerCase().includes(lower) || t.ticket.overview?.toLowerCase().includes(lower)
  })
}, [tickets, ticketSearch])
```

### 4. Task Management (`ticket-tasks-panel.tsx`)

Comprehensive task management with:

- **Auto-generation** from ticket overviews using AI
- **Drag-and-drop reordering** with order persistence
- **Multiple export formats** (markdown, bulleted, comma-separated)
- **Real-time updates** with optimistic UI
- **Empty states** with contextual actions

```tsx
function formatTasks(mode: 'markdown' | 'bulleted' | 'comma', tasks: TicketTask[]): string {
  switch (mode) {
    case 'markdown':
      return tasks.map((t) => `- [${t.done ? 'x' : ' '}] ${t.content}`).join('\n')
    case 'bulleted':
      return tasks.map((t) => `• ${t.content}`).join('\n')
    case 'comma':
      return tasks.map((t) => t.content).join(', ')
    default:
      return tasks.map((t) => t.content).join('\n')
  }
}
```

## Form Handling Patterns

### 1. Controlled Components with Validation

```tsx
const [title, setTitle] = useState('')
const [overview, setOverview] = useState('')
const [priority, setPriority] = useState<'low' | 'normal' | 'high'>('normal')

// Character limit enforcement
const titleCharCount = title.length
const maxTitleLength = 100

<Input
  value={title}
  onChange={(e) => setTitle(e.target.value.slice(0, maxTitleLength))}
  required
/>
```

### 2. Optimistic Updates

```tsx
const handleTaskToggle = async (taskId: number, done: boolean) => {
  try {
    await updateTask.mutateAsync({
      ticketId: ticket.ticket.id,
      taskId,
      data: { done }
    })
  } catch (error) {
    toast.error('Failed to update task')
  }
}
```

### 3. Form Submission with Loading States

```tsx
const [isSubmitting, setIsSubmitting] = useState(false)

async function handleSubmit(e: React.FormEvent) {
  e.preventDefault()
  if (isSubmitting) return

  setIsSubmitting(true)
  try {
    if (ticketWithTasks) {
      await updateTicket.mutateAsync({ ticketId: ticketWithTasks.ticket.id, data })
    } else {
      await createTicket.mutateAsync({ projectId: Number(projectId), ...data })
    }
    onClose()
  } catch (err) {
    console.error('Failed to save ticket:', err)
  } finally {
    setIsSubmitting(false)
  }
}
```

## Dialog Management Patterns

### 1. Modal State Management

```tsx
const [isEditDialogOpen, setIsEditDialogOpen] = useState(false)
const [selectedTicket, setSelectedTicket] = useState<TicketWithTasks | null>(null)

const handleSelectTicket = (ticket: TicketWithTasks) => {
  setSelectedTicket(ticket)
  setIsEditDialogOpen(true)
}

;<TicketDialog
  isOpen={isEditDialogOpen}
  onClose={() => {
    setIsEditDialogOpen(false)
    setSelectedTicket(null)
    onTicketUpdate?.()
  }}
  ticketWithTasks={selectedTicket}
  projectId={projectId.toString()}
/>
```

### 2. Prevent Accidental Closure

```tsx
<DialogContent
  onInteractOutside={(e) => {
    e.preventDefault() // Prevent closing on outside click
  }}
  onEscapeKeyDown={(e) => {
    if (isSubmitting) {
      e.preventDefault() // Prevent closing while submitting
    }
  }}
>
```

## List and Detail View Patterns

### 1. Master-Detail Layout

```tsx
export function TicketsTabWithSidebar({ selectedTicketId, onTicketSelect }: TicketsTabWithSidebarProps) {
  const [selectedTicket, setSelectedTicket] = useState<TicketWithTasks | null>(null)

  // Sync selected ticket with ID from URL/props
  useEffect(() => {
    if (selectedTicketId && tickets) {
      const ticket = tickets.find((t) => t.ticket.id === selectedTicketId)
      setSelectedTicket(ticket || null)
    }
  }, [selectedTicketId, tickets])

  return (
    <div className='flex h-full'>
      <div className='w-56 border-r bg-muted/30 flex-shrink-0'>
        <TicketsSidebarNav />
      </div>
      <div className='flex-1 overflow-hidden'>{renderContent()}</div>
    </div>
  )
}
```

### 2. Responsive Card Layouts

```tsx
<div className='grid gap-6'>
  {/* Header Card */}
  <Card>
    <CardHeader>
      <div className='flex items-start justify-between'>
        <div className='space-y-1'>
          <h1 className='text-2xl font-bold'>{ticket.ticket.title}</h1>
          <p className='text-muted-foreground'>Created {formatDistanceToNow(new Date(ticket.ticket.created))} ago</p>
        </div>
        <div className='flex gap-2'>
          <Button variant='outline' onClick={handleCopyAsMarkdown}>
            <Copy className='h-4 w-4 mr-2' />
            Copy as Markdown
          </Button>
        </div>
      </div>
    </CardHeader>
  </Card>

  {/* Status Card */}
  <Card>
    <CardContent>
      <div className='flex items-center gap-3'>
        <Badge className={cn(STATUS_COLORS[ticket.ticket.status])}>
          {ticket.ticket.status?.replace('_', ' ').toUpperCase()}
        </Badge>
      </div>
    </CardContent>
  </Card>
</div>
```

## Filtering Patterns

### 1. Multi-Dimensional Filtering

```tsx
// State management for filters
const [ticketSearch, setTicketSearch] = useState('')
const [ticketStatus, setTicketStatusFilter] = useState('all')
const [ticketSort, setTicketSort] = useState('created_desc')

// Filter pipeline
const filtered = useMemo(() => {
  if (!ticketSearch.trim()) return tickets
  const lower = ticketSearch.toLowerCase()
  return tickets.filter(
    (t) => t.ticket.title.toLowerCase().includes(lower) || t.ticket.overview?.toLowerCase().includes(lower)
  )
}, [tickets, ticketSearch])

const sorted = useMemo(() => {
  const arr = [...filtered]
  switch (ticketSort) {
    case 'created_desc':
      return arr.sort((a, b) => b.ticket.created - a.ticket.created)
    case 'priority':
      const priorityOrder = { low: 1, normal: 2, high: 3 }
      return arr.sort((a, b) => (priorityOrder[b.ticket.priority] || 2) - (priorityOrder[a.ticket.priority] || 2))
    // ... other sort options
  }
}, [filtered, ticketSort])
```

### 2. Filter UI Components

```tsx
<div className='flex items-center gap-2 p-3 border-b'>
  <Filter className='mr-1 h-4 w-4 text-muted-foreground' />
  <Input
    placeholder='Filter tickets...'
    value={ticketSearch}
    onChange={(e) => setTicketSearch(e.target.value)}
    className='max-w-xs'
  />

  <Select value={ticketStatus} onValueChange={setTicketStatusFilter}>
    <SelectTrigger className='w-[140px] text-sm'>
      <SelectValue placeholder='Status Filter' />
    </SelectTrigger>
    <SelectContent>
      <SelectItem value='all'>All</SelectItem>
      <SelectItem value='open'>Open</SelectItem>
      <SelectItem value='in_progress'>In Progress</SelectItem>
      <SelectItem value='closed'>Closed</SelectItem>
    </SelectContent>
  </Select>
</div>
```

## Testing Ticket Components

### 1. Component Testing Strategy

```tsx
// Example test structure for ticket components
describe('TicketDetailView', () => {
  const mockTicket = {
    ticket: {
      id: 1,
      title: 'Test Ticket',
      status: 'open',
      priority: 'normal',
      overview: 'Test overview'
    },
    tasks: [
      { id: 1, content: 'Task 1', done: false },
      { id: 2, content: 'Task 2', done: true }
    ]
  }

  it('displays ticket information correctly', () => {
    render(<TicketDetailView ticket={mockTicket} projectId={1} />)
    expect(screen.getByText('Test Ticket')).toBeInTheDocument()
    expect(screen.getByText('OPEN')).toBeInTheDocument()
  })

  it('calculates task completion percentage', () => {
    render(<TicketDetailView ticket={mockTicket} projectId={1} />)
    expect(screen.getByText('1 of 2 tasks completed (50%)')).toBeInTheDocument()
  })

  it('handles task toggle', async () => {
    const mockUpdateTask = jest.fn()
    render(<TicketDetailView ticket={mockTicket} projectId={1} />)

    const checkbox = screen.getByRole('checkbox', { name: /task 1/i })
    await user.click(checkbox)

    expect(mockUpdateTask).toHaveBeenCalledWith({
      ticketId: 1,
      taskId: 1,
      data: { done: true }
    })
  })
})
```

### 2. Dialog Testing

```tsx
describe('TicketDialog', () => {
  it('validates required fields', async () => {
    render(<TicketDialog isOpen={true} onClose={jest.fn()} />)

    const submitButton = screen.getByText('Create Ticket')
    expect(submitButton).toBeDisabled()

    const titleInput = screen.getByLabelText('Title')
    await user.type(titleInput, 'New Ticket')

    expect(submitButton).toBeEnabled()
  })

  it('enforces character limits', async () => {
    render(<TicketDialog isOpen={true} onClose={jest.fn()} />)

    const titleInput = screen.getByLabelText('Title')
    const longTitle = 'a'.repeat(150) // Exceeds 100 char limit
    await user.type(titleInput, longTitle)

    expect(titleInput.value).toHaveLength(100)
    expect(screen.getByText('100/100')).toBeInTheDocument()
  })
})
```

### 3. List Component Testing

```tsx
describe('TicketListPanel', () => {
  it('filters tickets by search term', async () => {
    const tickets = [
      { ticket: { title: 'Bug Fix', overview: 'Fix login bug' } },
      { ticket: { title: 'Feature', overview: 'Add new feature' } }
    ]

    render(<TicketListPanel tickets={tickets} />)

    const searchInput = screen.getByPlaceholderText('Filter tickets...')
    await user.type(searchInput, 'bug')

    expect(screen.getByText('Bug Fix')).toBeInTheDocument()
    expect(screen.queryByText('Feature')).not.toBeInTheDocument()
  })

  it('sorts tickets by creation date', async () => {
    // Test sorting functionality
  })

  it('handles empty states correctly', () => {
    render(<TicketListPanel tickets={[]} />)
    expect(screen.getByText('Create Your First Ticket')).toBeInTheDocument()
  })
})
```

## Code Examples

### 1. Creating a New Ticket Component

```tsx
import React, { useState } from 'react'
import { Card, CardHeader, CardTitle, CardContent } from '@promptliano/ui'
import { Button } from '@promptliano/ui'
import { Badge } from '@promptliano/ui'
import { useCreateTicket } from '@/hooks/api/use-tickets-api'
import type { TicketWithTasks } from '@promptliano/schemas'

interface TicketCardProps {
  ticket: TicketWithTasks
  onSelect: (ticket: TicketWithTasks) => void
  className?: string
}

export function TicketCard({ ticket, onSelect, className }: TicketCardProps) {
  const [isHovered, setIsHovered] = useState(false)

  const completionPercentage =
    ticket.tasks.length > 0 ? Math.round((ticket.tasks.filter((t) => t.done).length / ticket.tasks.length) * 100) : 0

  return (
    <Card
      className={cn('cursor-pointer transition-all duration-200 hover:shadow-md', isHovered && 'scale-105', className)}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      onClick={() => onSelect(ticket)}
    >
      <CardHeader className='pb-3'>
        <div className='flex items-start justify-between'>
          <CardTitle className='text-lg font-semibold line-clamp-2'>{ticket.ticket.title}</CardTitle>
          <Badge variant={ticket.ticket.status === 'closed' ? 'default' : 'secondary'}>
            {ticket.ticket.status?.replace('_', ' ').toUpperCase()}
          </Badge>
        </div>
      </CardHeader>
      <CardContent>
        <p className='text-sm text-muted-foreground line-clamp-3 mb-4'>{ticket.ticket.overview}</p>
        <div className='flex items-center justify-between text-xs'>
          <span className='text-muted-foreground'>
            {ticket.tasks.filter((t) => t.done).length} / {ticket.tasks.length} tasks
          </span>
          <span className='font-medium text-primary'>{completionPercentage}% complete</span>
        </div>
      </CardContent>
    </Card>
  )
}
```

### 2. Custom Hook for Ticket Management

```tsx
import { useState, useCallback } from 'react'
import { useGetTicketsWithTasks, useCreateTicket } from '@/hooks/api/use-tickets-api'
import type { TicketWithTasks } from '@promptliano/schemas'

export function useTicketManager(projectId: number) {
  const [selectedTicket, setSelectedTicket] = useState<TicketWithTasks | null>(null)
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false)

  const { data: tickets, isLoading, error, refetch } = useGetTicketsWithTasks(projectId)
  const createTicketMutation = useCreateTicket()

  const handleSelectTicket = useCallback((ticket: TicketWithTasks) => {
    setSelectedTicket(ticket)
  }, [])

  const handleCreateTicket = useCallback(
    async (data: CreateTicketBody) => {
      try {
        await createTicketMutation.mutateAsync(data)
        setIsCreateDialogOpen(false)
        refetch()
      } catch (error) {
        console.error('Failed to create ticket:', error)
      }
    },
    [createTicketMutation, refetch]
  )

  const openCreateDialog = useCallback(() => {
    setSelectedTicket(null)
    setIsCreateDialogOpen(true)
  }, [])

  return {
    // Data
    tickets,
    selectedTicket,
    isLoading,
    error,

    // State
    isCreateDialogOpen,

    // Actions
    handleSelectTicket,
    handleCreateTicket,
    openCreateDialog,
    closeCreateDialog: () => setIsCreateDialogOpen(false),
    refetch
  }
}
```

This ticket component architecture provides a comprehensive, scalable foundation for project management with excellent UX patterns, proper state management, and extensive testing capabilities.
