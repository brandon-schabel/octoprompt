import { generateTabName } from './gen-ai-services'
import type { ProjectTabState } from '@promptliano/schemas'
import { getProjectById, getProjectFiles } from './project-service'

export interface TabNameGenerationResult {
  name: string
  status: 'success' | 'fallback'
  generatedAt: Date
}

export class TabNameGenerationService {
  static async generateTabName(projectId: number, tabData: Partial<ProjectTabState>): Promise<TabNameGenerationResult> {
    try {
      const project = await getProjectById(projectId)
      if (!project) {
        throw new Error('Project not found')
      }

      const selectedFiles = tabData.selectedFiles || []
      const userPrompt = tabData.userPrompt || ''

      let fileNames: string[] = []
      if (selectedFiles.length > 0) {
        const projectFiles = await getProjectFiles(projectId)
        fileNames = selectedFiles
          .map((fileId) => {
            const file = projectFiles?.find((f) => f.id === fileId)
            return file?.path || ''
          })
          .filter(Boolean)
          .slice(0, 10)
      }

      const context = userPrompt || this.extractContextFromFiles(fileNames)

      const generatedName = await generateTabName(project.name, fileNames, context)

      return {
        name: generatedName,
        status: 'success',
        generatedAt: new Date()
      }
    } catch (error) {
      console.error('[TabNameGenerationService] Error generating name with AI:', error)
      return {
        name: this.generateFallbackName(projectId, tabData),
        status: 'fallback',
        generatedAt: new Date()
      }
    }
  }

  private static extractContextFromFiles(filePaths: string[]): string {
    if (filePaths.length === 0) return 'General project work'

    const directories = filePaths
      .map((path) => {
        const parts = path.split('/')
        return parts.length > 1 ? parts[parts.length - 2] : ''
      })
      .filter(Boolean)

    const uniqueDirs = [...new Set(directories)]
    if (uniqueDirs.length > 0) {
      return `Working on ${uniqueDirs.slice(0, 3).join(', ')}`
    }

    return 'General project work'
  }

  private static generateFallbackName(projectId: number, tabData: Partial<ProjectTabState>): string {
    const timestamp = new Date().getTime()
    const shortId = timestamp.toString().slice(-4)

    if (tabData.selectedFiles && tabData.selectedFiles.length > 0) {
      return `Project ${shortId}`
    }

    return `Tab ${shortId}`
  }

  static async generateUniqueTabName(
    projectId: number,
    tabData: Partial<ProjectTabState>,
    existingTabNames: string[]
  ): Promise<TabNameGenerationResult> {
    const result = await this.generateTabName(projectId, tabData)

    let uniqueName = result.name
    let counter = 1

    while (existingTabNames.includes(uniqueName)) {
      counter++
      uniqueName = `${result.name} ${counter}`
    }

    return {
      ...result,
      name: uniqueName
    }
  }
}

export function createTabNameGenerationService() {
  return TabNameGenerationService
}
