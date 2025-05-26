import json
import os
import shutil
from typing import List, Dict, Any, Optional
from uuid import uuid4

import aiofiles
from fastapi import APIRouter, HTTPException, Body, Path, status
from fastapi.encoders import jsonable_encoder
from pydantic import BaseModel

from app.services.agents.agent_logger import AGENT_LOGS_DIR
from app.error_handling.api_error import ApiError
from app.schemas.agent_coder_schemas import (
    AgentCoderRunRequest,
    AgentCoderRunResponse,
    AgentDataLog,
    AgentCoderRunSuccessData,
    ProjectFile as PyProjectFile,
    AgentTaskPlan as PyAgentTaskPlan,
    ProjectFileMap,
    AgentContext
)
from app.schemas.project_schemas import Project, ProjectFile
from app.schemas.prompt_schemas import Prompt
from app.schemas.common_schemas import ApiErrorResponse

from app.services.agents.agent_coder_service import main_orchestrator, CoderAgentOrchestratorSuccessResult
from app.services.agents.agent_logger import (
    get_orchestrator_log_file_paths,
    get_agent_data_log_file_path,
    list_agent_jobs
)
from app.services.project_service import get_project_by_id, get_project_files, bulk_update_project_files
from app.services.prompt_service import get_prompts_by_ids
from app.utils.project_utils import build_project_file_map
from app.utils.get_full_project_summary import get_full_project_summary
from app.utils.path_utils import resolve_path, normalize_path_for_db
from app.services.file_services.file_sync_service_unified import compute_checksum

router = APIRouter(
    prefix="/api",
    tags=["Agent Coder"],
)

async def parse_jsonl(content: str) -> List[Dict[str, Any]]:
    parsed_objects: List[Dict[str, Any]] = []
    for line in content.splitlines():
        trimmed_line = line.strip()
        if trimmed_line:
            try:
                parsed_objects.append(json.loads(trimmed_line))
            except json.JSONDecodeError:
                pass # Skipping invalid line
    return parsed_objects

def is_valid_checksum(checksum: Optional[str]) -> bool:
    return isinstance(checksum, str) and checksum.isalnum()

async def write_files_to_filesystem(
    agent_job_id: str,
    project_file_map: ProjectFileMap,
    absolute_project_path: str,
    updated_files: List[PyProjectFile]
) -> List[str]:
    written_paths: List[str] = []
    for updated_file in updated_files:
        if updated_file.content is None:
            continue

        original_file = project_file_map.get(updated_file.id)
        original_checksum = original_file.checksum if original_file else None
        
        new_checksum = updated_file.checksum or compute_checksum(updated_file.content)

        needs_write = not original_file or (
            is_valid_checksum(original_checksum) and
            is_valid_checksum(new_checksum) and
            original_checksum != new_checksum
        )

        if not needs_write:
            continue

        absolute_file_path = os.path.join(absolute_project_path, updated_file.path)
        directory_path = os.path.dirname(absolute_file_path)

        try:
            os.makedirs(directory_path, exist_ok=True)
            async with aiofiles.open(absolute_file_path, "w", encoding="utf-8") as f:
                await f.write(updated_file.content)
            written_paths.append(updated_file.path)
        except IOError:
            # Error writing file, decide on handling: continue, or raise
            pass
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
    try:
        project = await get_project_by_id(project_id)
        if not project:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"Project {project_id} not found.")

        project_files_list = await get_project_files(project_id)
        if project_files_list is None: project_files_list = []
        
        prompts_list: List[Prompt] = []
        if request_body.selected_prompt_ids:
            prompts_list = await get_prompts_by_ids(request_body.selected_prompt_ids)

        project_summary_context = await get_full_project_summary(project_id)
        if not isinstance(project_summary_context, str):
            raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Project summary context error")

        selected_project_files = [pf for pf in project_files_list if pf.id in request_body.selected_file_ids]
        if not selected_project_files and request_body.selected_file_ids:
            # Optionally raise error or proceed if empty selection is valid
            pass

        coder_agent_data_context = AgentContext(
            user_input=request_body.user_input,
            project_files=project_files_list,
            project_file_map=build_project_file_map(project_files_list),
            project_summary_context=project_summary_context,
            agent_job_id=agent_job_id,
            project=project,
            prompts=prompts_list,
            selected_file_ids=request_body.selected_file_ids,
        )

        orchestrator_result: CoderAgentOrchestratorSuccessResult = await main_orchestrator(coder_agent_data_context)
        
        response_data = AgentCoderRunSuccessData(
            updated_files=orchestrator_result.updated_files,
            task_plan=orchestrator_result.task_plan,
            agent_job_id=orchestrator_result.agent_job_id,
        )
        return AgentCoderRunResponse(success=True, data=response_data)

    except ApiError as e:
        raise HTTPException(status_code=e.status_code, detail=e.to_dict())
    except HTTPException:
        raise
    except Exception as e:
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
    try:
        log_paths = await get_orchestrator_log_file_paths(project_id, agent_job_id)
        log_file_path = log_paths["file_path"]

        if not await aiofiles.os.path.exists(log_file_path):
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"Agent run {agent_job_id} logs not found.")

        async with aiofiles.open(log_file_path, "r", encoding="utf-8") as f:
            log_content = await f.read()
        
        parsed_logs = await parse_jsonl(log_content)
        return parsed_logs

    except ApiError as e:
        raise HTTPException(status_code=e.status_code, detail=e.to_dict())
    except HTTPException:
        raise
    except FileNotFoundError:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"Log file for agent run {agent_job_id} not found.")
    except Exception as e:
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
    try:
        data_file_path = await get_agent_data_log_file_path(project_id, agent_job_id)

        if not await aiofiles.os.path.exists(data_file_path):
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"Agent run {agent_job_id} data not found.")

        async with aiofiles.open(data_file_path, "r", encoding="utf-8") as f:
            agent_data_content = await f.read()
        
        agent_data = json.loads(agent_data_content)
        return agent_data

    except ApiError as e:
        raise HTTPException(status_code=e.status_code, detail=e.to_dict())
    except HTTPException:
        raise
    except FileNotFoundError:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"Data file for agent run {agent_job_id} not found.")
    except json.JSONDecodeError as e:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=f"Error decoding agent data JSON: {str(e)}")
    except Exception as e:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=f"Error reading agent data file: {str(e)}")

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
    try:
        job_ids = await list_agent_jobs(project_id)
        return ListAgentRunsResponse(success=True, data=job_ids)
    except ApiError as e:
        raise HTTPException(status_code=e.status_code, detail=e.to_dict())
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=f"Error retrieving run list: {str(e)}")

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
    try:
        data_file_path = await get_agent_data_log_file_path(project_id, agent_job_id)

        if not await aiofiles.os.path.exists(data_file_path):
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"Agent run {agent_job_id} data log not found.")

        async with aiofiles.open(data_file_path, "r", encoding="utf-8") as f:
            agent_data_log_raw = json.loads(await f.read())
        
        try:
            agent_data_log = AgentDataLog.model_validate(agent_data_log_raw)
        except Exception as val_error:
            raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=f"Invalid agent data log structure for {agent_job_id}.")

        if not agent_data_log.updated_files:
            return ConfirmAgentRunChangesResponse(success=True, message="No file changes proposed. Filesystem unchanged.", written_files=[])

        project_data = await get_project_by_id(project_id)
        if not project_data:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"Project {project_id} not found.")

        absolute_project_path = resolve_path(project_data.path)
        if not absolute_project_path:
            raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Could not resolve project path.")
        
        original_project_files_list = await get_project_files(project_id)
        if original_project_files_list is None: original_project_files_list = []
        original_project_file_map = build_project_file_map(original_project_files_list)
        
        typed_updated_files = [PyProjectFile(**uf.model_dump()) for uf in agent_data_log.updated_files]

        written_paths = await write_files_to_filesystem(
            agent_job_id=agent_job_id,
            project_file_map=original_project_file_map,
            absolute_project_path=absolute_project_path,
            updated_files=typed_updated_files
        )
        
        return ConfirmAgentRunChangesResponse(success=True, message="Agent run changes successfully written.", written_files=written_paths)

    except ApiError as e:
        raise HTTPException(status_code=e.status_code, detail=e.to_dict())
    except HTTPException:
        raise
    except FileNotFoundError:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"Data log for agent run {agent_job_id} not found.")
    except json.JSONDecodeError as e:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=f"Error decoding agent data JSON: {str(e)}")
    except Exception as e:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=f"Error confirming agent run changes: {str(e)}")

class DeleteAgentRunResponse(BaseModel):
    success: bool = True
    message: str

@router.delete(
    "/projects/{project_id}/agent-coder/runs/{agent_job_id}",
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
    try:
        project_jobs_dir = os.path.join(AGENT_LOGS_DIR, "projects", project_id, "jobs")
        agent_run_directory = os.path.join(project_jobs_dir, agent_job_id)

        if not os.path.exists(agent_run_directory) or not os.path.isdir(agent_run_directory):
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"Agent run {agent_job_id} not found.")

        shutil.rmtree(agent_run_directory)
        
        return DeleteAgentRunResponse(success=True, message=f"Agent run {agent_job_id} deleted successfully.")

    except ApiError as e:
        raise HTTPException(status_code=e.status_code, detail=e.to_dict())
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=f"Error deleting agent run: {str(e)}")