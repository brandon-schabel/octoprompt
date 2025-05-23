# packages/python_backend/app/api/endpoints/provider_key_api.py
from typing import List

from fastapi import APIRouter, HTTPException, Path, status, Body
from app.schemas.provider_key_schemas import (
    CreateProviderKeyBody,
    ProviderKeyResponse,
    ProviderKeyListResponse,
    UpdateProviderKeyBody
)
from app.schemas.common_schemas import OperationSuccessResponse, ApiErrorResponse, ErrorDetail
from app.services.provider_key_service import provider_key_service

router = APIRouter(
    prefix="/api/keys",
    tags=["Provider Keys"],
    # Common responses for all routes in this router can be defined here
    # For example, if all routes could return 422 or 500 with ApiErrorResponse model.
    # However, Hono defined them per route, so we'll stick to that for specificity.
)

@router.post(
    "/",
    response_model=ProviderKeyResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Add a new API key for an AI provider",
    description="Creates a new provider key. The response includes the created key, including its secret.",
    responses={
        status.HTTP_422_UNPROCESSABLE_ENTITY: {"model": ApiErrorResponse, "description": "Validation Error"},
        status.HTTP_500_INTERNAL_SERVER_ERROR: {"model": ApiErrorResponse, "description": "Internal Server Error"},
    }
)
async def create_provider_key(
    body: CreateProviderKeyBody = Body(...)
):
    """
    Add a new API key for an AI provider.
    - **provider**: The name of the AI provider (e.g., openai, anthropic).
    - **key**: The API key string.
    """
    new_key = await provider_key_service.create_key(data=body)
    return ProviderKeyResponse(data=new_key)

@router.get(
    "/",
    response_model=ProviderKeyListResponse,
    summary="List all configured provider keys (excluding secrets)",
    description="Retrieves a list of all configured provider keys. The secret API keys themselves are excluded from this list for security.",
    responses={
        status.HTTP_500_INTERNAL_SERVER_ERROR: {"model": ApiErrorResponse, "description": "Internal Server Error"},
    }
)
async def list_provider_keys():
    """
    List all configured provider keys. Secrets are not included in the response.
    Keys are sorted by provider (ascending) and then by creation date (descending).
    """
    keys = await provider_key_service.list_keys()
    # The ProviderKeyListResponse model and its ProviderKeyListItem sub-model
    # will ensure the 'key' (secret) is excluded from the response.
    return ProviderKeyListResponse(data=keys)

@router.get(
    "/{keyId}",
    response_model=ProviderKeyResponse,
    summary="Get a specific provider key by ID (including secret)",
    description="Retrieves details for a specific provider key, including its secret API key.",
    responses={
        status.HTTP_404_NOT_FOUND: {"model": ApiErrorResponse, "description": "Provider key not found"},
        status.HTTP_422_UNPROCESSABLE_ENTITY: {"model": ApiErrorResponse, "description": "Validation Error (e.g., invalid keyId format)"},
        status.HTTP_500_INTERNAL_SERVER_ERROR: {"model": ApiErrorResponse, "description": "Internal Server Error"},
    }
)
async def get_provider_key_by_id(
    keyId: str = Path(..., description="The ID of the provider key to retrieve", example="1677657600000")
):
    """
    Get a specific provider key by its unique ID. Includes the secret key.
    """
    try:
        key_id_int = int(keyId)
    except ValueError:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=ErrorDetail(message="Invalid key ID format", code="INVALID_KEY_ID").model_dump(exclude_none=True)
        )
    
    key = await provider_key_service.get_key_by_id(key_id=key_id_int)
    if not key:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=ErrorDetail(message="Provider key not found", code="PROVIDER_KEY_NOT_FOUND").model_dump(exclude_none=True)
        )
    return ProviderKeyResponse(data=key)

@router.patch(
    "/{keyId}",
    response_model=ProviderKeyResponse,
    summary="Update a provider key's details",
    description="Updates the provider name and/or the secret key for an existing provider key. At least one field (provider or key) must be provided.",
    responses={
        status.HTTP_404_NOT_FOUND: {"model": ApiErrorResponse, "description": "Provider key not found"},
        status.HTTP_422_UNPROCESSABLE_ENTITY: {"model": ApiErrorResponse, "description": "Validation Error (e.g., invalid keyId or empty body)"},
        status.HTTP_500_INTERNAL_SERVER_ERROR: {"model": ApiErrorResponse, "description": "Internal Server Error"},
    }
)
async def update_provider_key(
    body: UpdateProviderKeyBody = Body(...),
    keyId: str = Path(..., description="The ID of the provider key to update", example="1677657600000")
):
    """
    Update a provider key's details.
    Allows updating the `provider` and/or `key`.
    - **provider** (optional): The new AI provider identifier.
    - **key** (optional): The new API key string.
    At least one of `provider` or `key` must be supplied.
    """
    try:
        key_id_int = int(keyId)
    except ValueError:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=ErrorDetail(message="Invalid key ID format", code="INVALID_KEY_ID").model_dump(exclude_none=True)
        )
    
    updated_key = await provider_key_service.update_key(key_id=key_id_int, data=body)
    return ProviderKeyResponse(data=updated_key)

@router.delete(
    "/{keyId}",
    response_model=OperationSuccessResponse,
    summary="Delete a provider key",
    description="Deletes a provider key by its ID.",
    responses={
        status.HTTP_404_NOT_FOUND: {"model": ApiErrorResponse, "description": "Provider key not found"},
        status.HTTP_422_UNPROCESSABLE_ENTITY: {"model": ApiErrorResponse, "description": "Validation Error (e.g., invalid keyId format)"},
        status.HTTP_500_INTERNAL_SERVER_ERROR: {"model": ApiErrorResponse, "description": "Internal Server Error"},
    }
)
async def delete_provider_key(
    keyId: str = Path(..., description="The ID of the provider key to delete", example="1677657600000")
):
    """
    Delete a provider key by its unique ID.
    """
    try:
        key_id_int = int(keyId)
    except ValueError:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=ErrorDetail(message="Invalid key ID format", code="INVALID_KEY_ID").model_dump(exclude_none=True)
        )
    
    success = await provider_key_service.delete_key(key_id=key_id_int)
    if not success:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=ErrorDetail(message="Provider key not found", code="PROVIDER_KEY_NOT_FOUND").model_dump(exclude_none=True)
        )
    return OperationSuccessResponse(message="Key deleted successfully.")