// Recent changes:
// 1. Created simplified agent orchestrator instead of complex workflow
// 2. Uses direct agent calls with proper tool integration
// 3. Removed manual workflow execution that doesn't work with Mastra
// 4. Started simple with basic patterns instead of over-engineering
// 5. Focuses on working agent communication rather than complex orchestration

import { z } from 'zod'
import { enhancedCoderAgent, enhancedPlanningAgent } from '../agents/enhanced-coder-agent'
import { getProjectById } from '@octoprompt/services'
import { getFullProjectSummary } from '@octoprompt/services'
import { projectStorage } from '@octoprompt/storage'

// Input schema for the orchestrator
const AgentOrchestratorInput = z.object({
  projectId: z.number(),
  userRequest: z.string(),
  selectedFileIds: z.array(z.number()),
  agentJobId: z.number()
})

// Output schema for the orchestrator
const AgentOrchestratorOutput = z.object({
  success: z.boolean(),
  updatedFiles: z.array(
    z.object({
      id: z.number(),
      path: z.string(),
      content: z.string(),
      explanation: z.string()
    })
  ),
  summary: z.string(),
  error: z.string().optional()
})

type OrchestratorInput = z.infer<typeof AgentOrchestratorInput>
type OrchestratorOutput = z.infer<typeof AgentOrchestratorOutput>

/**
 * Simple agent orchestrator that uses direct agent calls
 * This is a working starting point that can be enhanced later
 */
export async function executeSimpleAgentOrchestrator(input: OrchestratorInput): Promise<OrchestratorOutput> {
  try {
    const { projectId, userRequest, selectedFileIds } = input
    // Note: agentJobId is available in input but not currently used in this implementation

    // 1. Get project context
    const project = await getProjectById(projectId)
    if (!project) {
      throw new Error(`Project with ID ${projectId} not found`)
    }

    const projectSummary = await getFullProjectSummary(projectId)

    // 2. Get selected files
    const selectedFiles: Array<{ id: number; path: string; content: string }> = []
    for (const fileId of selectedFileIds) {
      const file = await projectStorage.readProjectFile(projectId, fileId)
      if (file) {
        selectedFiles.push({
          id: file.id,
          path: file.path,
          content: file.content || ''
        })
      }
    }

    if (selectedFiles.length === 0) {
      throw new Error('No valid files found from selected file IDs')
    }

    // 3. Create planning prompt
    const planningPrompt = `You are helping with this coding request:

**Request:** ${userRequest}

**Project:** ${project.name}
**Project Summary:** ${projectSummary.substring(0, 500)}...

**Selected Files:**
${selectedFiles.map((f) => `- ${f.path} (${f.content.length} chars)`).join('\n')}

Please analyze this request and create a simple plan. For each file that needs changes, explain:
1. What changes are needed
2. Why these changes are needed
3. Any dependencies or order requirements

Keep the response concise and actionable.`

    // 4. Get planning response
    const planningResponse = await enhancedPlanningAgent.generate([{ role: 'user', content: planningPrompt }])

    // 5. Execute changes on each file
    const updatedFiles: Array<{
      id: number
      path: string
      content: string
      explanation: string
    }> = []
    for (const file of selectedFiles) {
      const codingPrompt = `Based on this request: "${userRequest}"

Please modify this file: **${file.path}**

Current content:
\`\`\`
${file.content}
\`\`\`

Project context: ${projectSummary.substring(0, 300)}...

Planning insight: ${planningResponse.text.substring(0, 300)}...

Please provide the complete updated file content. Make sure the code is functional and follows best practices.`

      const codingResponse = await enhancedCoderAgent.generate([{ role: 'user', content: codingPrompt }])

      // For now, we'll use the response text as the updated content
      // In a production system, you'd want structured output here
      let updatedContent = codingResponse.text

      // Simple heuristic: if response contains code blocks, extract the largest one
      const codeBlockRegex = /```(?:typescript|javascript|ts|js)?\n([\s\S]*?)\n```/g
      const codeBlocks: string[] = []
      let match: RegExpExecArray | null
      while ((match = codeBlockRegex.exec(codingResponse.text)) !== null) {
        if (match[1] && match[1].trim()) {
          codeBlocks.push(match[1].trim())
        }
      }

      if (codeBlocks.length > 0) {
        // Use the longest code block as the updated content
        updatedContent = codeBlocks.reduce((longest, current) => {
          return current.length > longest.length ? current : longest
        })
      }

      updatedFiles.push({
        id: file.id,
        path: file.path,
        content: updatedContent,
        explanation: `Modified ${file.path} according to request: ${userRequest}`
      })
    }

    return {
      success: true,
      updatedFiles,
      summary: `Successfully processed ${updatedFiles.length} files for request: ${userRequest}`
    }
  } catch (error) {
    return {
      success: false,
      updatedFiles: [],
      summary: 'Agent orchestration failed',
      error: error instanceof Error ? error.message : 'Unknown error'
    }
  }
}

// Export types for use in other modules
export type { OrchestratorInput, OrchestratorOutput }
