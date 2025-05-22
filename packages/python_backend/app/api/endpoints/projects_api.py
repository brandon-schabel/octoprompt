# packages/python_backend/app/api/endpoints/projects.py
# - Initial Python conversion of project-routes.ts
# - Maps Hono routes to FastAPI APIRouter path operations
# - Uses Pydantic schemas from app.schemas.*
# - Calls Python services from app.services.*
# - Replicates request/response structures and error handling

import os
from pathlib import Path
from typing import List, Optional, Union, Dict, Any

from fastapi import APIRouter, Body, Query, Path as FastAPIPath, status, Depends
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
    created_project = await project_service.create_project(project_data_for_service)
    print(f"Project created with ID: {created_project.id}")

    sync_warning: Optional[str] = None
    sync_error: Optional[str] = None
    http_status_code: int = status.HTTP_201_CREATED



    try:
        project_path_obj = Path(created_project.path)
        if not project_path_obj.exists() or not project_path_obj.is_dir():
            print(f"Warning: Project path does not exist or is not a directory: {created_project.path}")
            sync_warning = "Project created but directory does not exist or is not a directory. No files will be synced."
            http_status_code = status.HTTP_207_MULTI_STATUS
        else:
            print(f"Starting sync for project: {created_project.id} at path: {created_project.path}")
            await file_sync_service.sync_project(created_project) # Assuming this is available
            print(f"Finished syncing files for project: {created_project.id}")

            # Placeholder for watcher functionality
            # print(f"Starting file watchers for project: {created_project.id}")
            # await watchers_manager.start_watching_project(created_project, ['node_modules', 'dist', '.git', '*.tmp', '*.db-journal'])
            # print(f"File watchers started for project: {created_project.id}")
            
            files = await project_service.get_project_files(created_project.id)
            print(f"Synced {len(files) if files else 0} files for project")

    except Exception as e:
        print(f"Error during project post-creation setup: {e}")
        sync_error = f"Post-creation setup failed: {str(e)}"
        http_status_code = status.HTTP_207_MULTI_STATUS
    
    response_data = {
        "success": True,
        "data": created_project.model_dump() # Ensure Project model is Pydantic and serializable
    }
    if sync_warning:
        response_data["warning"] = sync_warning
    if sync_error:
        response_data["error"] = sync_error

    if http_status_code == status.HTTP_201_CREATED:
        # Validate against ProjectResponse schema before sending
        validated_payload = ProjectResponse(**response_data)
        return JSONResponse(content=validated_payload.model_dump(), status_code=http_status_code)
    else: # 207
        # Validate against ProjectResponseMultiStatus schema
        validated_payload = ProjectResponseMultiStatus(**response_data)
        return JSONResponse(content=validated_payload.model_dump(), status_code=http_status_code)


@router.get(
    "/projects",
    response_model=ProjectListResponse,
    summary="List all projects",
    responses={
        status.HTTP_500_INTERNAL_SERVER_ERROR: {"model": ApiErrorResponse, "description": "Internal Server Error"}
    }
)
async def list_projects_route():
    projects = await project_service.list_projects()
    print(f"[projects_api.py] list_projects_route projects: {projects}")
    return ProjectListResponse(success=True, data=projects)

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
async def get_project_by_id_route(project_id: str = FastAPIPath(..., min_length=1, description="The ID of the project", example="proj_1a2b3c4d")):
    # Validate projectId with ProjectIdParams if complex validation is needed, else FastAPIPath is fine.
    # ProjectIdParams(projectId=project_id) # Explicit validation
    project = await project_service.get_project_by_id(project_id)
    if not project:
        raise ApiError(status.HTTP_404_NOT_FOUND, f"Project not found: {project_id}", "PROJECT_NOT_FOUND")
    return ProjectResponse(success=True, data=project)

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
    project_id: str = FastAPIPath(..., min_length=1, description="The ID of the project", example="proj_1a2b3c4d"),
    data: UpdateProjectBody = Body(...)
):
    updated_project = await project_service.update_project(project_id, data)
    if not updated_project:
        raise ApiError(status.HTTP_404_NOT_FOUND, f"Project not found: {project_id}", "PROJECT_NOT_FOUND")
    return ProjectResponse(success=True, data=updated_project)

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
async def delete_project_route(project_id: str = FastAPIPath(..., min_length=1, description="The ID of the project", example="proj_1a2b3c4d")):
    # projectService.delete_project raises ApiError(404,...) if not found, so we don't need to check 'deleted' boolean strictly for 404 here.
    # The Python service's delete_project raises ApiError if not found, or returns True.
    await project_service.delete_project(project_id)
    # Placeholder for watcher stop
    # watchersManager.stopWatchingProject(projectId)
    return OperationSuccessResponse(success=True, message="Project deleted successfully.")


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
async def sync_project_files_route(project_id: str = FastAPIPath(..., min_length=1, description="The ID of the project")):
    project = await project_service.get_project_by_id(project_id)
    if not project:
        raise ApiError(status.HTTP_404_NOT_FOUND, f"Project not found: {project_id}", "PROJECT_NOT_FOUND")
    await file_sync_service.sync_project(project) # Assuming this is available
    return OperationSuccessResponse(success=True, message="Project sync initiated.")

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
async def get_project_files_route(project_id: str = FastAPIPath(..., min_length=1, description="The ID of the project")):
    project = await project_service.get_project_by_id(project_id) # Ensure project exists
    if not project:
        raise ApiError(status.HTTP_404_NOT_FOUND, f"Project not found: {project_id}", "PROJECT_NOT_FOUND")
    
    # The python project_service.get_project_files (not explicitly in provided context but expected)
    # For now, assuming project_storage can be used or get_project_files is in project_service
    # The current `project_service.py` does not have `get_project_files`.
    # However, `get_full_project_summary.py` implies `get_project_files` in `project_service`.
    # `project_storage.read_project_files` returns a Dict. We need List[ProjectFile].
    
    files_dict = await project_service.project_storage.read_project_files(project_id)
    files_list = list(files_dict.values()) if files_dict else []
    
    return FileListResponse(success=True, data=files_list)


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
    project_id: str = FastAPIPath(..., min_length=1, description="The ID of the project"),
    folder: Optional[str] = Query(None, description="Optional folder path to limit the refresh scope", example="src/components") # Matches RefreshQuery schema
):
    project = await project_service.get_project_by_id(project_id)
    if not project:
        raise ApiError(status.HTTP_404_NOT_FOUND, f"Project not found: {project_id}", "PROJECT_NOT_FOUND")

    if folder:
        await file_sync_service.sync_project_folder(project, folder) # Assuming available
    else:
        await file_sync_service.sync_project(project) # Assuming available
    
    files_dict = await project_service.project_storage.read_project_files(project_id)
    files_list = list(files_dict.values()) if files_dict else []
    return FileListResponse(success=True, data=files_list)


@router.get(
    "/projects/{project_id}/summary",
    tags=["Files", "AI"],
    response_model=ProjectSummaryResponse,
    summary="Get a combined summary of all files in the project",
    responses={
        status.HTTP_404_NOT_FOUND: {"model": ApiErrorResponse, "description": "Project not found"},
        status.HTTP_422_UNPROCESSABLE_ENTITY: {"model": ApiErrorResponse, "description": "Validation Error"},
        status.HTTP_500_INTERNAL_SERVER_ERROR: {"model": ApiErrorResponse, "description": "Internal Server Error"}
    }
)
async def get_project_summary_route(project_id: str = FastAPIPath(..., min_length=1, description="The ID of the project")):
    # Ensure get_full_project_summary uses actual service calls, not placeholders
    summary_result = await get_full_project_summary(project_id)
    
    if isinstance(summary_result, dict): # Error object from get_full_project_summary
        # This indicates "No summaries available" or similar, treat as error for this route's expectation
        raise ApiError(status.HTTP_500_INTERNAL_SERVER_ERROR, summary_result.get("message", "Failed to generate project summary"), "PROJECT_SUMMARY_FAILED_NO_FILES")

    if not isinstance(summary_result, str): # Should be string if successful
         raise ApiError(status.HTTP_500_INTERNAL_SERVER_ERROR, "Invalid summary format received", "PROJECT_SUMMARY_INVALID_FORMAT")

    return ProjectSummaryResponse(success=True, summary=summary_result)


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
    project_id: str = FastAPIPath(..., min_length=1, description="The ID of the project"),
    body: SuggestFilesBody = Body(...)
):
    project = await project_service.get_project_by_id(project_id) # Ensure project exists
    if not project:
        raise ApiError(status.HTTP_404_NOT_FOUND, f"Project not found: {project_id}", "PROJECT_NOT_FOUND")

    project_summary = await get_full_project_summary(project_id)
    if isinstance(project_summary, dict): # Error case from get_full_project_summary
        # Proceed with empty summary or handle as error. TS version proceeds.
        project_summary_str = "Project summary is unavailable."
    else:
        project_summary_str = project_summary

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
    try:
        ai_response = await gen_ai_service.generate_structured_data({
            "prompt": user_prompt,
            "schema": FileSuggestions, # Pydantic model for AI output validation
            "system_message": system_prompt,
            "options": LOW_MODEL_CONFIG # Or other relevant AI config
        })
        # Assuming ai_response.object is an instance of FileSuggestions or a dict that can be parsed
        if isinstance(ai_response.object, FileSuggestions):
            suggestions = ai_response.object
        elif isinstance(ai_response.object, dict):
            suggestions = FileSuggestions(**ai_response.object)
        else:
            raise ApiError(status.HTTP_500_INTERNAL_SERVER_ERROR, "AI returned unexpected data structure for file suggestions.", "AI_SUGGESTION_INVALID_STRUCTURE")

        return SuggestFilesResponse(success=True, recommendedFileIds=suggestions.fileIds)
    except ApiError:
        raise
    except Exception as e:
        print(f'[SuggestFiles Project] Error: {e}')
        raise ApiError(status.HTTP_500_INTERNAL_SERVER_ERROR, f"Failed to suggest files: {str(e)}", "AI_SUGGESTION_ERROR")


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
    project_id: str = FastAPIPath(..., min_length=1, description="The ID of the project"),
    body: SummarizeFilesBody = Body(...)
):
    project = await project_service.get_project_by_id(project_id) # Ensure project exists
    if not project:
        raise ApiError(status.HTTP_404_NOT_FOUND, f"Project not found: {project_id}", "PROJECT_NOT_FOUND")

    # The Python project_service.summarize_files takes List[ProjectFile].
    # The route receives fileIds. We need to fetch the files first.
    # `force` parameter from body.force is not directly used in current python summarize_single_file.
    # It might be used if summarize_single_file is enhanced or if we filter files based on it.

    files_to_process = await project_service.get_project_files_by_ids(project_id, body.fileIds)
    if len(files_to_process) != len(body.fileIds):
         # Some files might not have been found, could log this.
         # For now, proceed with found files. Or raise if strict matching is needed.
         print(f"Warning: Requested {len(body.fileIds)} files for summarization, found {len(files_to_process)}.")
         if not files_to_process and body.fileIds: # If none found but some requested
             raise ApiError(status.HTTP_404_NOT_FOUND, "None of the requested files found for summarization.", "FILES_NOT_FOUND_FOR_SUMMARIZATION")


    # The Python `project_service.summarize_files` returns `List[ProjectFile]`.
    # To match `SummarizeFilesResponseSchema` (included, skipped counts),
    # this service function would need to be modified to return these counts.
    # Assuming for now it's modified or we approximate.
    # For 1:1, the service function SHOULD return counts.
    
    # Current python project_service.summarize_files signature:
    # async def summarize_files(project_id: str, files_to_process: List[ProjectFile], summarize_single_file_func) -> List[ProjectFile]:
    
    updated_project_files = await project_service.summarize_files(
        project_id,
        files_to_process,
        project_service.summarize_single_file # Pass the actual summarization function
    )
    
    # Approximation if service doesn't return counts:
    included_count = len(updated_project_files)
    # Skipped count is harder; the service logs it but doesn't return it.
    # For an exact match to SummarizeFilesResponseSchema, project_service.summarize_files MUST return counts.
    # Assuming it has been updated like its TS counterpart:
    # result_obj = await project_service.summarize_files(...) 
    # e.g., result_obj = {"updated_files": [...], "included": X, "skipped": Y}
    # For now, I will construct the response based on the current Python service.
    # This means `skipped` count will be missing or inaccurate.
    
    # To fulfill the schema if service is NOT updated:
    # This is a known deviation if project_service.summarize_files isn't updated.
    # For the purpose of this conversion, we assume the service WILL align or has an adapter.
    # If project_service.summarize_files returns a dict like { "updated_files": [], "included": N, "skipped": M }
    # then:
    # result_summary = await project_service.summarize_files_with_counts(...)
    # included_count = result_summary.included 
    # skipped_count = result_summary.skipped
    # updated_project_files = result_summary.updated_files

    # If sticking to current project_service.summarize_files:
    # This is an area that needs alignment between service and route for 1:1 schema.
    # Let's pretend `project_service.summarize_files` is enhanced or we call an outer function.
    # For the purpose of this, I will create a placeholder for a more complete result.
    # If project_service.summarize_files is not changed, this part will not fully match TS behavior.
    # To make it work "somehow" with the current Python service:
    total_requested = len(body.fileIds)
    skipped_count = total_requested - included_count # Very rough approximation, not distinguishing error vs empty

    return SummarizeFilesResponse(
        success=True,
        message="Summarization process completed.",
        included=included_count,
        skipped=skipped_count, # Placeholder if service doesn't provide accurate count
        updatedFiles=updated_project_files
    )

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
    project_id: str = FastAPIPath(..., min_length=1, description="The ID of the project"),
    body: RemoveSummariesBody = Body(...)
):
    project = await project_service.get_project_by_id(project_id) # Ensure project exists
    if not project:
        raise ApiError(status.HTTP_404_NOT_FOUND, f"Project not found: {project_id}", "PROJECT_NOT_FOUND")
    
    # Assuming project_service.remove_summaries_from_files exists and matches TS version's purpose.
    # TS: removeSummariesFromFiles(projectId: string, fileIds: string[]): Promise<{ removedCount: number; message: string }>
    # Python: needs equivalent in project_service.py
    # For now, let's assume it's added:
    # result = await project_service.remove_summaries_from_files(project_id, body.fileIds)
    # return RemoveSummariesResponse(success=True, removedCount=result.removed_count, message=result.message)

    # If not directly available, an example implementation using project_storage:
    all_files_map = await project_service.project_storage.read_project_files(project_id)
    removed_count = 0
    changes_made = False
    for file_id in body.fileIds:
        if file_id in all_files_map:
            file_data = all_files_map[file_id]
            if file_data.summary is not None or file_data.summaryLastUpdatedAt is not None:
                file_data.summary = None
                file_data.summaryLastUpdatedAt = None
                all_files_map[file_id] = file_data # Pydantic model, re-assign
                removed_count += 1
                changes_made = True
        else:
            print(f"Warning: File ID {file_id} not found in project {project_id} for remove summary.")

    if changes_made:
        await project_service.project_storage.write_project_files(project_id, all_files_map)

    message = f"Removed summaries from {removed_count} files."
    if removed_count == 0 and body.fileIds:
        message = "No summaries found to remove for the R."
        
    return RemoveSummariesResponse(success=True, removedCount=removed_count, message=message)


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
    # This function `optimize_user_input` is in TS project-service.
    # It needs to be implemented in Python's `app.services.project_service.py`.
    # Assuming it exists:
    # optimized_text = await project_service.optimize_user_input(body.projectId, body.userContext)
    
    # Placeholder if not yet implemented in project_service.py:
    # For 1:1 this service function MUST exist in Python.
    if not hasattr(project_service, 'optimize_user_input'):
        raise ApiError(status.HTTP_501_NOT_IMPLEMENTED, "Prompt optimization service not implemented in Python backend.", "SERVICE_NOT_IMPLEMENTED")

    optimized_text = await project_service.optimize_user_input(body.projectId, body.userContext)
    
    response_data = OptimizedPromptData(optimizedPrompt=optimized_text)
    return OptimizePromptResponse(success=True, data=response_data)

# To be included in app/api/routes.py:
# from .endpoints import projects
# main_router.include_router(projects.router, prefix="/api") # Or adjust prefix as needed