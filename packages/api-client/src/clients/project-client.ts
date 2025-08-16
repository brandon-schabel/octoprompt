import { z } from 'zod'
import { BaseApiClient } from '../base-client'
import type { 
  CreateProjectBody,
  UpdateProjectBody,
  Project,
  ProjectFile,
  ProjectStatistics,
  DataResponseSchema
} from '../types'

// Import response schemas
import {
  ProjectResponseSchema as ProjectResponseSchemaZ,
  ProjectListResponseSchema as ProjectListResponseSchemaZ,
  FileListResponseSchema as FileListResponseSchemaZ,
  FileResponseSchema as FileResponseSchemaZ,
  ProjectSummaryResponseSchema as ProjectSummaryResponseSchemaZ,
  ProjectFileWithoutContentListResponseSchema as ProjectFileWithoutContentListResponseSchemaZ,
  ProjectStatisticsResponseSchema as ProjectStatisticsResponseSchemaZ,
  CreateProjectBodySchema,
  UpdateProjectBodySchema,
  RefreshQuerySchema,
  OperationSuccessResponseSchema as OperationSuccessResponseSchemaZ
} from '@promptliano/schemas'

/**
 * Project API client for managing projects, files, and project-related operations
 */
export class ProjectClient extends BaseApiClient {
  /**
   * List all projects
   */
  async listProjects(): Promise<DataResponseSchema<Project[]>> {
    const result = await this.request('GET', '/projects', {
      responseSchema: ProjectListResponseSchemaZ
    })
    return result as DataResponseSchema<Project[]>
  }

  /**
   * Create a new project
   */
  async createProject(data: CreateProjectBody): Promise<DataResponseSchema<Project>> {
    const validatedData = this.validateBody(CreateProjectBodySchema, data)
    const result = await this.request('POST', '/projects', {
      body: validatedData,
      responseSchema: ProjectResponseSchemaZ
    })
    return result as DataResponseSchema<Project>
  }

  /**
   * Get a project by ID
   */
  async getProject(projectId: number): Promise<DataResponseSchema<Project>> {
    const result = await this.request('GET', `/projects/${projectId}`, {
      responseSchema: ProjectResponseSchemaZ
    })
    return result as DataResponseSchema<Project>
  }

  /**
   * Update a project
   */
  async updateProject(projectId: number, data: UpdateProjectBody): Promise<DataResponseSchema<Project>> {
    const validatedData = this.validateBody(UpdateProjectBodySchema, data)
    const result = await this.request('PATCH', `/projects/${projectId}`, {
      body: validatedData,
      responseSchema: ProjectResponseSchemaZ
    })
    return result as DataResponseSchema<Project>
  }

  /**
   * Delete a project
   */
  async deleteProject(projectId: number): Promise<boolean> {
    await this.request('DELETE', `/projects/${projectId}`, {
      responseSchema: OperationSuccessResponseSchemaZ
    })
    return true
  }

  /**
   * Sync project files from filesystem
   */
  async syncProject(projectId: number): Promise<boolean> {
    await this.request('POST', `/projects/${projectId}/sync`, {
      responseSchema: OperationSuccessResponseSchemaZ,
      timeout: 300000 // 5 minutes timeout for sync operations
    })
    return true
  }

  /**
   * Get project files with optional version history
   */
  async getProjectFiles(projectId: number, includeAllVersions: boolean = false): Promise<DataResponseSchema<ProjectFile[]>> {
    const result = await this.request('GET', `/projects/${projectId}/files`, {
      params: { includeAllVersions },
      responseSchema: FileListResponseSchemaZ
    })
    return result as DataResponseSchema<ProjectFile[]>
  }

  /**
   * Get project files without content for performance optimization
   */
  async getProjectFilesWithoutContent(projectId: number): Promise<DataResponseSchema<Omit<ProjectFile, 'content'>[]>> {
    const result = await this.request('GET', `/projects/${projectId}/files/metadata`, {
      responseSchema: ProjectFileWithoutContentListResponseSchemaZ
    })
    return result as DataResponseSchema<Omit<ProjectFile, 'content'>[]>
  }

  /**
   * Refresh project files from filesystem
   */
  async refreshProject(projectId: number, query?: z.infer<typeof RefreshQuerySchema>): Promise<DataResponseSchema<ProjectFile[]>> {
    const result = await this.request('POST', `/projects/${projectId}/refresh`, {
      params: query,
      responseSchema: FileListResponseSchemaZ,
      timeout: 300000 // 5 minutes timeout for refresh operations
    })
    return result as DataResponseSchema<ProjectFile[]>
  }

  /**
   * Get AI-generated project summary
   */
  async getProjectSummary(projectId: number): Promise<{ summary: string; success: boolean }> {
    const result = await this.request('GET', `/projects/${projectId}/summary`, {
      responseSchema: ProjectSummaryResponseSchemaZ
    })
    return result as { summary: string; success: boolean }
  }

  /**
   * Update file content
   */
  async updateFileContent(projectId: number, fileId: number, content: string): Promise<DataResponseSchema<ProjectFile>> {
    const result = await this.request('PUT', `/projects/${projectId}/files/${fileId}`, {
      body: { content },
      responseSchema: z.object({
        success: z.literal(true),
        data: z.unknown()
      })
    })
    return result as DataResponseSchema<ProjectFile>
  }

  /**
   * Create multiple files in bulk
   */
  async bulkCreateFiles(
    projectId: number,
    files: Array<{
      path: string
      name: string
      extension: string
      content: string
      size: number
      checksum?: string
    }>
  ): Promise<unknown> {
    const result = await this.request('POST', `/projects/${projectId}/files/bulk`, {
      body: { files },
      responseSchema: z.object({
        success: z.literal(true),
        data: z.unknown()
      })
    })
    return result.data
  }

  /**
   * Update multiple files in bulk
   */
  async bulkUpdateFiles(projectId: number, updates: Array<{ fileId: number; content: string }>): Promise<unknown> {
    const result = await this.request('PUT', `/projects/${projectId}/files/bulk`, {
      body: { updates },
      responseSchema: z.object({
        success: z.literal(true),
        data: z.unknown()
      })
    })
    return result.data
  }

  /**
   * Get AI-suggested files based on prompt
   */
  async suggestFiles(projectId: number, data: { prompt: string; limit?: number }): Promise<DataResponseSchema<ProjectFile[]>> {
    const result = await this.request('POST', `/projects/${projectId}/suggest-files`, {
      body: data,
      responseSchema: z.object({
        success: z.literal(true),
        data: z.array(z.unknown())
      })
    })
    return result as DataResponseSchema<ProjectFile[]>
  }

  /**
   * Generate AI summaries for specific files
   */
  async summarizeFiles(
    projectId: number, 
    data: { fileIds: number[]; force?: boolean }
  ): Promise<DataResponseSchema<{ included: number; skipped: number; updatedFiles: ProjectFile[] }>> {
    const result = await this.request('POST', `/projects/${projectId}/files/summarize`, {
      body: data,
      responseSchema: z.object({
        success: z.literal(true),
        data: z.object({
          included: z.number(),
          skipped: z.number(),
          updatedFiles: z.array(z.unknown())
        })
      })
    })
    return result as DataResponseSchema<{
      included: number
      skipped: number
      updatedFiles: ProjectFile[]
    }>
  }

  /**
   * Remove AI summaries from files
   */
  async removeSummariesFromFiles(
    projectId: number, 
    data: { fileIds: number[] }
  ): Promise<DataResponseSchema<{ removedCount: number; message: string }>> {
    const result = await this.request('POST', `/projects/${projectId}/files/remove-summaries`, {
      body: data,
      responseSchema: z.object({
        success: z.literal(true),
        data: z.object({
          removedCount: z.number(),
          message: z.string()
        })
      })
    })
    return result as DataResponseSchema<{
      removedCount: number
      message: string
    }>
  }

  /**
   * Get project statistics
   */
  async getProjectStatistics(projectId: number): Promise<DataResponseSchema<ProjectStatistics>> {
    const result = await this.request('GET', `/projects/${projectId}/statistics`, {
      responseSchema: ProjectStatisticsResponseSchemaZ
    })
    return result as DataResponseSchema<ProjectStatistics>
  }

  /**
   * Get active tab for project
   */
  async getActiveTab(projectId: number, clientId?: string): Promise<{
    success: true
    data: {
      activeTabId: number
      lastUpdated: number
      clientId?: string
      tabMetadata?: {
        displayName?: string
        selectedFiles?: number[]
        selectedPrompts?: number[]
        userPrompt?: string
        fileSearch?: string
        contextLimit?: number
        preferredEditor?: 'vscode' | 'cursor' | 'webstorm' | 'vim' | 'emacs' | 'sublime' | 'atom' | 'idea' | 'phpstorm' | 'pycharm' | 'rubymine' | 'goland' | 'fleet' | 'zed' | 'neovim' | 'xcode' | 'androidstudio' | 'rider'
        suggestedFileIds?: number[]
        ticketSearch?: string
        ticketSort?: 'created_asc' | 'created_desc' | 'status' | 'priority'
        ticketStatusFilter?: 'all' | 'open' | 'in_progress' | 'closed' | 'non_closed'
        searchByContent?: boolean
        resolveImports?: boolean
        bookmarkedFileGroups?: Record<string, number[]>
        sortOrder?: number
        promptsPanelCollapsed?: boolean
        selectedFilesCollapsed?: boolean
      }
    } | null
  }> {
    const result = await this.request('GET', `/projects/${projectId}/active-tab`, {
      params: clientId ? { clientId } : undefined,
      responseSchema: z.object({
        success: z.literal(true),
        data: z
          .object({
            activeTabId: z.number(),
            lastUpdated: z.number(),
            clientId: z.string().optional(),
            tabMetadata: z
              .object({
                displayName: z.string().optional(),
                selectedFiles: z.array(z.number()).optional(),
                selectedPrompts: z.array(z.number()).optional(),
                userPrompt: z.string().optional(),
                fileSearch: z.string().optional(),
                contextLimit: z.number().optional(),
                preferredEditor: z
                  .enum([
                    'vscode',
                    'cursor',
                    'webstorm',
                    'vim',
                    'emacs',
                    'sublime',
                    'atom',
                    'idea',
                    'phpstorm',
                    'pycharm',
                    'rubymine',
                    'goland',
                    'fleet',
                    'zed',
                    'neovim',
                    'xcode',
                    'androidstudio',
                    'rider'
                  ])
                  .optional(),
                suggestedFileIds: z.array(z.number()).optional(),
                ticketSearch: z.string().optional(),
                ticketSort: z.enum(['created_asc', 'created_desc', 'status', 'priority']).optional(),
                ticketStatusFilter: z.enum(['all', 'open', 'in_progress', 'closed', 'non_closed']).optional(),
                searchByContent: z.boolean().optional(),
                resolveImports: z.boolean().optional(),
                bookmarkedFileGroups: z.record(z.string(), z.array(z.number())).optional(),
                sortOrder: z.number().optional(),
                promptsPanelCollapsed: z.boolean().optional(),
                selectedFilesCollapsed: z.boolean().optional()
              })
              .optional()
          })
          .nullable()
      })
    })
    return result
  }

  /**
   * Set active tab for project
   */
  async setActiveTab(
    projectId: number,
    data: {
      tabId: number
      clientId?: string
      tabMetadata?: {
        displayName?: string
        selectedFiles?: number[]
        selectedPrompts?: number[]
        userPrompt?: string
        fileSearch?: string
        contextLimit?: number
        preferredEditor?: 'vscode' | 'cursor' | 'webstorm' | 'vim' | 'emacs' | 'sublime' | 'atom' | 'idea' | 'phpstorm' | 'pycharm' | 'rubymine' | 'goland' | 'fleet' | 'zed' | 'neovim' | 'xcode' | 'androidstudio' | 'rider'
        suggestedFileIds?: number[]
        ticketSearch?: string
        ticketSort?: 'created_asc' | 'created_desc' | 'status' | 'priority'
        ticketStatusFilter?: 'all' | 'open' | 'in_progress' | 'closed' | 'non_closed'
        searchByContent?: boolean
        resolveImports?: boolean
        bookmarkedFileGroups?: Record<string, number[]>
        sortOrder?: number
        promptsPanelCollapsed?: boolean
        selectedFilesCollapsed?: boolean
      }
    }
  ): Promise<{
    success: true
    data: {
      activeTabId: number
      lastUpdated: number
      clientId?: string
      tabMetadata?: {
        displayName?: string
        selectedFiles?: number[]
        selectedPrompts?: number[]
        userPrompt?: string
        fileSearch?: string
        contextLimit?: number
        preferredEditor?: 'vscode' | 'cursor' | 'webstorm' | 'vim' | 'emacs' | 'sublime' | 'atom' | 'idea' | 'phpstorm' | 'pycharm' | 'rubymine' | 'goland' | 'fleet' | 'zed' | 'neovim' | 'xcode' | 'androidstudio' | 'rider'
        suggestedFileIds?: number[]
        ticketSearch?: string
        ticketSort?: 'created_asc' | 'created_desc' | 'status' | 'priority'
        ticketStatusFilter?: 'all' | 'open' | 'in_progress' | 'closed' | 'non_closed'
        searchByContent?: boolean
        resolveImports?: boolean
        bookmarkedFileGroups?: Record<string, number[]>
        sortOrder?: number
        promptsPanelCollapsed?: boolean
        selectedFilesCollapsed?: boolean
      }
    }
  }> {
    const result = await this.request('POST', `/projects/${projectId}/active-tab`, {
      body: data,
      responseSchema: z.object({
        success: z.literal(true),
        data: z.object({
          activeTabId: z.number(),
          lastUpdated: z.number(),
          clientId: z.string().optional(),
          tabMetadata: z
            .object({
              displayName: z.string().optional(),
              selectedFiles: z.array(z.number()).optional(),
              selectedPrompts: z.array(z.number()).optional(),
              userPrompt: z.string().optional(),
              fileSearch: z.string().optional(),
              contextLimit: z.number().optional(),
              preferredEditor: z
                .enum([
                  'vscode',
                  'cursor',
                  'webstorm',
                  'vim',
                  'emacs',
                  'sublime',
                  'atom',
                  'idea',
                  'phpstorm',
                  'pycharm',
                  'rubymine',
                  'goland',
                  'fleet',
                  'zed',
                  'neovim',
                  'xcode',
                  'androidstudio',
                  'rider'
                ])
                .optional(),
              suggestedFileIds: z.array(z.number()).optional(),
              ticketSearch: z.string().optional(),
              ticketSort: z.enum(['created_asc', 'created_desc', 'status', 'priority']).optional(),
              ticketStatusFilter: z.enum(['all', 'open', 'in_progress', 'closed', 'non_closed']).optional(),
              searchByContent: z.boolean().optional(),
              resolveImports: z.boolean().optional(),
              bookmarkedFileGroups: z.record(z.string(), z.array(z.number())).optional(),
              sortOrder: z.number().optional(),
              promptsPanelCollapsed: z.boolean().optional(),
              selectedFilesCollapsed: z.boolean().optional()
            })
            .optional()
        })
      })
    })
    return result
  }

  /**
   * Clear active tab for project
   */
  async clearActiveTab(projectId: number, clientId?: string): Promise<{ success: true; message: string }> {
    const result = await this.request('DELETE', `/projects/${projectId}/active-tab`, {
      params: clientId ? { clientId } : undefined,
      responseSchema: z.object({
        success: z.literal(true),
        message: z.string()
      })
    })
    return result
  }

  /**
   * Generate AI tab name for project tab
   */
  async generateProjectTabName(
    tabId: number,
    data: {
      projectId: number
      tabData?: {
        selectedFiles?: number[]
        userPrompt?: string
      }
      existingNames?: string[]
    }
  ): Promise<{
    success: true
    data: {
      name: string
      status: 'success' | 'fallback'
      generatedAt: string
    }
  }> {
    const validatedData = this.validateBody(
      z.object({
        projectId: z.number(),
        tabData: z
          .object({
            selectedFiles: z.array(z.number()).optional(),
            userPrompt: z.string().optional()
          })
          .optional(),
        existingNames: z.array(z.string()).optional()
      }),
      data
    )

    const result = await this.request('POST', `/project-tabs/${tabId}/generate-name`, {
      body: validatedData,
      responseSchema: z.object({
        success: z.literal(true),
        data: z.object({
          name: z.string(),
          status: z.enum(['success', 'fallback']),
          generatedAt: z.string()
        })
      })
    })
    return result
  }

  /**
   * Get MCP installation status for project
   */
  async getMCPInstallationStatus(projectId: number): Promise<DataResponseSchema<{
    projectConfig: {
      projectId: number
      projectName: string
      mcpEnabled: boolean
      installedTools: Array<{
        tool: string
        installedAt: number
        configPath?: string
        serverName: string
      }>
      customInstructions?: string
    } | null
    connectionStatus: {
      connected: boolean
      sessionId?: string
      lastActivity?: number
      projectId?: number
    }
  }>> {
    const result = await this.request('GET', `/projects/${projectId}/mcp/installation/status`, {
      responseSchema: z.object({
        success: z.boolean(),
        data: z.object({
          projectConfig: z
            .object({
              projectId: z.number(),
              projectName: z.string(),
              mcpEnabled: z.boolean(),
              installedTools: z.array(
                z.object({
                  tool: z.string(),
                  installedAt: z.number(),
                  configPath: z.string().optional(),
                  serverName: z.string()
                })
              ),
              customInstructions: z.string().optional()
            })
            .nullable(),
          connectionStatus: z.object({
            connected: z.boolean(),
            sessionId: z.string().optional(),
            lastActivity: z.number().optional(),
            projectId: z.number().optional()
          })
        })
      })
    })
    return result as DataResponseSchema<{
      projectConfig: {
        projectId: number
        projectName: string
        mcpEnabled: boolean
        installedTools: Array<{
          tool: string
          installedAt: number
          configPath?: string
          serverName: string
        }>
        customInstructions?: string
      } | null
      connectionStatus: {
        connected: boolean
        sessionId?: string
        lastActivity?: number
        projectId?: number
      }
    }>
  }
}