import { MEDIUM_MODEL_CONFIG } from 'shared';
import { AiSdkOptions } from 'shared/src/schemas/gen-ai.schemas';
import { ProjectFile, } from 'shared/src/schemas/project.schemas';
import { buildProjectFileMap } from 'shared/src/utils/projects-utils';
import { generateStructuredData } from '../gen-ai-services';
import { createProjectFileRecord } from '../project-service'; // Assuming this interacts with your DB/storage
import { computeChecksum } from '../file-services/file-sync-service';
import { fromZodError } from 'zod-validation-error';
import { normalizePathForDb } from '@/utils/path-utils';
import { AGENT_LOGS_DIR, getOrchestratorLogFilePaths, initializeLogger, log, writeAgentDataLog } from './agent-logger';
import { join } from 'node:path';
import { AgentTaskPlanSchema, CoderAgentDataContext, AgentFileRewriteResponseSchema, Task, TaskPlan, FileRewriteResponse, AgentTaskSchema, AgentContextSchema, AgentCoderRunRequestSchema, AgentCoderRunSuccessDataSchema } from 'shared/src/schemas/agent-coder.schemas';

const agentCoderPrompts = {
    planningAgent: {
        schema: AgentTaskPlanSchema,
        prompt: (agentContext: CoderAgentDataContext) => {
            return `
    <goal>
    Analyze the user request and project summary to create a detailed, actionable task plan in JSON format conforming to the TaskPlanSchema.
    Break down the request into specific, sequential tasks, each focusing on modifying *one* file or creating *one* new file to progress towards the overall goal.
    Each task's description should clearly state the changes needed for *that specific task and file*.
    Ensure the generated JSON strictly adheres to the provided TaskPlanSchema. Include the projectId in the plan.
    Assign a descriptive title and a detailed description for each task.
    Specify the targetFilePath for every task.
    </goal>
    <user_request>${agentContext.userInput}</user_request>
    <project_summary>${agentContext.projectSummaryContext}</project_summary>
    <project_id>${agentContext.projectFiles[0].projectId}</project_id>
    <schema>${JSON.stringify(AgentTaskPlanSchema.openapi("TaskPlan"), null, 2)}</schema>
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
        throw new Error(errorMsg);
    }

    // Ensure projectId is set
    const plan = validationResult.data;
    plan.projectId = plan.projectId || agentContext.projectFiles[0].projectId;

    // Basic validation for tasks
    for (const task of plan.tasks) {
        if (!task.targetFilePath) {
            const errorMsg = `Planning Agent generated a task(ID: ${task.id}, Title: ${task.title}) without a targetFilePath.`;
            await log(errorMsg, 'error', { task });
            throw new Error(errorMsg);
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
            throw new Error(errorMsg);
        }

        await log(`File Rewrite Agent finished successfully for task: ${task.title}`, 'info', { taskId: task.id });
        return validationResult.data;

    } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        await log(`File Rewrite Agent failed for task ${task.id}: ${errorMessage}`, 'error', { taskId: task.id, error: errorMessage, stack: error instanceof Error ? error.stack : undefined });
        throw new Error(`AI file rewrite failed for task ${task.id} (${task.title}) on file ${task.targetFilePath}: ${errorMessage}`);
    }
}


// this basically takes all the tasks and project files, creates modifications, it will there return the full modified project files
// then we will parse the diferences and write the changes to the filesystem.
export async function createFileChangeDiffFromTaskPlan(agentContext: CoderAgentDataContext, taskPlan: TaskPlan) {
    let overallSuccess = true;
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
            overallSuccess = false;
            break; // Stop processing
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
                // 1. Create DB Record (if needed by your persistence layer)
                // Ensure file doesn't accidentally exist in DB but not map (edge case)
                await log(`[Orchestrator] Calling createProjectFileRecord for new file`, 'verbose', { projectId: agentContext.projectId, path: normalizedTaskPath });
                const newFileRecord = await createProjectFileRecord(
                    agentContext.projectId,
                    normalizedTaskPath,
                    "// Placeholder: Content will be generated by AI..." // Initial temporary content before AI runs
                );
                await log(`[Orchestrator] DB record created for ${newFileRecord.path}. ID: ${newFileRecord.id}`, 'info');

                // Update task with the new ID
                task.targetFileId = newFileRecord.id;

                // 2. Call Rewrite Agent to generate INITIAL content
                const rewriteResponse = await runFileRewriteAgent(task, null, agentContext); // Pass null content

                // 3. Update the new record with AI-generated content
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

                // 4. Add to state map
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
            overallSuccess = false;
            await log(`Task ${task.id} failed. Stopping workflow.`, 'error', { taskId: task.id });
            break; // Halt the process on first task failure
        }

        await log(`--- Finished Task ${i + 1}: ${task.title} (Status: ${task.status}) ---`, 'info', { taskId: task.id, status: task.status });

    }

    return { success: overallSuccess, files: Array.from(currentFileMapState.values()), tasks: taskPlan };
}

export async function mainOrchestrator(rawAgentContext: CoderAgentDataContext): Promise<{ success: boolean; files: ProjectFile[]; tasks: TaskPlan | null; agentJobId: string; agentDataLog: Record<string, any> }> {
    const agentDataLog: Record<string, any> = {}
    const agentJobId = rawAgentContext.agentJobId;
    const agentJobDirPath = join(AGENT_LOGS_DIR, agentJobId);


    const writeDataLog = async () => {
        return writeAgentDataLog(agentJobId, agentDataLog);
    }
    agentDataLog.agentJobDirPath = agentJobDirPath;
    agentDataLog.projectId = rawAgentContext.projectId
    agentDataLog.agentJobId = agentJobId
    agentDataLog.agentJobStartTime = new Date().toISOString();


    await writeDataLog()

    // Get the log file path using the agentJobId
    const { filePath } = await getOrchestratorLogFilePaths(agentJobId);
    await initializeLogger(filePath);
    log(`[Orchestrator] Starting run ${agentJobId} for project ${rawAgentContext.projectId}. Logging to: ${filePath}`, 'info');

    // 1. Validate Agent Context
    const contextValidation = AgentContextSchema.safeParse({
        ...rawAgentContext,
        projectFileMap: buildProjectFileMap(rawAgentContext.projectFiles || []),
    });

    if (!contextValidation.success) {
        const error = fromZodError(contextValidation.error);
        const errorMsg = `Invalid agent context: ${error.message}`;
        await log(`Orchestrator initial context validation failed: ${error.message}`, 'error', { validationError: contextValidation.error.format() });
        throw new Error(errorMsg);
    }
    const agentContext: CoderAgentDataContext = contextValidation.data;

    // Initialize state
    const initialProjectId = agentContext.projectFiles[0].projectId;
    let finalTaskPlan: TaskPlan | null = null;
    let filesFromTaskPlan: ProjectFile[] = [];
    let tasksFromTaskPlan: TaskPlan | null = null;

    try {
        // Planning Agent
        finalTaskPlan = await runPlanningAgent(agentContext);
        agentDataLog.taskPlan = finalTaskPlan;

        if (!finalTaskPlan || finalTaskPlan.tasks.length === 0) {
            await log("No tasks generated by Planning Agent. Exiting.", 'info');
            agentDataLog.agentJobEndTime = new Date().toISOString();
            agentDataLog.finalStatus = 'No tasks generated';
            await writeDataLog()
            return { success: true, files: [], tasks: finalTaskPlan, agentJobId, agentDataLog }; // Use agentJobId
        }
        // Ensure plan projectId matches context projectId
        if (finalTaskPlan.projectId !== initialProjectId) {
            await log(`Project ID mismatch between context (${initialProjectId}) and plan (${finalTaskPlan.projectId}). Using plan ID.`, 'warn');
        }

        await writeDataLog()

        const { success: planImplementationSuccess, files: allFinalFiles, tasks: tasksFromTaskPlan } = await createFileChangeDiffFromTaskPlan(agentContext, finalTaskPlan);

        // --- Filter for changed files ---
        const initialFileMap = agentContext.projectFileMap;
        const changedFiles: ProjectFile[] = allFinalFiles.filter(finalFile => {
            const initialFile = initialFileMap.get(finalFile.id);
            // Include if it's a new file (not in initial map) or if checksum differs
            return !initialFile || initialFile.checksum !== finalFile.checksum;
        });
        // --- End Filter ---

        await log(`Orchestrator finished. Overall Success: ${planImplementationSuccess}. Changed files: ${changedFiles.length}`, 'info');
        await log(`Final Orchestrator State`, 'verbose', { success: planImplementationSuccess, changedFileCount: changedFiles.length, tasks: tasksFromTaskPlan });

        agentDataLog.finalStatus = planImplementationSuccess ? 'Success' : 'Failed';
        agentDataLog.finalTaskPlan = tasksFromTaskPlan; // Log final task state
        agentDataLog.agentJobEndTime = new Date().toISOString();
        agentDataLog.proposedFileChanges = changedFiles;

        await writeDataLog()

        return {
            success: planImplementationSuccess,
            files: changedFiles, // Return only changed files
            tasks: tasksFromTaskPlan,
            agentJobId, // Use agentJobId
            agentDataLog,
            
        };

    } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        const errorMsg = `Orchestrator failed with unhandled error: ${errorMessage}`;
        await log(errorMsg, 'error', { error: errorMessage, stack: error instanceof Error ? error.stack : undefined });
        await log(`Final Orchestrator State (on error)`, 'verbose', { success: false, fileCount: filesFromTaskPlan.length, tasks: tasksFromTaskPlan });

        agentDataLog.finalStatus = 'Error';
        agentDataLog.errorMessage = errorMessage;
        agentDataLog.errorStack = error instanceof Error ? error.stack : undefined;
        agentDataLog.agentJobEndTime = new Date().toISOString();
        agentDataLog.finalTaskPlan = tasksFromTaskPlan;

        await writeDataLog()

        // Filter for changed files even in error case (might have partial changes)
        const initialFileMapOnError = agentContext.projectFileMap;
        const changedFilesOnError: ProjectFile[] = filesFromTaskPlan.filter(finalFile => {
            const initialFile = initialFileMapOnError.get(finalFile.id);
            return !initialFile || initialFile.checksum !== finalFile.checksum;
        });

        // Return failure state with potentially changed files
        return {
            success: false,
            files: changedFilesOnError, // Return changed files identified before the error
            tasks: tasksFromTaskPlan,
            agentJobId, // Use agentJobId
            agentDataLog
        };
    }
}

