import json
import os
import shutil
from typing import List, Dict, Any, Optional, AsyncGenerator
from uuid import uuid4

import aiofiles
from fastapi import APIRouter, HTTPException, Body, Path, Query, Depends, status
from fastapi.encoders import jsonable_encoder
from fastapi.responses import FileResponse, JSONResponse, StreamingResponse
from pydantic import BaseModel

# Imports from agent_coder_api.py
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
from app.schemas.project_schemas import Project, ProjectFile, ProjectIdParams
from app.schemas.prompt_schemas import Prompt
from app.schemas.common_schemas import ApiErrorResponse

from app.services.agents.agent_coder_service import main_orchestrator, CoderAgentOrchestratorSuccessResult
from app.services.agents.agent_logger import (
    get_orchestrator_log_file_paths,
    get_agent_data_log_file_path,
    list_agent_jobs,
    log as api_log
)
from app.services.project_service import get_project_by_id, get_project_files, bulk_update_project_files
from app.services.prompt_service import get_prompts_by_ids
from app.utils.project_utils import build_project_file_map
from app.utils.get_full_project_summary import get_full_project_summary
from app.utils.path_utils import resolve_path, normalize_path_for_db
from app.services.file_services.file_sync_service_unified import compute_checksum

# Imports from ai_file_change_api.py
from app.schemas.ai_file_change_schemas import (
    GenerateAIFileChangeBody,
    GenerateAIFileChangeResponse,
    GetAIFileChangeDetailsResponse,
    ConfirmAIFileChangeResponse,
    AIFileChangeRecordResponse, 
    ErrorDetail, 
    FileChangeIdParams 
)

from app.services.file_services import ai_file_change_service
from app.services.file_services.ai_file_change_service import GenerateFileChangeOptions

# Imports from gen_ai_api.py
from app.schemas.chat_schemas import ModelsQuery
from app.schemas.gen_ai_schemas import (
    AiGenerateTextRequest, AiGenerateTextResponse,
    AiGenerateStructuredRequest, AiGenerateStructuredResponse, ModelsListResponse,
    FilenameSuggestionOutput, BasicSummaryOutput, UnifiedModel as ApiUnifiedModel, AiSdkOptions
)
from app.core.config import OLLAMA_BASE_URL, LMSTUDIO_BASE_URL

from app.services.gen_ai_service import (
    generate_text_stream,
    generate_single_text,
    generate_structured_data
)
from app.services.provider_key_service import provider_key_service
from app.services.model_providers.model_fetcher_service import ModelFetcherService, ProviderKeysConfig, ListModelsOptions
from app.schemas.provider_key_schemas import AIProviderEnum

# Constants from gen_ai_api.py
STRUCTURED_DATA_SCHEMAS_CONFIG = {
    "filenameSuggestion": {
        "name": "Filename Suggestion",
        "description": "Suggests 5 suitable filenames based on a description of the file's content.",
        "prompt_template": "Based on the following file description, suggest 5 suitable and conventional filenames. File Description: {user_input}",
        "system_prompt": "You are an expert programmer specializing in clear code organization and naming conventions. Provide concise filename suggestions.",
        "model_settings": AiSdkOptions(model="gpt-4o", temperature=0.5),
        "schema": FilenameSuggestionOutput,
    },
    "basicSummary": {
        "name": "Basic Summary",
        "description": "Generates a short summary of the input text.",
        "prompt_template": "Summarize the following text concisely: {user_input}",
        "system_prompt": "You are a summarization expert.",
        "model_settings": AiSdkOptions(model="gpt-4o", temperature=0.6, max_tokens=150),
        "schema": BasicSummaryOutput,
    },
}

router = APIRouter(
    prefix="/api",
    tags=["GenAI", "Agent Coder", "AI File Changes"]
)

# Helper functions from agent_coder_api.py
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

# Helper functions from ai_file_change_api.py
def _create_api_error_response(
    status_code: int, message: str, error_code: str, details: dict = None
) -> JSONResponse:
    error_content = ApiErrorResponse(
        success=False,
        error=ErrorDetail(message=message, code=error_code, details=details or {})
    )
    return JSONResponse(status_code=status_code, content=error_content.model_dump(exclude_none=True))

# Response models from agent_coder_api.py
class ListAgentRunsResponse(BaseModel):
    success: bool = True
    data: List[str]

class ConfirmAgentRunChangesResponse(BaseModel):
    success: bool = True
    message: str
    written_files: List[str]

class DeleteAgentRunResponse(BaseModel):
    success: bool = True
    message: str

# ============================================================================
# AGENT CODER ENDPOINTS
# ============================================================================

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

# ============================================================================
# AI FILE CHANGE ENDPOINTS
# ============================================================================

@router.post(
    "/projects/{projectId}/ai-file-changes",
    response_model=GenerateAIFileChangeResponse,
    summary="Generate AI-assisted file changes for a project file",
    status_code=status.HTTP_200_OK,
    responses={
        status.HTTP_400_BAD_REQUEST: {"model": ApiErrorResponse, "description": "Invalid request"},
        status.HTTP_404_NOT_FOUND: {"model": ApiErrorResponse, "description": "Project or File not found"},
        status.HTTP_500_INTERNAL_SERVER_ERROR: {"model": ApiErrorResponse, "description": "Error generating file change"},
    }
)
async def generate_ai_file_change(
    path_params: ProjectIdParams = Depends(),
    body: GenerateAIFileChangeBody = Body(...)
):
    try:
        options = GenerateFileChangeOptions(
            projectId=path_params.project_id,
            filePath=body.file_path,
            prompt=body.prompt
        )
        change_record = await ai_file_change_service.generate_file_change(options)
        
        response_payload = GenerateAIFileChangeResponse(success=True, result=change_record)
        return response_payload
    except HTTPException as he:
        err_detail = he.detail if isinstance(he.detail, dict) else {"message": str(he.detail), "code": "UNKNOWN_SERVICE_ERROR"}
        return _create_api_error_response(
            status_code=he.status_code,
            message=err_detail.get("message", "An error occurred."),
            error_code=err_detail.get("code", f"SERVICE_ERROR_{he.status_code}"),
            details=err_detail.get("details", {})
        )
    except Exception:
        return _create_api_error_response(
            status.HTTP_500_INTERNAL_SERVER_ERROR,
            message="Error generating file change",
            error_code="FILE_CHANGE_GENERATION_ERROR"
        )

@router.get(
    "/projects/{projectId}/ai-file-changes/{aiFileChangeId}",
    response_model=GetAIFileChangeDetailsResponse,
    summary="Retrieve details for a specific AI file change",
    responses={
        status.HTTP_400_BAD_REQUEST: {"model": ApiErrorResponse, "description": "Invalid ID (format/type)"},
        status.HTTP_404_NOT_FOUND: {"model": ApiErrorResponse, "description": "Resource not found"},
        status.HTTP_500_INTERNAL_SERVER_ERROR: {"model": ApiErrorResponse, "description": "Error retrieving file change"},
    }
)
async def get_ai_file_change_details(
    path_params: FileChangeIdParams = Depends()
):
    try:
        file_change_record = await ai_file_change_service.get_file_change(
            project_id=path_params.project_id,
            ai_file_change_id=path_params.ai_file_change_id
        )
        response_payload = GetAIFileChangeDetailsResponse(success=True, fileChange=file_change_record)
        return response_payload
    except HTTPException as he:
        err_detail = he.detail if isinstance(he.detail, dict) else {"message": str(he.detail), "code": "UNKNOWN_SERVICE_ERROR"}
        custom_code = err_detail.get("code", f"SERVICE_ERROR_{he.status_code}")
        if he.status_code == status.HTTP_404_NOT_FOUND and custom_code == "AI_FILE_CHANGE_NOT_FOUND":
            custom_code = "NOT_FOUND"
        
        return _create_api_error_response(
            status_code=he.status_code,
            message=err_detail.get("message", "An error occurred."),
            error_code=custom_code,
            details=err_detail.get("details", {})
        )
    except Exception:
        return _create_api_error_response(
            status.HTTP_500_INTERNAL_SERVER_ERROR,
            message="Error retrieving file change",
            error_code="FILE_CHANGE_RETRIEVAL_ERROR"
        )

@router.post(
    "/projects/{projectId}/ai-file-changes/{aiFileChangeId}/confirm",
    response_model=ConfirmAIFileChangeResponse,
    summary="Confirm and apply an AI-generated file change",
    responses={
        status.HTTP_400_BAD_REQUEST: {"model": ApiErrorResponse, "description": "Invalid ID or state"},
        status.HTTP_404_NOT_FOUND: {"model": ApiErrorResponse, "description": "Resource not found"},
        status.HTTP_500_INTERNAL_SERVER_ERROR: {"model": ApiErrorResponse, "description": "Error confirming file change"},
    }
)
async def confirm_ai_file_change(
    path_params: FileChangeIdParams = Depends()
):
    try:
        result = await ai_file_change_service.confirm_file_change(
            project_id=path_params.project_id,
            ai_file_change_id=path_params.ai_file_change_id
        )
        response_payload = ConfirmAIFileChangeResponse(success=True, result=result)
        return response_payload
    except HTTPException as he:
        err_detail = he.detail if isinstance(he.detail, dict) else {"message": str(he.detail), "code": "UNKNOWN_SERVICE_ERROR"}
        custom_code = err_detail.get("code", f"SERVICE_ERROR_{he.status_code}")
        if he.status_code == status.HTTP_404_NOT_FOUND and custom_code == "AI_FILE_CHANGE_NOT_FOUND":
            custom_code = "NOT_FOUND"
        elif he.status_code == status.HTTP_400_BAD_REQUEST and "INVALID_STATE" in custom_code:
            custom_code = "INVALID_STATE"

        return _create_api_error_response(
            status_code=he.status_code,
            message=err_detail.get("message", "An error occurred."),
            error_code=custom_code,
            details=err_detail.get("details", {})
        )
    except Exception:
        return _create_api_error_response(
            status.HTTP_500_INTERNAL_SERVER_ERROR,
            message="Error confirming file change",
            error_code="FILE_CHANGE_CONFIRM_ERROR"
        )

@router.post(
    "/projects/{projectId}/ai-file-changes/{aiFileChangeId}/reject",
    response_model=ConfirmAIFileChangeResponse,
    summary="Reject an AI-generated file change",
    responses={
        status.HTTP_400_BAD_REQUEST: {"model": ApiErrorResponse, "description": "Invalid ID or state"},
        status.HTTP_404_NOT_FOUND: {"model": ApiErrorResponse, "description": "Resource not found"},
        status.HTTP_500_INTERNAL_SERVER_ERROR: {"model": ApiErrorResponse, "description": "Error rejecting file change"},
    }
)
async def reject_ai_file_change(
    path_params: FileChangeIdParams = Depends()
):
    try:
        result = await ai_file_change_service.reject_file_change(
            project_id=path_params.project_id,
            ai_file_change_id=path_params.ai_file_change_id
        )
        response_payload = ConfirmAIFileChangeResponse(success=True, result=result)
        return response_payload
    except HTTPException as he:
        err_detail = he.detail if isinstance(he.detail, dict) else {"message": str(he.detail), "code": "UNKNOWN_SERVICE_ERROR"}
        custom_code = err_detail.get("code", f"SERVICE_ERROR_{he.status_code}")
        if he.status_code == status.HTTP_404_NOT_FOUND and custom_code == "AI_FILE_CHANGE_NOT_FOUND":
            custom_code = "NOT_FOUND"
        elif he.status_code == status.HTTP_400_BAD_REQUEST and "INVALID_STATE" in custom_code:
            custom_code = "INVALID_STATE"

        return _create_api_error_response(
            status_code=he.status_code,
            message=err_detail.get("message", "An error occurred."),
            error_code=custom_code,
            details=err_detail.get("details", {})
        )
    except Exception:
        return _create_api_error_response(
            status.HTTP_500_INTERNAL_SERVER_ERROR,
            message="Error rejecting file change",
            error_code="FILE_CHANGE_REJECT_ERROR"
        )

# ============================================================================
# GENERAL AI ENDPOINTS
# ============================================================================

@router.post(
    "/gen-ai/stream",
    summary="Generate text using a specified model and prompt (streaming)",
    response_description="Successfully initiated AI response stream (text/event-stream).",
)
async def stream_generate_text_endpoint(body: AiGenerateTextRequest):
    try:
        stream_generator = generate_text_stream(
            prompt=body.prompt, options=body.options, system_message_content=body.system_message
        )
        return StreamingResponse(stream_generator, media_type="text/event-stream")
    except ApiError as e:
        # await api_log(f"[stream_generate_text_endpoint] ApiError: {e.message}", "error", {"error_code": e.code, "details": e.details})
        raise HTTPException(status_code=e.status_code, detail=e.to_dict())
    except HTTPException:
        raise
    except Exception as e:
        # await api_log(f"[stream_generate_text_endpoint] Exception: {str(e)}", "error", {"error_type": type(e).__name__})
        raise HTTPException(status_code=500, detail=f"An unexpected error occurred: {str(e)}")

@router.post(
    "/gen-ai/text",
    summary="Generate text using a specified model and prompt",
    response_model=AiGenerateTextResponse,
    responses={
        422: {"model": ApiErrorResponse, "description": "Validation Error (invalid input)"},
        500: {"model": ApiErrorResponse, "description": "Internal Server Error or AI Provider Error"},
    },
)
async def generate_text_endpoint(body: AiGenerateTextRequest):
    try:
        generated_text = await generate_single_text(
            prompt=body.prompt, options=body.options, system_message_content=body.system_message
        )
        return AiGenerateTextResponse(data={"text": generated_text})
    except ApiError as e:
        # await api_log(f"[generate_text_endpoint] ApiError: {e.message}", "error", {"error_code": e.code, "details": e.details})
        raise HTTPException(status_code=e.status_code, detail=e.to_dict())
    except HTTPException:
        raise
    except Exception as e:
        # await api_log(f"[generate_text_endpoint] Exception: {str(e)}", "error", {"error_type": type(e).__name__})
        raise HTTPException(status_code=500, detail=f"Internal Server Error or AI Provider Error: {str(e)}")

@router.post(
    "/gen-ai/structured",
    summary="Generate structured data based on a predefined schema key and user input",
    response_model=AiGenerateStructuredResponse,
    responses={
        400: {"model": ApiErrorResponse, "description": "Bad Request: Invalid or unknown schemaKey provided."},
        422: {"model": ApiErrorResponse, "description": "Validation Error (invalid input)"},
        500: {"model": ApiErrorResponse, "description": "Internal Server Error or AI Provider Error"},
    },
)
async def generate_structured_endpoint(body: AiGenerateStructuredRequest):
    config_entry = STRUCTURED_DATA_SCHEMAS_CONFIG.get(body.schema_key)
    if not config_entry:
        valid_keys = ", ".join(STRUCTURED_DATA_SCHEMAS_CONFIG.keys())
        raise HTTPException(
            status_code=400,
            detail=f"Invalid schemaKey provided: {body.schema_key}. Valid keys are: {valid_keys}"
        )
    try:
        final_prompt = config_entry["prompt_template"].replace("{user_input}", body.user_input)
        
        merged_options_dict = {}
        if config_entry["model_settings"]:
            merged_options_dict.update(config_entry["model_settings"].model_dump(exclude_unset=True))
        if body.options:
            merged_options_dict.update(body.options.model_dump(exclude_unset=True))
        
        final_options = AiSdkOptions(**merged_options_dict) if merged_options_dict else None
        
        final_system_prompt = config_entry["system_prompt"]

        structured_response_dict = await generate_structured_data(
            prompt=final_prompt, output_schema=config_entry["schema"], options=final_options, system_message_content=final_system_prompt
        )
        return AiGenerateStructuredResponse(data={"output": structured_response_dict["object"]})
    except ApiError as e:
        # await api_log(f"[generate_structured_endpoint] ApiError for schema {body.schema_key}: {e.message}", "error", {"schema_key": body.schema_key, "error_code": e.code, "details": e.details})
        raise HTTPException(status_code=e.status_code, detail=e.to_dict())
    except HTTPException:
        raise
    except Exception as e:
        # await api_log(f"[generate_structured_endpoint] Exception for schema {body.schema_key}: {str(e)}", "error", {"schema_key": body.schema_key, "error_type": type(e).__name__})
        raise HTTPException(status_code=500, detail=f"Internal Server Error or AI Provider Error: {str(e)}")

@router.get(
    "/models",
    summary="List available AI models for a provider",
    response_model=ModelsListResponse,
    responses={
        422: {"model": ApiErrorResponse, "description": "Validation error for query parameters"},
        400: {"model": ApiErrorResponse, "description": "Invalid provider or configuration error"},
        500: {"model": ApiErrorResponse, "description": "Internal Server Error"},
    },
)
async def get_models_endpoint(query_params: ModelsQuery = Query(...)):
    provider_id_str = query_params.provider
    try:
        try:
            provider_enum_member = AIProviderEnum(provider_id_str)
        except ValueError:
            valid_providers = ", ".join([p.value for p in AIProviderEnum])
            raise HTTPException(status_code=400, detail=f"Invalid provider ID: '{provider_id_str}'. Valid providers are: {valid_providers}")

        all_keys_list_items = await provider_key_service.list_all_key_details()
        # print(f"[get_models_endpoint] all_keys_list_items: {all_keys_list_items}") # Removed log

        keys_for_provider = await provider_key_service.get_keys_by_provider(provider_enum_member.value)
        # print(f"[get_models_endpoint] keys_for_provider: {keys_for_provider}") # Removed log
        key_value = keys_for_provider[0].key if keys_for_provider else None

        provider_keys_config_dict = {}
        if key_value:
            if provider_enum_member == AIProviderEnum.OPENAI: provider_keys_config_dict["openaiKey"] = key_value
            elif provider_enum_member == AIProviderEnum.ANTHROPIC: provider_keys_config_dict["anthropicKey"] = key_value
            elif provider_enum_member == AIProviderEnum.GOOGLE_GEMINI: provider_keys_config_dict["googleGeminiKey"] = key_value
            elif provider_enum_member == AIProviderEnum.GROQ: provider_keys_config_dict["groqKey"] = key_value
            elif provider_enum_member == AIProviderEnum.TOGETHER: provider_keys_config_dict["togetherKey"] = key_value
            elif provider_enum_member == AIProviderEnum.XAI: provider_keys_config_dict["xaiKey"] = key_value
            elif provider_enum_member == AIProviderEnum.OPENROUTER: provider_keys_config_dict["openrouterKey"] = key_value
        
        keys_config = ProviderKeysConfig(**provider_keys_config_dict)
        model_fetcher = ModelFetcherService(config=keys_config)
        
        list_options = ListModelsOptions(
            ollama_base_url=OLLAMA_BASE_URL, 
            lmstudio_base_url=LMSTUDIO_BASE_URL
        )

        fetched_models_from_service = []
        try:
            fetched_models_from_service = await model_fetcher.list_models(provider=provider_enum_member, options=list_options)
        finally:
            await model_fetcher.close()

        api_models_response: List[ApiUnifiedModel] = []
        for idx, service_model in enumerate(fetched_models_from_service):
            api_models_response.append(
                ApiUnifiedModel(
                    id=idx + 1,
                    name=service_model.name,
                    provider=service_model.provider_slug,
                    context_length=service_model.context_length
                )
            )
        
        return ModelsListResponse(data=api_models_response)
    except ApiError as e:
        # await api_log(f"[get_models_endpoint] ApiError for provider {provider_id_str}: {e.message}", "error", {"provider": provider_id_str, "error_code": e.code, "details": e.details})
        raise HTTPException(status_code=e.status_code, detail=e.to_dict())
    except HTTPException:
        raise
    except Exception as e:
        # await api_log(f"[get_models_endpoint] Exception for provider {provider_id_str}: {str(e)}", "error", {"provider": provider_id_str, "error_type": type(e).__name__})
        raise HTTPException(status_code=500, detail=f"Internal Server Error: {str(e)}")

@router.post(
    "//ai/generate/text",
    summary="Generate text (one-off, non-streaming) - Alternative Path",
    description="Generates text based on a prompt. This path includes a double slash, preserved from the original TypeScript version.",
    response_model=AiGenerateTextResponse,
    responses={
        422: {"model": ApiErrorResponse, "description": "Validation error (invalid request body)"},
        400: {"model": ApiErrorResponse, "description": "Bad Request (e.g., missing API key, invalid provider/model)"},
        500: {"model": ApiErrorResponse, "description": "Internal Server Error or AI provider communication error"},
    },
    tags=["AI"], 
)
async def post_ai_generate_text_endpoint(body: AiGenerateTextRequest):
    try:
        generated_text = await generate_single_text(
            prompt=body.prompt, options=body.options, system_message_content=body.system_message
        )
        return AiGenerateTextResponse(data={"text": generated_text})
    except ApiError as e:
        # await api_log(f"[post_ai_generate_text_endpoint] ApiError: {e.message}", "error", {"error_code": e.code, "details": e.details})
        raise HTTPException(status_code=e.status_code, detail=e.to_dict())
    except HTTPException:
        raise
    except Exception as e:
        # await api_log(f"[post_ai_generate_text_endpoint] Exception: {str(e)}", "error", {"error_type": type(e).__name__})
        raise HTTPException(status_code=500, detail=f"Internal Server Error or AI Provider Error: {str(e)}")