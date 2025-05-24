from fastapi import APIRouter, Depends, HTTPException, Path, Body, status
from fastapi.responses import JSONResponse

from app.schemas.ai_file_change_schemas import (
    GenerateAIFileChangeBody,
    GenerateAIFileChangeResponse,
    GetAIFileChangeDetailsResponse,
    ConfirmAIFileChangeResponse,
    AIFileChangeRecordResponse, 
    ApiErrorResponse, ErrorDetail, 
    FileChangeIdParams 
)
from app.schemas.project_schemas import ProjectIdParams

from app.services.file_services import ai_file_change_service
from app.services.file_services.ai_file_change_service import GenerateFileChangeOptions

router = APIRouter(
    prefix="/api",
    tags=["Projects", "AI File Changes"]
)

def _create_api_error_response(
    status_code: int, message: str, error_code: str, details: dict = None
) -> JSONResponse:
    error_content = ApiErrorResponse(
        success=False,
        error=ErrorDetail(message=message, code=error_code, details=details or {})
    )
    return JSONResponse(status_code=status_code, content=error_content.model_dump(exclude_none=True))

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