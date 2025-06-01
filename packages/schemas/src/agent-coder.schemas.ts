import { z } from '@hono/zod-openapi'
import { ProjectFileSchema, ProjectFileMapSchema, ProjectSchema } from '@octoprompt/schemas'
import { PromptSchema } from './prompt.schemas'
import { unixTSArrayOptionalSchemaSpec, unixTSArraySchemaSpec, unixTSSchemaSpec } from './schema-utils'

// Project/Task related schemas remain largely the same
export const AgentTaskStatusSchema = z.enum(['PENDING', 'IN_PROGRESS', 'COMPLETED', 'FAILED', 'SKIPPED']).openapi({
  description: 'The current lifecycle status of the task.',
  example: 'IN_PROGRESS'
})

export const AgentTaskSchema = z
  .object({
    id: unixTSSchemaSpec,
    title: z.string().min(5).openapi({
      description: "A brief, human-readable title summarizing the task's objective.",
      example: 'Refactor User Authentication Logic'
    }),
    description: z.string().min(20).openapi({
      description:
        'A detailed description of the changes required for the target file. This will be used as the primary instruction for the LLM rewrite.',
      example:
        'Update the login function in `src/auth.ts` to use asynchronous hashing for passwords and return a JWT token upon successful authentication.'
    }),
    targetFileId: unixTSSchemaSpec.optional(),
    targetFilePath: z.string().min(1).openapi({
      description:
        "The relative path of the primary source file (e.g., 'src/utils/auth.ts'). Required for all tasks. Used for creation path.",
      example: 'src/utils/auth.ts'
    }),
    status: AgentTaskStatusSchema.default('PENDING').openapi({
      description: 'Tracks the progress of the task through the workflow.',
      example: 'PENDING'
    }),
    relatedTestFileId: unixTSSchemaSpec.optional(),
    estimatedComplexity: z.enum(['LOW', 'MEDIUM', 'HIGH']).optional().openapi({
      description: "Optional: AI's estimation of the task's complexity.",
      example: 'MEDIUM'
    }),
    dependencies: unixTSArraySchemaSpec.optional(),
  })
  .openapi('AgentTask', {
    description:
      "Represents a single, well-defined unit of work required to fulfill part of the user's overall request, typically focused on one file."
  })

// Schema for the AI's file rewrite response
export const AgentFileRewriteResponseSchema = z
  .object({
    updatedContent: z.string().openapi({
      description:
        'The complete, updated content of the file after applying the changes requested in the task description.',
      example: "export function updatedFunction() { console.log('Updated!'); }"
    }),
    explanation: z.string().optional().openapi({
      description: 'A brief explanation of the changes made (optional but helpful).',
      example: 'Refactored the function to use async/await and added error handling.'
    })
  })
  .openapi('AgentFileRewriteResponse', {
    description: 'The structured response expected from the file rewrite AI agent.'
  })

// Schema for Agent Context Validation (Simplified potentially)
// Note: Examples for complex types like projectFiles/Map might be too verbose for OpenAPI spec, keep them minimal or omit
export const AgentContextSchema = z
  .object({
    userInput: z
      .string()
      .min(1)
      .openapi({ description: 'The original user request.', example: 'Please implement JWT authentication.' }),
    projectFiles: z
      .array(ProjectFileSchema)
      .min(1, 'At least one project file is required for context.')
      .openapi({ description: 'Array of project files provided as context.' }),
    projectFileMap: ProjectFileMapSchema.refine((map) => map.size > 0, {
      message: 'Project file map cannot be empty.'
    }).openapi({ description: 'Map representation of project files for quick lookup.' }),
    projectSummaryContext: z
      .string()
      .openapi({
        description: "A summary of the project's purpose and structure.",
        example: 'A Node.js backend service for managing user accounts.'
      }),
    project: ProjectSchema,
    agentJobId: unixTSSchemaSpec,
    prompts: z.array(PromptSchema).openapi({ description: 'The prompts to use for the agent.' }),
    selectedFileIds: unixTSArraySchemaSpec,
  })
  .refine((ctx) => ctx.projectFiles[0]?.projectId, {
    message: 'Could not determine projectId from the first project file.',
    path: ['projectFiles']
  })
  .openapi('AgentContext') // Add OpenAPI name here

export const AgentTaskPlanSchema = z
  .object({
    projectId: unixTSSchemaSpec,
    overallGoal: z
      .string()
      .openapi({
        description: 'A concise summary of the original user request being addressed by this plan.',
        example: 'Implement JWT-based authentication flow.'
      }),
    tasks: z
      .array(AgentTaskSchema)
      .min(1)
      .openapi({
        description:
          'An ordered list of tasks designed to collectively achieve the overall goal. Order implies execution sequence unless overridden by dependencies.'
      })
  })
  .openapi('AgentTaskPlan', {
    description:
      'A structured execution plan containing an ordered list of tasks derived from the user request, project summary, and file context.'
  })

// Schemas for Agent Run Request/Response (kept for potential API layer)
export const AgentCoderRunRequestSchema = z
  .object({
    userInput: z.string().min(1).openapi({
      description: 'The main instruction or goal for the agent.',
      example: 'Refactor the authentication logic in auth.ts to use JWT.'
    }),
    selectedFileIds: unixTSArraySchemaSpec,
    // generated on the client side and passed to the server to retrieve the execution logs and data for this run.
    agentJobId: unixTSSchemaSpec.optional(),
    selectedPromptIds: unixTSArrayOptionalSchemaSpec,
  })
  .openapi('AgentCoderRunRequest')

export const AgentCoderRunSuccessDataSchema = z
  .object({
    updatedFiles: unixTSArrayOptionalSchemaSpec.openapi({
      description: "The state of the project files after the agent's execution."
    }),
    taskPlan: AgentTaskPlanSchema.optional().openapi({
      description: 'The final task plan executed by the agent (includes task statuses).'
    }),
    agentJobId: z.number().openapi({
      description: 'The unique ID for retrieving the execution logs and data for this run.'
    })
  })
  .openapi('AgentCoderRunSuccessData')

export const AgentCoderRunResponseSchema = z
  .object({
    success: z.literal(true),
    data: AgentCoderRunSuccessDataSchema
  })
  .openapi('AgentCoderRunResponse')

// Define the response schema to include agentJobId instead of logId

// Schema reflecting the actual content saved in the *.agent-data.json log file
export const AgentDataLogSchema = z
  .object({
    agentJobDirPath: z
      .string()
      .openapi({ description: 'Absolute path to the directory containing logs for this job.' }),
    projectId: unixTSSchemaSpec,
    agentJobId: unixTSSchemaSpec,
    agentJobStartTime: unixTSSchemaSpec,
    // The initial plan generated before execution steps
    taskPlan: AgentTaskPlanSchema.optional().openapi({
      description: 'The initial task plan generated by the planning agent (before execution).'
    }),
    // Final status after the orchestrator attempted to run the plan
    finalStatus: z
      .enum(['Success', 'Failed', 'No tasks generated', 'Error'])
      .openapi({ description: 'The final outcome status of the agent run.' }),
    // The plan state after execution attempt (tasks have final statuses)
    finalTaskPlan: AgentTaskPlanSchema.nullable().openapi({
      description:
        'The task plan reflecting the state after execution attempts (tasks will have final statuses like COMPLETED, FAILED).'
    }),
    agentJobEndTime: unixTSSchemaSpec,
    // Optional fields only present on error
    errorMessage: z.string().optional().openapi({ description: 'Error message if the agent run failed.' }),
    errorStack: z.string().optional().openapi({ description: 'Stack trace if the agent run failed.' }),
    // Crucial for the confirm route: list of files proposed for writing
    updatedFiles: unixTSArrayOptionalSchemaSpec,
  })
  .openapi('AgentDataLog') // Give it a unique OpenAPI name

// --- Type Exports ---
export type Task = z.infer<typeof AgentTaskSchema>
export type TaskPlan = z.infer<typeof AgentTaskPlanSchema>
export type TaskStatus = z.infer<typeof AgentTaskStatusSchema>
export type CoderAgentDataContext = z.infer<typeof AgentContextSchema>
export type FileRewriteResponse = z.infer<typeof AgentFileRewriteResponseSchema>
export type AgentCoderRunRequest = z.infer<typeof AgentCoderRunRequestSchema>
export type AgentCoderRunSuccessData = z.infer<typeof AgentCoderRunSuccessDataSchema>
export type AgentCoderRunResponse = z.infer<typeof AgentCoderRunResponseSchema>
export type AgentDataLog = z.infer<typeof AgentDataLogSchema>
