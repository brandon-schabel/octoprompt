import { ApiError } from '@promptliano/shared'
import { getProjectById, getProjectFiles } from './project-service'
import { listTicketsByProject, getTasks } from './ticket-service'
import { listPromptsByProject } from './prompt-service'
import { type Ticket } from '@promptliano/schemas'
import { MAX_FILE_SIZE_FOR_SUMMARY } from '@promptliano/config'

export interface ProjectStatistics {
  // File Statistics
  fileStats: {
    totalFiles: number
    totalSize: number
    filesByType: Record<string, number>
    sizeByType: Record<string, number>
    filesByCategory: {
      source: number
      tests: number
      docs: number
      config: number
      other: number
    }
    filesWithSummaries: number
    averageSummaryLength: number
    filesExceedingSizeLimit: number
    largestFileSize: number
  }

  // Ticket Statistics
  ticketStats: {
    totalTickets: number
    ticketsByStatus: {
      open: number
      in_progress: number
      closed: number
    }
    ticketsByPriority: {
      low: number
      normal: number
      high: number
    }
    averageTasksPerTicket: number
  }

  // Task Statistics
  taskStats: {
    totalTasks: number
    completedTasks: number
    completionRate: number
    tasksByTicket: Array<{
      ticketId: number
      ticketTitle: string
      totalTasks: number
      completedTasks: number
    }>
  }

  // Prompt Statistics
  promptStats: {
    totalPrompts: number
    totalTokens: number
    averagePromptLength: number
    promptTypes: Record<string, number>
  }

  // Activity Statistics
  activityStats: {
    recentUpdates: number
    lastUpdateTime: number
    creationTrend: Array<{
      date: string
      files: number
      tickets: number
      tasks: number
    }>
  }
}

function categorizeFile(path: string): string {
  const lowerPath = path.toLowerCase()

  if (lowerPath.includes('/test/') || lowerPath.includes('.test.') || lowerPath.includes('.spec.')) {
    return 'tests'
  }
  if (lowerPath.includes('/docs/') || lowerPath.includes('readme') || lowerPath.endsWith('.md')) {
    return 'docs'
  }
  if (lowerPath.includes('/src/') || lowerPath.includes('/lib/') || lowerPath.includes('/components/')) {
    return 'source'
  }
  if (
    lowerPath.includes('config') ||
    lowerPath.includes('.json') ||
    lowerPath.includes('.yml') ||
    lowerPath.includes('.yaml')
  ) {
    return 'config'
  }
  return 'other'
}

export async function getProjectStatistics(projectId: number): Promise<ProjectStatistics> {
  try {
    // Validate project exists
    await getProjectById(projectId)

    // Fetch all data in parallel for performance
    const [filesData, tickets, prompts] = await Promise.all([
      getProjectFiles(projectId),
      listTicketsByProject(projectId),
      listPromptsByProject(projectId)
    ])

    const files = filesData || []

    // Calculate file statistics
    const fileStats = calculateFileStats(files)

    // Calculate ticket and task statistics
    const { ticketStats, taskStats } = await calculateTicketAndTaskStats(tickets)

    // Calculate prompt statistics
    const promptStats = calculatePromptStats(prompts)

    // Calculate activity statistics
    const activityStats = calculateActivityStats(files, tickets)

    return {
      fileStats,
      ticketStats,
      taskStats,
      promptStats,
      activityStats
    }
  } catch (error) {
    if (error instanceof ApiError) throw error
    throw new ApiError(
      500,
      `Failed to get project statistics: ${error instanceof Error ? error.message : String(error)}`,
      'PROJECT_STATISTICS_FAILED'
    )
  }
}

function calculateFileStats(files: any[]): ProjectStatistics['fileStats'] {
  const filesByType: Record<string, number> = {}
  const sizeByType: Record<string, number> = {}
  const filesByCategory = {
    source: 0,
    tests: 0,
    docs: 0,
    config: 0,
    other: 0
  }
  let totalSize = 0
  let filesWithSummaries = 0
  let totalSummaryLength = 0
  let filesExceedingSizeLimit = 0
  let largestFileSize = 0

  files.forEach((file) => {
    const ext = file.extension || 'unknown'
    filesByType[ext] = (filesByType[ext] || 0) + 1
    sizeByType[ext] = (sizeByType[ext] || 0) + (file.size || 0)
    totalSize += file.size || 0

    const category = categorizeFile(file.path)
    filesByCategory[category as keyof typeof filesByCategory]++

    if (file.summary && file.summary.length > 0) {
      filesWithSummaries++
      totalSummaryLength += file.summary.length
    }

    // Track files exceeding size limit
    if (file.size > MAX_FILE_SIZE_FOR_SUMMARY) {
      filesExceedingSizeLimit++
    }

    // Track largest file
    if (file.size > largestFileSize) {
      largestFileSize = file.size
    }
  })

  return {
    totalFiles: files.length,
    totalSize,
    filesByType,
    sizeByType,
    filesByCategory,
    filesWithSummaries,
    averageSummaryLength: filesWithSummaries > 0 ? totalSummaryLength / filesWithSummaries : 0,
    filesExceedingSizeLimit,
    largestFileSize
  }
}

async function calculateTicketAndTaskStats(tickets: Ticket[]): Promise<{
  ticketStats: ProjectStatistics['ticketStats']
  taskStats: ProjectStatistics['taskStats']
}> {
  const ticketsByStatus = {
    open: 0,
    in_progress: 0,
    closed: 0
  }
  const ticketsByPriority = {
    low: 0,
    normal: 0,
    high: 0
  }

  let totalTasks = 0
  let completedTasks = 0
  const tasksByTicket: ProjectStatistics['taskStats']['tasksByTicket'] = []

  // Process each ticket and its tasks
  await Promise.all(
    tickets.map(async (ticket) => {
      // Count ticket status
      const status = ticket.status as keyof typeof ticketsByStatus
      if (status in ticketsByStatus) {
        ticketsByStatus[status]++
      }

      // Count ticket priority
      const priority = ticket.priority as keyof typeof ticketsByPriority
      if (priority in ticketsByPriority) {
        ticketsByPriority[priority]++
      }

      // Get tasks for this ticket
      const tasks = await getTasks(ticket.id)
      const ticketTotalTasks = tasks.length
      const ticketCompletedTasks = tasks.filter((task) => task.done).length

      totalTasks += ticketTotalTasks
      completedTasks += ticketCompletedTasks

      if (ticketTotalTasks > 0) {
        tasksByTicket.push({
          ticketId: ticket.id,
          ticketTitle: ticket.title,
          totalTasks: ticketTotalTasks,
          completedTasks: ticketCompletedTasks
        })
      }
    })
  )

  const averageTasksPerTicket = tickets.length > 0 ? totalTasks / tickets.length : 0
  const completionRate = totalTasks > 0 ? (completedTasks / totalTasks) * 100 : 0

  return {
    ticketStats: {
      totalTickets: tickets.length,
      ticketsByStatus,
      ticketsByPriority,
      averageTasksPerTicket
    },
    taskStats: {
      totalTasks,
      completedTasks,
      completionRate,
      tasksByTicket: tasksByTicket.sort((a, b) => b.totalTasks - a.totalTasks).slice(0, 10) // Top 10 tickets by task count
    }
  }
}

function calculatePromptStats(prompts: any[]): ProjectStatistics['promptStats'] {
  const promptTypes: Record<string, number> = {}
  let totalTokens = 0
  let totalLength = 0

  prompts.forEach((prompt) => {
    const type = prompt.type || 'custom'
    promptTypes[type] = (promptTypes[type] || 0) + 1

    // Estimate tokens (rough approximation: 1 token ≈ 4 characters)
    const promptLength = prompt.content?.length || 0
    totalLength += promptLength
    totalTokens += Math.ceil(promptLength / 4)
  })

  return {
    totalPrompts: prompts.length,
    totalTokens,
    averagePromptLength: prompts.length > 0 ? totalLength / prompts.length : 0,
    promptTypes
  }
}

function calculateActivityStats(files: any[], tickets: Ticket[]): ProjectStatistics['activityStats'] {
  const now = Date.now()
  const oneWeekAgo = now - 7 * 24 * 60 * 60 * 1000

  // Count recent updates
  let recentUpdates = 0
  let lastUpdateTime = 0

  files.forEach((file) => {
    const updateTime = file.updated || file.created || 0
    if (updateTime > oneWeekAgo) {
      recentUpdates++
    }
    if (updateTime > lastUpdateTime) {
      lastUpdateTime = updateTime
    }
  })

  tickets.forEach((ticket) => {
    const updateTime = ticket.updated || ticket.created || 0
    if (updateTime > oneWeekAgo) {
      recentUpdates++
    }
    if (updateTime > lastUpdateTime) {
      lastUpdateTime = updateTime
    }
  })

  // Create a simple 7-day trend (this is a simplified version)
  const creationTrend: ProjectStatistics['activityStats']['creationTrend'] = []
  for (let i = 6; i >= 0; i--) {
    const date = new Date(now - i * 24 * 60 * 60 * 1000)
    const dateStr = date.toISOString().split('T')[0] || date.toDateString()

    // Count items created on this day
    const dayStart = date.setHours(0, 0, 0, 0)
    const dayEnd = date.setHours(23, 59, 59, 999)

    const filesCreated = files.filter((f) => {
      const created = f.created || 0
      return created >= dayStart && created <= dayEnd
    }).length

    const ticketsCreated = tickets.filter((t) => {
      const created = t.created || 0
      return created >= dayStart && created <= dayEnd
    }).length

    creationTrend.push({
      date: dateStr,
      files: filesCreated,
      tickets: ticketsCreated,
      tasks: 0 // Would need to fetch all tasks to calculate this accurately
    })
  }

  return {
    recentUpdates,
    lastUpdateTime,
    creationTrend
  }
}
