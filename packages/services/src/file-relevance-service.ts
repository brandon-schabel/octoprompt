import { ProjectFile, Ticket, TicketTask, RelevanceScore, RelevanceConfig } from '@promptliano/schemas'
import { ApiError } from '@promptliano/shared'
import { fileIndexingService } from './file-indexing-service'
import { getProjectFiles } from './project-service'

const DEFAULT_CONFIG: RelevanceConfig = {
  weights: {
    keyword: 0.4,
    path: 0.2,
    type: 0.15,
    recency: 0.15,
    import: 0.1
  },
  maxFiles: 100,
  minScore: 0.1
}

export class FileRelevanceService {
  private stopWords = new Set([
    'the', 'is', 'at', 'which', 'on', 'and', 'a', 'an', 'as', 'are',
    'was', 'were', 'been', 'be', 'have', 'has', 'had', 'do', 'does',
    'did', 'will', 'would', 'could', 'should', 'may', 'might', 'must',
    'shall', 'to', 'of', 'in', 'for', 'with', 'by', 'from', 'up',
    'about', 'into', 'through', 'during', 'before', 'after', 'above',
    'below', 'between', 'under', 'again', 'further', 'then', 'once'
  ])

  constructor(private config: RelevanceConfig = DEFAULT_CONFIG) { }

  async scoreFilesForTicket(
    ticket: Ticket,
    projectId: number,
    userContext?: string
  ): Promise<RelevanceScore[]> {
    const text = `${ticket.title} ${ticket.overview} ${userContext || ''}`
    return this.scoreFilesForText(text, projectId)
  }

  async scoreFilesForTask(
    task: TicketTask,
    ticket: Ticket,
    projectId: number
  ): Promise<RelevanceScore[]> {
    const text = `${task.content} ${task.description} ${ticket.title}`
    return this.scoreFilesForText(text, projectId)
  }

  async scoreFilesForText(
    text: string,
    projectId: number
  ): Promise<RelevanceScore[]> {
    const files = await getProjectFiles(projectId)
    if (!files || files.length === 0) return []

    const keywords = this.extractKeywords(text)
    const scores: RelevanceScore[] = []

    for (const file of files) {
      // Skip binary and large files
      if (this.shouldSkipFile(file)) continue

      const score = this.calculateFileRelevance(file, keywords, files)
      if (score.totalScore >= this.config.minScore) {
        scores.push(score)
      }
    }

    // Sort by total score descending and limit results
    return scores
      .sort((a, b) => b.totalScore - a.totalScore)
      .slice(0, this.config.maxFiles)
  }

  private calculateFileRelevance(
    file: ProjectFile,
    keywords: string[],
    allFiles: ProjectFile[]
  ): RelevanceScore {
    const keywordScore = this.calculateKeywordScore(file, keywords)
    const pathScore = this.calculatePathScore(file, keywords)
    const typeScore = this.calculateTypeScore(file, keywords)
    const recencyScore = this.calculateRecencyScore(file)
    const importScore = this.calculateImportScore(file, allFiles)

    const totalScore =
      keywordScore * this.config.weights.keyword +
      pathScore * this.config.weights.path +
      typeScore * this.config.weights.type +
      recencyScore * this.config.weights.recency +
      importScore * this.config.weights.import

    return {
      fileId: file.id,
      totalScore,
      keywordScore,
      pathScore,
      typeScore,
      recencyScore,
      importScore
    }
  }

  private calculateKeywordScore(file: ProjectFile, keywords: string[]): number {
    if (keywords.length === 0) return 0

    let matchCount = 0
    const fileText = `${file.name} ${file.summary || ''} ${file.content || ''}`.toLowerCase()

    for (const keyword of keywords) {
      if (fileText.includes(keyword.toLowerCase())) {
        matchCount++
      }
    }

    // Also check for partial matches in file content
    const contentWords = this.tokenize(fileText)
    for (const keyword of keywords) {
      for (const word of contentWords) {
        if (word.includes(keyword) || keyword.includes(word)) {
          matchCount += 0.5
        }
      }
    }

    return Math.min(matchCount / keywords.length, 1)
  }

  private calculatePathScore(file: ProjectFile, keywords: string[]): number {
    const pathParts = file.path.toLowerCase().split(/[\/\\.-_]/)
    let score = 0

    for (const keyword of keywords) {
      for (const part of pathParts) {
        if (part === keyword) {
          score += 1
        } else if (part.includes(keyword) || keyword.includes(part)) {
          score += 0.5
        }
      }
    }

    return Math.min(score / keywords.length, 1)
  }

  private calculateTypeScore(file: ProjectFile, keywords: string[]): number {
    const ext = file.extension?.toLowerCase() || ''

    // Map keywords to likely file types
    const typeAssociations: Record<string, string[]> = {
      component: ['tsx', 'jsx', 'vue', 'svelte'],
      style: ['css', 'scss', 'sass', 'less'],
      test: ['test.ts', 'test.js', 'spec.ts', 'spec.js'],
      config: ['json', 'yaml', 'yml', 'toml', 'env'],
      api: ['ts', 'js', 'py', 'go'],
      route: ['ts', 'js', 'tsx', 'jsx'],
      service: ['ts', 'js'],
      hook: ['ts', 'tsx', 'js', 'jsx'],
      schema: ['ts', 'zod.ts'],
      model: ['ts', 'js', 'py'],
      database: ['sql', 'prisma', 'ts'],
      documentation: ['md', 'mdx', 'txt']
    }

    let score = 0
    for (const keyword of keywords) {
      const associations = typeAssociations[keyword.toLowerCase()]
      if (associations && associations.some(a => file.path.endsWith(a))) {
        score += 1
      }
    }

    return Math.min(score / keywords.length, 1)
  }

  private calculateRecencyScore(file: ProjectFile): number {
    if (!file.updated) return 0.5

    const now = Date.now()
    const fileAge = now - file.updated
    const dayInMs = 24 * 60 * 60 * 1000

    // Files modified in the last day get highest score
    if (fileAge < dayInMs) return 1
    // Linear decay over 30 days
    if (fileAge < 30 * dayInMs) return 1 - (fileAge / (30 * dayInMs)) * 0.5
    // Older files get baseline score
    return 0.5
  }

  private calculateImportScore(file: ProjectFile, allFiles: ProjectFile[]): number {
    if (!file.imports || file.imports.length === 0) return 0

    // Count how many other files import this file
    let importCount = 0
    for (const otherFile of allFiles) {
      if (otherFile.id === file.id) continue
      if (otherFile.imports?.some(imp => imp.source.includes(file.name))) {
        importCount++
      }
    }

    // Normalize by total files (files imported by many others are likely important)
    return Math.min(importCount / Math.max(allFiles.length * 0.1, 1), 1)
  }

  private extractKeywords(text: string): string[] {
    const words = this.tokenize(text)
    const wordFreq = new Map<string, number>()

    for (const word of words) {
      if (word.length < 3 || this.stopWords.has(word)) continue
      wordFreq.set(word, (wordFreq.get(word) || 0) + 1)
    }

    // Sort by frequency and take top keywords
    return Array.from(wordFreq.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 20)
      .map(([word]) => word)
  }

  private tokenize(text: string): string[] {
    return text
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, ' ')
      .split(/\s+/)
      .filter(word => word.length > 0)
  }

  private shouldSkipFile(file: ProjectFile): boolean {
    // Skip binary files
    const binaryExtensions = [
      'jpg', 'jpeg', 'png', 'gif', 'bmp', 'ico', 'svg', 'webp',
      'mp4', 'avi', 'mov', 'mp3', 'wav', 'pdf', 'doc', 'docx',
      'zip', 'tar', 'gz', 'exe', 'dll', 'so', 'dylib'
    ]
    if (file.extension && binaryExtensions.includes(file.extension.toLowerCase())) {
      return true
    }

    // Skip very large files
    if (file.size && file.size > 1024 * 1024) { // 1MB
      return true
    }

    // Skip node_modules, vendor, dist directories
    const skipPaths = ['node_modules', 'vendor', 'dist', 'build', '.git']
    if (skipPaths.some(skip => file.path.includes(skip))) {
      return true
    }

    return false
  }

  updateConfig(config: Partial<RelevanceConfig>) {
    this.config = { ...this.config, ...config }
  }
}

// Export singleton instance
export const fileRelevanceService = new FileRelevanceService()