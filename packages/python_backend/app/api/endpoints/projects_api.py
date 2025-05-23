# packages/python_backend/app/api/endpoints/projects.py
# - Initial Python conversion of project-routes.ts
# - Maps Hono routes to FastAPI APIRouter path operations
# - Uses Pydantic schemas from app.schemas.*
# - Calls Python services from app.services.*
# - Replicates request/response structures and error handling

import os
from pathlib import Path
from typing import List, Optional, Union, Dict, Any

from fastapi import APIRouter, Body, Query, Path as FastAPIPath, status, Depends, HTTPException
from fastapi.responses import JSONResponse

from app.schemas.project_schemas import (
    Project,
    CreateProjectBody,
    UpdateProjectBody,
    ProjectIdParams, # Though FastAPI handles path params directly in signature
    ProjectResponse,
    ProjectListResponse,
    FileListResponse,
    ProjectResponseMultiStatus,
    ProjectSummaryResponse,
    RemoveSummariesBody,
    SuggestFilesBody,
    SummarizeFilesBody,
    RefreshQuery, # This will be used with Query parameters, not a body
)
from app.schemas.common_schemas import ApiErrorResponse, OperationSuccessResponse
from app.schemas.gen_ai_schemas import (
    SuggestFilesResponse,
    FileSuggestions, # Changed from FileSuggestionsModel
    SummarizeFilesResponse,
    RemoveSummariesResponse
)
from app.schemas.prompt_schemas import (
    OptimizeUserInputRequest,
    OptimizePromptResponse,
    OptimizedPromptData,
)

# Assuming ApiError is in app.error_handling.api_error
# If it's still in project_service, adjust import: from app.services.project_service import ApiError
from app.error_handling.api_error import ApiError

import app.services.project_service as project_service
from app.services.project_service import LOW_MODEL_CONFIG # Used in summarize_single_file -> summarize_files
# Placeholder for gen_ai_service if specific functions are directly called from routes
# (though project_service.py already has placeholders for generate_single_text, generate_structured_data)
import app.services.gen_ai_service as gen_ai_service

# Assuming file_sync_service exists for sync_project and sync_project_folder
# import app.services.file_sync_service as file_sync_service
import app.services.file_services.file_sync_service_unified as file_sync_service
# Placeholder for watchers_manager if its direct equivalent is needed
# from app.services.watchers_manager import watchers_manager

from app.utils.get_full_project_summary import get_full_project_summary
# from app.utils.prompts_map import prompts_map # optimize_user_input in project_service.ts uses this. Assume Python version does too.

# Assuming a generic logger, or if agent_log is to be used here:
from app.services.agents.agent_logger import log as api_log # Using a generic alias for now

router = APIRouter(
    tags=["Projects"], # Apply tag to all routes in this router
)

# Helper for path normalization, similar to TS version
def _normalize_path(project_path: str) -> str:
    if project_path.startswith('~'):
        project_path = os.path.expanduser(project_path)
    return str(Path(project_path).resolve())

# Route implementations mirroring TypeScript project-routes.ts

@router.post(
    "/projects",
    response_model=Union[ProjectResponse, ProjectResponseMultiStatus], # Union for OpenAPI doc, actual response type handled by JSONResponse
    status_code=status.HTTP_201_CREATED, # Default, can be overridden by JSONResponse
    summary="Create a new project and sync its files",
    responses={
        status.HTTP_201_CREATED: {"model": ProjectResponse, "description": "Project created and initial sync started"},
        status.HTTP_207_MULTI_STATUS: {"model": ProjectResponseMultiStatus, "description": "Project created, but post-creation steps encountered issues"},
        status.HTTP_422_UNPROCESSABLE_ENTITY: {"model": ApiErrorResponse, "description": "Validation Error"},
        status.HTTP_500_INTERNAL_SERVER_ERROR: {"model": ApiErrorResponse, "description": "Internal Server Error"},
    }
)
async def create_project_route(data: CreateProjectBody = Body(...)):
    print(f"[projects_api.py] create_project_route called with data: {data}")
    normalized_path = _normalize_path(data.path)
    print(f"Creating project - Original path: {data.path}, Normalized path: {normalized_path}")

    project_data_for_service = data.model_copy(update={"path": normalized_path})
    print(f"[projects_api.py] project_data_for_service: {project_data_for_service}")
    
    created_project: Optional[Project] = None # Initialize to allow access in finally/except
    http_status_code: int = status.HTTP_201_CREATED
    response_data: Dict[str, Any] = {"success": False} # Default to not success

    try:
        created_project = await project_service.create_project(project_data_for_service)
        print(f"Project created with ID: {created_project.id}")

        sync_warning: Optional[str] = None
        sync_error: Optional[str] = None
        # http_status_code: int = status.HTTP_201_CREATED # Moved up

        project_path_obj = Path(created_project.path)
        if not project_path_obj.exists() or not project_path_obj.is_dir():
            print(f"Warning: Project path does not exist or is not a directory: {created_project.path}")
            sync_warning = "Project created but directory does not exist or is not a directory. No files will be synced."
            http_status_code = status.HTTP_207_MULTI_STATUS
        else:
            print(f"Starting sync for project: {created_project.id} at path: {created_project.path}")
            await file_sync_service.sync_project(created_project)
            print(f"Finished syncing files for project: {created_project.id}")
            files = await project_service.get_project_files(created_project.id)
            print(f"Synced {len(files) if files else 0} files for project")

        response_data = {
            "success": True,
            "data": created_project.model_dump()
        }
        if sync_warning:
            response_data["warning"] = sync_warning
        # sync_error is handled by general exception below if it's from sync_project

    except ApiError as e:
        await api_log(f"[create_project_route] ApiError: {e.message}", "error", {"error_code": e.code, "details": e.details})
        # For create, if project creation itself fails (ApiError from create_project), we might not have a created_project
        # If error is from sync part, project exists.
        # The original code structure implies create_project can throw, then sync happens.
        # If create_project fails, it's a clear error. If sync fails, it's a 207.
        # This specific ApiError catch will make it a direct error response matching the ApiError's status.
        # This might differ from the original 207 logic if sync_project itself raises an ApiError.
        # For now, let it be handled by the generic ApiError handler.
        # To preserve original 207 for sync issues, that try-except needs to be more specific.
        raise HTTPException(status_code=e.status_code, detail=e.to_dict())
    except HTTPException:
        raise # Re-raise if it's already an HTTPException
    except Exception as e:
        print(f"Error during project creation or post-creation setup: {e}")
        await api_log(f"[create_project_route] Exception: {str(e)}", "error", {"path": data.path})
        # This part is tricky. If project was created but sync failed, original code sets 207.
        # If create_project failed, then it's a 500 or other error.
        if created_project: # Project was created, but a subsequent step failed
            sync_error = f"Post-creation setup failed: {str(e)}"
            response_data = {
                "success": True, # Project was created
                "data": created_project.model_dump(),
                "error": sync_error
            }
            http_status_code = status.HTTP_207_MULTI_STATUS
        else: # Project creation itself failed
            # This might be redundant if create_project raises ApiError handled above
            # but as a general fallback:
            raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=f"Failed to create project: {str(e)}")
    
    # Construct and return response based on http_status_code
    # This part might need adjustment based on whether an exception was raised and handled.
    # If an HTTPException was raised, this part is not reached.
    # This is for the success path or the 207 path where an error string is added.

    if http_status_code == status.HTTP_201_CREATED:
        validated_payload = ProjectResponse(**response_data)
        return JSONResponse(content=validated_payload.model_dump(), status_code=http_status_code)
    elif http_status_code == status.HTTP_207_MULTI_STATUS:
        validated_payload = ProjectResponseMultiStatus(**response_data)
        return JSONResponse(content=validated_payload.model_dump(), status_code=http_status_code)
    else: # Should not happen if exceptions are raised correctly
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
        print(f"[projects_api.py] list_projects_route projects: {projects}")
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
            # This specific ApiError is raised by the service or should be.
            # If service returns None, we raise it here.
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
        if not updated_project: # Should be handled by service raising ApiError(404,...)
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
        await project_service.delete_project(project_id) # Expects service to raise ApiError on failure/not found
        # watchersManager.stopWatchingProject(projectId) # Placeholder
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
            # Original code raises ApiError here, which is good.
            raise ApiError(status.HTTP_404_NOT_FOUND, f"Project not found: {project_id}", "PROJECT_NOT_FOUND")
        
        await api_log(f"[sync_project_files_route] Syncing project {project_id}", "info", {"project_id": project_id})
        await file_sync_service.sync_project(project)
        await api_log(f"[sync_project_files_route] Sync completed for project {project_id}", "info", {"project_id": project_id})
        return OperationSuccessResponse(success=True, message="Project sync initiated.")
    except ApiError as e:
        # Log the ApiError with specific details
        await api_log(f"[sync_project_files_route] ApiError for project {project_id}: {e.message}", "error", {"project_id": project_id, "error_code": e.code, "details": e.details})
        # Convert ApiError to HTTPException
        raise HTTPException(status_code=e.status_code, detail=e.to_dict())
    except HTTPException:
        # If it's already an HTTPException (e.g., from FastAPI validation), re-raise it
        await api_log(f"[sync_project_files_route] HTTPException for project {project_id}", "warn", {"project_id": project_id})
        raise
    except Exception as e:
        # Catch any other unexpected exceptions
        await api_log(f"[sync_project_files_route] Unhandled exception for project {project_id}: {str(e)}", "error", {"project_id": project_id, "error_type": type(e).__name__})
        # Return a generic 500 error
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
        # The explicit int conversion and print statements can be removed if FastAPI handles type coercion well,
        # but keeping for parity with original snippet if these logs are important.
        # project_id_int = int(project_id) # FastAPI does this
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
        # project_id_int = int(project_id) # FastAPI handles
        await api_log(f"[get_project_summary_route] Request for project summary, project_id: {project_id}", "info", {"project_id": project_id})
        
        summary_result = await get_full_project_summary(project_id)

        if isinstance(summary_result, str):
            return ProjectSummaryResponse(success=True, summary=summary_result)
        elif isinstance(summary_result, dict) and ("message" in summary_result or "error" in summary_result):
            actual_message = summary_result.get("message", summary_result.get("error", "No specific message from get_full_project_summary"))
            await api_log(f"[get_project_summary_route] Project {project_id}: get_full_project_summary returned a dict: '{actual_message}'. Returning empty summary.", "info", {"project_id": project_id, "message": actual_message})
            return ProjectSummaryResponse(success=True, summary="")
        elif summary_result is None:
            await api_log(f"[get_project_summary_route] Project {project_id}: get_full_project_summary returned None. Returning empty summary.", "info", {"project_id": project_id})
            return ProjectSummaryResponse(success=True, summary="")
        else:
            await api_log(f"[get_project_summary_route] Project {project_id}: get_full_project_summary returned an unexpected format: {type(summary_result)}. Value: {summary_result}", "error", {"project_id": project_id, "result_type": str(type(summary_result))})
            raise ApiError(status.HTTP_500_INTERNAL_SERVER_ERROR, "Invalid summary format received.", "PROJECT_SUMMARY_INVALID_FORMAT")

    except ApiError as e:
        await api_log(f"[get_project_summary_route] ApiError for project {project_id}: {e.message}", "error", {"project_id": project_id, "error_code": e.code, "details": e.details, "status_code": e.status_code})
        # if e.status_code == status.HTTP_404_NOT_FOUND: # This check is already in get_full_project_summary which raises ApiError
        #     print(f"Project {project_id} not found according to get_full_project_summary. Raising 404.")
        raise HTTPException(status_code=e.status_code, detail=e.to_dict())
    except HTTPException:
        raise
    except Exception as e:
        await api_log(f"[get_project_summary_route] Unexpected error for project {project_id}: {str(e)}", "error", {"project_id": project_id, "error_type": type(e).__name__})
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
        # project_id_int = int(project_id) # FastAPI handles
        await api_log(f"[suggest_files_route] Suggesting files for project {project_id}", "info", {"project_id": project_id, "user_input_length": len(body.userInput)})
        project = await project_service.get_project_by_id(project_id)
        if not project:
            raise ApiError(status.HTTP_404_NOT_FOUND, f"Project not found: {project_id}", "PROJECT_NOT_FOUND")

        project_summary = await get_full_project_summary(project_id)
        project_summary_str = "Project summary is unavailable."
        if isinstance(project_summary, str):
            project_summary_str = project_summary
        elif isinstance(project_summary, dict): # Error case from get_full_project_summary
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
        ai_response = await gen_ai_service.generate_structured_data({
            "prompt": user_prompt,
            "schema": FileSuggestions,
            "system_message": system_prompt,
            "options": LOW_MODEL_CONFIG
        })
        
        if isinstance(ai_response.object, FileSuggestions):
            suggestions = ai_response.object
        elif isinstance(ai_response.object, dict):
            suggestions = FileSuggestions(**ai_response.object)
        else:
            await api_log(f"[suggest_files_route] AI returned unexpected structure for project {project_id}", "error", {"project_id": project_id, "response_type": str(type(ai_response.object))})
            raise ApiError(status.HTTP_500_INTERNAL_SERVER_ERROR, "AI returned unexpected data structure.", "AI_SUGGESTION_INVALID_STRUCTURE")

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
        # project_id_int = int(project_id) # FastAPI handles
        await api_log(f"[summarize_project_files_route] Summarizing files for project {project_id}", "info", {"project_id": project_id, "file_ids_count": len(body.fileIds)})
        project = await project_service.get_project_by_id(project_id)
        if not project:
            raise ApiError(status.HTTP_404_NOT_FOUND, f"Project not found: {project_id}", "PROJECT_NOT_FOUND")

        files_to_process_check = await project_service.get_project_files_by_ids(project_id, body.fileIds)
        if len(files_to_process_check) != len(body.fileIds):
             await api_log(f"[summarize_project_files_route] Warning: Requested {len(body.fileIds)} files for summarization, found {len(files_to_process_check)} for project {project_id}.", "warn", {"project_id": project_id, "requested_count": len(body.fileIds), "found_count": len(files_to_process_check)})
             if not files_to_process_check and body.fileIds:
                 raise ApiError(status.HTTP_404_NOT_FOUND, "None of the requested files found for summarization.", "FILES_NOT_FOUND_FOR_SUMMARIZATION")
        
        if not files_to_process_check: # If files_to_process_check is empty (either none requested or none found)
            await api_log(f"[summarize_project_files_route] No files to process for summarization for project {project_id}.", "info", {"project_id": project_id})
            return SummarizeFilesResponse(
                success=True,
                message="No files processed for summarization.",
                included=0,
                skipped=len(body.fileIds), # All requested files were skipped as they were not found/processed
                updated_files=[],
            )

        # Call summarize_files with the original list of file IDs
        summarization_result = await project_service.summarize_files(
            project_id,
            body.fileIds, # Pass the list of file IDs directly
        )
        
        # The summarize_files service now returns a dict: {"included": int, "skipped": int, "updated_files": List[ProjectFile]}
        updated_project_files_list = summarization_result.get("updated_files", [])
        included_count = summarization_result.get("included", 0)
        # The service internally calculates skipped files based on what it processed vs. what was requested (body.fileIds)
        # So we use the skipped count directly from the service if available.
        # If not, we fall back to the previous logic, but ideally, the service handles this.
        service_skipped_count = summarization_result.get("skipped")

        if service_skipped_count is not None:
            skipped_count = service_skipped_count
        else:
            # Fallback logic if service doesn't provide skipped count (it should)
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
        # project_id_int = int(project_id) # FastAPI handles
        await api_log(f"[remove_summaries_route] Removing summaries for project {project_id}", "info", {"project_id": project_id, "file_ids_count": len(body.fileIds)})
        project = await project_service.get_project_by_id(project_id)
        if not project:
            raise ApiError(status.HTTP_404_NOT_FOUND, f"Project not found: {project_id}", "PROJECT_NOT_FOUND")
        
        # Assuming project_service.remove_summaries_from_files is NOT implemented yet
        # Using the inline logic as before:
        all_files_map = await project_service.project_storage.read_project_files(project_id)
        removed_count = 0
        changes_made = False
        files_not_found_count = 0

        if not all_files_map: # Handle case where project has no files stored
            all_files_map = {}

        for file_id in body.fileIds:
            if file_id in all_files_map:
                file_data = all_files_map[file_id]
                if file_data.summary is not None or file_data.summaryLastUpdatedAt is not None:
                    file_data.summary = None
                    file_data.summaryLastUpdatedAt = None
                    # Pydantic models are immutable by default, but if it's a dict from storage, direct update is fine.
                    # If it's a Pydantic model instance, it might need to be reconstructed or use model_copy.
                    # Assuming all_files_map contains mutable dicts or project_storage handles Pydantic instances correctly on write.
                    # For safety with Pydantic models: all_files_map[file_id] = file_data.model_copy(update={"summary": None, "summaryLastUpdatedAt": None})
                    # However, project_storage.write_project_files probably expects dicts of ProjectFile models, so mutating the model instance before write is typical.
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
        if removed_count == 0 and files_not_found_count == 0 and body.fileIds: # files requested, none found with summaries, none missing
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

# To be included in app/api/routes.py:
# from .endpoints import projects
# main_router.include_router(projects.router, prefix="/api") # Or adjust prefix as needed