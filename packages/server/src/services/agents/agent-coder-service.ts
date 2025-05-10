import { MEDIUM_MODEL_CONFIG } from 'shared';
import { AiSdkOptions } from 'shared/src/schemas/gen-ai.schemas';
import { ProjectFile, } from 'shared/src/schemas/project.schemas';
import { buildProjectFileMap } from 'shared/src/utils/projects-utils';
import { generateStructuredData } from '../gen-ai-services';
import { computeChecksum } from '../file-services/file-sync-service-unified';
import { fromZodError } from 'zod-validation-error';
import { normalizePathForDb } from '@/utils/path-utils';
import { AGENT_LOGS_DIR, getOrchestratorLogFilePaths, initializeLogger, log, writeAgentDataLog, getAgentDataLogFilePath } from './agent-logger';
import { join } from 'node:path';
import { AgentTaskPlanSchema, CoderAgentDataContext, AgentFileRewriteResponseSchema, Task, TaskPlan, FileRewriteResponse, AgentTaskSchema, AgentContextSchema, AgentCoderRunRequestSchema, AgentCoderRunSuccessDataSchema, AgentDataLog } from 'shared/src/schemas/agent-coder.schemas';
import { FileSyncData, bulkCreateProjectFiles } from '../project-service';
import { basename, extname } from 'path';
import { ApiError } from 'shared';

const agentCoderPrompts = {
    planningAgent: {
        schema: AgentTaskPlanSchema,
        prompt: (agentContext: CoderAgentDataContext) => {
            const selectedFileIds = agentContext.selectedFileIds;
            const selectedFiles = agentContext.projectFiles.filter(f => selectedFileIds.includes(f.id));


            return `
    <goal>
    Analyze the user request and project summary to create a detailed, actionable task plan in JSON format conforming to the TaskPlanSchema.
    Break down the request into specific, sequential tasks, each focusing on modifying *one* file or creating *one* new file to progress towards the overall goal.
    Each task's description should clearly state the changes needed for *that specific task and file*.
    Ensure the generated JSON strictly adheres to the provided TaskPlanSchema. Include the projectId in the plan.
    Assign a descriptive title and a detailed description for each task.
    Specify the targetFilePath for every task.
    </goal>
    <prompts>
    ${agentContext.prompts.map(p => `<prompt name="${p.name}">${p.content}</prompt>`).join("\n")}
    </prompts>
    <user_request>${agentContext.userInput}</user_request>
    <project_summary>${agentContext.projectSummaryContext}</project_summary>
    <selected_files>
    ${selectedFiles.map(f => `
      <file>
        <id>${f.id}</id>
        <name>${f.name}</name>
        <path>${f.path}</path>
        <content><![CDATA[${f.content}]]></content>
      </file>`).join("")}
    </selected_files>
    <project_id>${agentContext.projectFiles[0].projectId}</project_id>
    <project_name>${agentContext.project.name}</project_name>
    <project_description>${agentContext.project.description}</project_description>
    `;
        },
        systemPrompt: (agentContext: CoderAgentDataContext) => {
            return `
    You are a meticulous software project planner. Generate a detailed, actionable task plan in the specified JSON format.
    Each task should target a single file modification or creation and have a clear description of the work required for that task.
    `;
        }
    },
    fileRewriteAgent: {
        schema: AgentFileRewriteResponseSchema,
        prompt: (agentContext: CoderAgentDataContext, task: Task, currentFileContent: string | null) => {
            const filePath = task.targetFilePath;
            const changeRequest = task.description; // The core instruction for the LLM

            // Determine if it's creation or modification for the prompt
            const isCreation = currentFileContent === null;

            // User prompt content varies slightly for creation vs modification
            let userPrompt = `
            < task_details >
            <file_path>${filePath} </file_path>
                < request_description > ${changeRequest} </request_description>
                    </task_details>
                        `;

            if (isCreation) {
                userPrompt += `
This file does not exist yet.Generate the complete initial content for this file based * only * on the request_description.
`;
                // await log(`Rewrite Agent Mode: File Creation`, 'verbose', { taskId: task.id });
            } else {
                userPrompt += `
            < current_file_content language = "typescript" >
                <![CDATA[${currentFileContent}]]>
                    </current_file_content>

Modify the < current_file_content > based * only * on the <request_description>.Output the * entire * updated file content.
`;
                // await log(`Rewrite Agent Mode: File Modification`, 'verbose', { taskId: task.id, currentContentLength: currentFileContent?.length });
            }

            // Optional: Add project context to the prompt if needed
            // userPrompt += `\n < project_context > ${ agentContext.projectSummaryContext } </project_context>`;

            userPrompt += `
Output the result strictly as JSON conforming to this schema:
<schema>${JSON.stringify(AgentFileRewriteResponseSchema.openapi("FileRewriteResponse"), null, 2)}</schema>
`;

            return userPrompt
        },
        systemPrompt: (agentContext: CoderAgentDataContext, currentFileContent: string | null) => {
            const isCreation = currentFileContent === null;

            const actionVerb = isCreation ? "Create" : "Update";

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
`;
        }
    }
}

// --- Configuration ---
const AI_OPTIONS: AiSdkOptions = MEDIUM_MODEL_CONFIG; // Use your desired model config
const AI_REWRITE_TEMPERATURE = 0.3; // Adjust temperature for rewrite creativity vs precision

// --- Agent Function Definitions ---

// Planning Agent remains useful for breaking down the work
async function runPlanningAgent(agentContext: CoderAgentDataContext): Promise<TaskPlan> {
    await log("Running Planning Agent...", 'info');

    const result = await generateStructuredData({
        prompt: agentCoderPrompts.planningAgent.prompt(agentContext),
        schema: agentCoderPrompts.planningAgent.schema,
        options: AI_OPTIONS, // Use base options, maybe slightly higher temp for planning
        systemMessage: agentCoderPrompts.planningAgent.systemPrompt(agentContext),
    });

    const validationResult = agentCoderPrompts.planningAgent.schema.safeParse(result.object);
    if (!validationResult.success) {
        const error = fromZodError(validationResult.error);
        const errorMsg = `Planning Agent failed to produce a valid TaskPlan: ${error.message} `;
        await log(`Planning Agent Output Validation Failed: ${error.message} `, 'error', { validationError: validationResult.error.format(), rawOutput: result.object });
        throw new ApiError(500, errorMsg, 'PLANNING_AGENT_VALIDATION_FAILED', validationResult.error.format());
    }

    // Ensure projectId is set
    const plan = validationResult.data;
    plan.projectId = plan.projectId || agentContext.projectFiles[0].projectId;

    // Basic validation for tasks
    for (const task of plan.tasks) {
        if (!task.targetFilePath) {
            const errorMsg = `Planning Agent generated a task(ID: ${task.id}, Title: ${task.title}) without a targetFilePath.`;
            await log(errorMsg, 'error', { task });
            throw new ApiError(500, errorMsg, 'PLANNING_AGENT_INVALID_TASK', { task });
        }
        task.targetFilePath = normalizePathForDb(task.targetFilePath); // Normalize path early
    }


    await log("Planning Agent finished successfully.", 'info');
    return plan;
}


async function runFileRewriteAgent(
    task: Task,
    currentFileContent: string | null, // Null if the file is being created
    agentContext: CoderAgentDataContext // Pass context for potential use in prompt
): Promise<FileRewriteResponse> {
    await log(`Running File Rewrite Agent for task: ${task.title} `, 'info', { taskId: task.id, targetFile: task.targetFilePath });

    await log(`Rewrite Agent Mode: File Modification`, 'verbose', { taskId: task.id, currentContentLength: currentFileContent?.length });

    // --- Call LLM ---
    try {
        await log(`Calling LLM for file rewrite...`, 'verbose', { taskId: task.id, filePath: task.targetFilePath });
        const result = await generateStructuredData({
            prompt: agentCoderPrompts.fileRewriteAgent.prompt(agentContext, task, currentFileContent),
            schema: AgentFileRewriteResponseSchema,
            options: { ...AI_OPTIONS, temperature: AI_REWRITE_TEMPERATURE }, // Use specific temp for rewrite
            systemMessage: agentCoderPrompts.fileRewriteAgent.systemPrompt(agentContext, currentFileContent),
        });

        // --- Validate Response ---
        const validationResult = AgentFileRewriteResponseSchema.safeParse(result.object);
        if (!validationResult.success) {
            const error = fromZodError(validationResult.error);
            const errorMsg = `File Rewrite Agent failed to produce a valid response: ${error.message}`;
            await log(`File Rewrite Agent Output Validation Failed: ${error.message}`, 'error', { taskId: task.id, validationError: validationResult.error.format(), rawOutput: result.object });
            throw new ApiError(500, errorMsg, 'FILE_REWRITE_AGENT_VALIDATION_FAILED', validationResult.error.format());
        }

        await log(`File Rewrite Agent finished successfully for task: ${task.title}`, 'info', { taskId: task.id });
        return validationResult.data;

    } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        await log(`File Rewrite Agent failed for task ${task.id}: ${errorMessage}`, 'error', { taskId: task.id, error: errorMessage, stack: error instanceof Error ? error.stack : undefined });
        if (error instanceof ApiError) throw error;
        throw new ApiError(500, `AI file rewrite failed for task ${task.id} (${task.title}) on file ${task.targetFilePath}: ${errorMessage}`, 'FILE_REWRITE_AI_ERROR', { taskId: task.id });
    }
}


// this basically takes all the tasks and project files, creates modifications, it will there return the full modified project files
// then we will parse the diferences and write the changes to the filesystem.
export async function createFileChangeDiffFromTaskPlan(agentContext: CoderAgentDataContext, taskPlan: TaskPlan): Promise<{ files: ProjectFile[], tasks: TaskPlan }> {
    let currentFileMapState = new Map<string, ProjectFile>(agentContext.projectFileMap);


    //  Execute Tasks Sequentially (Respecting Dependencies could be added here)
    for (let i = 0; i < taskPlan.tasks.length; i++) {
        const task = taskPlan.tasks[i];
        // Validate task structure
        const taskValidation = AgentTaskSchema.safeParse(task);
        if (!taskValidation.success) {
            const validationError = fromZodError(taskValidation.error);
            const errorMsg = `Invalid task structure encountered at index ${i}: ${validationError.message}. Task Title: ${task.title || 'N/A'}`;
            await log(errorMsg, 'error', { taskIndex: i, taskTitle: task.title || 'N/A', validationError: taskValidation.error.format() });
            task.status = 'FAILED';
            throw new ApiError(400, errorMsg, 'INVALID_TASK_STRUCTURE', { taskIndex: i, taskTitle: task.title, validationError: taskValidation.error.format() });
        }

        if (task.status !== 'PENDING') { // Skip non-pending tasks
            await log(`--- Skipping Task ${i + 1}/${taskPlan.tasks.length}: ${task.title} (Status: ${task.status}) ---`, 'info', { taskId: task.id, status: task.status });
            continue;
        }

        await log(`--- Starting Task ${i + 1}/${taskPlan.tasks.length}: ${task.title} ---`, 'info', { taskId: task.id, taskIndex: i, totalTasks: taskPlan.tasks.length, targetFile: task.targetFilePath });
        task.status = 'IN_PROGRESS';

        // Normalize path just in case it wasn't done earlier
        const normalizedTaskPath = normalizePathForDb(task.targetFilePath);
        task.targetFilePath = normalizedTaskPath;

        try {
            // ** Determine Task Type: Create, Delete, or Modify **
            let isCreationTask = false;
            let targetFile: ProjectFile | undefined = undefined;

            // Try to find the file by path in the *current* state
            targetFile = [...currentFileMapState.values()].find(f => normalizePathForDb(f.path) === normalizedTaskPath);

            if (!targetFile) {
                // If not found by path, assume it needs to be created (or task is invalid)
                // We rely on the Planning Agent to correctly identify creation tasks vs. modifications of non-existent files.
                isCreationTask = true;
                await log(`Task ${task.id} determined as file creation for path: ${normalizedTaskPath}`, 'info', { taskId: task.id });
                // TODO: Add more robust check? What if planner meant to modify but file was deleted?
            } else {
                // File exists, ensure task has the correct ID (it might be missing from the planner)
                if (!task.targetFileId) {
                    await log(`Task ${task.id} targetFileId missing, but file found by path. Updating task.`, 'warn', { taskId: task.id, foundFileId: targetFile.id });
                    task.targetFileId = targetFile.id;
                } else if (task.targetFileId !== targetFile.id) {
                    // Mismatch between path and ID - indicates inconsistency
                    await log(`Task ${task.id} targetFileId (${task.targetFileId}) mismatches ID found by path (${targetFile.id}) for ${normalizedTaskPath}. Prioritizing path match.`, 'error', { taskId: task.id });
                    task.targetFileId = targetFile.id; // Prioritize path match from current state
                    // Consider throwing an error here for stricter state management
                }
                await log(`Task ${task.id} determined as file modification for path: ${normalizedTaskPath} (ID: ${targetFile.id})`, 'info', { taskId: task.id });
            }


            // ** Execute Action **
            if (isCreationTask) {
                // 1. Prepare data for bulk creation
                await log(`[Orchestrator] Preparing data for bulkCreateProjectFiles for new file`, 'verbose', { projectId: agentContext.project.id, path: normalizedTaskPath });
                const placeholderContent = "// Placeholder: Content will be generated by AI...";
                const fileSyncData: FileSyncData = {
                    path: normalizedTaskPath,
                    name: basename(normalizedTaskPath),
                    extension: extname(normalizedTaskPath),
                    content: placeholderContent,
                    size: Buffer.byteLength(placeholderContent, 'utf8'),
                    checksum: computeChecksum(placeholderContent)
                };

                // 2. Call bulkCreateProjectFiles with the single file data
                const createdFiles = await bulkCreateProjectFiles(agentContext.project.id, [fileSyncData]);

                if (!createdFiles || createdFiles.length !== 1) {
                    throw new Error(`[Orchestrator] Failed to create file record via bulk operation for path: ${normalizedTaskPath}`);
                }
                const newFileRecord = createdFiles[0]; // Get the single created file record
                await log(`[Orchestrator] DB record created via bulk for ${newFileRecord.path}. ID: ${newFileRecord.id}`, 'info');


                // Update task with the new ID
                task.targetFileId = newFileRecord.id;

                // 3. Call Rewrite Agent to generate INITIAL content
                const rewriteResponse = await runFileRewriteAgent(task, null, agentContext); // Pass null content

                // 4. Update the new record with AI-generated content
                const newContent = rewriteResponse.updatedContent;
                const newChecksum = computeChecksum(newContent);
                const updatedFileRecord: ProjectFile = {
                    ...newFileRecord, // Spread properties from DB record
                    content: newContent,
                    checksum: newChecksum,
                    size: Buffer.byteLength(newContent, 'utf8'),
                    updatedAt: new Date().toISOString(),
                    // Ensure all ProjectFile fields are present
                };

                // 5. Add to state map
                currentFileMapState.set(updatedFileRecord.id, updatedFileRecord);
                await log(`[Orchestrator] Added newly created and AI-populated file to state: ${normalizedTaskPath}`, 'verbose', { fileId: updatedFileRecord.id });

            } else if (targetFile) { // Modification Task
                // 1. Get current content
                const currentContent = targetFile.content ?? ''; // Handle potentially null content gracefully
                const originalChecksum = targetFile.checksum;

                // 2. Call Rewrite Agent
                const rewriteResponse = await runFileRewriteAgent(task, currentContent, agentContext);

                // 3. Check if content actually changed
                const updatedContent = rewriteResponse.updatedContent;
                const newChecksum = computeChecksum(updatedContent);

                if (newChecksum === originalChecksum) {
                    await log(`[Orchestrator] File content unchanged by Rewrite Agent for ${normalizedTaskPath}. Skipping update.`, 'info', { taskId: task.id, fileId: targetFile.id });
                } else {
                    // 4. Update file in the state map
                    const updatedFile: ProjectFile = {
                        ...targetFile,
                        content: updatedContent,
                        checksum: newChecksum,
                        size: Buffer.byteLength(updatedContent, 'utf8'),
                        updatedAt: new Date().toISOString(),
                    };
                    currentFileMapState.set(targetFile.id, updatedFile);
                    await log(`[Orchestrator] Updated file content in state map for ${normalizedTaskPath}`, 'verbose', { taskId: task.id, fileId: targetFile.id, oldChecksum: originalChecksum, newChecksum });
                }
            } else {
                // Should not happen if logic above is correct
                throw new Error(`[Orchestrator] Inconsistent state for task ${task.id}: Not a creation task, but target file not found.`);
            }

            task.status = 'COMPLETED';

        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : String(error);
            const errorMsg = `Error processing task ${task.id} (${task.title}) for file ${task.targetFilePath}: ${errorMessage}`;
            await log(errorMsg, 'error', { taskId: task.id, taskTitle: task.title, file: task.targetFilePath, error: errorMessage, stack: error instanceof Error ? error.stack : undefined });
            task.status = 'FAILED';
            await log(`Task ${task.id} failed. Stopping workflow.`, 'error', { taskId: task.id });
            if (error instanceof ApiError) throw error;
            throw new ApiError(500, errorMsg, 'TASK_PROCESSING_FAILED', { taskId: task.id, taskTitle: task.title, file: task.targetFilePath });
        }

        await log(`--- Finished Task ${i + 1}: ${task.title} (Status: ${task.status}) ---`, 'info', { taskId: task.id, status: task.status });

    }

    return { files: Array.from(currentFileMapState.values()), tasks: taskPlan };
}

export type CoderAgentOrchestratorSuccessResult = {
    updatedFiles: ProjectFile[];
    taskPlan: TaskPlan | null;
    agentJobId: string;
    agentDataLog: AgentDataLog; // Use the specific type here
};


export async function mainOrchestrator(rawAgentContext: CoderAgentDataContext): Promise<CoderAgentOrchestratorSuccessResult> {
    const agentJobId = rawAgentContext.agentJobId;
    const agentJobDirPath = join(AGENT_LOGS_DIR, agentJobId);
    let { filePath: logFilePath } = { filePath: '' }; // Initialize to prevent uninitialized errors

    const agentDataLog: AgentDataLog = {
        agentJobDirPath,
        projectId: rawAgentContext.project.id,
        agentJobId,
        agentJobStartTime: new Date().toISOString(),
        taskPlan: { overallGoal: '', tasks: [], projectId: rawAgentContext.project.id },
        finalStatus: 'No tasks generated',
        finalTaskPlan: null,
        errorMessage: '',
        errorStack: '',
        agentJobEndTime: '',
        updatedFiles: [],
    }

    // Get the log file path using the agentJobId
    try {
        const paths = await getOrchestratorLogFilePaths(agentJobId);
        logFilePath = paths.filePath;
        await initializeLogger(logFilePath);
        await log(`[Orchestrator] Starting run ${agentJobId} for project ${rawAgentContext.project.id}. Logging to: ${logFilePath}`, 'info');
    } catch (initError: any) {
        // If logger initialization fails, we can't log much more.
        // Populate basic data log and rethrow as a critical error.
        agentDataLog.finalStatus = 'Error';
        agentDataLog.errorMessage = `Logger initialization failed: ${initError.message}`;
        agentDataLog.errorStack = initError.stack;
        agentDataLog.agentJobEndTime = new Date().toISOString();
        // Attempt to write the data log even if logger init failed
        try {
            await writeAgentDataLog(agentJobId, agentDataLog);
        } catch (dataLogWriteError: any) {
            console.error(`[Orchestrator CRITICAL] Failed to write AgentDataLog after logger init failure for ${agentJobId}: ${dataLogWriteError.message}`);
        }
        throw new ApiError(500, `Orchestrator logger initialization failed for ${agentJobId}: ${initError.message}`, 'ORCHESTRATOR_LOG_INIT_FAILED');
    }


    // 1. Validate Agent Context
    const contextValidation = AgentContextSchema.safeParse({
        ...rawAgentContext,
        projectFileMap: buildProjectFileMap(rawAgentContext.projectFiles || []),
    });

    if (!contextValidation.success) {
        const error = fromZodError(contextValidation.error);
        const errorMsg = `Invalid agent context: ${error.message}`;
        await log(`Orchestrator initial context validation failed: ${error.message}`, 'error', { validationError: contextValidation.error.format() });
        // Populate AgentDataLog before throwing
        agentDataLog.finalStatus = 'Error';
        agentDataLog.errorMessage = errorMsg;
        agentDataLog.errorStack = JSON.stringify(contextValidation.error.format()); // Or some other serialization
        throw new ApiError(422, errorMsg, 'INVALID_AGENT_CONTEXT', contextValidation.error.format());
    }
    const agentContext: CoderAgentDataContext = contextValidation.data;

    // Initialize state
    const initialProjectId = agentContext.projectFiles[0].projectId;
    let finalTaskPlan: TaskPlan | null = null;

    try {
        // Planning Agent
        finalTaskPlan = await runPlanningAgent(agentContext);
        agentDataLog.taskPlan = finalTaskPlan;

        if (!finalTaskPlan || finalTaskPlan.tasks.length === 0) {
            await log("No tasks generated by Planning Agent. Exiting.", 'info');
            agentDataLog.finalStatus = 'No tasks generated';
            return {
                updatedFiles: [],
                taskPlan: finalTaskPlan,
                agentJobId,
                agentDataLog
            };
        }
        // Ensure plan projectId matches context projectId
        if (finalTaskPlan.projectId !== initialProjectId) {
            await log(`Project ID mismatch between context (${initialProjectId}) and plan (${finalTaskPlan.projectId}). Using plan ID.`, 'warn');
        }

        const { files: allFinalFiles, tasks: executedTaskPlan } = await createFileChangeDiffFromTaskPlan(agentContext, finalTaskPlan);
        finalTaskPlan = executedTaskPlan; // Update finalTaskPlan with statuses from execution

        // --- Filter for changed files ---
        const initialFileMap = agentContext.projectFileMap;
        const changedFiles: ProjectFile[] = allFinalFiles.filter(finalFile => {
            const initialFile = initialFileMap.get(finalFile.id);
            // Include if it's a new file (not in initial map) or if checksum differs
            return !initialFile || initialFile.checksum !== finalFile.checksum;
        });
        // --- End Filter ---

        await log(`Orchestrator finished successfully. Changed files: ${changedFiles.length}`, 'info');

        agentDataLog.finalStatus = 'Success';
        agentDataLog.finalTaskPlan = finalTaskPlan;
        agentDataLog.updatedFiles = changedFiles;

        return {
            updatedFiles: changedFiles,
            taskPlan: finalTaskPlan,
            agentJobId,
            agentDataLog,
        };

    } catch (error: any) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        await log(`Orchestrator failed: ${errorMessage}`, 'error', { error: errorMessage, stack: error instanceof Error ? error.stack : undefined });

        agentDataLog.finalStatus = 'Error';
        agentDataLog.errorMessage = errorMessage;
        agentDataLog.errorStack = error instanceof Error ? error.stack : undefined;
        agentDataLog.finalTaskPlan = finalTaskPlan; // Log the task plan state at point of failure

        // If updatedFiles were partially computed before error, decide if they should be logged
        // For now, updatedFiles in agentDataLog will only be set on full success path.
        // Or, if createFileChangeDiffFromTaskPlan throws, changedFilesOnError logic would be here.
        // However, createFileChangeDiffFromTaskPlan now throws immediately.

        if (error instanceof ApiError) {
            throw error; // Re-throw ApiError after logging it to AgentDataLog
        }
        // For other errors, wrap them in a new ApiError
        throw new ApiError(500, `Orchestrator failed: ${errorMessage}`, 'ORCHESTRATOR_UNHANDLED_ERROR', { agentJobId, originalError: errorMessage });
    } finally {
        agentDataLog.agentJobEndTime = new Date().toISOString();
        try {
            await writeAgentDataLog(agentJobId, agentDataLog);
            if (logFilePath) { // Check if logFilePath was initialized
                await log(`[Orchestrator] Run ${agentJobId} processing finished. Final status: ${agentDataLog.finalStatus}. Orchestrator logs at: ${logFilePath}. Data log at: ${getAgentDataLogFilePath(agentJobId)}`, 'info');
            } else {
                console.error(`[Orchestrator CRITICAL] logFilePath not available in finally block for ${agentJobId}. AgentDataLog written to: ${getAgentDataLogFilePath(agentJobId)}`);
            }
        } catch (finalLogWriteError: any) {
            console.error(`[Orchestrator CRITICAL] Failed to write final AgentDataLog for ${agentJobId}: ${finalLogWriteError.message}`);
            // Not throwing here to avoid masking the original error if one occurred
        }
    }
}

