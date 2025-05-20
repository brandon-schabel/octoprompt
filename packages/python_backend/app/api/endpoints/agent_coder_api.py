# /packages/python_backend/app/api/endpoints/agent_coder_api.py
# Last 5 changes:
# 1. Initial creation of the agent coder API routes file.
# 2. Added imports for FastAPI, Pydantic models, and services.
# 3. Defined the APIRouter.
# 4. Added run_agent_coder endpoint.
# 5. Added get_agent_run_logs endpoint.

import json
import os
import shutil
from typing import List, Dict, Any, Optional
from uuid import uuid4

import aiofiles
from fastapi import APIRouter, HTTPException, Body, Path, status
from fastapi.encoders import jsonable_encoder
from pydantic import BaseModel

from app.core.config import AGENT_LOGS_DIR # Assuming AGENT_LOGS_DIR is in config
from app.error_handling.api_error import ApiError # Assuming ApiError is defined
from app.schemas.agent_coder_schemas import (
    AgentCoderRunRequest,
    AgentCoderRunResponse,
    AgentDataLog,
    AgentCoderRunSuccessData,
    ProjectFile as PyProjectFile, # Renamed to avoid clash if ProjectFile is imported from elsewhere
    AgentTaskPlan as PyAgentTaskPlan,
    ProjectFileMap
)
from app.schemas.project_schemas import Project, ProjectFile # Assuming these exist
from app.schemas.prompt_schemas import Prompt # Assuming this exists
from app.schemas.common_schemas import ApiErrorResponse # Assuming this exists

# Assuming services are available and structured similarly
from app.services.agents.agent_coder_service import main_orchestrator, CoderAgentDataContext, CoderAgentOrchestratorSuccessResult
from app.services.agents.agent_logger import (
    get_orchestrator_log_file_paths, # Python equivalent
    get_agent_data_log_file_path, # Python equivalent
    list_agent_jobs, # Python equivalent
    log as agent_log # Python equivalent, aliased to avoid conflict with math.log
)
from app.services.project_service import get_project_by_id, get_project_files, bulk_update_project_files # Python equivalents
from app.services.prompt_service import get_prompts_by_ids # Python equivalent
from app.utils.projects_utils import build_project_file_map # Python equivalent
from app.utils.get_full_project_summary import get_full_project_summary # Python equivalent
from app.utils.path_utils import resolve_path, normalize_path_for_db # Python equivalents
from app.services.file_services.file_sync_service_unified import compute_checksum # Python equivalent

router = APIRouter(
    prefix="/api", # Matching TS /api prefix
    tags=["Agent Coder"], # Tag for OpenAPI docs
)

# Helper to parse JSONL content
async def parse_jsonl(content: str) -> List[Dict[str, Any]]:
    parsed_objects: List[Dict[str, Any]] = []
    for line in content.splitlines():
        trimmed_line = line.strip()
        if trimmed_line:
            try:
                parsed_objects.append(json.loads(trimmed_line))
            except json.JSONDecodeError:
                await agent_log(f"[JSONL Parser] Skipping invalid line: {trimmed_line[:100]}...", "warn")
    return parsed_objects

# Helper to validate checksum format (basic)
def is_valid_checksum(checksum: Optional[str]) -> bool:
    return isinstance(checksum, str) and checksum.isalnum() # Basic check, adjust if specific format needed

# Helper function to write files to the filesystem
async def write_files_to_filesystem(
    agent_job_id: str,
    project_file_map: ProjectFileMap,
    absolute_project_path: str,
    updated_files: List[PyProjectFile]
) -> List[str]:
    written_paths: List[str] = []
    # Ensure AGENT_LOGS_DIR is defined, typically from config
    # from app.core.config import AGENT_LOGS_DIR (already imported)

    for updated_file in updated_files:
        if updated_file.content is None: # Skip if no content
            await agent_log(f"[Agent Coder Route {agent_job_id}] Skipping write for {updated_file.path} (null content).", "warn", {"agent_job_id": agent_job_id, "file_path": updated_file.path})
            continue

        original_file = project_file_map.get(updated_file.id)
        original_checksum = original_file.checksum if original_file else None
        
        # Calculate new checksum if not present or if content exists.
        # The Pydantic model for ProjectFile in python_backend might already have checksum computed if content is set.
        # If not, ensure it's computed before this check.
        # For this example, we assume updated_file.checksum is correctly populated if content is present.
        new_checksum = updated_file.checksum or compute_checksum(updated_file.content)

        needs_write = not original_file or (
            is_valid_checksum(original_checksum) and
            is_valid_checksum(new_checksum) and
            original_checksum != new_checksum
        )

        if not needs_write:
            await agent_log(f"[Agent Coder Route {agent_job_id}] Skipping write for {updated_file.path} (checksum match or no original).", "info", {"agent_job_id": agent_job_id, "file_path": updated_file.path})
            continue

        absolute_file_path = os.path.join(absolute_project_path, updated_file.path)
        directory_path = os.path.dirname(absolute_file_path)

        try:
            os.makedirs(directory_path, exist_ok=True)
            async with aiofiles.open(absolute_file_path, "w", encoding="utf-8") as f:
                await f.write(updated_file.content)
            written_paths.append(updated_file.path)
            await agent_log(f"[Agent Coder Route {agent_job_id}] Wrote code file: {updated_file.path}", "info", {"agent_job_id": agent_job_id, "file_path": updated_file.path})
        except IOError as write_error:
            await agent_log(f"[Agent Coder Route {agent_job_id}] Failed to write {updated_file.path}: {str(write_error)}", "error", {"agent_job_id": agent_job_id, "file_path": updated_file.path, "error": str(write_error)})
            # Decide on error handling: continue, or raise to stop all writes
    return written_paths

@router.post(
    "/projects/{project_id}/agent-coder",
    response_model=AgentCoderRunResponse,
    summary="Run the Agent Coder on selected files with a user prompt",
    status_code=status.HTTP_200_OK,
    responses={
        status.HTTP_404_NOT_FOUND: {"model": ApiErrorResponse},
        status.HTTP_422_UNPROCESSABLE_ENTITY: {"model": ApiErrorResponse},
        status.HTTP_500_INTERNAL_SERVER_ERROR: {"model": ApiErrorResponse},
    },
)
async def run_agent_coder(
    project_id: str = Path(..., description="The unique ID of the project."),
    request_body: AgentCoderRunRequest = Body(...),
):
    agent_job_id = request_body.agent_job_id or f"job_{uuid4()}"
    await agent_log(f"[Agent Coder Route] Starting run {agent_job_id} for project {project_id}", "info", {"agent_job_id": agent_job_id, "project_id": project_id})

    try:
        project = await get_project_by_id(project_id)
        if not project:
            await agent_log(f"[Agent Coder Route {agent_job_id}] Project {project_id} not found.", "error", {"agent_job_id": agent_job_id, "project_id": project_id})
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"Project {project_id} not found.")

        project_files_list = await get_project_files(project_id) # project_files_list can be None or empty
        if project_files_list is None: project_files_list = []
        
        prompts_list: List[Prompt] = []
        if request_body.selected_prompt_ids:
            prompts_list = await get_prompts_by_ids(request_body.selected_prompt_ids)

        project_summary_context = await get_full_project_summary(project_id)
        if not isinstance(project_summary_context, str): # Type check, as original TS code had a check
             await agent_log(f"[Agent Coder Route {agent_job_id}] Project summary context error for project {project_id}.", "error", {"agent_job_id": agent_job_id, "project_id": project_id})
             raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Project summary context error")

        # Filter selected files (similar to TS logic, ensure selected_file_ids are valid)
        # This part assumes project_files_list contains full ProjectFile objects
        selected_project_files = [pf for pf in project_files_list if pf.id in request_body.selected_file_ids]
        if not selected_project_files and request_body.selected_file_ids:
             await agent_log(f"[Agent Coder Route {agent_job_id}] No matching files found for IDs: {', '.join(request_body.selected_file_ids)}", "warn", {"agent_job_id": agent_job_id, "selected_file_ids": request_body.selected_file_ids})
             # Depending on strictness, you might raise 404/422 here or proceed if empty selection is allowed for some use cases

        coder_agent_data_context = CoderAgentDataContext(
            user_input=request_body.user_input,
            project_files=project_files_list, # Pass all project files
            project_file_map=build_project_file_map(project_files_list),
            project_summary_context=project_summary_context,
            agent_job_id=agent_job_id,
            project=project, # Pass the Project model instance
            prompts=prompts_list, # Pass the list of Prompt model instances
            selected_file_ids=request_body.selected_file_ids,
        )

        await agent_log(f"[Agent Coder Route {agent_job_id}] Calling main orchestrator...", "info", {"agent_job_id": agent_job_id})
        orchestrator_result: CoderAgentOrchestratorSuccessResult = await main_orchestrator(coder_agent_data_context)
        await agent_log(f"[Agent Coder Route {agent_job_id}] Orchestrator finished successfully.", "info", {"agent_job_id": agent_job_id})

        # Ensure orchestrator_result.task_plan is handled correctly if it can be None
        # The Pydantic model AgentCoderRunSuccessData has task_plan as Optional[AgentTaskPlan]
        # main_orchestrator in Python returns CoderAgentOrchestratorSuccessResult which has task_plan: Optional[PyTaskPlan]
        # So this mapping should be fine.
        response_data = AgentCoderRunSuccessData(
            updated_files=orchestrator_result.updated_files,
            task_plan=orchestrator_result.task_plan, # This can be None
            agent_job_id=orchestrator_result.agent_job_id,
        )
        return AgentCoderRunResponse(success=True, data=response_data)

    except ApiError as e: # Catch custom ApiError from services
        await agent_log(f"[Agent Coder Route {agent_job_id}] ApiError: {e.message}", "error", {"agent_job_id": agent_job_id, "error_code": e.code, "details": e.details})
        raise HTTPException(status_code=e.status_code, detail=e.to_dict()) # Use a method to convert ApiError to dict
    except HTTPException: # Re-raise HTTPExceptions directly
        raise
    except Exception as e:
        await agent_log(f"[Agent Coder Route {agent_job_id}] Unhandled exception: {str(e)}", "error", {"agent_job_id": agent_job_id, "error": str(e)})
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=f"An unexpected error occurred: {str(e)}")

@router.get(
    "/projects/{project_id}/agent-coder/runs/{agent_job_id}/logs",
    response_model=List[Dict[str, Any]],
    summary="Retrieve the orchestrator execution logs (.jsonl) for a specific Agent Coder run",
    status_code=status.HTTP_200_OK,
    responses={
        status.HTTP_404_NOT_FOUND: {"model": ApiErrorResponse},
        status.HTTP_500_INTERNAL_SERVER_ERROR: {"model": ApiErrorResponse},
    },
)
async def get_agent_run_logs(
    project_id: str = Path(..., description="The unique ID of the project."),
    agent_job_id: str = Path(..., description="The unique ID of the agent run."),
):
    await agent_log(f"[Agent Logs Route] Request for logs: project {project_id}, job {agent_job_id}", "info", {"project_id": project_id, "agent_job_id": agent_job_id})
    try:
        # This function in TS returns { filePath: string, jobLogDir: string }
        # Assuming Python equivalent returns a similar structure or just the file path directly.
        # Let's assume it returns a dict with 'file_path'.
        log_paths = await get_orchestrator_log_file_paths(project_id, agent_job_id)
        log_file_path = log_paths["file_path"]

        if not await aiofiles.os.path.exists(log_file_path):
            await agent_log(f"[Agent Logs Route] Log file not found: {log_file_path}", "error", {"project_id": project_id, "agent_job_id": agent_job_id})
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"Agent run {agent_job_id} logs not found.")

        async with aiofiles.open(log_file_path, "r", encoding="utf-8") as f:
            log_content = await f.read()
        
        parsed_logs = await parse_jsonl(log_content)
        await agent_log(f"[Agent Logs Route] Successfully retrieved and parsed logs for job {agent_job_id}", "info", {"project_id": project_id, "agent_job_id": agent_job_id, "log_count": len(parsed_logs)})
        return parsed_logs

    except ApiError as e:
        await agent_log(f"[Agent Logs Route] ApiError: {e.message}", "error", {"project_id": project_id, "agent_job_id": agent_job_id, "error_code": e.code, "details": e.details})
        raise HTTPException(status_code=e.status_code, detail=e.to_dict())
    except HTTPException: # Re-raise HTTPExceptions directly
        raise
    except FileNotFoundError:
        await agent_log(f"[Agent Logs Route] Log file not found exception for job {agent_job_id}", "error", {"project_id": project_id, "agent_job_id": agent_job_id})
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"Log file for agent run {agent_job_id} not found.")
    except Exception as e:
        await agent_log(f"[Agent Logs Route] Error reading log file for job {agent_job_id}: {str(e)}", "error", {"project_id": project_id, "agent_job_id": agent_job_id, "error": str(e)})
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=f"Error reading log file: {str(e)}")

@router.get(
    "/projects/{project_id}/agent-coder/runs/{agent_job_id}/data",
    response_model=AgentDataLog,
    summary="Retrieve the agent data log (.json) for a specific Agent Coder run",
    status_code=status.HTTP_200_OK,
    responses={
        status.HTTP_404_NOT_FOUND: {"model": ApiErrorResponse},
        status.HTTP_500_INTERNAL_SERVER_ERROR: {"model": ApiErrorResponse},
    },
)
async def get_agent_run_data(
    project_id: str = Path(..., description="The unique ID of the project."),
    agent_job_id: str = Path(..., description="The unique ID of the agent run."),
):
    await agent_log(f"[Agent Data Route] Request for data: project {project_id}, job {agent_job_id}", "info", {"project_id": project_id, "agent_job_id": agent_job_id})
    try:
        data_file_path = await get_agent_data_log_file_path(project_id, agent_job_id)

        if not await aiofiles.os.path.exists(data_file_path):
            await agent_log(f"[Agent Data Route] Data file not found: {data_file_path}", "error", {"project_id": project_id, "agent_job_id": agent_job_id})
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"Agent run {agent_job_id} data not found.")

        async with aiofiles.open(data_file_path, "r", encoding="utf-8") as f:
            agent_data_content = await f.read()
        
        agent_data = json.loads(agent_data_content)
        # Validate with Pydantic model AgentDataLog, which is also the response_model
        # FastAPI will do this automatically on return if response_model is set.
        # For manual validation: AgentDataLog.model_validate(agent_data)
        await agent_log(f"[Agent Data Route] Successfully retrieved and parsed data for job {agent_job_id}", "info", {"project_id": project_id, "agent_job_id": agent_job_id})
        return agent_data # FastAPI will validate against AgentDataLog

    except ApiError as e:
        await agent_log(f"[Agent Data Route] ApiError: {e.message}", "error", {"project_id": project_id, "agent_job_id": agent_job_id, "error_code": e.code, "details": e.details})
        raise HTTPException(status_code=e.status_code, detail=e.to_dict())
    except HTTPException: # Re-raise HTTPExceptions directly
        raise
    except FileNotFoundError:
        await agent_log(f"[Agent Data Route] Data file not found exception for job {agent_job_id}", "error", {"project_id": project_id, "agent_job_id": agent_job_id})
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"Data file for agent run {agent_job_id} not found.")
    except json.JSONDecodeError as e:
        await agent_log(f"[Agent Data Route] Error decoding JSON data for job {agent_job_id}: {str(e)}", "error", {"project_id": project_id, "agent_job_id": agent_job_id, "error": str(e)})
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=f"Error decoding agent data JSON: {str(e)}")
    except Exception as e:
        await agent_log(f"[Agent Data Route] Error reading data file for job {agent_job_id}: {str(e)}", "error", {"project_id": project_id, "agent_job_id": agent_job_id, "error": str(e)})
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=f"Error reading agent data file: {str(e)}")

# Define response model for listing agent runs
class ListAgentRunsResponse(BaseModel):
    success: bool = True
    data: List[str]

@router.get(
    "/projects/{project_id}/agent-coder/runs",
    response_model=ListAgentRunsResponse,
    summary="List available Agent Coder run job IDs for a project",
    status_code=status.HTTP_200_OK,
    responses={
        status.HTTP_500_INTERNAL_SERVER_ERROR: {"model": ApiErrorResponse},
    },
)
async def list_project_agent_runs(
    project_id: str = Path(..., description="The unique ID of the project."),
):
    await agent_log(f"[List Runs Route] Request to list runs for project {project_id}", "info", {"project_id": project_id})
    try:
        # list_agent_jobs is assumed to return List[str] of job IDs
        job_ids = await list_agent_jobs(project_id)
        await agent_log(f"[List Runs Route] Found {len(job_ids)} runs for project {project_id}", "info", {"project_id": project_id, "count": len(job_ids)})
        return ListAgentRunsResponse(success=True, data=job_ids)
    except ApiError as e:
        await agent_log(f"[List Runs Route] ApiError listing runs for project {project_id}: {e.message}", "error", {"project_id": project_id, "error_code": e.code, "details": e.details})
        raise HTTPException(status_code=e.status_code, detail=e.to_dict())
    except HTTPException: # Re-raise HTTPExceptions directly
        raise
    except Exception as e:
        await agent_log(f"[List Runs Route] Error listing runs for project {project_id}: {str(e)}", "error", {"project_id": project_id, "error": str(e)})
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=f"Error retrieving run list: {str(e)}")

# Define response model for confirming changes
class ConfirmAgentRunChangesResponse(BaseModel):
    success: bool = True
    message: str
    written_files: List[str]

@router.post(
    "/projects/{project_id}/agent-coder/runs/{agent_job_id}/confirm",
    response_model=ConfirmAgentRunChangesResponse,
    summary="Confirm and write agent-generated file changes to the filesystem",
    status_code=status.HTTP_200_OK,
    responses={
        status.HTTP_404_NOT_FOUND: {"model": ApiErrorResponse},
        status.HTTP_500_INTERNAL_SERVER_ERROR: {"model": ApiErrorResponse},
    },
)
async def confirm_agent_run_changes(
    project_id: str = Path(..., description="The unique ID of the project."),
    agent_job_id: str = Path(..., description="The unique ID of the agent run."),
):
    await agent_log(f"[Agent Confirm Route] Request received for job ID: {agent_job_id}", "info", {"agent_job_id": agent_job_id, "project_id": project_id})
    try:
        data_file_path = await get_agent_data_log_file_path(project_id, agent_job_id)
        await agent_log(f"[Agent Confirm Route] Reading data file path: {data_file_path}", "info", {"agent_job_id": agent_job_id, "data_file_path": data_file_path})

        if not await aiofiles.os.path.exists(data_file_path):
            await agent_log(f"[Agent Confirm Route] Data file not found at path: {data_file_path}", "error", {"agent_job_id": agent_job_id, "data_file_path": data_file_path})
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"Agent run {agent_job_id} data log not found.")

        async with aiofiles.open(data_file_path, "r", encoding="utf-8") as f:
            agent_data_log_raw = json.loads(await f.read())
        
        # Validate the raw data against the Pydantic model
        try:
            agent_data_log = AgentDataLog.model_validate(agent_data_log_raw)
        except Exception as val_error: # PydanticValidationError
            await agent_log(f"[Agent Confirm Route] Invalid data log structure for {agent_job_id}: {str(val_error)}", "error", {"agent_job_id": agent_job_id, "validation_error": str(val_error)})
            raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=f"Invalid agent data log structure for {agent_job_id}.")

        if not agent_data_log.updated_files:
            await agent_log(f"[Agent Confirm Route {agent_job_id}] No file changes proposed. Nothing to write.", "info", {"agent_job_id": agent_job_id})
            return ConfirmAgentRunChangesResponse(success=True, message="No file changes proposed. Filesystem unchanged.", written_files=[])

        await agent_log(f"[Agent Confirm Route] Found {len(agent_data_log.updated_files)} proposed changes for project {project_id}.", "info", {"agent_job_id": agent_job_id, "project_id": project_id, "file_count": len(agent_data_log.updated_files)})

        project_data = await get_project_by_id(project_id)
        if not project_data:
            await agent_log(f"[Agent Confirm Route {agent_job_id}] Project {project_id} not found.", "error", {"agent_job_id": agent_job_id, "project_id": project_id})
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"Project {project_id} not found.")

        absolute_project_path = resolve_path(project_data.path)
        if not absolute_project_path:
            await agent_log(f"[Agent Confirm Route {agent_job_id}] Could not resolve project path for {project_id}.", "error", {"agent_job_id": agent_job_id, "project_id": project_id})
            raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Could not resolve project path.")
        await agent_log(f"[Agent Confirm Route] Absolute project path: {absolute_project_path}", "info", {"agent_job_id": agent_job_id, "absolute_project_path": absolute_project_path})
        
        original_project_files_list = await get_project_files(project_id)
        if original_project_files_list is None: original_project_files_list = []
        original_project_file_map = build_project_file_map(original_project_files_list)
        await agent_log(f"[Agent Confirm Route] Built original project file map with {len(original_project_file_map)} files.", "info", {"agent_job_id": agent_job_id, "map_size": len(original_project_file_map)})

        await agent_log(f"[Agent Confirm Route {agent_job_id}] Calling writeFilesToFileSystem...", "info", {"agent_job_id": agent_job_id})
        # Ensure updated_files are correctly typed for write_files_to_filesystem, which expects List[PyProjectFile]
        # AgentDataLog.updated_files is Optional[List[ProjectFile]] (from schemas)
        # We need to ensure these are PyProjectFile instances if type hints are strict or if write_files_to_filesystem expects specific model methods.
        # Assuming PyProjectFile and ProjectFile (from AgentDataLog) are compatible for now.
        # If they are different Pydantic models, conversion might be needed:
        # typed_updated_files = [PyProjectFile.model_validate(uf.model_dump()) for uf in agent_data_log.updated_files]
        typed_updated_files = [PyProjectFile(**uf.model_dump()) for uf in agent_data_log.updated_files]

        written_paths = await write_files_to_filesystem(
            agent_job_id=agent_job_id,
            project_file_map=original_project_file_map,
            absolute_project_path=absolute_project_path,
            updated_files=typed_updated_files
        )
        await agent_log(f"[Agent Confirm Route {agent_job_id}] writeFilesToFileSystem completed.", "info", {"agent_job_id": agent_job_id, "written_count": len(written_paths)})
        
        return ConfirmAgentRunChangesResponse(success=True, message="Agent run changes successfully written.", written_files=written_paths)

    except ApiError as e:
        await agent_log(f"[Agent Confirm Route] ApiError: {e.message}", "error", {"agent_job_id": agent_job_id, "error_code": e.code, "details": e.details})
        raise HTTPException(status_code=e.status_code, detail=e.to_dict())
    except HTTPException: # Re-raise HTTPExceptions directly
        raise
    except FileNotFoundError:
        await agent_log(f"[Agent Confirm Route] Data file not found for job {agent_job_id}", "error", {"agent_job_id": agent_job_id})
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"Data log for agent run {agent_job_id} not found.")
    except json.JSONDecodeError as e:
        await agent_log(f"[Agent Confirm Route] Error decoding agent data JSON for job {agent_job_id}: {str(e)}", "error", {"agent_job_id": agent_job_id, "error": str(e)})
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=f"Error decoding agent data JSON: {str(e)}")
    except Exception as e:
        await agent_log(f"[Agent Confirm Route] Error confirming changes for job {agent_job_id}: {str(e)}", "error", {"agent_job_id": agent_job_id, "error": str(e)})
        # Consider logging e.__traceback__ for more detail in server logs if using a proper logger setup
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=f"Error confirming agent run changes: {str(e)}")

# Define response model for deleting an agent run
class DeleteAgentRunResponse(BaseModel):
    success: bool = True
    message: str

@router.delete(
    "/projects/{project_id}/agent-coder/runs/{agent_job_id}", # Path includes project_id for consistency
    response_model=DeleteAgentRunResponse,
    summary="Delete an Agent Coder run and its associated logs/data",
    status_code=status.HTTP_200_OK,
    responses={
        status.HTTP_404_NOT_FOUND: {"model": ApiErrorResponse},
        status.HTTP_500_INTERNAL_SERVER_ERROR: {"model": ApiErrorResponse},
    },
)
async def delete_agent_run(
    project_id: str = Path(..., description="The unique ID of the project."),
    agent_job_id: str = Path(..., description="The unique ID of the agent run to delete."),
):
    await agent_log(f"[Agent Delete Route] Request received for job ID: {agent_job_id}, project ID: {project_id}", "info", {"agent_job_id": agent_job_id, "project_id": project_id})
    try:
        # The agent run directory is typically structured under AGENT_LOGS_DIR/projects/{project_id}/jobs/{agent_job_id}
        # This needs to align with how get_orchestrator_log_file_paths and get_agent_data_log_file_path construct paths.
        # Let's assume a helper function or build the path directly based on config.
        # AGENT_LOGS_DIR should be the root for all agent logs.
        project_jobs_dir = os.path.join(AGENT_LOGS_DIR, "projects", project_id, "jobs")
        agent_run_directory = os.path.join(project_jobs_dir, agent_job_id)

        if not os.path.exists(agent_run_directory) or not os.path.isdir(agent_run_directory):
            await agent_log(f"[Agent Delete Route] Directory not found for {agent_job_id}: {agent_run_directory}", "warn", {"agent_job_id": agent_job_id, "directory": agent_run_directory})
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"Agent run {agent_job_id} not found.")

        await agent_log(f"[Agent Delete Route] Attempting to delete directory: {agent_run_directory}", "info", {"agent_job_id": agent_job_id, "directory": agent_run_directory})
        shutil.rmtree(agent_run_directory)
        await agent_log(f"[Agent Delete Route] Successfully deleted directory for {agent_job_id}", "info", {"agent_job_id": agent_job_id, "directory": agent_run_directory})
        
        return DeleteAgentRunResponse(success=True, message=f"Agent run {agent_job_id} deleted successfully.")

    except ApiError as e:
        await agent_log(f"[Agent Delete Route] ApiError deleting run {agent_job_id}: {e.message}", "error", {"agent_job_id": agent_job_id, "error_code": e.code, "details": e.details})
        raise HTTPException(status_code=e.status_code, detail=e.to_dict())
    except HTTPException: # Re-raise HTTPExceptions directly
        raise
    except Exception as e:
        await agent_log(f"[Agent Delete Route] Error deleting agent run {agent_job_id}: {str(e)}", "error", {"agent_job_id": agent_job_id, "error": str(e)})
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=f"Error deleting agent run: {str(e)}")
