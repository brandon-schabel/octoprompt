// Recent changes:
// - Initial implementation of agent instruction service
// - Added template management with version tracking
// - Implemented duplicate prevention using HTML comment markers
// - Added support for multiple agent file formats
// - Included project-specific customization

import * as fs from 'fs/promises'
import * as path from 'path'
import { z } from 'zod'

const INSTRUCTION_VERSION = '1.0'
const INSTRUCTION_START_MARKER = '<!-- PROMPTLIANO_MCP_INSTRUCTIONS_START'
const INSTRUCTION_END_MARKER = '<!-- PROMPTLIANO_MCP_INSTRUCTIONS_END -->'

export const AgentFileTypeSchema = z.enum([
  'claude',
  'copilot',
  'cursor',
  'aider',
  'codebase',
  'custom'
])

export type AgentFileType = z.infer<typeof AgentFileTypeSchema>

export interface AgentInstructionOptions {
  projectId: number
  projectName: string
  projectPath: string
  includeExamples?: boolean
  customInstructions?: string
}

export interface AgentFileInfo {
  type: AgentFileType
  path: string
  exists: boolean
  hasInstructions: boolean
  instructionVersion?: string
}

export class AgentInstructionService {
  private getInstructionTemplate(options: AgentInstructionOptions): string {
    const { projectId, projectName, includeExamples, customInstructions } = options

    let template = `${INSTRUCTION_START_MARKER} v${INSTRUCTION_VERSION} -->
# Promptliano MCP Integration

Promptliano MCP provides direct access to project context, files, and intelligent tools for the "${projectName}" project.

## Quick Start

First, get an overview of the current project:
\`\`\`
mcp__Promptliano__project_manager(
  action: "overview",
  projectId: ${projectId}
)
\`\`\`

## Available Tools

### Project Management
- **project_manager**: File operations, summaries, search
  - Actions: overview, get_summary, suggest_files, search, create_file

### Task Management  
- **ticket_manager**: Create and manage tickets
  - Actions: list, create, update, suggest_tasks, auto_generate_tasks
- **task_manager**: Manage tasks within tickets
  - Actions: create, update, list, suggest_files

### Knowledge Base
- **prompt_manager**: Access saved documentation and prompts
  - Actions: list_by_project, suggest_prompts

### Version Control
- **git_manager**: Comprehensive Git operations
  - Actions: status, commit, branches, stash, worktree operations

### AI Assistance
- **ai_assistant**: Optimize prompts and get project insights
  - Actions: optimize_prompt, get_compact_summary

## Key Features

- **Token-Efficient File Suggestions**: 90-95% token reduction with smart pre-filtering
- **Project-Aware Context**: All tools understand your current project context
- **Integrated Workflow**: Seamlessly move from planning to implementation
- **Git Worktree Support**: Manage multiple working directories efficiently`

    if (includeExamples) {
      template += `

## Examples

### Find relevant files for a feature:
\`\`\`
mcp__Promptliano__project_manager(
  action: "suggest_files",
  projectId: ${projectId},
  data: {
    prompt: "authentication components",
    limit: 10
  }
)
\`\`\`

### Create a new ticket with tasks:
\`\`\`
mcp__Promptliano__ticket_manager(
  action: "create",
  projectId: ${projectId},
  data: {
    title: "Implement user authentication",
    overview: "Add login/logout functionality",
    priority: "high"
  }
)
\`\`\``
    }

    if (customInstructions) {
      template += `

## Project-Specific Instructions

${customInstructions}`
    }

    template += `

Project ID: ${projectId}
${INSTRUCTION_END_MARKER}`

    return template
  }

  async updateAgentFile(
    filePath: string,
    options: AgentInstructionOptions
  ): Promise<{ success: boolean; message: string; backedUp?: boolean }> {
    try {
      const fileExists = await this.fileExists(filePath)
      let content = ''
      let backedUp = false

      if (fileExists) {
        content = await fs.readFile(filePath, 'utf-8')

        // Create backup
        const backupPath = `${filePath}.backup-${Date.now()}`
        await fs.writeFile(backupPath, content)
        backedUp = true

        // Check for existing instructions
        const startIndex = content.indexOf(INSTRUCTION_START_MARKER)
        const endIndex = content.indexOf(INSTRUCTION_END_MARKER)

        if (startIndex !== -1 && endIndex !== -1) {
          // Replace existing instructions
          const before = content.substring(0, startIndex)
          const after = content.substring(endIndex + INSTRUCTION_END_MARKER.length)
          content = before + this.getInstructionTemplate(options) + after
        } else {
          // Append instructions
          content = content.trimEnd() + '\n\n' + this.getInstructionTemplate(options) + '\n'
        }
      } else {
        // Create new file with instructions
        content = this.getInstructionTemplate(options) + '\n'
      }

      await fs.writeFile(filePath, content, 'utf-8')

      return {
        success: true,
        message: fileExists
          ? 'Successfully updated agent instructions'
          : 'Successfully created agent file with instructions',
        backedUp
      }
    } catch (error) {
      return {
        success: false,
        message: `Failed to update agent file: ${error instanceof Error ? error.message : 'Unknown error'}`
      }
    }
  }

  async detectAgentFiles(projectPath: string): Promise<AgentFileInfo[]> {
    const agentFiles: AgentFileInfo[] = []

    // Define common agent file patterns
    const patterns = [
      { type: 'claude' as AgentFileType, path: 'CLAUDE.md' },
      { type: 'claude' as AgentFileType, path: '.claude/CLAUDE.md' },
      { type: 'copilot' as AgentFileType, path: '.github/copilot-instructions.md' },
      { type: 'cursor' as AgentFileType, path: '.cursorrules' },
      { type: 'aider' as AgentFileType, path: '.aider/aider.conf.yml' },
      { type: 'codebase' as AgentFileType, path: 'codebase-instructions.md' },
      { type: 'codebase' as AgentFileType, path: '.ai/instructions.md' }
    ]

    for (const pattern of patterns) {
      const fullPath = path.join(projectPath, pattern.path)
      const exists = await this.fileExists(fullPath)
      let hasInstructions = false
      let instructionVersion: string | undefined

      if (exists) {
        const content = await fs.readFile(fullPath, 'utf-8')
        hasInstructions = content.includes(INSTRUCTION_START_MARKER)

        if (hasInstructions) {
          const versionMatch = content.match(new RegExp(`${INSTRUCTION_START_MARKER} v([\\d.]+)`))
          instructionVersion = versionMatch ? versionMatch[1] : undefined
        }
      }

      agentFiles.push({
        type: pattern.type,
        path: fullPath,
        exists,
        hasInstructions,
        instructionVersion
      })
    }

    return agentFiles
  }

  async removeInstructions(filePath: string): Promise<{ success: boolean; message: string }> {
    try {
      const content = await fs.readFile(filePath, 'utf-8')
      const startIndex = content.indexOf(INSTRUCTION_START_MARKER)
      const endIndex = content.indexOf(INSTRUCTION_END_MARKER)

      if (startIndex === -1 || endIndex === -1) {
        return {
          success: false,
          message: 'No Promptliano instructions found in file'
        }
      }

      const before = content.substring(0, startIndex)
      const after = content.substring(endIndex + INSTRUCTION_END_MARKER.length)
      const newContent = (before + after).replace(/\n\n+/g, '\n\n').trim() + '\n'

      await fs.writeFile(filePath, newContent, 'utf-8')

      return {
        success: true,
        message: 'Successfully removed Promptliano instructions'
      }
    } catch (error) {
      return {
        success: false,
        message: `Failed to remove instructions: ${error instanceof Error ? error.message : 'Unknown error'}`
      }
    }
  }

  private async fileExists(filePath: string): Promise<boolean> {
    try {
      await fs.access(filePath)
      return true
    } catch {
      return false
    }
  }

  isOutdated(version?: string): boolean {
    if (!version) return true
    return version !== INSTRUCTION_VERSION
  }

  getCurrentVersion(): string {
    return INSTRUCTION_VERSION
  }
}

export const agentInstructionService = new AgentInstructionService()