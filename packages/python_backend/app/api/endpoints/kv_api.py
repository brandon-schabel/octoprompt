#ロップス
# Description: FastAPI endpoints for managing Key-Value store.
# Path: packages/python_backend/app/api/endpoints/kv_api.py
# Last 5 changes:
# 1. Initial creation of KV API routes.
# 2. Implemented GET /api/kv with default value initialization.
# 3. Implemented DELETE /api/kv.
# 4. Implemented POST /api/kv/{key}.
# 5. Implemented PATCH /api/kv/{key} with object-type check.

from fastapi import APIRouter, Depends, Body, Path as FastApiPath, Query
from typing import Any, Dict

from app.services import kv_service
from app.schemas.kv_store_schema import (
    KVKeyEnum,
    KvKeyQuery,
    KvSetBody,
    KvGetResponse,
    KvSetResponse,
    KvDeleteResponse,
    KV_DEFAULT_VALUES_PYTHON
)
from app.error_handling.api_error import ApiError
from pydantic import BaseModel

router = APIRouter(prefix="/api", tags=["KV Store"])

def _get_default_for_key(key: KVKeyEnum) -> Any:
    default_value = KV_DEFAULT_VALUES_PYTHON.get(key)
    if default_value is None:
        # This check ensures that KV_DEFAULT_VALUES_PYTHON is comprehensive.
        # AppSettings() Pydantic model returns default instance, str is primitive.
        # For projectTabs, it is also a default structure.
        print(f"[KV API] Consistency Check: No default value explicitly mapped for key: {key.value} in KV_DEFAULT_VALUES_PYTHON. This might be an oversight.")
        # Fallback to trying to get default from schema directly if possible (e.g. Pydantic model defaults)
        schema = kv_service.get_schema_for_key(key)
        if isinstance(schema, type) and issubclass(schema, BaseModel):
            try: return schema() # Attempt to get default from Pydantic model
            except Exception as e:
                print(f"[KV API] Error getting default from schema for {key.value}: {e}")
        # If not a BaseModel or instantiation fails, then it's a critical issue if not in KV_DEFAULT_VALUES_PYTHON
        raise ApiError(500, f"Internal Error: No default value configuration found for key '{key.value}'.", "KV_MISSING_DEFAULT_CONFIG")
    return default_value

@router.get("/kv", response_model=KvGetResponse)
async def get_kv_value_route(query_params: KvKeyQuery = Depends()):
    key = query_params.key
    try:
        value = await kv_service.get_kv_value(key)
    except ApiError as e:
        if e.error_code == "KV_KEY_NOT_FOUND":
            print(f"[KV API] Key '{key.value}' not found. Initializing with default.")
            default_value = _get_default_for_key(key)
            try:
                await kv_service.set_kv_value(key, default_value)
                # Fetch the value again to ensure it's what was stored and validated
                value = await kv_service.get_kv_value(key) 
            except ApiError as setError:
                print(f"[KV API] Error setting default for '{key.value}': {setError.message}")
                raise ApiError(
                    500,
                    f"Failed to initialize state for key '{key.value}'. Reason: {setError.message}",
                    "KV_INIT_DEFAULT_FAILED",
                    details=setError.details
                ) from setError
        else:
            raise
    return KvGetResponse(success=True, key=key, value=value)

@router.delete("/kv", response_model=KvDeleteResponse)
async def delete_kv_key_route(query_params: KvKeyQuery = Depends()):
    key = query_params.key
    await kv_service.delete_kv_key(key)
    return KvDeleteResponse(success=True, message=f"Key '{key.value}' deleted successfully.")

@router.post("/kv/{key}", response_model=KvSetResponse)
async def set_kv_value_route(
    key: KVKeyEnum,
    request_body: KvSetBody = Body(...)
):
    value_to_set = request_body.value
    await kv_service.set_kv_value(key, value_to_set)
    retrieved_value = await kv_service.get_kv_value(key) # Get validated & stored value
    return KvSetResponse(success=True, key=key, value=retrieved_value)

@router.patch("/kv/{key}", response_model=KvSetResponse)
async def update_kv_value_route(
    key: KVKeyEnum,
    request_body: KvSetBody = Body(...)
):
    partial_value_to_update = request_body.value

    key_schema_type = kv_service.get_schema_for_key(key)
    is_object_schema = (isinstance(key_schema_type, type) and issubclass(key_schema_type, BaseModel)) or \
                       (key_schema_type is dict) # dict is for ProjectTabsStateRecord

    if not is_object_schema:
        raise ApiError(
            400,
            f"Partial updates are only supported for object-based KV stores. Key '{key.value}' schema is {key_schema_type}.",
            "KV_PARTIAL_OBJECT_ONLY"
        )

    if not isinstance(partial_value_to_update, Dict):
        raise ApiError(400, f"Partial update value for key '{key.value}' must be an object/dictionary.", "KV_INVALID_PARTIAL_VALUE_TYPE")

    updated_value = await kv_service.update_kv_store(key, partial_value_to_update)
    return KvSetResponse(success=True, key=key, value=updated_value)
