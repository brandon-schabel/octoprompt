# OctoPrompt DSPy Agent Coder Service
# Recent changes:
# 1. Updated to use octoprompt_client.py instead of direct service imports
# 2. Added local utility functions for normalize_path_for_db and compute_checksum
# 3. Implemented bulk_create_project_files and update_file API calls
# 4. Replaced direct service calls with API client calls
# 5. Added proper error handling for API client operations
# 6. Removed TODO comments and implemented actual API integration

import json
import os
import hashlib
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional, Tuple, Union

import dspy
from pydantic import ValidationError, BaseModel

from app.error_handling.api_error import ApiError
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
    AgentTaskStatusEnum,
    AgentTaskPlan as PyTaskPlan, 
)
from app.schemas.gen_ai_schemas import AiSdkOptions
from app.schemas.project_schemas import ProjectFile, FileSyncData

from app.utils.octoprompt_client import OctoPromptClient, OctoPromptError
from app.services.agents.agent_logger import (
    AGENT_LOGS_DIR,
    get_orchestrator_log_file_paths,
    initialize_logger,
    log, 
    write_agent_data_log,
    get_agent_data_log_file_path,
)

# Utility functions (previously imported from services)
def normalize_path_for_db(path: str) -> str:
    """Normalize path for database storage - ensures consistent format"""
    return path.replace('\\', '/').strip()

def compute_checksum(content: str) -> str:
    """Compute SHA-256 checksum of file content"""
    return hashlib.sha256(content.encode('utf-8')).hexdigest()

# Configure DSPy with OpenRouter
def configure_dspy():
    """Configure DSPy with OpenRouter LM based on model config"""
    openrouter_lm = dspy.LM(
        "openrouter/google/gemini-2.5-flash-preview",
        api_key="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",
        api_base="https://openrouter.ai/api/v1"
    )
    
    openrouter_lm.extra_headers = {
        "HTTP-Referer": "https://octoprompt.com",
        "X-Title": "OctoPrompt"
    }
    
    dspy.configure(lm=openrouter_lm)

# Initialize DSPy configuration
configure_dspy()

PyCoderAgentDataContext = AgentContext

# DSPy Signatures
class PlanningSignature(dspy.Signature):
    """Analyze user request and project context to create a detailed, actionable task plan.
    Break down the request into specific, sequential tasks for file modifications or creations."""
    
    user_request: str = dspy.InputField(desc="The user's original request describing what they want to accomplish")
    project_context: str = dspy.InputField(desc="Summary of the project structure, purpose, and relevant context")
    selected_files_info: str = dspy.InputField(desc="Information about the files selected by the user as context")
    prompts_context: str = dspy.InputField(desc="Available prompts that can guide the task execution")
    project_metadata: str = dspy.InputField(desc="Project ID, name, and description for context")
    
    task_plan_json: str = dspy.OutputField(desc="A valid JSON string conforming to TaskPlanSchema with detailed tasks")

class FileRewriteSignature(dspy.Signature):
    """Generate or modify file content based on task description and current file state."""
    
    file_path: str = dspy.InputField(desc="The path of the file to create or modify")
    task_description: str = dspy.InputField(desc="Detailed description of the changes needed")
    current_content: str = dspy.InputField(desc="Current file content (empty string if creating new file)")
    is_creation: bool = dspy.InputField(desc="True if creating a new file, False if modifying existing")
    
    updated_content: str = dspy.OutputField(desc="The complete updated file content")
    explanation: str = dspy.OutputField(desc="Brief explanation of changes made")

# DSPy Modules
class PlanningAgent(dspy.Module):
    """DSPy module for generating task plans from user requests and project context."""
    
    def __init__(self):
        super().__init__()
        self.plan_generator = dspy.ChainOfThought(PlanningSignature)
    
    def forward(self, agent_context: PyCoderAgentDataContext) -> PyTaskPlan:
        # Prepare context strings
        selected_files = [f for f in agent_context.project_files if f.id in agent_context.selected_file_ids]
        
        prompts_context = "<prompts>\n" + "\n".join(
            [f'<prompt name="{p.name}">{p.content}</prompt>' for p in agent_context.prompts]
        ) + "\n</prompts>"
        
        selected_files_info = "<selected_files>\n" + "".join(
            [f"<file><id>{f.id}</id><name>{f.name}</name><path>{f.path}</path></file>" 
             for f in selected_files]
        ) + "\n</selected_files>"
        
        project_metadata = f"<project_id>{agent_context.project.id}</project_id>\n" + \
                          f"<project_name>{agent_context.project.name}</project_name>\n" + \
                          f"<project_description>{agent_context.project.description or ''}</project_description>"
        
        # Generate task plan
        prediction = self.plan_generator(
            user_request=agent_context.user_input,
            project_context=agent_context.project_summary_context,
            selected_files_info=selected_files_info,
            prompts_context=prompts_context,
            project_metadata=project_metadata
        )
        
        # Parse and validate the JSON response
        try:
            plan_dict = json.loads(prediction.task_plan_json)
            plan = PyTaskPlan.model_validate(plan_dict)
            
            # Ensure project_id is set
            plan.project_id = plan.project_id or agent_context.project.id
            
            # Normalize file paths
            for task in plan.tasks:
                if not task.target_file_path:
                    raise ValueError(f"Task '{task.title}' missing target_file_path")
                task.target_file_path = normalize_path_for_db(task.target_file_path)
            
            return plan
            
        except (json.JSONDecodeError, ValidationError) as e:
            raise ValueError(f"Planning Agent failed to generate valid task plan: {str(e)}")

class FileRewriteAgent(dspy.Module):
    """DSPy module for rewriting or creating files based on task descriptions."""
    
    def __init__(self):
        super().__init__()
        self.code_generator = dspy.ChainOfThought(FileRewriteSignature)
    
    def forward(self, task: AgentTask, current_file_content: Optional[str]) -> AgentFileRewriteResponse:
        is_creation = current_file_content is None
        content_for_input = current_file_content or ""
        
        # Generate file content
        prediction = self.code_generator(
            file_path=task.target_file_path,
            task_description=task.description,
            current_content=content_for_input,
            is_creation=is_creation
        )
        
        return AgentFileRewriteResponse(
            updated_content=prediction.updated_content,
            explanation=prediction.explanation
        )

# Enhanced agent orchestrator with DSPy modules
class CoderAgentOrchestrator(dspy.Module):
    """Main orchestrator that combines planning and file rewriting agents."""
    
    def __init__(self):
        super().__init__()
        self.planning_agent = PlanningAgent()
        self.file_rewrite_agent = FileRewriteAgent()
    
    async def plan_tasks(self, agent_context: PyCoderAgentDataContext) -> PyTaskPlan:
        """Generate task plan using DSPy planning agent."""
        await log("Running DSPy Planning Agent...", "info", {"agent_job_id": agent_context.agent_job_id})
        
        try:
            plan = self.planning_agent(agent_context)
            await log("DSPy Planning Agent completed successfully.", "info")
            return plan
            
        except Exception as error:
            error_message = str(error)
            await log(
                f"DSPy Planning Agent failed: {error_message}",
                "error",
                {
                    "agent_job_id": agent_context.agent_job_id,
                    "error_message": error_message,
                },
            )
            raise ApiError(
                500,
                f"DSPy Planning Agent failed: {error_message}",
                "DSPY_PLANNING_AGENT_FAILED",
                {"original_error": error_message},
            )
    
    async def rewrite_file(
        self, 
        task: AgentTask, 
        current_file_content: Optional[str], 
        agent_context: PyCoderAgentDataContext
    ) -> AgentFileRewriteResponse:
        """Rewrite file content using DSPy file rewrite agent."""
        await log(
            f"Running DSPy File Rewrite Agent for task: {task.title}",
            "info",
            {"agent_job_id": agent_context.agent_job_id, "task_id": task.id, "target_file": task.target_file_path},
        )
        
        try:
            response = self.file_rewrite_agent(task, current_file_content)
            await log(f"DSPy File Rewrite Agent completed for task: {task.title}", "info", {"task_id": task.id})
            return response
            
        except Exception as error:
            error_message = str(error)
            await log(
                f"DSPy File Rewrite Agent failed for task {task.id}: {error_message}",
                "error",
                {"task_id": task.id, "error": error_message},
            )
            raise ApiError(
                500,
                f"DSPy file rewrite failed for task {task.id} ({task.title}): {error_message}",
                "DSPY_FILE_REWRITE_FAILED",
                {"task_id": task.id},
            )

# Global orchestrator instance
_orchestrator = CoderAgentOrchestrator()

async def run_planning_agent(agent_context: PyCoderAgentDataContext) -> PyTaskPlan:
    """Run planning agent using DSPy - Legacy compatibility function."""
    return await _orchestrator.plan_tasks(agent_context)

async def run_file_rewrite_agent(
    task: AgentTask, current_file_content: Optional[str], agent_context: PyCoderAgentDataContext
) -> AgentFileRewriteResponse:
    """Run file rewrite agent using DSPy - Legacy compatibility function."""
    return await _orchestrator.rewrite_file(task, current_file_content, agent_context)

async def create_file_change_diff_from_task_plan(
    agent_context: PyCoderAgentDataContext, task_plan: PyTaskPlan
) -> Dict[str, Union[List[ProjectFile], PyTaskPlan]]:
    """Execute task plan and create file changes - using API client for persistence."""
    current_file_map_state: Dict[str, ProjectFile] = {**agent_context.project_file_map}
    
    # Initialize API client for file operations
    async with OctoPromptClient() as api_client:
        # Track files to create and update for bulk operations
        files_to_create: List[FileSyncData] = []
        files_to_update: List[Dict[str, Any]] = []
        creation_tasks: List[AgentTask] = []
        modification_tasks: List[AgentTask] = []
        
        # First pass: categorize tasks and prepare content
        await log(f"[DSPy Orchestrator] Categorizing {len(task_plan.tasks)} tasks...", "info", {"agent_job_id": agent_context.agent_job_id})
        
        for i, task in enumerate(task_plan.tasks):
            try:
                AgentTask.model_validate(task.model_dump())
            except ValidationError as e:
                error_msg = f"Invalid task structure encountered at index {i}: {str(e)}. Task Title: {task.title or 'N/A'}"
                await log(error_msg, "error", {"task_index": i, "task_title": task.title or "N/A", "validation_error": e.errors()})
                task.status = AgentTaskStatusEnum.FAILED
                raise ApiError(400, error_msg, "INVALID_TASK_STRUCTURE", {"task_index": i, "task_title": task.title, "validation_error": e.errors()})

            if task.status != AgentTaskStatusEnum.PENDING:
                await log(f"--- Skipping Task {i + 1}/{len(task_plan.tasks)}: {task.title} (Status: {task.status}) ---", "info", {"task_id": task.id, "status": task.status})
                continue

            await log(f"--- Processing Task {i + 1}/{len(task_plan.tasks)}: {task.title} ---", "info", {"task_id": task.id, "task_index": i, "total_tasks": len(task_plan.tasks), "target_file": task.target_file_path})
            task.status = AgentTaskStatusEnum.IN_PROGRESS
            normalized_task_path = normalize_path_for_db(task.target_file_path)
            task.target_file_path = normalized_task_path

            try:
                # Find existing file by path
                target_file: Optional[ProjectFile] = None
                for pf_id, pf_obj in current_file_map_state.items():
                    if normalize_path_for_db(pf_obj.path) == normalized_task_path:
                        target_file = pf_obj
                        break
                
                if not target_file:
                    # File creation task
                    await log(f"Task {task.id} determined as file creation for path: {normalized_task_path}", "info", {"task_id": task.id})
                    
                    # Generate content using AI
                    rewrite_response = await run_file_rewrite_agent(task, None, agent_context)
                    new_content = rewrite_response.updated_content
                    
                    # Prepare file data for bulk creation
                    file_sync_data = FileSyncData(
                        path=normalized_task_path,
                        name=os.path.basename(normalized_task_path),
                        extension=os.path.splitext(normalized_task_path)[1],
                        content=new_content,
                        size=len(new_content.encode("utf-8")),
                        checksum=compute_checksum(new_content),
                    )
                    files_to_create.append(file_sync_data)
                    creation_tasks.append(task)
                    
                else:
                    # File modification task
                    if not task.target_file_id:
                        await log(f"Task {task.id} target_file_id missing, but file found by path. Updating task.", "warn", {"task_id": task.id, "found_file_id": target_file.id})
                        task.target_file_id = target_file.id
                    elif task.target_file_id != target_file.id:
                        await log(f"Task {task.id} target_file_id ({task.target_file_id}) mismatches ID found by path ({target_file.id}) for {normalized_task_path}. Prioritizing path match.", "error", {"task_id": task.id})
                        task.target_file_id = target_file.id
                    
                    await log(f"Task {task.id} determined as file modification for path: {normalized_task_path} (ID: {target_file.id})", "info", {"task_id": task.id})
                    
                    # Generate updated content using AI
                    current_content = target_file.content or ""
                    rewrite_response = await run_file_rewrite_agent(task, current_content, agent_context)
                    updated_content = rewrite_response.updated_content
                    
                    # Check if content actually changed
                    original_checksum = target_file.checksum
                    new_checksum = compute_checksum(updated_content)
                    
                    if new_checksum != original_checksum:
                        files_to_update.append({
                            "fileId": target_file.id,
                            "content": updated_content
                        })
                        modification_tasks.append(task)
                    else:
                        await log(f"Task {task.id} content unchanged for {normalized_task_path}. Skipping update.", "info", {"task_id": task.id, "file_id": target_file.id})
                
                task.status = AgentTaskStatusEnum.COMPLETED
                
            except Exception as error:
                error_message = str(error)
                error_msg_log = f"Error processing task {task.id} ({task.title}) for file {task.target_file_path}: {error_message}"
                await log(error_msg_log, "error", {"task_id": task.id, "task_title": task.title, "file": task.target_file_path, "error": error_message})
                task.status = AgentTaskStatusEnum.FAILED
                
                if isinstance(error, ApiError):
                    raise
                raise ApiError(500, error_msg_log, "TASK_PROCESSING_FAILED", {"task_id": task.id, "task_title": task.title, "file": task.target_file_path})
        
        # Second pass: Execute bulk operations via API
        created_files: List[ProjectFile] = []
        updated_files: List[ProjectFile] = []
        
        try:
            # Bulk create new files
            if files_to_create:
                await log(f"[DSPy Orchestrator] Creating {len(files_to_create)} new files via API...", "info", {"project_id": agent_context.project.id, "file_count": len(files_to_create)})
                created_files = await api_client.projects.bulk_create_project_files(agent_context.project.id, files_to_create)
                
                # Update task file IDs and current state
                for i, created_file in enumerate(created_files):
                    if i < len(creation_tasks):
                        creation_tasks[i].target_file_id = created_file.id
                    current_file_map_state[str(created_file.id)] = created_file
                
                await log(f"[DSPy Orchestrator] Successfully created {len(created_files)} files", "info")
            
            # Bulk update existing files
            if files_to_update:
                await log(f"[DSPy Orchestrator] Updating {len(files_to_update)} existing files via API...", "info", {"project_id": agent_context.project.id, "file_count": len(files_to_update)})
                updated_files = await api_client.projects.bulk_update_project_files(agent_context.project.id, files_to_update)
                
                # Update current state with updated files
                for updated_file in updated_files:
                    current_file_map_state[str(updated_file.id)] = updated_file
                
                await log(f"[DSPy Orchestrator] Successfully updated {len(updated_files)} files", "info")
                
        except OctoPromptError as api_error:
            error_msg = f"API operation failed: {api_error} (Status: {api_error.status_code})"
            await log(error_msg, "error", {"api_error_code": api_error.error_code, "status_code": api_error.status_code})
            
            # Mark affected tasks as failed
            for task in creation_tasks + modification_tasks:
                task.status = AgentTaskStatusEnum.FAILED
            
            raise ApiError(500, error_msg, "API_OPERATION_FAILED", {"api_error_code": api_error.error_code})
        
        except Exception as error:
            error_message = str(error)
            await log(f"[DSPy Orchestrator] Unexpected error during API operations: {error_message}", "error", {"error": error_message})
            
            # Mark affected tasks as failed
            for task in creation_tasks + modification_tasks:
                task.status = AgentTaskStatusEnum.FAILED
            
            raise ApiError(500, f"File operations failed: {error_message}", "FILE_OPERATIONS_FAILED")

        await log(f"[DSPy Orchestrator] Task execution completed. Created: {len(created_files)}, Updated: {len(updated_files)}", "info", {"created_count": len(created_files), "updated_count": len(updated_files)})
        
        return {"files": list(current_file_map_state.values()), "tasks": task_plan}

class CoderAgentOrchestratorSuccessResult(BaseModel):
    updated_files: List[ProjectFile]
    task_plan: Optional[PyTaskPlan]
    agent_job_id: str
    agent_data_log: AgentDataLog

async def main_orchestrator(raw_agent_context_input: PyCoderAgentDataContext) -> CoderAgentOrchestratorSuccessResult:
    """Main orchestrator function - now powered by DSPy agents with full API integration."""
    agent_job_id = raw_agent_context_input.agent_job_id
    
    agent_data_log_dict: Dict[str, Any] = {
        "agent_job_dir_path": os.path.join(AGENT_LOGS_DIR, "projects", str(raw_agent_context_input.project.id), "jobs", agent_job_id),
        "project_id": raw_agent_context_input.project.id,
        "agent_job_id": agent_job_id,
        "agent_job_start_time": datetime.now(timezone.utc).isoformat(),
        "task_plan": PyTaskPlan(project_id=raw_agent_context_input.project.id, overall_goal=raw_agent_context_input.user_input or "User input not provided", tasks=[]).model_dump(),
        "final_status": None, 
        "final_task_plan": None,
        "error_message": None,
        "error_stack": None,
        "agent_job_end_time": None,
        "updated_files": [],
    }

    log_file_path: Optional[str] = None
    try:
        paths = await get_orchestrator_log_file_paths(raw_agent_context_input.project.id, agent_job_id)
        log_file_path = paths["file_path"]
        agent_data_log_dict["agent_job_dir_path"] = paths["job_log_dir"]
        await initialize_logger(log_file_path)
        await log(f"[DSPy Orchestrator] Starting run {agent_job_id} for project {raw_agent_context_input.project.id}. Logging to: {log_file_path}", "info", {"agent_job_id": agent_job_id})
    except Exception as init_error:
        print(f"[DSPy Orchestrator CRITICAL] Logger initialization failed for {agent_job_id}: {str(init_error)}") 
        agent_data_log_dict["final_status"] = AgentDataLogFinalStatusEnum.ERROR.value
        agent_data_log_dict["error_message"] = f"Logger initialization failed: {str(init_error)}"
        agent_data_log_dict["error_stack"] = str(getattr(init_error, "__traceback__", None))
        agent_data_log_dict["agent_job_end_time"] = datetime.now(timezone.utc).isoformat()
        try:
            final_agent_data_log = AgentDataLog.model_validate(agent_data_log_dict)
            await write_agent_data_log(raw_agent_context_input.project.id, agent_job_id, final_agent_data_log)
        except Exception as data_log_write_error:
            print(f"[DSPy Orchestrator CRITICAL] Failed to write AgentDataLog after logger init failure for {agent_job_id}: {str(data_log_write_error)}")
        raise ApiError(500, f"DSPy Orchestrator logger init failed for {agent_job_id}: {str(init_error)}", "DSPY_ORCHESTRATOR_LOG_INIT_FAILED", {"original_error": str(init_error)})

    agent_context = raw_agent_context_input 
    if agent_data_log_dict["task_plan"]: 
         agent_data_log_dict["task_plan"]["overall_goal"] = agent_context.user_input or "User input not provided"

    initial_project_id = agent_context.project.id
    final_task_plan_obj: Optional[PyTaskPlan] = None

    try:
        await log(f"[DSPy Orchestrator] Context validated for {agent_job_id}. Starting DSPy planning phase.", "info", {"agent_job_id": agent_job_id})
        final_task_plan_obj = await run_planning_agent(agent_context)
        agent_data_log_dict["task_plan"] = final_task_plan_obj.model_dump()

        if not final_task_plan_obj or not final_task_plan_obj.tasks:
            await log("No tasks generated by DSPy Planning Agent. Exiting.", "info", {"agent_job_id": agent_job_id})
            agent_data_log_dict["final_status"] = AgentDataLogFinalStatusEnum.NO_TASKS_GENERATED.value
            agent_data_log_dict["final_task_plan"] = final_task_plan_obj.model_dump() if final_task_plan_obj else None
        else:
            if final_task_plan_obj.project_id != initial_project_id:
                await log(f"Project ID mismatch context ({initial_project_id}) vs plan ({final_task_plan_obj.project_id}). Using plan ID.", "warn", {"agent_job_id": agent_job_id, "context_project_id": initial_project_id, "plan_project_id": final_task_plan_obj.project_id})
            
            await log(f"[DSPy Orchestrator] Planning complete for {agent_job_id}. {len(final_task_plan_obj.tasks)} tasks. Starting execution with API integration.", "info", {"agent_job_id": agent_job_id, "task_count": len(final_task_plan_obj.tasks)})
            
            execution_result = await create_file_change_diff_from_task_plan(agent_context, final_task_plan_obj)
            all_final_files = execution_result["files"]
            executed_task_plan = execution_result["tasks"]
            
            final_task_plan_obj = executed_task_plan 
            agent_data_log_dict["final_task_plan"] = executed_task_plan.model_dump()

            initial_file_map = agent_context.project_file_map
            changed_files = [
                final_file for final_file in all_final_files 
                if str(final_file.id) not in initial_file_map or initial_file_map[str(final_file.id)].checksum != final_file.checksum
            ]
            await log(f"[DSPy Orchestrator] Task execution finished for {agent_job_id}. Changed files: {len(changed_files)}", "info", {"agent_job_id": agent_job_id, "changed_file_count": len(changed_files)})
            agent_data_log_dict["updated_files"] = [f.model_dump() for f in changed_files]
            agent_data_log_dict["final_status"] = AgentDataLogFinalStatusEnum.SUCCESS.value
            
    except Exception as error:
        error_message = str(error)
        error_stack = str(getattr(error, "__traceback__", None))
        error_code = getattr(error, "code", "DSPY_ORCHESTRATOR_PROCESSING_ERROR") if isinstance(error, ApiError) else "DSPY_ORCHESTRATOR_PROCESSING_ERROR"

        await log(f"[DSPy Orchestrator] Error during run {agent_job_id}: {error_message}", "error", {"agent_job_id": agent_job_id, "error": error_message, "error_code": error_code, "stack": error_stack, "details": getattr(error, "details", None)})
        
        agent_data_log_dict["final_status"] = AgentDataLogFinalStatusEnum.ERROR.value
        agent_data_log_dict["error_message"] = error_message
        agent_data_log_dict["error_stack"] = error_stack
        if final_task_plan_obj: 
             agent_data_log_dict["final_task_plan"] = final_task_plan_obj.model_dump()
        
        if isinstance(error, ApiError):
            raise
        raise ApiError(500, f"DSPy Orchestrator failed: {error_message}", "DSPY_ORCHESTRATOR_UNHANDLED_ERROR", {"agent_job_id": agent_job_id, "original_error": error_message, "original_stack": error_stack})
    finally:
        agent_data_log_dict["agent_job_end_time"] = datetime.now(timezone.utc).isoformat()
        try:
            if agent_data_log_dict["final_status"] is None:
                agent_data_log_dict["final_status"] = AgentDataLogFinalStatusEnum.ERROR.value
                if not agent_data_log_dict["error_message"]:
                    agent_data_log_dict["error_message"] = "DSPy Orchestrator ended in an unexpected state."

            final_agent_data_log_model = AgentDataLog.model_validate(agent_data_log_dict)
            await write_agent_data_log(raw_agent_context_input.project.id, agent_job_id, final_agent_data_log_model)
            agent_data_log_path = await get_agent_data_log_file_path(raw_agent_context_input.project.id, agent_job_id)
            
            final_message = f"[DSPy Orchestrator] Run {agent_job_id} finished. Status: {agent_data_log_dict['final_status']}. Logs: {log_file_path or 'N/A'}. Data: {agent_data_log_path or 'N/A'}"
            if agent_data_log_dict["final_status"] == AgentDataLogFinalStatusEnum.ERROR.value:
                await log(final_message, "error", {"agent_job_id": agent_job_id, "final_status": agent_data_log_dict["final_status"], "error_message": agent_data_log_dict["error_message"]})
            else:
                await log(final_message, "info", {"agent_job_id": agent_job_id, "final_status": agent_data_log_dict["final_status"]})
        except Exception as final_log_write_error:
            print(f"[DSPy Orchestrator CRITICAL] Failed to write final AgentDataLog or orchestrator log for {agent_job_id}: {str(final_log_write_error)}")

    if agent_data_log_dict["final_status"] is None:
        agent_data_log_dict["final_status"] = AgentDataLogFinalStatusEnum.ERROR.value
        agent_data_log_dict["error_message"] = agent_data_log_dict.get("error_message") or "DSPy Orchestrator ended with an indeterminate status."

    parsed_updated_files = [ProjectFile.model_validate(f_dict) for f_dict in agent_data_log_dict.get("updated_files", [])]
    parsed_final_task_plan = PyTaskPlan.model_validate(agent_data_log_dict["final_task_plan"]) if agent_data_log_dict["final_task_plan"] else None
    
    agent_data_log_model_for_return = AgentDataLog.model_validate(agent_data_log_dict)

    return CoderAgentOrchestratorSuccessResult(
        updated_files=parsed_updated_files,
        task_plan=parsed_final_task_plan,
        agent_job_id=agent_job_id,
        agent_data_log=agent_data_log_model_for_return,
    )