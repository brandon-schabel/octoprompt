import { z } from '@hono/zod-openapi'
import {
  validateDataField,
  createTrackedHandler,
  MCPError,
  MCPErrorCode,
  createMCPError,
  formatMCPErrorResponse,
  type MCPToolDefinition,
  type MCPToolResponse
} from '../shared'

export enum WebsiteDemoRunnerAction {
  LIST_SCENARIOS = 'list_scenarios',
  RUN_SCENARIO = 'run_scenario',
  GET_SCENARIO_STATUS = 'get_scenario_status',
  RESET_SCENARIO = 'reset_scenario'
}

const WebsiteDemoRunnerSchema = z.object({
  action: z.enum([
    WebsiteDemoRunnerAction.LIST_SCENARIOS,
    WebsiteDemoRunnerAction.RUN_SCENARIO,
    WebsiteDemoRunnerAction.GET_SCENARIO_STATUS,
    WebsiteDemoRunnerAction.RESET_SCENARIO
  ]),
  data: z.any().optional()
})

export const websiteDemoRunnerTool: MCPToolDefinition = {
  name: 'website_demo_runner',
  description:
    'Run interactive demos for the Promptliano website. Actions: list_scenarios (list available demos), run_scenario (execute a demo), get_scenario_status (check demo progress), reset_scenario (reset demo state)',
  inputSchema: {
    type: 'object',
    properties: {
      action: {
        type: 'string',
        description: 'The action to perform',
        enum: Object.values(WebsiteDemoRunnerAction)
      },
      data: {
        type: 'object',
        description:
          'Action-specific data. For run_scenario: { scenarioId: "getting-started", step: 1 }. For get_scenario_status: { scenarioId: "getting-started" }. For reset_scenario: { scenarioId: "getting-started" }'
      }
    },
    required: ['action']
  },
  handler: createTrackedHandler(
    'website_demo_runner',
    async (args: z.infer<typeof WebsiteDemoRunnerSchema>): Promise<MCPToolResponse> => {
      try {
        const { action, data } = args
        // Demo scenarios
        const scenarios = {
          'getting-started': {
            title: 'Getting Started with Promptliano',
            steps: [
              { id: 1, title: 'Install Promptliano', command: 'npm install -g @promptliano/cli' },
              { id: 2, title: 'Initialize project', command: 'promptliano init my-project' },
              { id: 3, title: 'Configure MCP', command: 'promptliano mcp setup' },
              { id: 4, title: 'Start using tools', command: 'Open your editor and start coding!' }
            ]
          },
          'project-management': {
            title: 'Project Management Demo',
            steps: [
              { id: 1, title: 'Create a project', command: 'Use project_manager to create' },
              { id: 2, title: 'Add files', command: 'Create and organize your files' },
              { id: 3, title: 'Create tickets', command: 'Use ticket_manager for tasks' },
              { id: 4, title: 'Track progress', command: 'Monitor your development' }
            ]
          },
          'git-workflow': {
            title: 'Git Integration Demo',
            steps: [
              { id: 1, title: 'Check status', command: 'git_manager status' },
              { id: 2, title: 'Stage changes', command: 'git_manager stage_all' },
              { id: 3, title: 'Commit', command: 'git_manager commit' },
              { id: 4, title: 'Push to remote', command: 'git_manager push' }
            ]
          }
        }
        switch (action) {
          case WebsiteDemoRunnerAction.LIST_SCENARIOS: {
            return {
              content: [
                {
                  type: 'text',
                  text:
                    'Available Demo Scenarios:\n\n' +
                    Object.entries(scenarios)
                      .map(
                        ([id, scenario]) =>
                          `**${id}**: ${scenario.title}\n` +
                          `  Steps: ${scenario.steps.length}\n` +
                          `  ${scenario.steps.map((s) => s.title).join(' → ')}`
                      )
                      .join('\n\n')
                }
              ]
            }
          }
          case WebsiteDemoRunnerAction.RUN_SCENARIO: {
            const scenarioId = validateDataField<string>(data, 'scenarioId', 'string', '"getting-started"')
            const step = data?.step || 1
            const scenario = scenarios[scenarioId as keyof typeof scenarios]
            if (!scenario) {
              throw createMCPError(MCPErrorCode.INVALID_PARAMS, `Unknown scenario: ${scenarioId}`)
            }
            const currentStep = scenario.steps[step - 1]
            if (!currentStep) {
              return {
                content: [
                  {
                    type: 'text',
                    text: `Demo "${scenario.title}" completed! 🎉\n\n` + 'All steps have been executed successfully.'
                  }
                ]
              }
            }
            const nextStep = step < scenario.steps.length ? step + 1 : null
            return {
              content: [
                {
                  type: 'text',
                  text:
                    `Running: ${scenario.title}\n\n` +
                    `Step ${step}/${scenario.steps.length}: ${currentStep.title}\n\n` +
                    `\`\`\`bash\n${currentStep.command}\n\`\`\`\n\n` +
                    `Progress: ${'█'.repeat(step)}${'░'.repeat(scenario.steps.length - step)} ${Math.round((step / scenario.steps.length) * 100)}%\n\n` +
                    (nextStep ? `Next: Run with step: ${nextStep}` : 'Demo complete!')
                }
              ]
            }
          }
          case WebsiteDemoRunnerAction.GET_SCENARIO_STATUS: {
            const scenarioId = validateDataField<string>(data, 'scenarioId', 'string', '"getting-started"')
            // In a real implementation, this would track actual progress
            return {
              content: [
                {
                  type: 'text',
                  text:
                    `Scenario "${scenarioId}" status:\n` +
                    `- Started: Yes\n` +
                    `- Current Step: 2/4\n` +
                    `- Completion: 50%\n` +
                    `- Last Activity: 2 minutes ago`
                }
              ]
            }
          }
          case WebsiteDemoRunnerAction.RESET_SCENARIO: {
            const scenarioId = validateDataField<string>(data, 'scenarioId', 'string', '"getting-started"')
            return {
              content: [
                {
                  type: 'text',
                  text: `Scenario "${scenarioId}" has been reset to the beginning.`
                }
              ]
            }
          }
          default:
            throw createMCPError(MCPErrorCode.UNKNOWN_ACTION, `Unknown action: ${action}`, {
              action,
              validActions: Object.values(WebsiteDemoRunnerAction)
            })
        }
      } catch (error) {
        const mcpError =
          error instanceof MCPError
            ? error
            : MCPError.fromError(error, { tool: 'website_demo_runner', action: args.action })
        return formatMCPErrorResponse(mcpError)
      }
    }
  )
}
