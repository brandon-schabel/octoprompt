# packages/python_backend/app/api/endpoints/prompt_api.py

from fastapi import APIRouter, HTTPException, status, Path, Body
from fastapi.responses import JSONResponse
from typing import List, Optional

# Schemas from prompt_schemas.py and common_schemas.py
from app.schemas.prompt_schemas import (
    CreatePromptBody,
    UpdatePromptBody,
    PromptResponse,
    PromptListResponse
)
from app.schemas.common_schemas import ApiErrorResponse, OperationSuccessResponse, ErrorDetail

# Services from prompt_service.py
import app.services.prompt_service as prompt_service

router = APIRouter(
    prefix="/api",  # All routes in this router will be prefixed with /api
    tags=["Prompts"] # Default tag for routes if not overridden
)

# --- Helper for Standardized Error Responses ---
# Note: For a production application, it's highly recommended to implement
# global exception handlers for HTTPException and RequestValidationError (for 422 errors)
# at the main FastAPI application level to ensure all errors conform to ApiErrorResponseSchema.
# This helper is used here for explicit error returns from the endpoint logic.

def _create_api_error_response(status_code: int, message: str, code: Optional[str] = None, details: Optional[dict] = None) -> JSONResponse:
    """Creates a JSONResponse with the standard API error structure."""
    error_obj = ErrorDetail(message=message, code=code, details=details)
    api_error = ApiErrorResponse(success=False, error=error_obj)
    return JSONResponse(
        status_code=status_code,
        content=api_error.model_dump(exclude_none=True)
    )

# --- Prompt Routes ---

@router.post(
    "/prompts",
    response_model=PromptResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Create a new prompt",
    responses={
        status.HTTP_201_CREATED: {"description": "Prompt created successfully", "model": PromptResponse},
        status.HTTP_422_UNPROCESSABLE_ENTITY: {"model": ApiErrorResponse, "description": "Validation Error"},
        status.HTTP_404_NOT_FOUND: {"model": ApiErrorResponse, "description": "Referenced project not found"},
        status.HTTP_500_INTERNAL_SERVER_ERROR: {"model": ApiErrorResponse, "description": "Internal Server Error"},
    }
)
async def create_prompt_endpoint(body: CreatePromptBody = Body(...)):
    """
    Creates a new prompt. Optionally links to a project if `projectId` is provided in the body.
    """
    try:
        created_prompt = await prompt_service.create_prompt(body)
        return PromptResponse(success=True, data=created_prompt)
    except HTTPException as e:
        error_payload = e.detail if isinstance(e.detail, dict) else {"message": str(e.detail)}
        return _create_api_error_response(
            status_code=e.status_code,
            message=error_payload.get("message", "An error occurred while creating the prompt."),
            code=error_payload.get("code")
        )
    except Exception:
        # In a real app, log this exception: logging.exception("Unhandled error in create_prompt_endpoint")
        return _create_api_error_response(status.HTTP_500_INTERNAL_SERVER_ERROR, "An unexpected internal server error occurred.", "INTERNAL_SERVER_ERROR")

@router.get(
    "/prompts",
    response_model=PromptListResponse,
    summary="List all available prompts",
    responses={
        status.HTTP_200_OK: {"description": "Successfully retrieved all prompts", "model": PromptListResponse},
        status.HTTP_500_INTERNAL_SERVER_ERROR: {"model": ApiErrorResponse, "description": "Internal Server Error"},
    }
)
async def list_all_prompts_endpoint():
    """
    Retrieves a list of all prompts available in the system.
    """
    try:
        prompts = await prompt_service.list_all_prompts()
        return PromptListResponse(success=True, data=prompts)
    except HTTPException as e:
        error_payload = e.detail if isinstance(e.detail, dict) else {"message": str(e.detail)}
        return _create_api_error_response(
            status_code=e.status_code,
            message=error_payload.get("message", "An error occurred while listing prompts."),
            code=error_payload.get("code")
        )
    except Exception:
        return _create_api_error_response(status.HTTP_500_INTERNAL_SERVER_ERROR, "An unexpected internal server error occurred.", "INTERNAL_SERVER_ERROR")

@router.get(
    "/projects/{projectId}/prompts",
    response_model=PromptListResponse,
    tags=["Projects", "Prompts"], # Overrides default tag
    summary="List prompts associated with a specific project",
    responses={
        status.HTTP_200_OK: {"description": "Successfully retrieved project prompts", "model": PromptListResponse},
        status.HTTP_404_NOT_FOUND: {"model": ApiErrorResponse, "description": "Project not found"},
        status.HTTP_422_UNPROCESSABLE_ENTITY: {"model": ApiErrorResponse, "description": "Validation Error (e.g., invalid projectId format)"},
        status.HTTP_500_INTERNAL_SERVER_ERROR: {"model": ApiErrorResponse, "description": "Internal Server Error"},
    }
)
async def list_project_prompts_endpoint(projectId: str = Path(..., description="The ID of the project", min_length=1)):
    """
    Lists all prompts that are associated with the given `projectId`.
    """
    try:
        # TODO: Verify if project_service.get_project_by_id(projectId) should be called first to ensure project existence
        # The current prompt_service.list_prompts_by_project might return empty list for non-existent project_id
        # or the underlying storage for projects should be checked.
        # For now, assuming list_prompts_by_project handles or implies project existence checks if needed.
        # If project not found should be a distinct 404, that check needs to be explicit here or in service.
        project_prompts = await prompt_service.list_prompts_by_project(project_id=projectId)
        return PromptListResponse(success=True, data=project_prompts)
    except HTTPException as e:
        error_payload = e.detail if isinstance(e.detail, dict) else {"message": str(e.detail)}
        return _create_api_error_response(
            status_code=e.status_code,
            message=error_payload.get("message", "An error occurred while listing project prompts."),
            code=error_payload.get("code")
        )
    except Exception:
        return _create_api_error_response(status.HTTP_500_INTERNAL_SERVER_ERROR, "An unexpected internal server error occurred.", "INTERNAL_SERVER_ERROR")

@router.post(
    "/projects/{projectId}/prompts/{promptId}",
    response_model=OperationSuccessResponse,
    tags=["Projects", "Prompts"],
    summary="Associate a prompt with a project",
    responses={
        status.HTTP_200_OK: {"description": "Prompt successfully associated with project", "model": OperationSuccessResponse},
        status.HTTP_404_NOT_FOUND: {"model": ApiErrorResponse, "description": "Project or Prompt not found"},
        status.HTTP_422_UNPROCESSABLE_ENTITY: {"model": ApiErrorResponse, "description": "Validation Error (e.g., invalid ID formats)"},
        status.HTTP_500_INTERNAL_SERVER_ERROR: {"model": ApiErrorResponse, "description": "Internal Server Error"},
    }
)
async def add_prompt_to_project_endpoint(
    projectId: str = Path(..., description="The ID of the project", min_length=1),
    promptId: str = Path(..., description="The ID of the prompt", min_length=1)
):
    """
    Associates an existing prompt with an existing project.
    """
    try:
        # TODO: Similar to list_project_prompts, consider explicit checks for project existence
        # if prompt_service.add_prompt_to_project doesn't already raise a 404 for the project.
        await prompt_service.add_prompt_to_project(prompt_id=promptId, project_id=projectId)
        return OperationSuccessResponse(success=True, message="Prompt linked to project.")
    except HTTPException as e:
        error_payload = e.detail if isinstance(e.detail, dict) else {"message": str(e.detail)}
        return _create_api_error_response(
            status_code=e.status_code,
            message=error_payload.get("message", "An error occurred while associating prompt with project."),
            code=error_payload.get("code")
        )
    except Exception:
        return _create_api_error_response(status.HTTP_500_INTERNAL_SERVER_ERROR, "An unexpected internal server error occurred.", "INTERNAL_SERVER_ERROR")

@router.delete(
    "/projects/{projectId}/prompts/{promptId}",
    response_model=OperationSuccessResponse,
    tags=["Projects", "Prompts"],
    summary="Disassociate a prompt from a project",
    status_code=status.HTTP_200_OK,
    responses={
        status.HTTP_200_OK: {"description": "Prompt successfully disassociated from project", "model": OperationSuccessResponse},
        status.HTTP_404_NOT_FOUND: {"model": ApiErrorResponse, "description": "Project or Prompt not found, or association does not exist"},
        status.HTTP_422_UNPROCESSABLE_ENTITY: {"model": ApiErrorResponse, "description": "Validation Error (e.g., invalid ID formats)"},
        status.HTTP_500_INTERNAL_SERVER_ERROR: {"model": ApiErrorResponse, "description": "Internal Server Error"},
    }
)
async def remove_prompt_from_project_endpoint(
    projectId: str = Path(..., description="The ID of the project", min_length=1),
    promptId: str = Path(..., description="The ID of the prompt", min_length=1)
):
    """
    Disassociates a prompt from a project.
    """
    try:
        await prompt_service.remove_prompt_from_project(prompt_id=promptId, project_id=projectId)
        return OperationSuccessResponse(success=True, message="Prompt unlinked from project.")
    except HTTPException as e:
        error_payload = e.detail if isinstance(e.detail, dict) else {"message": str(e.detail)}
        # Customize message if service raises specific 404 for "association not found" vs "prompt/project not found"
        message = error_payload.get("message", "An error occurred while disassociating prompt from project.")
        if e.status_code == 404 and error_payload.get("code") == "PROMPT_PROJECT_LINK_NOT_FOUND":
            message = f"Association between prompt {promptId} and project {projectId} not found."
        elif e.status_code == 404:
             message = f"Project or Prompt not found, or association does not exist."

        return _create_api_error_response(
            status_code=e.status_code,
            message=message,
            code=error_payload.get("code")
        )
    except Exception:
        return _create_api_error_response(status.HTTP_500_INTERNAL_SERVER_ERROR, "An unexpected internal server error occurred.", "INTERNAL_SERVER_ERROR")

@router.get(
    "/prompts/{promptId}",
    response_model=PromptResponse,
    tags=["Prompts"],
    summary="Get a specific prompt by its ID",
    responses={
        status.HTTP_200_OK: {"description": "Successfully retrieved prompt", "model": PromptResponse},
        status.HTTP_404_NOT_FOUND: {"model": ApiErrorResponse, "description": "Prompt not found"},
        status.HTTP_422_UNPROCESSABLE_ENTITY: {"model": ApiErrorResponse, "description": "Validation Error (e.g., invalid promptId format)"},
        status.HTTP_500_INTERNAL_SERVER_ERROR: {"model": ApiErrorResponse, "description": "Internal Server Error"},
    }
)
async def get_prompt_by_id_endpoint(promptId: str = Path(..., description="The ID of the prompt", min_length=1)):
    """
    Retrieves a specific prompt by its ID.
    """
    try:
        prompt = await prompt_service.get_prompt_by_id(prompt_id=promptId)
        return PromptResponse(success=True, data=prompt)
    except HTTPException as e:
        error_payload = e.detail if isinstance(e.detail, dict) else {"message": str(e.detail)}
        message = error_payload.get("message", "An error occurred while retrieving the prompt.")
        if e.status_code == 404:
            message = f"Prompt with ID {promptId} not found."
        return _create_api_error_response(
            status_code=e.status_code,
            message=message,
            code=error_payload.get("code")
        )
    except Exception:
        return _create_api_error_response(status.HTTP_500_INTERNAL_SERVER_ERROR, "An unexpected internal server error occurred.", "INTERNAL_SERVER_ERROR")

@router.patch(
    "/prompts/{promptId}",
    response_model=PromptResponse,
    tags=["Prompts"],
    summary="Update a prompt's details",
    responses={
        status.HTTP_200_OK: {"description": "Prompt updated successfully", "model": PromptResponse},
        status.HTTP_404_NOT_FOUND: {"model": ApiErrorResponse, "description": "Prompt not found"},
        status.HTTP_422_UNPROCESSABLE_ENTITY: {"model": ApiErrorResponse, "description": "Validation Error (e.g., invalid promptId or empty body)"},
        status.HTTP_500_INTERNAL_SERVER_ERROR: {"model": ApiErrorResponse, "description": "Internal Server Error"},
    }
)
async def update_prompt_endpoint(
    promptId: str = Path(..., description="The ID of the prompt", min_length=1),
    body: UpdatePromptBody = Body(...)
):
    """
    Updates a prompt's name and/or content. At least one field must be provided.
    """
    try:
        updated_prompt = await prompt_service.update_prompt(prompt_id=promptId, data=body)
        return PromptResponse(success=True, data=updated_prompt)
    except HTTPException as e:
        error_payload = e.detail if isinstance(e.detail, dict) else {"message": str(e.detail)}
        message = error_payload.get("message", "An error occurred while updating the prompt.")
        if e.status_code == 404:
            message = f"Prompt with ID {promptId} not found for update."
        elif e.status_code == 422 : # Pydantic validation error from UpdatePromptBody
             message = "Validation Error: " + error_payload.get("message", "Invalid data provided for update.")

        return _create_api_error_response(
            status_code=e.status_code,
            message=message,
            code=error_payload.get("code"),
            details=error_payload.get("details") if e.status_code == 422 else None # Pass details for validation errors
        )
    except ValueError as ve: # Catch Pydantic validation error from UpdatePromptBody if not wrapped in HTTPException
        return _create_api_error_response(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            message=f"Validation Error: {str(ve)}",
            code="VALIDATION_ERROR"
        )
    except Exception:
        return _create_api_error_response(status.HTTP_500_INTERNAL_SERVER_ERROR, "An unexpected internal server error occurred.", "INTERNAL_SERVER_ERROR")

@router.delete(
    "/prompts/{promptId}",
    response_model=OperationSuccessResponse,
    tags=["Prompts"],
    summary="Delete a prompt",
    responses={
        status.HTTP_200_OK: {"description": "Prompt deleted successfully", "model": OperationSuccessResponse},
        status.HTTP_404_NOT_FOUND: {"model": ApiErrorResponse, "description": "Prompt not found"},
        status.HTTP_422_UNPROCESSABLE_ENTITY: {"model": ApiErrorResponse, "description": "Validation Error (e.g., invalid promptId format)"},
        status.HTTP_500_INTERNAL_SERVER_ERROR: {"model": ApiErrorResponse, "description": "Internal Server Error"},
    }
)
async def delete_prompt_endpoint(promptId: str = Path(..., description="The ID of the prompt", min_length=1)):
    """
    Deletes a prompt by its ID.
    """
    try:
        success = await prompt_service.delete_prompt(prompt_id=promptId)
        if not success:
            return _create_api_error_response(
                status_code=status.HTTP_404_NOT_FOUND,
                message=f"Prompt with ID {promptId} not found.",
                code="PROMPT_NOT_FOUND"
            )
        return OperationSuccessResponse(success=True, message="Prompt deleted successfully.")
    except HTTPException as e: # Should not happen if service returns bool, but as a safeguard
        error_payload = e.detail if isinstance(e.detail, dict) else {"message": str(e.detail)}
        return _create_api_error_response(
            status_code=e.status_code,
            message=error_payload.get("message", "An error occurred while deleting the prompt."),
            code=error_payload.get("code")
        )
    except Exception:
        return _create_api_error_response(status.HTTP_500_INTERNAL_SERVER_ERROR, "An unexpected internal server error occurred.", "INTERNAL_SERVER_ERROR")