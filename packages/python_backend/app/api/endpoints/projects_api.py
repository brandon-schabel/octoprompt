
import os
from pathlib import Path
from typing import List, Optional, Union, Dict, Any

from fastapi import APIRouter, Body, Query, Path as FastAPIPath, status, Depends, HTTPException
from fastapi.responses import JSONResponse

from app.schemas.project_schemas import (
    Project,
    CreateProjectBody,
    UpdateProjectBody,
    ProjectIdParams,
    ProjectResponse,
    ProjectListResponse,
    FileListResponse,
    ProjectResponseMultiStatus,
    ProjectSummaryResponse,
    RemoveSummariesBody,
    SuggestFilesBody,
    SummarizeFilesBody,
    RefreshQuery, 
)
from app.schemas.common_schemas import ApiErrorResponse, OperationSuccessResponse
from app.schemas.gen_ai_schemas import (
    SuggestFilesResponse,
    FileSuggestions,
    SummarizeFilesResponse,
    RemoveSummariesResponse
)
from app.schemas.prompt_schemas import (
    OptimizeUserInputRequest,
    OptimizePromptResponse,
    OptimizedPromptData,
)
from app.error_handling.api_error import ApiError
import app.services.project_service as project_service
from app.services.project_service import LOW_MODEL_CONFIG
import app.services.gen_ai_service as gen_ai_service
import app.services.file_services.file_sync_service_unified as file_sync_service
from app.utils.get_full_project_summary import get_full_project_summary
from app.services.agents.agent_logger import log as api_log

router = APIRouter(
    tags=["Projects"], 
)

def _normalize_path(project_path: str) -> str:
    if project_path.startswith('~'):
        project_path = os.path.expanduser(project_path)
    return str(Path(project_path).resolve())

@router.post(
    "/projects",
    response_model=Union[ProjectResponse, ProjectResponseMultiStatus], 
    status_code=status.HTTP_201_CREATED, 
    summary="Create a new project and sync its files",
    responses={
        status.HTTP_201_CREATED: {"model": ProjectResponse, "description": "Project created and initial sync started"},
        status.HTTP_207_MULTI_STATUS: {"model": ProjectResponseMultiStatus, "description": "Project created, but post-creation steps encountered issues"},
        status.HTTP_422_UNPROCESSABLE_ENTITY: {"model": ApiErrorResponse, "description": "Validation Error"},
        status.HTTP_500_INTERNAL_SERVER_ERROR: {"model": ApiErrorResponse, "description": "Internal Server Error"},
    }
)
async def create_project_route(data: CreateProjectBody = Body(...)):
    normalized_path = _normalize_path(data.path)

    project_data_for_service = data.model_copy(update={"path": normalized_path})
    
    created_project: Optional[Project] = None
    http_status_code: int = status.HTTP_201_CREATED
    response_data: Dict[str, Any] = {"success": False}

    try:
        created_project = await project_service.create_project(project_data_for_service)

        sync_warning: Optional[str] = None
        sync_error: Optional[str] = None

        project_path_obj = Path(created_project.path)
        if not project_path_obj.exists() or not project_path_obj.is_dir():
            print(f"Warning: Project path does not exist or is not a directory: {created_project.path}")
            sync_warning = "Project created but directory does not exist or is not a directory. No files will be synced."
            http_status_code = status.HTTP_207_MULTI_STATUS
        else:
            await file_sync_service.sync_project(created_project)
            files = await project_service.get_project_files(created_project.id)

        response_data = {
            "success": True,
            "data": created_project.model_dump()
        }
        if sync_warning:
            response_data["warning"] = sync_warning

    except ApiError as e:
        await api_log(f"[create_project_route] ApiError: {e.message}", "error", {"error_code": e.code, "details": e.details})
        raise HTTPException(status_code=e.status_code, detail=e.to_dict())
    except HTTPException:
        raise
    except Exception as e:
        await api_log(f"[create_project_route] Exception: {str(e)}", "error", {"path": data.path})
        if created_project:
            sync_error = f"Post-creation setup failed: {str(e)}"
            response_data = {
                "success": True,
                "data": created_project.model_dump(),
                "error": sync_error
            }
            http_status_code = status.HTTP_207_MULTI_STATUS
        else: 
            raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=f"Failed to create project: {str(e)}")
    
    if http_status_code == status.HTTP_201_CREATED:
        validated_payload = ProjectResponse(**response_data)
        return JSONResponse(content=validated_payload.model_dump(), status_code=http_status_code)
    elif http_status_code == status.HTTP_207_MULTI_STATUS:
        validated_payload = ProjectResponseMultiStatus(**response_data)
        return JSONResponse(content=validated_payload.model_dump(), status_code=http_status_code)
    else: 
        await api_log(f"[create_project_route] Unexpected http_status_code: {http_status_code}", "error")
        return JSONResponse(content={"success": False, "error": "Unexpected server state"}, status_code=status.HTTP_500_INTERNAL_SERVER_ERROR)


@router.get(
    "/projects",
    response_model=ProjectListResponse,
    summary="List all projects",
    responses={
        status.HTTP_500_INTERNAL_SERVER_ERROR: {"model": ApiErrorResponse, "description": "Internal Server Error"}
    }
)
async def list_projects_route():
    try:
        projects = await project_service.list_projects()
        return ProjectListResponse(success=True, data=projects)
    except ApiError as e:
        await api_log(f"[list_projects_route] ApiError: {e.message}", "error", {"error_code": e.code, "details": e.details})
        raise HTTPException(status_code=e.status_code, detail=e.to_dict())
    except HTTPException:
        raise
    except Exception as e:
        await api_log(f"[list_projects_route] Exception: {str(e)}", "error")
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=f"Failed to list projects: {str(e)}")

@router.get(
    "/projects/{project_id}",
    response_model=ProjectResponse,
    summary="Get a specific project by ID",
    responses={
        status.HTTP_404_NOT_FOUND: {"model": ApiErrorResponse, "description": "Project not found"},
        status.HTTP_422_UNPROCESSABLE_ENTITY: {"model": ApiErrorResponse, "description": "Validation Error"},
        status.HTTP_500_INTERNAL_SERVER_ERROR: {"model": ApiErrorResponse, "description": "Internal Server Error"}
    }
)
async def get_project_by_id_route(project_id: int = FastAPIPath(..., description="The ID of the project")):
    try:
        project = await project_service.get_project_by_id(project_id)
        if not project:
            raise ApiError(status.HTTP_404_NOT_FOUND, f"Project not found: {project_id}", "PROJECT_NOT_FOUND")
        return ProjectResponse(success=True, data=project)
    except ApiError as e:
        await api_log(f"[get_project_by_id_route] ApiError for project {project_id}: {e.message}", "error", {"project_id": project_id, "error_code": e.code, "details": e.details})
        raise HTTPException(status_code=e.status_code, detail=e.to_dict())
    except HTTPException:
        raise
    except Exception as e:
        await api_log(f"[get_project_by_id_route] Exception for project {project_id}: {str(e)}", "error", {"project_id": project_id})
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=f"Failed to get project {project_id}: {str(e)}")

@router.patch(
    "/projects/{project_id}",
    response_model=ProjectResponse,
    summary="Update a project's details",
    responses={
        status.HTTP_404_NOT_FOUND: {"model": ApiErrorResponse, "description": "Project not found"},
        status.HTTP_422_UNPROCESSABLE_ENTITY: {"model": ApiErrorResponse, "description": "Validation Error"},
        status.HTTP_500_INTERNAL_SERVER_ERROR: {"model": ApiErrorResponse, "description": "Internal Server Error"}
    }
)
async def update_project_route(
    project_id: int = FastAPIPath(..., description="The ID of the project"),
    data: UpdateProjectBody = Body(...)
):
    try:
        updated_project = await project_service.update_project(project_id, data)
        if not updated_project:
            raise ApiError(status.HTTP_404_NOT_FOUND, f"Project not found: {project_id} for update", "PROJECT_NOT_FOUND_FOR_UPDATE")
        return ProjectResponse(success=True, data=updated_project)
    except ApiError as e:
        await api_log(f"[update_project_route] ApiError for project {project_id}: {e.message}", "error", {"project_id": project_id, "error_code": e.code, "details": e.details})
        raise HTTPException(status_code=e.status_code, detail=e.to_dict())
    except HTTPException:
        raise
    except Exception as e:
        await api_log(f"[update_project_route] Exception for project {project_id}: {str(e)}", "error", {"project_id": project_id})
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=f"Failed to update project {project_id}: {str(e)}")

@router.delete(
    "/projects/{project_id}",
    response_model=OperationSuccessResponse,
    summary="Delete a project and its associated data",
    responses={
        status.HTTP_404_NOT_FOUND: {"model": ApiErrorResponse, "description": "Project not found"},
        status.HTTP_422_UNPROCESSABLE_ENTITY: {"model": ApiErrorResponse, "description": "Validation Error"},
        status.HTTP_500_INTERNAL_SERVER_ERROR: {"model": ApiErrorResponse, "description": "Internal Server Error"}
    }
)
async def delete_project_route(project_id: int = FastAPIPath(..., description="The ID of the project")):
    try:
        await project_service.delete_project(project_id)
        return OperationSuccessResponse(success=True, message="Project deleted successfully.")
    except ApiError as e:
        await api_log(f"[delete_project_route] ApiError for project {project_id}: {e.message}", "error", {"project_id": project_id, "error_code": e.code, "details": e.details})
        raise HTTPException(status_code=e.status_code, detail=e.to_dict())
    except HTTPException:
        raise
    except Exception as e:
        await api_log(f"[delete_project_route] Exception for project {project_id}: {str(e)}", "error", {"project_id": project_id})
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=f"Failed to delete project {project_id}: {str(e)}")


@router.post(
    "/projects/{project_id}/sync",
    tags=["Files"],
    response_model=OperationSuccessResponse,
    summary="Manually trigger a full file sync for a project",
    responses={
        status.HTTP_404_NOT_FOUND: {"model": ApiErrorResponse, "description": "Project not found"},
        status.HTTP_422_UNPROCESSABLE_ENTITY: {"model": ApiErrorResponse, "description": "Validation Error"},
        status.HTTP_500_INTERNAL_SERVER_ERROR: {"model": ApiErrorResponse, "description": "Internal Server Error during sync"}
    }
)
async def sync_project_files_route(project_id: int = FastAPIPath(..., description="The ID of the project")):
    try:
        project = await project_service.get_project_by_id(project_id)
        if not project:
            raise ApiError(status.HTTP_404_NOT_FOUND, f"Project not found: {project_id}", "PROJECT_NOT_FOUND")
        
        await api_log(f"[sync_project_files_route] Syncing project {project_id}", "info", {"project_id": project_id})
        await file_sync_service.sync_project(project)
        await api_log(f"[sync_project_files_route] Sync completed for project {project_id}", "info", {"project_id": project_id})
        return OperationSuccessResponse(success=True, message="Project sync initiated.")
    except ApiError as e:
        await api_log(f"[sync_project_files_route] ApiError for project {project_id}: {e.message}", "error", {"project_id": project_id, "error_code": e.code, "details": e.details})
        raise HTTPException(status_code=e.status_code, detail=e.to_dict())
    except HTTPException:
        await api_log(f"[sync_project_files_route] HTTPException for project {project_id}", "warn", {"project_id": project_id})
        raise
    except Exception as e:
        await api_log(f"[sync_project_files_route] Unhandled exception for project {project_id}: {str(e)}", "error", {"project_id": project_id, "error_type": type(e).__name__})
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=f"An unexpected error occurred during project sync: {str(e)}")

@router.get(
    "/projects/{project_id}/files",
    tags=["Files"],
    response_model=FileListResponse,
    summary="Get the list of files associated with a project",
    responses={
        status.HTTP_404_NOT_FOUND: {"model": ApiErrorResponse, "description": "Project not found"},
        status.HTTP_422_UNPROCESSABLE_ENTITY: {"model": ApiErrorResponse, "description": "Validation Error"},
        status.HTTP_500_INTERNAL_SERVER_ERROR: {"model": ApiErrorResponse, "description": "Internal Server Error"}
    }
)
async def get_project_files_route(project_id: int = FastAPIPath(..., description="The ID of the project")):
    try:
        await api_log(f"[get_project_files_route] Request for project files, project_id: {project_id}", "info", {"project_id": project_id})

        project = await project_service.get_project_by_id(project_id)
        if not project:
            raise ApiError(status.HTTP_404_NOT_FOUND, f"Project not found: {project_id}", "PROJECT_NOT_FOUND")
        
        files_dict = await project_service.project_storage.read_project_files(project_id)
        files_list = list(files_dict.values()) if files_dict else []
        
        return FileListResponse(success=True, data=files_list)
    except ApiError as e:
        await api_log(f"[get_project_files_route] ApiError for project {project_id}: {e.message}", "error", {"project_id": project_id, "error_code": e.code, "details": e.details})
        raise HTTPException(status_code=e.status_code, detail=e.to_dict())
    except HTTPException:
        raise
    except Exception as e:
        await api_log(f"[get_project_files_route] Exception for project {project_id}: {str(e)}", "error", {"project_id": project_id})
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=f"Failed to get project files for {project_id}: {str(e)}")


@router.post(
    "/projects/{project_id}/refresh",
    tags=["Files"],
    response_model=FileListResponse,
    summary="Refresh project files (sync) optionally limited to a folder",
    responses={
        status.HTTP_404_NOT_FOUND: {"model": ApiErrorResponse, "description": "Project not found"},
        status.HTTP_422_UNPROCESSABLE_ENTITY: {"model": ApiErrorResponse, "description": "Validation Error"},
        status.HTTP_500_INTERNAL_SERVER_ERROR: {"model": ApiErrorResponse, "description": "Internal Server Error during refresh/sync"}
    }
)
async def refresh_project_route(
    project_id: int = FastAPIPath(..., description="The ID of the project"),
    folder: Optional[str] = Query(None, description="Optional folder path to limit the refresh scope", example="src/components")
):
    try:
        await api_log(f"[refresh_project_route] Refreshing project {project_id}, folder: {folder}", "info", {"project_id": project_id, "folder": folder})
        project = await project_service.get_project_by_id(project_id)
        if not project:
            raise ApiError(status.HTTP_404_NOT_FOUND, f"Project not found: {project_id}", "PROJECT_NOT_FOUND")

        if folder:
            await file_sync_service.sync_project_folder(project, folder)
        else:
            await file_sync_service.sync_project(project)
        
        files_dict = await project_service.project_storage.read_project_files(project_id)
        files_list = list(files_dict.values()) if files_dict else []
        await api_log(f"[refresh_project_route] Refresh completed for project {project_id}", "info", {"project_id": project_id, "files_count": len(files_list)})
        return FileListResponse(success=True, data=files_list)
    except ApiError as e:
        await api_log(f"[refresh_project_route] ApiError for project {project_id}: {e.message}", "error", {"project_id": project_id, "folder": folder, "error_code": e.code, "details": e.details})
        raise HTTPException(status_code=e.status_code, detail=e.to_dict())
    except HTTPException:
        raise
    except Exception as e:
        await api_log(f"[refresh_project_route] Exception for project {project_id}: {str(e)}", "error", {"project_id": project_id, "folder": folder})
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=f"Failed to refresh project {project_id}: {str(e)}")


@router.get(
    "/projects/{project_id}/summary",
    tags=["Files", "AI"],
    response_model=ProjectSummaryResponse,
    summary="Get a combined summary of all files in the project",
    responses={
        status.HTTP_404_NOT_FOUND: {"model": ApiErrorResponse, "description": "Project not found"},
        status.HTTP_422_UNPROCESSABLE_ENTITY: {"model": ApiErrorResponse, "description": "Validation Error"},
        status.HTTP_500_INTERNAL_SERVER_ERROR: {"model": ApiErrorResponse, "description": "Internal Server Error or failed to generate summary for existing project"}
    }
)
async def get_project_summary_route(project_id: int = FastAPIPath(..., description="The ID of the project")):
    try:
        summary_result = await get_full_project_summary(project_id)

        if isinstance(summary_result, str):
            return ProjectSummaryResponse(success=True, summary=summary_result)
        elif isinstance(summary_result, dict) and ("message" in summary_result or "error" in summary_result):
            actual_message = summary_result.get("message", summary_result.get("error", "No specific message from get_full_project_summary"))
            return ProjectSummaryResponse(success=True, summary="")
        elif summary_result is None:
            return ProjectSummaryResponse(success=True, summary="")
        else:
            raise ApiError(status.HTTP_500_INTERNAL_SERVER_ERROR, "Invalid summary format received.", "PROJECT_SUMMARY_INVALID_FORMAT")

    except ApiError as e:
        raise HTTPException(status_code=e.status_code, detail=e.to_dict())
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=f"An unexpected error occurred while generating project summary for {project_id}: {str(e)}")


@router.post(
    "/projects/{project_id}/suggest-files",
    tags=["Files", "AI"],
    response_model=SuggestFilesResponse,
    summary="Suggest relevant files based on user input and project context",
    responses={
        status.HTTP_404_NOT_FOUND: {"model": ApiErrorResponse, "description": "Project not found"},
        status.HTTP_422_UNPROCESSABLE_ENTITY: {"model": ApiErrorResponse, "description": "Validation Error"},
        status.HTTP_500_INTERNAL_SERVER_ERROR: {"model": ApiErrorResponse, "description": "Internal Server Error or AI processing error"}
    }
)
async def suggest_files_route(
    project_id: int = FastAPIPath(..., description="The ID of the project"),
    body: SuggestFilesBody = Body(...)
):
    try:
        await api_log(f"[suggest_files_route] Suggesting files for project {project_id}", "info", {"project_id": project_id, "user_input_length": len(body.userInput)})
        project = await project_service.get_project_by_id(project_id)
        if not project:
            raise ApiError(status.HTTP_404_NOT_FOUND, f"Project not found: {project_id}", "PROJECT_NOT_FOUND")

        project_summary = await get_full_project_summary(project_id)
        project_summary_str = "Project summary is unavailable."
        if isinstance(project_summary, str):
            project_summary_str = project_summary
        elif isinstance(project_summary, dict):
            await api_log(f"[suggest_files_route] Project summary for {project_id} was a dict: {project_summary}. Proceeding with unavailable message.", "warn", {"project_id": project_id})
        
        system_prompt = """
<role>
You are a code assistant that recommends relevant files based on user input.
You have a list of file summaries and a user request.
</role>

<response_format>
    {"fileIds": ["9d679879sad7fdf324312", "9d679879sad7fdf324312"]}
</response_format>

<guidelines>
- For simple tasks: return max 5 files
- For complex tasks: return max 10 files
- For very complex tasks: return max 20 files
- Do not add comments in your response
- Strictly follow the JSON schema, do not add any additional properties or comments
- DO NOT RETURN THE FILE NAME UNDER ANY CIRCUMSTANCES, JUST THE FILE ID
</guidelines>
    """
    
        user_prompt = f"""
<project_summary>
{project_summary_str}
</project_summary>

<user_query>
{body.userInput}
</user_query>
"""
        ai_options = LOW_MODEL_CONFIG
        ai_response_dict = await gen_ai_service.generate_structured_data(
            prompt=user_prompt,
            output_schema=FileSuggestions,
            options=ai_options,
            system_message_content=system_prompt
        )

        
        suggestions_data_dict = ai_response_dict.get("object")
        if not suggestions_data_dict:
            raise ApiError(status.HTTP_500_INTERNAL_SERVER_ERROR, "AI returned no suggestion data.", "AI_SUGGESTION_NO_OBJECT")

        try:
            suggestions = FileSuggestions(**suggestions_data_dict)
        except ValidationError as e:
            raise ApiError(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                message="AI output failed validation.",
                code="AI_SUGGESTION_VALIDATION_ERROR",
                details=e.errors()
            )
        
        return SuggestFilesResponse(success=True, recommendedFileIds=suggestions.fileIds)
    except ApiError as e:
        await api_log(f"[suggest_files_route] ApiError for project {project_id}: {e.message}", "error", {"project_id": project_id, "error_code": e.code, "details": e.details})
        raise HTTPException(status_code=e.status_code, detail=e.to_dict())
    except HTTPException:
        raise
    except Exception as e:
        await api_log(f"[suggest_files_route] Exception for project {project_id}: {str(e)}", "error", {"project_id": project_id, "error_type": type(e).__name__})
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=f"Failed to suggest files for project {project_id}: {str(e)}")


@router.post(
    "/projects/{project_id}/summarize",
    tags=["Files", "AI"],
    response_model=SummarizeFilesResponse,
    summary="Summarize selected files in a project (or force re-summarize)",
    responses={
        status.HTTP_404_NOT_FOUND: {"model": ApiErrorResponse, "description": "Project or some files not found"},
        status.HTTP_422_UNPROCESSABLE_ENTITY: {"model": ApiErrorResponse, "description": "Validation Error"},
        status.HTTP_500_INTERNAL_SERVER_ERROR: {"model": ApiErrorResponse, "description": "Internal Server Error during summarization"}
    }
)
async def summarize_project_files_route(
    project_id: int = FastAPIPath(..., description="The ID of the project"),
    body: SummarizeFilesBody = Body(...)
):
    try:
        await api_log(f"[summarize_project_files_route] Summarizing files for project {project_id}", "info", {"project_id": project_id, "file_ids_count": len(body.fileIds)})
        project = await project_service.get_project_by_id(project_id)
        if not project:
            raise ApiError(status.HTTP_404_NOT_FOUND, f"Project not found: {project_id}", "PROJECT_NOT_FOUND")

        files_to_process_check = await project_service.get_project_files_by_ids(project_id, body.fileIds)
        if len(files_to_process_check) != len(body.fileIds):
             await api_log(f"[summarize_project_files_route] Warning: Requested {len(body.fileIds)} files for summarization, found {len(files_to_process_check)} for project {project_id}.", "warn", {"project_id": project_id, "requested_count": len(body.fileIds), "found_count": len(files_to_process_check)})
             if not files_to_process_check and body.fileIds:
                 raise ApiError(status.HTTP_404_NOT_FOUND, "None of the requested files found for summarization.", "FILES_NOT_FOUND_FOR_SUMMARIZATION")
        
        if not files_to_process_check:
            await api_log(f"[summarize_project_files_route] No files to process for summarization for project {project_id}.", "info", {"project_id": project_id})
            return SummarizeFilesResponse(
                success=True,
                message="No files processed for summarization.",
                included=0,
                skipped=len(body.fileIds),
                updated_files=[],
            )

        summarization_result = await project_service.summarize_files(
            project_id,
            body.fileIds, 
        )
        
        updated_project_files_list = summarization_result.get("updated_files", [])
        included_count = summarization_result.get("included", 0)
        service_skipped_count = summarization_result.get("skipped")

        if service_skipped_count is not None:
            skipped_count = service_skipped_count
        else:
            total_requested = len(body.fileIds)
            skipped_count = total_requested - included_count

        return SummarizeFilesResponse(
            success=True,
            message="Summarization process completed.",
            included=included_count,
            skipped=skipped_count, 
            updated_files=updated_project_files_list
        )
    except ApiError as e:
        await api_log(f"[summarize_project_files_route] ApiError for project {project_id}: {e.message}", "error", {"project_id": project_id, "error_code": e.code, "details": e.details})
        raise HTTPException(status_code=e.status_code, detail=e.to_dict())
    except HTTPException:
        raise
    except Exception as e:
        await api_log(f"[summarize_project_files_route] Exception for project {project_id}: {str(e)}", "error", {"project_id": project_id, "error_type": type(e).__name__})
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=f"Failed to summarize files for project {project_id}: {str(e)}")

@router.post(
    "/projects/{project_id}/remove-summaries",
    tags=["Files"],
    response_model=RemoveSummariesResponse,
    summary="Remove summaries from selected files",
    responses={
        status.HTTP_404_NOT_FOUND: {"model": ApiErrorResponse, "description": "Project or some files not found"},
        status.HTTP_422_UNPROCESSABLE_ENTITY: {"model": ApiErrorResponse, "description": "Validation Error"},
        status.HTTP_500_INTERNAL_SERVER_ERROR: {"model": ApiErrorResponse, "description": "Internal Server Error"}
    }
)
async def remove_summaries_route(
    project_id: int = FastAPIPath(..., description="The ID of the project"),
    body: RemoveSummariesBody = Body(...)
):
    try:
        await api_log(f"[remove_summaries_route] Removing summaries for project {project_id}", "info", {"project_id": project_id, "file_ids_count": len(body.fileIds)})
        project = await project_service.get_project_by_id(project_id)
        if not project:
            raise ApiError(status.HTTP_404_NOT_FOUND, f"Project not found: {project_id}", "PROJECT_NOT_FOUND")
        
        all_files_map = await project_service.project_storage.read_project_files(project_id)
        removed_count = 0
        changes_made = False
        files_not_found_count = 0

        if not all_files_map:
            all_files_map = {}

        for file_id in body.fileIds:
            if file_id in all_files_map:
                file_data = all_files_map[file_id]
                if file_data.summary is not None or file_data.summaryLastUpdated is not None:
                    file_data.summary = None
                    file_data.summaryLastUpdated = None
                all_files_map[file_id] = file_data 
                removed_count += 1
                changes_made = True
            else:
                files_not_found_count +=1
                await api_log(f"[remove_summaries_route] Warning: File ID {file_id} not found in project {project_id} for remove summary.", "warn", {"project_id": project_id, "file_id": file_id})

        if changes_made:
            await project_service.project_storage.write_project_files(project_id, all_files_map)

        message = f"Removed summaries from {removed_count} file(s)."
        if files_not_found_count > 0:
            message += f" {files_not_found_count} requested file(s) not found."
        if removed_count == 0 and files_not_found_count == 0 and body.fileIds:
             message = "No summaries found to remove for the provided file IDs."
        elif not body.fileIds:
            message = "No file IDs provided to remove summaries from."
            
        return RemoveSummariesResponse(success=True, removedCount=removed_count, message=message)
    except ApiError as e:
        await api_log(f"[remove_summaries_route] ApiError for project {project_id}: {e.message}", "error", {"project_id": project_id, "error_code": e.code, "details": e.details})
        raise HTTPException(status_code=e.status_code, detail=e.to_dict())
    except HTTPException:
        raise
    except Exception as e:
        await api_log(f"[remove_summaries_route] Exception for project {project_id}: {str(e)}", "error", {"project_id": project_id, "error_type": type(e).__name__})
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=f"Failed to remove summaries for project {project_id}: {str(e)}")


@router.post(
    "/prompt/optimize",
    tags=["Prompts", "AI"],
    response_model=OptimizePromptResponse,
    summary="Optimize a user-provided prompt using an AI model",
    responses={
        status.HTTP_422_UNPROCESSABLE_ENTITY: {"model": ApiErrorResponse, "description": "Validation Error"},
        status.HTTP_500_INTERNAL_SERVER_ERROR: {"model": ApiErrorResponse, "description": "Internal Server Error or AI provider error"}
    }
)
async def optimize_user_input_route(body: OptimizeUserInputRequest = Body(...)):
    try:
        await api_log(f"[optimize_user_input_route] Optimizing prompt for project {body.projectId}", "info", {"project_id": body.projectId, "context_length": len(body.userContext or "")})
        if not hasattr(project_service, 'optimize_user_input'):
            await api_log(f"[optimize_user_input_route] Service 'optimize_user_input' not implemented.", "error", {"project_id": body.projectId})
            raise ApiError(status.HTTP_501_NOT_IMPLEMENTED, "Prompt optimization service not implemented.", "SERVICE_NOT_IMPLEMENTED")

        optimized_text = await project_service.optimize_user_input(body.projectId, body.userContext)
        
        response_data = OptimizedPromptData(optimizedPrompt=optimized_text)
        return OptimizePromptResponse(success=True, data=response_data)
    except ApiError as e:
        await api_log(f"[optimize_user_input_route] ApiError for project {body.projectId}: {e.message}", "error", {"project_id": body.projectId, "error_code": e.code, "details": e.details})
        raise HTTPException(status_code=e.status_code, detail=e.to_dict())
    except HTTPException:
        raise
    except Exception as e:
        await api_log(f"[optimize_user_input_route] Exception for project {body.projectId}: {str(e)}", "error", {"project_id": body.projectId, "error_type": type(e).__name__})
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=f"Failed to optimize prompt for project {body.projectId}: {str(e)}")
