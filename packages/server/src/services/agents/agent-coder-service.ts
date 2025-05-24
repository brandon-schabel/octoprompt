import { HIGH_MODEL_CONFIG, MEDIUM_MODEL_CONFIG, PLANNING_MODEL_CONFIG } from 'shared'
import { AiSdkOptions } from 'shared/src/schemas/gen-ai.schemas'
import { ProjectFile } from 'shared/src/schemas/project.schemas'
import { buildProjectFileMap } from 'shared/src/utils/projects-utils'
import { generateStructuredData } from '../gen-ai-services'
import { computeChecksum } from '../file-services/file-sync-service-unified'
import { fromZodError } from 'zod-validation-error'
import { normalizePathForDb } from '@/utils/path-utils'
import {
  AGENT_LOGS_DIR,
  getOrchestratorLogFilePaths,
  initializeLogger,
  log,
  writeAgentDataLog,
  getAgentDataLogFilePath
} from './agent-logger'
import { join } from 'node:path'
import {
  AgentTaskPlanSchema,
  CoderAgentDataContext,
  AgentFileRewriteResponseSchema,
  Task,
  TaskPlan,
  FileRewriteResponse,
  AgentTaskSchema,
  AgentContextSchema,
  AgentCoderRunRequestSchema,
  AgentCoderRunSuccessDataSchema,
  AgentDataLog
} from 'shared/src/schemas/agent-coder.schemas'
import { FileSyncData, bulkCreateProjectFiles } from '../project-service'
import { basename, extname } from 'path'
import { ApiError } from 'shared'
import { normalizeToUnixMs } from '@/utils/parse-timestamp'

const agentCoderPrompts = {
  planningAgent: {
    schema: AgentTaskPlanSchema,
    prompt: (agentContext: CoderAgentDataContext) => {
      const selectedFileIds = agentContext.selectedFileIds
      const selectedFiles = agentContext.projectFiles.filter((f) => selectedFileIds.includes(f.id))

      const promptContext = `
                <prompts>
    ${agentContext.prompts.map((p) => `<prompt name="${p.name}">${p.content}</prompt>`).join('\n')}
    </prompts>
            `

      const projectSummaryContext = `
    <project_summary>${agentContext.projectSummaryContext}</project_summary>
            `

      const selectedFilesContext = `
            <selected_files>
    ${selectedFiles
          .map(
            (f) => `
      <file>
        <id>${f.id}</id>
        <name>${f.name}</name>
        <path>${f.path}</path>
    </file>`
          )
          .join('')}
    </selected_files>
            `

      const goal = `    <goal>
    Analyze the user request and project summary to create a detailed, actionable task plan in JSON format conforming to the TaskPlanSchema.
    Break down the request into specific, sequential tasks, each focusing on modifying *one* file or creating *one* new file to progress towards the overall goal.
    Each task's description should clearly state the changes needed for *that specific task and file*.
    Ensure the generated JSON strictly adheres to the provided TaskPlanSchema. Include the projectId in the plan.
    Assign a descriptive title and a detailed description for each task.
    Specify the targetFilePath for every task.
    </goal>
`

      return `
    ${goal}
    ${promptContext}
    ${projectSummaryContext}
    <user_request>${agentContext.userInput}</user_request>
    ${selectedFilesContext}
    <project_id>${agentContext.projectFiles[0].projectId}</project_id>
    <project_name>${agentContext.project.name}</project_name>
    <project_description>${agentContext.project.description}</project_description>
    <schema>${JSON.stringify(AgentTaskPlanSchema.openapi('TaskPlan'), null, 2)}</schema>
    `
    },
    systemPrompt: (agentContext: CoderAgentDataContext) => {
      return `
    You are a meticulous software project planner. Generate a detailed, actionable task plan in the specified JSON format.
    Each task should target a single file modification or creation and have a clear description of the work required for that task.
    `
    }
  },
  fileRewriteAgent: {
    schema: AgentFileRewriteResponseSchema,
    prompt: (agentContext: CoderAgentDataContext, task: Task, currentFileContent: string | null) => {
      const filePath = task.targetFilePath
      const changeRequest = task.description // The core instruction for the LLM

      // Determine if it's creation or modification for the prompt
      const isCreation = currentFileContent === null

      // User prompt content varies slightly for creation vs modification
      let userPrompt = `
            < task_details >
            <file_path>${filePath} </file_path>
                < request_description > ${changeRequest} </request_description>
                    </task_details>
                        `

      if (isCreation) {
        userPrompt += `
This file does not exist yet.Generate the complete initial content for this file based * only * on the request_description.
`
        // await log(`Rewrite Agent Mode: File Creation`, 'verbose', { taskId: task.id });
      } else {
        userPrompt += `
            < current_file_content language = "typescript" >
                <![CDATA[${currentFileContent}]]>
                    </current_file_content>

Modify the < current_file_content > based * only * on the <request_description>.Output the * entire * updated file content.
`
        // await log(`Rewrite Agent Mode: File Modification`, 'verbose', { taskId: task.id, currentContentLength: currentFileContent?.length });
      }

      // Optional: Add project context to the prompt if needed
      // userPrompt += `\n < project_context > ${ agentContext.projectSummaryContext } </project_context>`;

      userPrompt += `
Output the result strictly as JSON conforming to this schema:
<schema>${JSON.stringify(AgentFileRewriteResponseSchema.openapi('FileRewriteResponse'), null, 2)}</schema>
`

      return userPrompt
    },
    systemPrompt: (agentContext: CoderAgentDataContext, currentFileContent: string | null) => {
      const isCreation = currentFileContent === null

      const actionVerb = isCreation ? 'Create' : 'Update'

      return `
You are an expert coding assistant.You will be given the path to a file, a description of the desired changes, and potentially the current content of the file.
Your task is to:
        1. Understand the user's request (the task description).
        2. ${actionVerb} the file content to meet the request.
3. Output a JSON object containing:
        - "updatedContent": The * entire * file content after applying the changes(or the completely new content if creating).
   - "explanation": A concise summary of the modifications you made or the purpose of the new file.
Strictly adhere to the JSON output format provided in the schema.Only output the valid JSON object.
Ensure the generated code is complete and correct for the file path specified.
`
    }
  }
}

// --- Configuration ---
const AI_OPTIONS: AiSdkOptions = HIGH_MODEL_CONFIG // Use your desired model config
const AI_REWRITE_TEMPERATURE = 0.3 // Adjust temperature for rewrite creativity vs precision

// --- Agent Function Definitions ---

// Planning Agent remains useful for breaking down the work
async function runPlanningAgent(agentContext: CoderAgentDataContext): Promise<TaskPlan> {
  await log('Running Planning Agent...', 'info', { agentJobId: agentContext.agentJobId })

  const planningPrompt = agentCoderPrompts.planningAgent.prompt(agentContext)
  const planningSystemPrompt = agentCoderPrompts.planningAgent.systemPrompt(agentContext)

  // Log the exact prompt being sent for planning
  await log('[Planning Agent] Sending request to LLM.', 'verbose', {
    agentJobId: agentContext.agentJobId,
    promptLength: planningPrompt.length, // Log length to avoid overly long logs
    systemPromptLength: planningSystemPrompt.length // Log length
    // For full prompt debugging, consider logging planningPrompt and planningSystemPrompt directly
    // if issues persist and lengths are manageable.
    // schemaDigest: computeChecksum(JSON.stringify(agentCoderPrompts.planningAgent.schema.openapi("TaskPlan"))).substring(0,12) // Checksum of schema
  })

  let result
  try {
    result = await generateStructuredData({
      prompt: planningPrompt,
      schema: agentCoderPrompts.planningAgent.schema,
      options: {
        // TODO: there seems to be an API issue when using GEMINI for planning, but calude 3.7 works fine
        ...PLANNING_MODEL_CONFIG
      },
      systemMessage: planningSystemPrompt
    })
  } catch (error: any) {
    const errorMessage = error.message || 'Unknown error from generateStructuredData'
    // Attempt to get more details if the error object includes them (e.g., raw response)
    const errorDetails = error.details || (error.cause ? { cause: error.cause } : {})
    const rawResponseInfo =
      (error as any).rawResponse || 'Raw response not available in error object from generateStructuredData'

    await log(`[Planning Agent] generateStructuredData call failed: ${errorMessage}`, 'error', {
      agentJobId: agentContext.agentJobId,
      errorMessage: errorMessage,
      errorDetails: errorDetails,
      rawResponseInfo: rawResponseInfo, // This might give a clue if the response was not JSON
      promptLength: planningPrompt.length,
      systemPromptLength: planningSystemPrompt.length
    })
    // Re-throw to be caught by mainOrchestrator, which handles overall job status and logging to agentDataLog
    throw new ApiError(
      500,
      `Planning Agent's call to generateStructuredData failed: ${errorMessage}`,
      'PLANNING_AGENT_LLM_CALL_FAILED',
      { originalErrorStack: error.stack, promptSample: planningPrompt.substring(0, 200) }
    )
  }

  await log(`[Planning Agent] Raw LLM Output from generateStructuredData:`, 'info', {
    agentJobId: agentContext.agentJobId,
    output: result.object
  })
  const validationResult = agentCoderPrompts.planningAgent.schema.safeParse(result.object)

  if (!validationResult.success) {
    const error = fromZodError(validationResult.error)
    const errorMsg = `Planning Agent failed to produce a valid TaskPlan: ${error.message} `
    await log(`Planning Agent Output Validation Failed: ${error.message} `, 'error', {
      agentJobId: agentContext.agentJobId,
      validationError: validationResult.error.format(),
      rawOutput: result.object
    })
    throw new ApiError(500, errorMsg, 'PLANNING_AGENT_VALIDATION_FAILED', validationResult.error.format())
  }

  // Ensure projectId is set
  const plan = validationResult.data
  plan.projectId = plan.projectId || agentContext.projectFiles[0].projectId

  // Basic validation for tasks
  for (const task of plan.tasks) {
    if (!task.targetFilePath) {
      const errorMsg = `Planning Agent generated a task(ID: ${task.id}, Title: ${task.title}) without a targetFilePath.`
      await log(errorMsg, 'error', { task })
      throw new ApiError(500, errorMsg, 'PLANNING_AGENT_INVALID_TASK', { task })
    }
    task.targetFilePath = normalizePathForDb(task.targetFilePath) // Normalize path early
  }

  await log('Planning Agent finished successfully.', 'info')
  return plan
}

async function runFileRewriteAgent(
  task: Task,
  currentFileContent: string | null, // Null if the file is being created
  agentContext: CoderAgentDataContext // Pass context for potential use in prompt
): Promise<FileRewriteResponse> {
  await log(`Running File Rewrite Agent for task: ${task.title} `, 'info', {
    agentJobId: agentContext.agentJobId,
    taskId: task.id,
    targetFile: task.targetFilePath
  })

  // No longer logging "Rewrite Agent Mode: File Modification" here, covered by initial log.
  // Specific logic for isCreation vs modification is handled in prompt generation.

  // --- Call LLM ---
  try {
    await log(`Calling LLM for file rewrite...`, 'verbose', {
      agentJobId: agentContext.agentJobId,
      taskId: task.id,
      filePath: task.targetFilePath,
      isCreation: currentFileContent === null
    })
    const result = await generateStructuredData({
      prompt: agentCoderPrompts.fileRewriteAgent.prompt(agentContext, task, currentFileContent),
      schema: AgentFileRewriteResponseSchema,
      options: { ...AI_OPTIONS, temperature: AI_REWRITE_TEMPERATURE }, // Use specific temp for rewrite
      systemMessage: agentCoderPrompts.fileRewriteAgent.systemPrompt(agentContext, currentFileContent)
    })

    await log(`[File Rewrite Agent] Raw LLM Output for task ${task.id}:`, 'info', {
      agentJobId: agentContext.agentJobId,
      taskId: task.id,
      output: result.object
    })
    // --- Validate Response ---
    const validationResult = AgentFileRewriteResponseSchema.safeParse(result.object)
    if (!validationResult.success) {
      const error = fromZodError(validationResult.error)
      const errorMsg = `File Rewrite Agent failed to produce a valid response: ${error.message}`
      await log(`File Rewrite Agent Output Validation Failed: ${error.message}`, 'error', {
        taskId: task.id,
        validationError: validationResult.error.format(),
        rawOutput: result.object
      })
      throw new ApiError(500, errorMsg, 'FILE_REWRITE_AGENT_VALIDATION_FAILED', validationResult.error.format())
    }

    await log(`File Rewrite Agent finished successfully for task: ${task.title}`, 'info', { taskId: task.id })
    return validationResult.data
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error)
    await log(`File Rewrite Agent failed for task ${task.id}: ${errorMessage}`, 'error', {
      taskId: task.id,
      error: errorMessage,
      stack: error instanceof Error ? error.stack : undefined
    })
    if (error instanceof ApiError) throw error
    throw new ApiError(
      500,
      `AI file rewrite failed for task ${task.id} (${task.title}) on file ${task.targetFilePath}: ${errorMessage}`,
      'FILE_REWRITE_AI_ERROR',
      { taskId: task.id }
    )
  }
}

// this basically takes all the tasks and project files, creates modifications, it will there return the full modified project files
// then we will parse the diferences and write the changes to the filesystem.
export async function createFileChangeDiffFromTaskPlan(
  agentContext: CoderAgentDataContext,
  taskPlan: TaskPlan
): Promise<{ files: ProjectFile[]; tasks: TaskPlan }> {
  let currentFileMapState = new Map<number, ProjectFile>(agentContext.projectFileMap)

  //  Execute Tasks Sequentially (Respecting Dependencies could be added here)
  for (let i = 0; i < taskPlan.tasks.length; i++) {
    const task = taskPlan.tasks[i]
    // Validate task structure
    const taskValidation = AgentTaskSchema.safeParse(task)
    if (!taskValidation.success) {
      const validationError = fromZodError(taskValidation.error)
      const errorMsg = `Invalid task structure encountered at index ${i}: ${validationError.message}. Task Title: ${task.title || 'N/A'}`
      await log(errorMsg, 'error', {
        taskIndex: i,
        taskTitle: task.title || 'N/A',
        validationError: taskValidation.error.format()
      })
      task.status = 'FAILED'
      throw new ApiError(400, errorMsg, 'INVALID_TASK_STRUCTURE', {
        taskIndex: i,
        taskTitle: task.title,
        validationError: taskValidation.error.format()
      })
    }

    if (task.status !== 'PENDING') {
      // Skip non-pending tasks
      await log(
        `--- Skipping Task ${i + 1}/${taskPlan.tasks.length}: ${task.title} (Status: ${task.status}) ---`,
        'info',
        { taskId: task.id, status: task.status }
      )
      continue
    }

    await log(`--- Starting Task ${i + 1}/${taskPlan.tasks.length}: ${task.title} ---`, 'info', {
      taskId: task.id,
      taskIndex: i,
      totalTasks: taskPlan.tasks.length,
      targetFile: task.targetFilePath
    })
    task.status = 'IN_PROGRESS'

    // Normalize path just in case it wasn't done earlier
    const normalizedTaskPath = normalizePathForDb(task.targetFilePath)
    task.targetFilePath = normalizedTaskPath

    try {
      // ** Determine Task Type: Create, Delete, or Modify **
      let isCreationTask = false
      let targetFile: ProjectFile | undefined = undefined

      // Try to find the file by path in the *current* state
      targetFile = [...currentFileMapState.values()].find((f) => normalizePathForDb(f.path) === normalizedTaskPath)

      if (!targetFile) {
        // If not found by path, assume it needs to be created (or task is invalid)
        // We rely on the Planning Agent to correctly identify creation tasks vs. modifications of non-existent files.
        isCreationTask = true
        await log(`Task ${task.id} determined as file creation for path: ${normalizedTaskPath}`, 'info', {
          taskId: task.id
        })
        // TODO: Add more robust check? What if planner meant to modify but file was deleted?
      } else {
        // File exists, ensure task has the correct ID (it might be missing from the planner)
        if (!task.targetFileId) {
          await log(`Task ${task.id} targetFileId missing, but file found by path. Updating task.`, 'warn', {
            taskId: task.id,
            foundFileId: targetFile.id
          })
          task.targetFileId = targetFile.id
        } else if (task.targetFileId !== targetFile.id) {
          // Mismatch between path and ID - indicates inconsistency
          await log(
            `Task ${task.id} targetFileId (${task.targetFileId}) mismatches ID found by path (${targetFile.id}) for ${normalizedTaskPath}. Prioritizing path match.`,
            'error',
            { taskId: task.id }
          )
          task.targetFileId = targetFile.id // Prioritize path match from current state
          // Consider throwing an error here for stricter state management
        }
        await log(
          `Task ${task.id} determined as file modification for path: ${normalizedTaskPath} (ID: ${targetFile.id})`,
          'info',
          { taskId: task.id }
        )
      }

      // ** Execute Action **
      if (isCreationTask) {
        // 1. Prepare data for bulk creation
        await log(`[Orchestrator] Preparing data for bulkCreateProjectFiles for new file`, 'verbose', {
          projectId: agentContext.project.id,
          path: normalizedTaskPath
        })
        const placeholderContent = '// Placeholder: Content will be generated by AI...'
        const fileSyncData: FileSyncData = {
          path: normalizedTaskPath,
          name: basename(normalizedTaskPath),
          extension: extname(normalizedTaskPath),
          content: placeholderContent,
          size: Buffer.byteLength(placeholderContent, 'utf8'),
          checksum: computeChecksum(placeholderContent)
        }

        // 2. Call bulkCreateProjectFiles with the single file data
        const createdFiles = await bulkCreateProjectFiles(agentContext.project.id, [fileSyncData])

        if (!createdFiles || createdFiles.length !== 1) {
          throw new Error(
            `[Orchestrator] Failed to create file record via bulk operation for path: ${normalizedTaskPath}`
          )
        }
        const newFileRecord = createdFiles[0] // Get the single created file record
        await log(
          `[Orchestrator] DB record created via bulk for ${newFileRecord.path}. ID: ${newFileRecord.id}`,
          'info'
        )

        task.targetFileId = newFileRecord.id

        // 3. Call Rewrite Agent to generate INITIAL content
        const rewriteResponse = await runFileRewriteAgent(task, null, agentContext) // Pass null content

        // 4. Update the new record with AI-generated content
        const newContent = rewriteResponse.updatedContent
        const newChecksum = computeChecksum(newContent)
        const updatedFileRecord: ProjectFile = {
          ...newFileRecord, // Spread properties from DB record
          content: newContent,
          checksum: newChecksum,
          size: Buffer.byteLength(newContent, 'utf8'),
          updated: normalizeToUnixMs(new Date())
          // Ensure all ProjectFile fields are present
        }

        // 5. Add to state map
        currentFileMapState.set(updatedFileRecord.id, updatedFileRecord)
        await log(
          `[Orchestrator] Added newly created and AI-populated file to state: ${normalizedTaskPath}`,
          'verbose',
          { fileId: updatedFileRecord.id }
        )
      } else if (targetFile) {
        // Modification Task
        // 1. Get current content
        const currentContent = targetFile.content ?? '' // Handle potentially null content gracefully
        const originalChecksum = targetFile.checksum

        // 2. Call Rewrite Agent
        const rewriteResponse = await runFileRewriteAgent(task, currentContent, agentContext)

        // 3. Check if content actually changed
        const updatedContent = rewriteResponse.updatedContent
        const newChecksum = computeChecksum(updatedContent)

        if (newChecksum === originalChecksum) {
          await log(
            `[Orchestrator] File content unchanged by Rewrite Agent for ${normalizedTaskPath}. Skipping update.`,
            'info',
            { taskId: task.id, fileId: targetFile.id }
          )
        } else {
          // 4. Update file in the state map
          const updatedFile: ProjectFile = {
            ...targetFile,
            content: updatedContent,
            checksum: newChecksum,
            size: Buffer.byteLength(updatedContent, 'utf8'),
            updated: normalizeToUnixMs(new Date())
          }
          currentFileMapState.set(targetFile.id, updatedFile)
          await log(`[Orchestrator] Updated file content in state map for ${normalizedTaskPath}`, 'verbose', {
            taskId: task.id,
            fileId: targetFile.id,
            oldChecksum: originalChecksum,
            newChecksum
          })
        }
      } else {
        // Should not happen if logic above is correct
        throw new Error(
          `[Orchestrator] Inconsistent state for task ${task.id}: Not a creation task, but target file not found.`
        )
      }

      task.status = 'COMPLETED'
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error)
      const errorMsg = `Error processing task ${task.id} (${task.title}) for file ${task.targetFilePath}: ${errorMessage}`
      await log(errorMsg, 'error', {
        taskId: task.id,
        taskTitle: task.title,
        file: task.targetFilePath,
        error: errorMessage,
        stack: error instanceof Error ? error.stack : undefined
      })
      task.status = 'FAILED'
      await log(`Task ${task.id} failed. Stopping workflow.`, 'error', { taskId: task.id })
      if (error instanceof ApiError) throw error
      throw new ApiError(500, errorMsg, 'TASK_PROCESSING_FAILED', {
        taskId: task.id,
        taskTitle: task.title,
        file: task.targetFilePath
      })
    }

    await log(`--- Finished Task ${i + 1}: ${task.title} (Status: ${task.status}) ---`, 'info', {
      taskId: task.id,
      status: task.status
    })
  }

  return { files: Array.from(currentFileMapState.values()), tasks: taskPlan }
}

export type CoderAgentOrchestratorSuccessResult = {
  updatedFiles: ProjectFile[]
  taskPlan: TaskPlan | null
  agentJobId: number
  agentDataLog: AgentDataLog // Use the specific type here
}

export async function mainOrchestrator(
  rawAgentContext: CoderAgentDataContext
): Promise<CoderAgentOrchestratorSuccessResult> {
  const agentJobId = rawAgentContext.agentJobId
  // const agentJobDirPath = join(AGENT_LOGS_DIR, agentJobId); // This is determined by getOrchestratorLogFilePaths or getAgentDataLogFilePath

  // Initialize agentDataLog early to ensure it's available in catch/finally
  const agentDataLog: AgentDataLog = {
    // agentJobDirPath will be set once log paths are confirmed or from AGENT_LOGS_DIR structure
    agentJobDirPath: join(AGENT_LOGS_DIR, 'projects', rawAgentContext.project.id.toString(), 'jobs', agentJobId.toString()), // Initial sensible default
    projectId: rawAgentContext.project.id,
    agentJobId,
    agentJobStartTime: normalizeToUnixMs(new Date()),
    taskPlan: {
      overallGoal: rawAgentContext.userInput || 'User input not provided',
      tasks: [],
      projectId: rawAgentContext.project.id
    }, // Use userInput for overallGoal, ensure string
    finalStatus: 'PENDING' as any, // Initial status; cast to any to bypass strict literal type if 'PENDING' isn't in schema yet
    finalTaskPlan: null,
    errorMessage: '',
    errorStack: '',
    agentJobEndTime: normalizeToUnixMs(new Date()),
    updatedFiles: [] // Ensure it's always an array
  }

  let logFilePath: string | null = null // Ensure it's null if not set

  // Get the log file path using the agentJobId
  try {
    const paths = await getOrchestratorLogFilePaths(rawAgentContext.project.id, agentJobId)
    logFilePath = paths.filePath
    agentDataLog.agentJobDirPath = paths.jobLogDir // Update with actual job log directory
    await initializeLogger(logFilePath)
    await log(
      `[Orchestrator] Starting run ${agentJobId} for project ${rawAgentContext.project.id}. Logging to: ${logFilePath}`,
      'info',
      { agentJobId }
    )
  } catch (initError: any) {
    console.error(
      `[Orchestrator CRITICAL] Logger initialization failed for ${agentJobId}: ${initError.message}`,
      initError
    )
    agentDataLog.finalStatus = 'Error'
    agentDataLog.errorMessage = `Logger initialization failed: ${initError.message}`
    agentDataLog.errorStack = initError.stack
    agentDataLog.agentJobEndTime = normalizeToUnixMs(new Date())
    try {
      // Attempt to write data log even if orchestrator logger init fails, path might be guess but better than nothing
      await writeAgentDataLog(rawAgentContext.project.id, agentJobId, agentDataLog)
    } catch (dataLogWriteError: any) {
      console.error(
        `[Orchestrator CRITICAL] Failed to write AgentDataLog after logger init failure for ${agentJobId}: ${dataLogWriteError.message}`
      )
    }
    // This is a critical failure, rethrow.
    throw new ApiError(
      500,
      `Orchestrator logger (orchestrator-log.jsonl) initialization failed for ${agentJobId}: ${initError.message}`,
      'ORCHESTRATOR_LOG_INIT_FAILED',
      { originalError: initError.message }
    )
  }

  // 1. Validate Agent Context
  const contextValidation = AgentContextSchema.safeParse({
    ...rawAgentContext,
    projectFileMap: buildProjectFileMap(rawAgentContext.projectFiles || [])
  })

  if (!contextValidation.success) {
    const error = fromZodError(contextValidation.error)
    const errorMsg = `Invalid agent context: ${error.message}`
    await log(`Orchestrator initial context validation failed: ${error.message}`, 'error', {
      agentJobId,
      validationError: contextValidation.error.format()
    })
    agentDataLog.finalStatus = 'Error'
    agentDataLog.errorMessage = errorMsg
    agentDataLog.errorStack = JSON.stringify(contextValidation.error.format())
    agentDataLog.agentJobEndTime = normalizeToUnixMs(new Date()) // Set end time on error
    // No throw here, let finally block handle writing the data log
    // Then rethrow from main catch if this was the primary error
    // For now, we assume this is caught by the main try-catch block of the orchestrator.
    // Let's make this throw an ApiError directly.
    throw new ApiError(422, errorMsg, 'INVALID_AGENT_CONTEXT', contextValidation.error.format())
  }
  const agentContext: CoderAgentDataContext = contextValidation.data
  if (agentDataLog.taskPlan) {
    agentDataLog.taskPlan.overallGoal = agentContext.userInput || 'User input not provided' // Update overallGoal from validated contex
  }

  // Initialize state
  const initialProjectId = agentContext.project.id // Use agentContext.project.id
  let finalTaskPlan: TaskPlan | null = null

  try {
    await log(`[Orchestrator] Context validated for ${agentJobId}. Starting planning phase.`, 'info', { agentJobId })
    // Planning Agent
    finalTaskPlan = await runPlanningAgent(agentContext)
    agentDataLog.taskPlan = finalTaskPlan // Log the generated plan (or initial empty plan if it failed early)

    if (!finalTaskPlan || finalTaskPlan.tasks.length === 0) {
      await log('No tasks generated by Planning Agent. Exiting.', 'info', { agentJobId })
      agentDataLog.finalStatus = 'No tasks generated'
      agentDataLog.finalTaskPlan = finalTaskPlan // Store the (empty) plan
      // No 'return' here, let it go to finally block
    } else {
      if (finalTaskPlan.projectId !== initialProjectId) {
        await log(
          `Project ID mismatch between context (${initialProjectId}) and plan (${finalTaskPlan.projectId}). Using plan ID from task plan.`,
          'warn',
          { agentJobId, contextProjectId: initialProjectId, planProjectId: finalTaskPlan.projectId }
        )
        // This is more of a warning; the plan's projectId will likely be used by subsequent operations if they rely on it.
      }
      await log(
        `[Orchestrator] Planning complete for ${agentJobId}. ${finalTaskPlan.tasks.length} tasks generated. Starting task execution.`,
        'info',
        { agentJobId, taskCount: finalTaskPlan.tasks.length }
      )

      const { files: allFinalFiles, tasks: executedTaskPlan } = await createFileChangeDiffFromTaskPlan(
        agentContext,
        finalTaskPlan
      )
      finalTaskPlan = executedTaskPlan // Update finalTaskPlan with statuses from execution
      agentDataLog.finalTaskPlan = finalTaskPlan

      const initialFileMap = agentContext.projectFileMap
      const changedFiles: ProjectFile[] = allFinalFiles.filter((finalFile) => {
        const initialFile = initialFileMap.get(finalFile.id)
        return !initialFile || initialFile.checksum !== finalFile.checksum
      })

      await log(
        `[Orchestrator] Task execution finished for ${agentJobId}. Changed files: ${changedFiles.length}`,
        'info',
        { agentJobId, changedFileCount: changedFiles.length }
      )
      agentDataLog.updatedFiles = changedFiles
      agentDataLog.finalStatus = 'Success'
    }
  } catch (error: any) {
    const errorMessage = error instanceof Error ? error.message : String(error)
    const errorStack = error instanceof Error ? error.stack : undefined
    const errorCode = (error as ApiError).code || 'ORCHESTRATOR_PROCESSING_ERROR'

    await log(`[Orchestrator] Error during run ${agentJobId}: ${errorMessage}`, 'error', {
      agentJobId,
      error: errorMessage,
      errorCode: errorCode,
      stack: errorStack,
      details: (error as ApiError).details
    })

    agentDataLog.finalStatus = 'Error'
    agentDataLog.errorMessage = errorMessage
    agentDataLog.errorStack = errorStack
    // finalTaskPlan would be whatever state it was in when error occurred.
    // If error was in planning, it's null or the pre-execution plan.
    // If error was in execution, it's the plan with partial statuses.
    agentDataLog.finalTaskPlan = finalTaskPlan

    if (error instanceof ApiError) {
      throw error // Re-throw ApiError, it will be caught by the route handler
    }
    // For other errors, wrap them in a new ApiError
    throw new ApiError(500, `Orchestrator failed: ${errorMessage}`, 'ORCHESTRATOR_UNHANDLED_ERROR', {
      agentJobId,
      originalError: errorMessage,
      originalStack: errorStack
    })
  } finally {
    agentDataLog.agentJobEndTime = normalizeToUnixMs(new Date())
    try {
      await writeAgentDataLog(rawAgentContext.project.id, agentJobId, agentDataLog)
      const agentDataLogPath = await getAgentDataLogFilePath(rawAgentContext.project.id, agentJobId)

      const finalMessage = `[Orchestrator] Run ${agentJobId} processing finished. Final status: ${agentDataLog.finalStatus}. Orchestrator logs at: ${logFilePath || 'N/A'}. Data log at: ${agentDataLogPath || 'N/A'}`
      if (agentDataLog.finalStatus === 'Error') {
        await log(finalMessage, 'error', {
          agentJobId,
          finalStatus: agentDataLog.finalStatus,
          errorMessage: agentDataLog.errorMessage
        })
      } else {
        await log(finalMessage, 'info', { agentJobId, finalStatus: agentDataLog.finalStatus })
      }
    } catch (finalLogWriteError: any) {
      // This is a critical failure in the final logging step.
      console.error(
        `[Orchestrator CRITICAL] Failed to write final AgentDataLog or orchestrator log for ${agentJobId}: ${finalLogWriteError.message}`,
        finalLogWriteError
      )
      // Avoid throwing here to not mask the original error if one occurred in the main try block.
      // However, if the main try block succeeded, this error in finally would be lost.
      // For now, just console.error.
    }
  }
  // After the finally block, return the result.
  // If an error was thrown in the try or catch block, it would have propagated out,
  // and this return statement wouldn't be reached for error cases.
  return {
    updatedFiles: agentDataLog.updatedFiles || [], // Ensure array output
    taskPlan: agentDataLog.finalTaskPlan,
    agentJobId,
    agentDataLog
  }
}
