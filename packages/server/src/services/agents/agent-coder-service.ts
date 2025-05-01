import { MEDIUM_MODEL_CONFIG } from 'shared';
import { AiSdkOptions } from 'shared/src/schemas/gen-ai.schemas';
import { ProjectFile, ProjectFileMap, ProjectFileSchema, ProjectFileMapSchema } from 'shared/src/schemas/project.schemas';
import { buildProjectFileMap } from 'shared/src/utils/projects-utils';
import { generateStructuredData } from '../gen-ai-services';
import { createProjectFileRecord } from '../project-service'; // Assuming this interacts with your DB/storage
import { computeChecksum } from '../file-services/file-sync-service';
import { z } from 'zod';
import { fromZodError } from 'zod-validation-error';
import { normalizePathForDb } from '@/utils/path-utils';
import { getOrchestratorLogFilePath, initializeLogger, log } from './agent-logger';
import { v4 as uuidv4 } from 'uuid';




// --- Zod Schemas (Simplified) ---

// Schemas related to CodeModificationInstruction, CodeModificationPlan, ChangeType, CodeLocation, ImportStructure are REMOVED.

// Project/Task related schemas remain largely the same
export const TaskStatusSchema = z.enum(["PENDING", "IN_PROGRESS", "COMPLETED", "FAILED", "SKIPPED"]).describe("The current lifecycle status of the task.");

export const TaskSchema = z.object({
    id: z.string().min(1).describe("A unique ID automatically generated for tracking this specific task."),
    title: z.string().min(5).describe("A brief, human-readable title summarizing the task's objective (e.g., 'Refactor User Authentication Logic')."),
    description: z.string().min(20).describe("A detailed description of the changes required for the target file. This will be used as the primary instruction for the LLM rewrite."),
    targetFileId: z.string().optional().describe("The unique ID (from ProjectFileSchema) of the primary source file to be modified or created by this task. Will be populated by orchestrator for new files."),
    targetFilePath: z.string().min(1).describe("The relative path of the primary source file (e.g., 'src/utils/auth.ts'). Required for all tasks. Used for creation path."),
    // targetElement removed as it's less relevant without AST parsing
    status: TaskStatusSchema.default("PENDING").describe("Tracks the progress of the task through the workflow."),
    relatedTestFileId: z.string().optional().describe("Optional: The unique ID (from ProjectFileSchema) of the corresponding unit test file (e.g., 'src/utils/auth.test.ts'), if applicable."), // Keep for context if needed
    estimatedComplexity: z.enum(["LOW", "MEDIUM", "HIGH"]).optional().describe("Optional: AI's estimation of the task's complexity."), // Keep if useful for planning
    dependencies: z.array(z.string().min(1)).optional().describe("Optional: A list of other Task IDs that must be completed before this task can start."), // Keep for potential ordering
}).describe("Represents a single, well-defined unit of work required to fulfill part of the user's overall request, typically focused on one file.");


export const TaskPlanSchema = z.object({
    projectId: z.string().describe("The ID of the project context in which these tasks operate."),
    overallGoal: z.string().describe("A concise summary of the original user request being addressed by this plan."),
    tasks: z.array(TaskSchema).min(1).describe("An ordered list of tasks designed to collectively achieve the overall goal. Order implies execution sequence unless overridden by dependencies."),
}).describe("A structured execution plan containing an ordered list of tasks derived from the user request, project summary, and file context.");

// Schema for the AI's file rewrite response
export const FileRewriteResponseSchema = z.object({
    updatedContent: z.string().describe("The complete, updated content of the file after applying the changes requested in the task description."),
    explanation: z.string().optional().describe("A brief explanation of the changes made (optional but helpful)."),
}).describe("The structured response expected from the file rewrite AI agent.");

// Schema for Agent Context Validation (Simplified potentially)
const AgentContextSchema = z.object({
    userInput: z.string().min(1),
    projectFiles: z.array(ProjectFileSchema).min(1, "At least one project file is required for context."), // Still needed for initial state
    projectFileMap: ProjectFileMapSchema.refine(map => map.size > 0, { message: "Project file map cannot be empty." }), // Still needed
    projectSummaryContext: z.string(), // Could be used in rewrite prompt
}).refine(ctx => ctx.projectFiles[0]?.projectId, {
    message: "Could not determine projectId from the first project file.",
    path: ["projectFiles"],
});

// --- Type Exports ---
export type Task = z.infer<typeof TaskSchema>;
export type TaskPlan = z.infer<typeof TaskPlanSchema>;
export type TaskStatus = z.infer<typeof TaskStatusSchema>;
export type AgentContext = z.infer<typeof AgentContextSchema>;
export type FileRewriteResponse = z.infer<typeof FileRewriteResponseSchema>; // New type

// Schemas for Agent Run Request/Response (kept for potential API layer)
export const AgentCoderRunRequestSchema = z.object({
    userInput: z.string().min(1).openapi({
        description: "The main instruction or goal for the agent.",
        example: "Refactor the authentication logic in auth.ts to use JWT."
    }),
    selectedFileIds: z.array(z.string().min(1)).min(1).openapi({
        description: "Array of ProjectFile IDs to provide as initial context.",
        example: ["file-id-1", "file-id-2"]
    }),
}).openapi('AgentCoderRunRequest');

export const AgentCoderRunSuccessDataSchema = z.object({
    updatedFiles: z.array(ProjectFileSchema).openapi({
        description: "The state of the project files after the agent's execution."
    }),
    taskPlan: TaskPlanSchema.optional().openapi({
        description: "The final task plan executed by the agent (includes task statuses)."
    }),
    logId: z.string().openapi({ // Added logId
        description: "The unique ID for retrieving the execution logs for this run."
    })
}).openapi('AgentCoderRunSuccessData');

export const AgentCoderRunResponseSchema = z.object({
    success: z.literal(true),
    data: AgentCoderRunSuccessDataSchema
}).openapi('AgentCoderRunResponse');

export type AgentCoderRunRequest = z.infer<typeof AgentCoderRunRequestSchema>;
export type AgentCoderRunSuccessData = z.infer<typeof AgentCoderRunSuccessDataSchema>;
export type AgentCoderRunResponse = z.infer<typeof AgentCoderRunResponseSchema>;


// --- Configuration ---
const AI_OPTIONS: AiSdkOptions = MEDIUM_MODEL_CONFIG; // Use your desired model config
const AI_REWRITE_TEMPERATURE = 0.3; // Adjust temperature for rewrite creativity vs precision


// --- Agent Function Definitions ---

// Planning Agent remains useful for breaking down the work
async function runPlanningAgent(agentContext: AgentContext): Promise<TaskPlan> {
    await log("Running Planning Agent...", 'info');
    const prompt = `
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
<schema>${JSON.stringify(TaskPlanSchema.openapi("TaskPlan"), null, 2)}</schema>
`;

    const result = await generateStructuredData({
        prompt: prompt,
        schema: TaskPlanSchema,
        options: AI_OPTIONS, // Use base options, maybe slightly higher temp for planning
        systemMessage: "You are a meticulous software project planner. Generate a detailed, actionable task plan in the specified JSON format. Each task should target a single file modification or creation and have a clear description of the work required for that task.",
    });

    const validationResult = TaskPlanSchema.safeParse(result.object);
    if (!validationResult.success) {
        const error = fromZodError(validationResult.error);
        const errorMsg = `Planning Agent failed to produce a valid TaskPlan: ${error.message}`;
        await log(`Planning Agent Output Validation Failed: ${error.message}`, 'error', { validationError: validationResult.error.format(), rawOutput: result.object });
        throw new Error(errorMsg);
    }

    // Ensure projectId is set
    const plan = validationResult.data;
    plan.projectId = plan.projectId || agentContext.projectFiles[0].projectId;

    // Basic validation for tasks
    for (const task of plan.tasks) {
        if (!task.targetFilePath) {
            const errorMsg = `Planning Agent generated a task (ID: ${task.id}, Title: ${task.title}) without a targetFilePath.`;
            await log(errorMsg, 'error', { task });
            throw new Error(errorMsg);
        }
        task.targetFilePath = normalizePathForDb(task.targetFilePath); // Normalize path early
    }


    await log("Planning Agent finished successfully.", 'info');
    return plan;
}


// **NEW Agent: Replaces runCodeChangePlanningAgent and runCodeImplementationAgent**
// This agent takes a task and the current file content, asks the LLM to rewrite it.
async function runFileRewriteAgent(
    task: Task,
    currentFileContent: string | null, // Null if the file is being created
    agentContext: AgentContext // Pass context for potential use in prompt
): Promise<FileRewriteResponse> {
    await log(`Running File Rewrite Agent for task: ${task.title}`, 'info', { taskId: task.id, targetFile: task.targetFilePath });

    const filePath = task.targetFilePath;
    const changeRequest = task.description; // The core instruction for the LLM

    // Determine if it's creation or modification for the prompt
    const isCreation = currentFileContent === null;
    const actionVerb = isCreation ? "Create" : "Update";

    // --- Construct the Prompt ---
    // Base system message
    const systemMessage = `
You are an expert coding assistant. You will be given the path to a file, a description of the desired changes, and potentially the current content of the file.
Your task is to:
1. Understand the user's request (the task description).
2. ${actionVerb} the file content to meet the request.
3. Output a JSON object containing:
   - "updatedContent": The *entire* file content after applying the changes (or the completely new content if creating).
   - "explanation": A concise summary of the modifications you made or the purpose of the new file.
Strictly adhere to the JSON output format provided in the schema. Only output the valid JSON object.
Ensure the generated code is complete and correct for the file path specified.
`;

    // User prompt content varies slightly for creation vs modification
    let userPrompt = `
<task_details>
  <file_path>${filePath}</file_path>
  <request_description>${changeRequest}</request_description>
</task_details>
`;

    if (isCreation) {
        userPrompt += `
This file does not exist yet. Generate the complete initial content for this file based *only* on the request_description.
`;
        await log(`Rewrite Agent Mode: File Creation`, 'verbose', { taskId: task.id });
    } else {
        userPrompt += `
<current_file_content language="typescript">
<![CDATA[${currentFileContent}]]>
</current_file_content>

Modify the <current_file_content> based *only* on the <request_description>. Output the *entire* updated file content.
`;
        await log(`Rewrite Agent Mode: File Modification`, 'verbose', { taskId: task.id, currentContentLength: currentFileContent?.length });
    }

    // Optional: Add project context to the prompt if needed
    // userPrompt += `\n<project_context>${agentContext.projectSummaryContext}</project_context>`;

    userPrompt += `
Output the result strictly as JSON conforming to this schema:
<schema>${JSON.stringify(FileRewriteResponseSchema.openapi("FileRewriteResponse"), null, 2)}</schema>
`;


    // --- Call LLM ---
    try {
        await log(`Calling LLM for file rewrite...`, 'verbose', { taskId: task.id, filePath });
        const result = await generateStructuredData({
            prompt: userPrompt,
            schema: FileRewriteResponseSchema,
            options: { ...AI_OPTIONS, temperature: AI_REWRITE_TEMPERATURE }, // Use specific temp for rewrite
            systemMessage: systemMessage,
        });

        // --- Validate Response ---
        const validationResult = FileRewriteResponseSchema.safeParse(result.object);
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
        throw new Error(`AI file rewrite failed for task ${task.id} (${task.title}) on file ${filePath}: ${errorMessage}`);
    }
}


// --- Orchestrator (Refactored Logic) ---
async function mainOrchestrator(rawAgentContext: AgentContext): Promise<{ success: boolean; files: ProjectFile[]; tasks: TaskPlan | null; logId: string }> {
    const logId = uuidv4(); // Generate unique ID for this run
    const { filePath, logId: logIdFromFilePath } = getOrchestratorLogFilePath(logId); // Get the log file path
    await initializeLogger(filePath); // Pass only the file path

    // 1. Validate Initial Context
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
    const agentContext: AgentContext = contextValidation.data;

    // Initialize state
    let currentFileMapState = new Map<string, ProjectFile>(agentContext.projectFileMap); // Start with initial state
    const initialProjectId = agentContext.projectFiles[0].projectId; // Get Project ID
    let finalTaskPlan: TaskPlan | null = null;
    let overallSuccess = true; // Assume success until failure

    try {
        // 2. Run Planning Agent
        finalTaskPlan = await runPlanningAgent(agentContext);

        if (!finalTaskPlan || finalTaskPlan.tasks.length === 0) {
            await log("No tasks generated by Planning Agent. Exiting.", 'info');
            return { success: true, files: Array.from(currentFileMapState.values()), tasks: finalTaskPlan, logId }; // Include logId
        }
        // Ensure plan projectId matches context projectId
        if (finalTaskPlan.projectId !== initialProjectId) {
            await log(`Project ID mismatch between context (${initialProjectId}) and plan (${finalTaskPlan.projectId}). Using plan ID.`, 'warn');
            // Decide if this is an error or just a warning
        }
        const currentProjectId = finalTaskPlan.projectId;


        // 3. Execute Tasks Sequentially (Respecting Dependencies could be added here)
        for (let i = 0; i < finalTaskPlan.tasks.length; i++) {
            const task = finalTaskPlan.tasks[i];
            const taskValidation = TaskSchema.safeParse(task); // Validate task structure just in case
            if (!taskValidation.success) {
                const validationError = fromZodError(taskValidation.error);
                const errorMsg = `Invalid task structure encountered at index ${i}: ${validationError.message}. Task Title: ${task.title || 'N/A'}`;
                await log(errorMsg, 'error', { taskIndex: i, taskTitle: task.title || 'N/A', validationError: taskValidation.error.format() });
                task.status = 'FAILED';
                overallSuccess = false;
                break; // Stop processing
            }

            if (task.status !== 'PENDING') { // Skip non-pending tasks
                await log(`--- Skipping Task ${i + 1}/${finalTaskPlan.tasks.length}: ${task.title} (Status: ${task.status}) ---`, 'info', { taskId: task.id, status: task.status });
                continue;
            }

            await log(`--- Starting Task ${i + 1}/${finalTaskPlan.tasks.length}: ${task.title} ---`, 'info', { taskId: task.id, taskIndex: i, totalTasks: finalTaskPlan.tasks.length, targetFile: task.targetFilePath });
            task.status = 'IN_PROGRESS';

            // Normalize path just in case it wasn't done earlier
            const normalizedTaskPath = normalizePathForDb(task.targetFilePath);
            task.targetFilePath = normalizedTaskPath; // Ensure task object has normalized path

            try {
                // ** Determine Task Type: Create, Delete, or Modify **
                // Note: Added a hypothetical 'DELETE' task type - adjust TaskSchema if needed or handle via description.
                // For simplicity, let's assume Planning Agent creates tasks for creation/modification. Deletion might need special handling.

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
                    await log(`[Orchestrator] Calling createProjectFileRecord for new file`, 'verbose', { projectId: currentProjectId, path: normalizedTaskPath });
                    const newFileRecord = await createProjectFileRecord(
                        currentProjectId,
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

        } // End Task Loop

        // 4. Determine Final Overall Success
        if (overallSuccess) {
            // Check if all non-skipped tasks actually completed
            overallSuccess = finalTaskPlan?.tasks.every(t => t.status === 'COMPLETED' || t.status === 'SKIPPED') ?? false;
            if (!overallSuccess) {
                await log(`Orchestrator finished, but not all tasks completed successfully.`, 'warn', { tasks: finalTaskPlan?.tasks });
            }
        }

        await log(`Orchestrator finished. Overall Success: ${overallSuccess}`, 'info');
        await log(`Final Orchestrator State`, 'verbose', { success: overallSuccess, fileCount: currentFileMapState.size, tasks: finalTaskPlan });



        // TODO: What is left, is since what is return is a fille project map, this will contain all the new and olf files,
        // iterate through the files, and then write all the new/changes files to disk

        // 5. Return final state
        return {
            success: overallSuccess,
            files: Array.from(currentFileMapState.values()),
            tasks: finalTaskPlan,
            logId // Include logId
        };

    } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        const errorMsg = `Orchestrator failed with unhandled error: ${errorMessage}`;
        await log(errorMsg, 'error', { error: errorMessage, stack: error instanceof Error ? error.stack : undefined });
        await log(`Final Orchestrator State (on error)`, 'verbose', { success: false, fileCount: currentFileMapState.size, tasks: finalTaskPlan });
        // Return failure state
        return {
            success: false,
            files: Array.from(currentFileMapState.values()),
            tasks: finalTaskPlan,
            logId // Include logId
        };
    }
}

// Export the main orchestrator and potentially other necessary components
export { mainOrchestrator };