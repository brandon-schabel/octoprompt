# /packages/python_backend/app/services/agents/agent_coder_service.py
# Last 5 changes:
# 1. Initial migration from TypeScript to Python.
# 2. Translated prompts and agent logic for planning and file rewriting.
# 3. Implemented task processing loop from createFileChangeDiffFromTaskPlan.
# 4. Ported mainOrchestrator logic including logging, error handling, and state management.
# 5. Adapted to Pydantic schemas and Python-specific error/data handling.

import json
import os
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional, Tuple, Union

from pydantic import ValidationError

from app.error_handling.api_error import ApiError
# Assuming config is structured to provide these model configs
from app.core.config import (
    HIGH_MODEL_CONFIG,
    MEDIUM_MODEL_CONFIG,
    PLANNING_MODEL_CONFIG,
)
from app.schemas.agent_coder_schemas import (
    AgentContext,
    AgentDataLog,
    AgentDataLogFinalStatusEnum,
    AgentFileRewriteResponse,
    AgentTask,
    AgentTaskPlan,
    AgentTaskStatusEnum,
    CoderAgentDataContext, # This was used in TS, AgentContext is the Python equivalent
    FileRewriteResponse, # Python: AgentFileRewriteResponse
    Task, # Python: AgentTask
    TaskPlan as PyTaskPlan, # Python: AgentTaskPlan
)
from app.schemas.gen_ai_schemas import AiSdkOptions
from app.schemas.project_schemas import ProjectFile
# Assuming FileSyncData would be defined elsewhere if needed by bulk_create_project_files
# from app.services.project_service import FileSyncData, bulk_create_project_files
from app.services.project_service import bulk_create_project_files, FileSyncData # Adjusted import
from app.services.file_services.file_sync_service_unified import compute_checksum
from app.services.gen_ai_services import generate_structured_data
from app.services.agents.agent_logger import (
    AGENT_LOGS_DIR,
    get_orchestrator_log_file_paths,
    initialize_logger,
    log, # Assuming log is an async function
    write_agent_data_log,
    get_agent_data_log_file_path,
)
from app.utils.path_utils import normalize_path_for_db
# Assuming build_project_file_map is available, e.g., from a shared utils module
from app.utils.projects_utils import build_project_file_map


# Type alias for consistency with TS if CoderAgentDataContext is preferred over AgentContext internally
PyCoderAgentDataContext = AgentContext

# --- Agent Prompts Definition ---
def get_planning_agent_prompt(agent_context: PyCoderAgentDataContext) -> str:
    selected_file_ids = agent_context.selected_file_ids
    selected_files = [f for f in agent_context.project_files if f.id in selected_file_ids]

    prompts_context = "<prompts>\n" + "\n".join(
        [f'<prompt name="{p.name}">{p.content}</prompt>' for p in agent_context.prompts]
    ) + "\n</prompts>"

    project_summary_context = f"<project_summary>{agent_context.project_summary_context}</project_summary>"

    selected_files_context = "<selected_files>\n" + "".join(
        [
            f"<file><id>{f.id}</id><name>{f.name}</name><path>{f.path}</path></file>"
            for f in selected_files
        ]
    ) + "\n</selected_files>"

    goal = """ <goal>
    Analyze the user request and project summary to create a detailed, actionable task plan in JSON format conforming to the TaskPlanSchema.
    Break down the request into specific, sequential tasks, each focusing on modifying *one* file or creating *one* new file to progress towards the overall goal.
    Each task's description should clearly state the changes needed for *that specific task and file*.
    Ensure the generated JSON strictly adheres to the provided TaskPlanSchema. Include the projectId in the plan.
    Assign a descriptive title and a detailed description for each task.
    Specify the targetFilePath for every task.
    </goal>"""
    
    # Length object logging removed for brevity as per coding rules, can be added for debugging
    # project_id = agent_context.project_files[0].project_id if agent_context.project_files else agent_context.project.id

    return f"""
    {goal}
    {prompts_context}
    {project_summary_context}
    <user_request>{agent_context.user_input}</user_request>
    {selected_files_context}
    <project_id>{agent_context.project.id}</project_id>
    <project_name>{agent_context.project.name}</project_name>
    <project_description>{agent_context.project.description if agent_context.project.description else ''}</project_description>
    <schema>{json.dumps(AgentTaskPlan.model_json_schema(ref_template='#/components/schemas/{model}'), indent=2)}</schema>
    """

def get_planning_agent_system_prompt(_agent_context: PyCoderAgentDataContext) -> str:
    return """
    You are a meticulous software project planner. Generate a detailed, actionable task plan in the specified JSON format.
    Each task should target a single file modification or creation and have a clear description of the work required for that task.
    """

def get_file_rewrite_agent_prompt(
    _agent_context: PyCoderAgentDataContext, task: AgentTask, current_file_content: Optional[str]
) -> str:
    file_path = task.target_file_path
    change_request = task.description
    is_creation = current_file_content is None

    user_prompt = f"""
        <task_details>
        <file_path>{file_path}</file_path>
        <request_description>{change_request}</request_description>
        </task_details>
    """
    if is_creation:
        user_prompt += "\nThis file does not exist yet. Generate the complete initial content for this file based *only* on the request_description.\n"
    else:
        user_prompt += f"""
        <current_file_content language="typescript">
        <![CDATA[{current_file_content}]]>
        </current_file_content>
        Modify the <current_file_content> based *only* on the <request_description>. Output the *entire* updated file content.
        """
    user_prompt += f"""
    Output the result strictly as JSON conforming to this schema:
    <schema>{json.dumps(AgentFileRewriteResponse.model_json_schema(ref_template='#/components/schemas/{model}'), indent=2)}</schema>
    """
    return user_prompt

def get_file_rewrite_agent_system_prompt(
    _agent_context: PyCoderAgentDataContext, current_file_content: Optional[str]
) -> str:
    action_verb = "Create" if current_file_content is None else "Update"
    return f"""
    You are an expert coding assistant. You will be given the path to a file, a description of the desired changes, and potentially the current content of the file.
    Your task is to:
        1. Understand the user's request (the task description).
        2. {action_verb} the file content to meet the request.
        3. Output a JSON object containing:
            - "updatedContent": The *entire* file content after applying the changes (or the completely new content if creating).
            - "explanation": A concise summary of the modifications you made or the purpose of the new file.
    Strictly adhere to the JSON output format provided in the schema. Only output the valid JSON object.
    Ensure the generated code is complete and correct for the file path specified.
    """

agent_coder_prompts = {
    "planning_agent": {
        "schema": AgentTaskPlan,
        "prompt": get_planning_agent_prompt,
        "system_prompt": get_planning_agent_system_prompt,
    },
    "file_rewrite_agent": {
        "schema": AgentFileRewriteResponse,
        "prompt": get_file_rewrite_agent_prompt,
        "system_prompt": get_file_rewrite_agent_system_prompt,
    },
}

# --- Configuration ---
# These would typically come from a config file or environment variables
AI_OPTIONS: AiSdkOptions = HIGH_MODEL_CONFIG 
AI_REWRITE_TEMPERATURE = 0.3

# --- Agent Function Definitions ---

async def run_planning_agent(agent_context: PyCoderAgentDataContext) -> PyTaskPlan:
    await log("Running Planning Agent...", "info", {"agent_job_id": agent_context.agent_job_id})
    planning_prompt = agent_coder_prompts["planning_agent"]["prompt"](agent_context)
    planning_system_prompt = agent_coder_prompts["planning_agent"]["system_prompt"](agent_context)

    await log(
        "[Planning Agent] Sending request to LLM.",
        "verbose",
        {
            "agent_job_id": agent_context.agent_job_id,
            "prompt_length": len(planning_prompt),
            "system_prompt_length": len(planning_system_prompt),
        },
    )
    
    result_obj: Any
    try:
        # TODO: Python AI SDK might return a structured object directly or a raw response to parse
        # Assuming generate_structured_data returns an object that includes the parsed data
        # and that schema validation is part of generate_structured_data or handled after
        response = await generate_structured_data(
            prompt=planning_prompt,
            schema=agent_coder_prompts["planning_agent"]["schema"], # Pydantic model
            options={**PLANNING_MODEL_CONFIG, "temperature": PLANNING_MODEL_CONFIG.get("temperature", 0.7)}, # Ensure temperature is a float if not already
            system_message=planning_system_prompt,
        )
        result_obj = response.object # Assuming the Vercel AI SDK like structure
    except Exception as error:
        error_message = str(error)
        raw_response_info = getattr(error, "raw_response", "Raw response not available")
        await log(
            f"[Planning Agent] generate_structured_data call failed: {error_message}",
            "error",
            {
                "agent_job_id": agent_context.agent_job_id,
                "error_message": error_message,
                "error_details": getattr(error, "details", {}),
                "raw_response_info": raw_response_info,
                "prompt_length": len(planning_prompt),
            },
        )
        raise ApiError(
            500,
            f"Planning Agent's call to generate_structured_data failed: {error_message}",
            "PLANNING_AGENT_LLM_CALL_FAILED",
            {"original_error_stack": getattr(error, "__traceback__", None), "prompt_sample": planning_prompt[:200]},
        )

    await log(
        "[Planning Agent] Raw LLM Output from generate_structured_data:",
        "info",
        {"agent_job_id": agent_context.agent_job_id, "output": result_obj},
    )

    try:
        # The schema is passed to generate_structured_data, which should ideally return a validated Pydantic model
        # If it returns a dict, we validate here.
        if isinstance(result_obj, dict):
            plan = AgentTaskPlan.model_validate(result_obj)
        elif isinstance(result_obj, AgentTaskPlan):
            plan = result_obj
        else:
            raise ValueError(f"Unexpected type from generate_structured_data: {type(result_obj)}")
            
    except ValidationError as e:
        error_msg = f"Planning Agent failed to produce a valid TaskPlan: {str(e)}"
        await log(
            f"Planning Agent Output Validation Failed: {str(e)}",
            "error",
            {"agent_job_id": agent_context.agent_job_id, "validation_error": e.errors(), "raw_output": result_obj},
        )
        raise ApiError(500, error_msg, "PLANNING_AGENT_VALIDATION_FAILED", e.errors())
    
    plan.project_id = plan.project_id or agent_context.project.id

    for task in plan.tasks:
        if not task.target_file_path:
            error_msg = f"Planning Agent generated a task (ID: {task.id}, Title: {task.title}) without a target_file_path."
            await log(error_msg, "error", {"task": task.model_dump()})
            raise ApiError(500, error_msg, "PLANNING_AGENT_INVALID_TASK", {"task": task.model_dump()})
        task.target_file_path = normalize_path_for_db(task.target_file_path)
    
    await log("Planning Agent finished successfully.", "info")
    return plan


async def run_file_rewrite_agent(
    task: AgentTask, current_file_content: Optional[str], agent_context: PyCoderAgentDataContext
) -> AgentFileRewriteResponse:
    await log(
        f"Running File Rewrite Agent for task: {task.title}",
        "info",
        {"agent_job_id": agent_context.agent_job_id, "task_id": task.id, "target_file": task.target_file_path},
    )
    
    try:
        await log(
            "Calling LLM for file rewrite...",
            "verbose",
            {
                "agent_job_id": agent_context.agent_job_id,
                "task_id": task.id,
                "file_path": task.target_file_path,
                "is_creation": current_file_content is None,
            },
        )
        response = await generate_structured_data(
            prompt=agent_coder_prompts["file_rewrite_agent"]["prompt"](agent_context, task, current_file_content),
            schema=agent_coder_prompts["file_rewrite_agent"]["schema"], # Pydantic model
            options={**AI_OPTIONS, "temperature": AI_REWRITE_TEMPERATURE},
            system_message=agent_coder_prompts["file_rewrite_agent"]["system_prompt"](agent_context, current_file_content),
        )
        result_obj = response.object # Assuming the Vercel AI SDK like structure

        await log(
            f"[File Rewrite Agent] Raw LLM Output for task {task.id}:",
            "info",
            {"agent_job_id": agent_context.agent_job_id, "task_id": task.id, "output": result_obj},
        )

        if isinstance(result_obj, dict):
            rewrite_response_data = AgentFileRewriteResponse.model_validate(result_obj)
        elif isinstance(result_obj, AgentFileRewriteResponse):
            rewrite_response_data = result_obj
        else:
            raise ValueError(f"Unexpected type from generate_structured_data: {type(result_obj)}")

        await log(f"File Rewrite Agent finished successfully for task: {task.title}", "info", {"task_id": task.id})
        return rewrite_response_data
        
    except ValidationError as e:
        error_msg = f"File Rewrite Agent failed to produce a valid response: {str(e)}"
        await log(
            f"File Rewrite Agent Output Validation Failed: {str(e)}",
            "error",
            {"task_id": task.id, "validation_error": e.errors(), "raw_output": result_obj if 'result_obj' in locals() else 'N/A'},
        )
        raise ApiError(500, error_msg, "FILE_REWRITE_AGENT_VALIDATION_FAILED", e.errors())
    except Exception as error:
        error_message = str(error)
        await log(
            f"File Rewrite Agent failed for task {task.id}: {error_message}",
            "error",
            {"task_id": task.id, "error": error_message, "stack": getattr(error, "__traceback__", None)},
        )
        if isinstance(error, ApiError):
            raise
        raise ApiError(
            500,
            f"AI file rewrite failed for task {task.id} ({task.title}) on file {task.target_file_path}: {error_message}",
            "FILE_REWRITE_AI_ERROR",
            {"task_id": task.id},
        )

async def create_file_change_diff_from_task_plan(
    agent_context: PyCoderAgentDataContext, task_plan: PyTaskPlan
) -> Dict[str, Union[List[ProjectFile], PyTaskPlan]]:
    current_file_map_state: Dict[str, ProjectFile] = {**agent_context.project_file_map} # Shallow copy

    for i, task in enumerate(task_plan.tasks):
        try:
            AgentTask.model_validate(task.model_dump()) # Validate task structure (already a model, but good practice)
        except ValidationError as e:
            error_msg = f"Invalid task structure encountered at index {i}: {str(e)}. Task Title: {task.title or 'N/A'}"
            await log(error_msg, "error", {"task_index": i, "task_title": task.title or "N/A", "validation_error": e.errors()})
            task.status = AgentTaskStatusEnum.FAILED
            raise ApiError(400, error_msg, "INVALID_TASK_STRUCTURE", {"task_index": i, "task_title": task.title, "validation_error": e.errors()})

        if task.status != AgentTaskStatusEnum.PENDING:
            await log(f"--- Skipping Task {i + 1}/{len(task_plan.tasks)}: {task.title} (Status: {task.status}) ---", "info", {"task_id": task.id, "status": task.status})
            continue

        await log(f"--- Starting Task {i + 1}/{len(task_plan.tasks)}: {task.title} ---", "info", {"task_id": task.id, "task_index": i, "total_tasks": len(task_plan.tasks), "target_file": task.target_file_path})
        task.status = AgentTaskStatusEnum.IN_PROGRESS
        normalized_task_path = normalize_path_for_db(task.target_file_path)
        task.target_file_path = normalized_task_path

        try:
            is_creation_task = False
            target_file: Optional[ProjectFile] = None
            
            # Find file by path in current state
            for pf_id, pf_obj in current_file_map_state.items():
                 if normalize_path_for_db(pf_obj.path) == normalized_task_path:
                    target_file = pf_obj
                    break
            
            if not target_file:
                is_creation_task = True
                await log(f"Task {task.id} determined as file creation for path: {normalized_task_path}", "info", {"task_id": task.id})
            else:
                if not task.target_file_id:
                    await log(f"Task {task.id} target_file_id missing, but file found by path. Updating task.", "warn", {"task_id": task.id, "found_file_id": target_file.id})
                    task.target_file_id = target_file.id
                elif task.target_file_id != target_file.id:
                    await log(f"Task {task.id} target_file_id ({task.target_file_id}) mismatches ID found by path ({target_file.id}) for {normalized_task_path}. Prioritizing path match.", "error", {"task_id": task.id})
                    task.target_file_id = target_file.id
                await log(f"Task {task.id} determined as file modification for path: {normalized_task_path} (ID: {target_file.id})", "info", {"task_id": task.id})

            if is_creation_task:
                await log("[Orchestrator] Preparing data for bulk_create_project_files for new file", "verbose", {"project_id": agent_context.project.id, "path": normalized_task_path})
                placeholder_content = "// Placeholder: Content will be generated by AI..."
                file_sync_data = FileSyncData(
                    path=normalized_task_path,
                    name=os.path.basename(normalized_task_path),
                    extension=os.path.splitext(normalized_task_path)[1],
                    content=placeholder_content,
                    size=len(placeholder_content.encode("utf-8")),
                    checksum=compute_checksum(placeholder_content),
                    # project_id=agent_context.project.id # Assuming bulk_create_project_files handles this or FileSyncData takes it
                )
                created_files = await bulk_create_project_files(agent_context.project.id, [file_sync_data])
                if not created_files or len(created_files) != 1:
                    raise RuntimeError(f"[Orchestrator] Failed to create file record for path: {normalized_task_path}")
                
                new_file_record = created_files[0]
                await log(f"[Orchestrator] DB record created for {new_file_record.path}. ID: {new_file_record.id}", "info")
                task.target_file_id = new_file_record.id

                rewrite_response = await run_file_rewrite_agent(task, None, agent_context)
                new_content = rewrite_response.updated_content
                new_checksum = compute_checksum(new_content)
                
                # Ensure all fields for ProjectFile are present
                updated_file_record_data = new_file_record.model_dump()
                updated_file_record_data.update({
                    "content": new_content,
                    "checksum": new_checksum,
                    "size": len(new_content.encode("utf-8")),
                    "updated_at": datetime.now(timezone.utc).isoformat(),
                })
                # Re-validate to ensure all fields are correct for ProjectFile
                updated_file_record = ProjectFile(**updated_file_record_data)

                current_file_map_state[updated_file_record.id] = updated_file_record
                await log(f"[Orchestrator] Added newly created file to state: {normalized_task_path}", "verbose", {"file_id": updated_file_record.id})

            elif target_file: # Modification task
                current_content = target_file.content or ""
                original_checksum = target_file.checksum
                rewrite_response = await run_file_rewrite_agent(task, current_content, agent_context)
                updated_content = rewrite_response.updated_content
                new_checksum = compute_checksum(updated_content)

                if new_checksum == original_checksum:
                    await log(f"[Orchestrator] File content unchanged for {normalized_task_path}. Skipping update.", "info", {"task_id": task.id, "file_id": target_file.id})
                else:
                    updated_file_data = target_file.model_dump()
                    updated_file_data.update({
                        "content": updated_content,
                        "checksum": new_checksum,
                        "size": len(updated_content.encode("utf-8")),
                        "updated_at": datetime.now(timezone.utc).isoformat(),
                    })
                    updated_file = ProjectFile(**updated_file_data)
                    current_file_map_state[target_file.id] = updated_file
                    await log(f"[Orchestrator] Updated file content in state map for {normalized_task_path}", "verbose", {"task_id": task.id, "file_id": target_file.id, "old_checksum": original_checksum, "new_checksum": new_checksum})
            else:
                raise RuntimeError(f"[Orchestrator] Inconsistent state for task {task.id}: Not creation, but target file not found.")
            task.status = AgentTaskStatusEnum.COMPLETED
        except Exception as error:
            error_message = str(error)
            error_msg_log = f"Error processing task {task.id} ({task.title}) for file {task.target_file_path}: {error_message}"
            await log(error_msg_log, "error", {"task_id": task.id, "task_title": task.title, "file": task.target_file_path, "error": error_message, "stack": getattr(error, "__traceback__", None)})
            task.status = AgentTaskStatusEnum.FAILED
            await log(f"Task {task.id} failed. Stopping workflow.", "error", {"task_id": task.id})
            if isinstance(error, ApiError):
                raise
            raise ApiError(500, error_msg_log, "TASK_PROCESSING_FAILED", {"task_id": task.id, "task_title": task.title, "file": task.target_file_path})
        
        await log(f"--- Finished Task {i + 1}: {task.title} (Status: {task.status}) ---", "info", {"task_id": task.id, "status": task.status})

    return {"files": list(current_file_map_state.values()), "tasks": task_plan}


class CoderAgentOrchestratorSuccessResult(BaseModel):
    updated_files: List[ProjectFile]
    task_plan: Optional[PyTaskPlan]
    agent_job_id: str
    agent_data_log: AgentDataLog


async def main_orchestrator(raw_agent_context_input: PyCoderAgentDataContext) -> CoderAgentOrchestratorSuccessResult:
    agent_job_id = raw_agent_context_input.agent_job_id
    
    # Initialize agent_data_log as a dictionary first
    agent_data_log_dict: Dict[str, Any] = {
        "agent_job_dir_path": os.path.join(AGENT_LOGS_DIR, "projects", raw_agent_context_input.project.id, "jobs", agent_job_id),
        "project_id": raw_agent_context_input.project.id,
        "agent_job_id": agent_job_id,
        "agent_job_start_time": datetime.now(timezone.utc).isoformat(),
        "task_plan": AgentTaskPlan(project_id=raw_agent_context_input.project.id, overall_goal=raw_agent_context_input.user_input or "User input not provided", tasks=[]).model_dump(),
        "final_status": None, # Will be set to a valid enum before final validation
        "final_task_plan": None,
        "error_message": None,
        "error_stack": None,
        "agent_job_end_time": None,
        "updated_files": [],
    }

    log_file_path: Optional[str] = None
    try:
        paths = await get_orchestrator_log_file_paths(raw_agent_context_input.project.id, agent_job_id)
        log_file_path = paths["file_path"] # Assuming dict like {"filePath": "...", "jobLogDir": "..."}
        agent_data_log_dict["agent_job_dir_path"] = paths["job_log_dir"]
        await initialize_logger(log_file_path)
        await log(f"[Orchestrator] Starting run {agent_job_id} for project {raw_agent_context_input.project.id}. Logging to: {log_file_path}", "info", {"agent_job_id": agent_job_id})
    except Exception as init_error:
        print(f"[Orchestrator CRITICAL] Logger initialization failed for {agent_job_id}: {str(init_error)}") # Basic print as logger failed
        agent_data_log_dict["final_status"] = AgentDataLogFinalStatusEnum.ERROR.value
        agent_data_log_dict["error_message"] = f"Logger initialization failed: {str(init_error)}"
        agent_data_log_dict["error_stack"] = str(getattr(init_error, "__traceback__", None))
        agent_data_log_dict["agent_job_end_time"] = datetime.now(timezone.utc).isoformat()
        try:
            # Attempt to write data log even if orchestrator logger init fails
            final_agent_data_log = AgentDataLog.model_validate(agent_data_log_dict)
            await write_agent_data_log(raw_agent_context_input.project.id, agent_job_id, final_agent_data_log)
        except Exception as data_log_write_error:
            print(f"[Orchestrator CRITICAL] Failed to write AgentDataLog after logger init failure for {agent_job_id}: {str(data_log_write_error)}")
        raise ApiError(500, f"Orchestrator logger init failed for {agent_job_id}: {str(init_error)}", "ORCHESTRATOR_LOG_INIT_FAILED", {"original_error": str(init_error)})

    # 1. Validate Agent Context (raw_agent_context_input is already a Pydantic model so it's validated on creation)
    # However, projectFileMap needs to be built if not already part of the input model construction
    # The provided agent_coder_schemas.py AgentContext already has project_file_map.
    # Let's assume raw_agent_context_input comes with project_file_map correctly populated.
    # If it's a dict input that needs parsing into AgentContext:
    # raw_context_dict = raw_agent_context_input.model_dump() if isinstance(raw_agent_context_input, BaseModel) else raw_agent_context_input
    # raw_context_dict["project_file_map"] = build_project_file_map(raw_context_dict.get("project_files", []))
    # try:
    #     agent_context = AgentContext.model_validate(raw_context_dict)
    # except ValidationError as e:
    # ... handle error as below ...
    # For this migration, assuming raw_agent_context_input IS the validated AgentContext (PyCoderAgentDataContext)
    agent_context = raw_agent_context_input 
    if agent_data_log_dict["task_plan"]: # Should always be true from init
         agent_data_log_dict["task_plan"]["overall_goal"] = agent_context.user_input or "User input not provided"


    initial_project_id = agent_context.project.id
    final_task_plan_obj: Optional[PyTaskPlan] = None

    try:
        await log(f"[Orchestrator] Context validated for {agent_job_id}. Starting planning phase.", "info", {"agent_job_id": agent_job_id})
        final_task_plan_obj = await run_planning_agent(agent_context)
        agent_data_log_dict["task_plan"] = final_task_plan_obj.model_dump()

        if not final_task_plan_obj or not final_task_plan_obj.tasks:
            await log("No tasks generated by Planning Agent. Exiting.", "info", {"agent_job_id": agent_job_id})
            agent_data_log_dict["final_status"] = AgentDataLogFinalStatusEnum.NO_TASKS_GENERATED.value
            agent_data_log_dict["final_task_plan"] = final_task_plan_obj.model_dump() if final_task_plan_obj else None
        else:
            if final_task_plan_obj.project_id != initial_project_id:
                await log(f"Project ID mismatch context ({initial_project_id}) vs plan ({final_task_plan_obj.project_id}). Using plan ID.", "warn", {"agent_job_id": agent_job_id, "context_project_id": initial_project_id, "plan_project_id": final_task_plan_obj.project_id})
            
            await log(f"[Orchestrator] Planning complete for {agent_job_id}. {len(final_task_plan_obj.tasks)} tasks. Starting execution.", "info", {"agent_job_id": agent_job_id, "task_count": len(final_task_plan_obj.tasks)})
            
            execution_result = await create_file_change_diff_from_task_plan(agent_context, final_task_plan_obj)
            all_final_files = execution_result["files"]
            executed_task_plan = execution_result["tasks"]
            
            final_task_plan_obj = executed_task_plan # Update with statuses
            agent_data_log_dict["final_task_plan"] = executed_task_plan.model_dump()

            initial_file_map = agent_context.project_file_map
            changed_files = [
                final_file for final_file in all_final_files 
                if final_file.id not in initial_file_map or initial_file_map[final_file.id].checksum != final_file.checksum
            ]
            await log(f"[Orchestrator] Task execution finished for {agent_job_id}. Changed files: {len(changed_files)}", "info", {"agent_job_id": agent_job_id, "changed_file_count": len(changed_files)})
            agent_data_log_dict["updated_files"] = [f.model_dump() for f in changed_files]
            agent_data_log_dict["final_status"] = AgentDataLogFinalStatusEnum.SUCCESS.value
            
    except Exception as error:
        error_message = str(error)
        error_stack = str(getattr(error, "__traceback__", None))
        error_code = getattr(error, "code", "ORCHESTRATOR_PROCESSING_ERROR") if isinstance(error, ApiError) else "ORCHESTRATOR_PROCESSING_ERROR"

        await log(f"[Orchestrator] Error during run {agent_job_id}: {error_message}", "error", {"agent_job_id": agent_job_id, "error": error_message, "error_code": error_code, "stack": error_stack, "details": getattr(error, "details", None)})
        
        agent_data_log_dict["final_status"] = AgentDataLogFinalStatusEnum.ERROR.value
        agent_data_log_dict["error_message"] = error_message
        agent_data_log_dict["error_stack"] = error_stack
        if final_task_plan_obj: # If planning succeeded but execution failed
             agent_data_log_dict["final_task_plan"] = final_task_plan_obj.model_dump()
        # If error happened during planning, task_plan (initial) is already in agent_data_log_dict
        
        if isinstance(error, ApiError):
            raise
        raise ApiError(500, f"Orchestrator failed: {error_message}", "ORCHESTRATOR_UNHANDLED_ERROR", {"agent_job_id": agent_job_id, "original_error": error_message, "original_stack": error_stack})
    finally:
        agent_data_log_dict["agent_job_end_time"] = datetime.now(timezone.utc).isoformat()
        try:
            # Ensure final_status is set if it reached here without error but also without explicit success/no_tasks
            if agent_data_log_dict["final_status"] is None:
                 # This case should ideally not happen if logic is correct, implies an unhandled path. Default to Error.
                agent_data_log_dict["final_status"] = AgentDataLogFinalStatusEnum.ERROR.value
                if not agent_data_log_dict["error_message"]:
                    agent_data_log_dict["error_message"] = "Orchestrator ended in an unexpected state."

            final_agent_data_log_model = AgentDataLog.model_validate(agent_data_log_dict)
            await write_agent_data_log(raw_agent_context_input.project.id, agent_job_id, final_agent_data_log_model)
            agent_data_log_path = await get_agent_data_log_file_path(raw_agent_context_input.project.id, agent_job_id)
            
            final_message = f"[Orchestrator] Run {agent_job_id} finished. Status: {agent_data_log_dict['final_status']}. Logs: {log_file_path or 'N/A'}. Data: {agent_data_log_path or 'N/A'}"
            if agent_data_log_dict["final_status"] == AgentDataLogFinalStatusEnum.ERROR.value:
                await log(final_message, "error", {"agent_job_id": agent_job_id, "final_status": agent_data_log_dict["final_status"], "error_message": agent_data_log_dict["error_message"]})
            else:
                await log(final_message, "info", {"agent_job_id": agent_job_id, "final_status": agent_data_log_dict["final_status"]})
        except Exception as final_log_write_error:
            print(f"[Orchestrator CRITICAL] Failed to write final AgentDataLog or orchestrator log for {agent_job_id}: {str(final_log_write_error)}")

    # Re-validate the final agent_data_log_dict before creating the model for return
    if agent_data_log_dict["final_status"] is None: # Should have been set in finally
        agent_data_log_dict["final_status"] = AgentDataLogFinalStatusEnum.ERROR.value # Fallback
        agent_data_log_dict["error_message"] = agent_data_log_dict.get("error_message") or "Orchestrator ended with an indeterminate status."

    # Parse the dicts back to Pydantic models for the return type
    parsed_updated_files = [ProjectFile.model_validate(f_dict) for f_dict in agent_data_log_dict.get("updated_files", [])]
    parsed_final_task_plan = PyTaskPlan.model_validate(agent_data_log_dict["final_task_plan"]) if agent_data_log_dict["final_task_plan"] else None
    
    # Create the final AgentDataLog model instance
    # This ensures the returned agent_data_log is a valid Pydantic model.
    # All fields of agent_data_log_dict should be compatible with AgentDataLog schema at this point.
    agent_data_log_model_for_return = AgentDataLog.model_validate(agent_data_log_dict)

    return CoderAgentOrchestratorSuccessResult(
        updated_files=parsed_updated_files,
        task_plan=parsed_final_task_plan,
        agent_job_id=agent_job_id,
        agent_data_log=agent_data_log_model_for_return,
    )