# app/services/kv_service.py
# 1. Migrated from kv-service.ts.
# 2. Used Pydantic for validation, pathlib for paths, aiofiles for IO.
# 3. Replaced ZodError with ValidationError, ApiError for custom errors.
# 4. Implemented memoryStore, syncStoreToFile, initKvStore, CRUD ops.
# 5. Refined type handling for get/set/update_kv_value with BaseModel, str, dict.
import asyncio
from pathlib import Path
from typing import TypeVar, Generic, Any, Type, cast, Dict
from pydantic import BaseModel, ValidationError
from app.error_handling.api_error import ApiError
from app.schemas.kv_store_schemas import KVKey, KV_SCHEMAS, KVValue, KVKeyEnum, AppSettings, ProjectTabsStateRecord
from app.utils.merge_deep import merge_deep
from app.utils.json_utils import json_scribe
import datetime
import aiofiles # For backup_kv_store

KV_STORE_FILE_PATH = ['data', 'kv-store.json']
KV_STORE_BASE_PATH = Path.cwd()
_memory_store: dict[str, Any] = {}

async def _sync_store_to_file() -> None:
    try:
        await json_scribe.write(path_list=KV_STORE_FILE_PATH, base_path=KV_STORE_BASE_PATH, data=_memory_store)
        print(f"[KV] Synced state to {KV_STORE_BASE_PATH.joinpath(*[str(p) for p in KV_STORE_FILE_PATH])}")
    except Exception as e: print(f"[KV] Error syncing to file: {e}"); raise ApiError(500, "Failed to save KV store", "KV_SYNC_FAILED")

async def init_kv_store() -> None:
    global _memory_store
    try:
        loaded_data = await json_scribe.read(path_list=KV_STORE_FILE_PATH, base_path=KV_STORE_BASE_PATH)
        if isinstance(loaded_data, dict): _memory_store = loaded_data; print(f"[KV] Loaded {len(_memory_store)} keys.")
        else: _memory_store = {}; print(f"[KV] Invalid data or no file found. Initialized empty store.")
    except Exception as e:
        _memory_store = {}; print(f"[KV] Error initializing: {e}"); raise ApiError(500, f"Failed to init KV store: {e}", "KV_INIT_FAILED")

def get_schema_for_key(key: KVKey) -> Type[BaseModel] | Type[str] | Type[dict]:
    schema_type = KV_SCHEMAS.get(key)
    if schema_type is None:
        raise ApiError(500, f"Schema not found for key {key.value}", "KV_SCHEMA_MISSING")
    # KV_SCHEMAS stores actual types (BaseModel subclasses, str, or dict (for ProjectTabsStateRecord))
    return schema_type

async def get_kv_value(key: KVKey) -> KVValue:
    value = _memory_store.get(key.value)
    if value is None: raise ApiError(404, f"Key '{key.value}' not found", "KV_KEY_NOT_FOUND")
    
    schema_type = get_schema_for_key(key)
    try:
        if isinstance(schema_type, type) and issubclass(schema_type, BaseModel):
            return schema_type.model_validate(value)
        elif schema_type is str:
            if not isinstance(value, str):
                raise ValidationError.from_exception_data(title=str(key.value), line_errors=[{'type': 'string_type', 'loc': ('__root__',), 'msg': 'Value is not a valid string', 'input': value}])
            return value
        elif schema_type is dict: # For ProjectTabsStateRecord = Dict[str, Any]
            if not isinstance(value, dict):
                 raise ValidationError.from_exception_data(title=str(key.value), line_errors=[{'type': 'dict_type', 'loc': ('__root__',), 'msg': 'Value is not a valid dict', 'input': value}])
            return value 
        else:
            raise ApiError(500, f"Unsupported schema type for key '{key.value}' during get", "KV_UNSUPPORTED_SCHEMA_GET")
    except ValidationError as e:
        print(f"[KV] Validation failed for key '{key.value}' on get: {e.errors()}");
        raise ApiError(500, f"Corrupt data for key '{key.value}'", "KV_VALUE_CORRUPT", {"issues": e.errors()})
    except Exception as e: 
        print(f"[KV] Error parsing '{key.value}': {e}"); 
        raise ApiError(500, f"Error parsing '{key.value}'", "KV_PARSE_ERROR", {"original_error": str(e)})

async def set_kv_value(key: KVKey, new_value: Any) -> None:
    schema_type = get_schema_for_key(key)
    validated_data_to_store: Any
    try:
        if isinstance(schema_type, type) and issubclass(schema_type, BaseModel):
            validated_model = schema_type.model_validate(new_value)
            validated_data_to_store = validated_model.model_dump(mode='json')
        elif schema_type is str:
            if not isinstance(new_value, str):
                raise ValidationError.from_exception_data(title=str(key.value), line_errors=[{'type': 'string_type', 'loc': ('__root__',), 'msg': 'Value is not a valid string', 'input': new_value}])
            validated_data_to_store = new_value
        elif schema_type is dict: # For ProjectTabsStateRecord = Dict[str, Any]
            if not isinstance(new_value, dict):
                raise ValidationError.from_exception_data(title=str(key.value), line_errors=[{'type': 'dict_type', 'loc': ('__root__',), 'msg': 'Value is not a valid dict', 'input': new_value}])
            validated_data_to_store = new_value
        else:
            raise ApiError(500, f"Unsupported schema type for key '{key.value}' for set operation", "KV_UNSUPPORTED_SCHEMA_SET")

        _memory_store[key.value] = validated_data_to_store
        print(f"[KV] Updated key '{key.value}' in memory.")
        await _sync_store_to_file()
    except ValidationError as e:
        print(f"[KV] Validation failed for key '{key.value}' on set: {e.errors()}")
        raise ApiError(400, "Invalid data provided", "VALIDATION_ERROR", {"issues": e.errors()})
    except Exception as e: 
        print(f"[KV] Internal error setting key '{key.value}': {e}"); 
        raise ApiError(500, "Internal validation error", "INTERNAL_VALIDATION_ERROR", {"original_error": str(e)})

async def update_kv_store(key: KVKey, partial_update_data: Dict[str, Any]) -> KVValue:
    current_value_obj = await get_kv_value(key) # Returns Pydantic model, str, or dict
    updated_value_to_set: Any

    if isinstance(current_value_obj, BaseModel):
        current_value_dict = current_value_obj.model_dump(mode='json')
        updated_value_dict = merge_deep(current_value_dict, partial_update_data)
        updated_value_to_set = updated_value_dict
    elif isinstance(current_value_obj, dict):
        updated_value_dict = merge_deep(current_value_obj, partial_update_data)
        updated_value_to_set = updated_value_dict
    else:
        # This case should be prevented by the controller's check that the key is for an object-like schema
        print(f"[KV Service - Update] Key '{key.value}' (type: {type(current_value_obj)}) is not a BaseModel or dict, cannot merge.")
        raise ApiError(400, f"Partial updates are only supported for object-like KV stores. Key '{key.value}' is type {type(current_value_obj)}.", "KV_PARTIAL_OBJECT_ONLY")

    await set_kv_value(key, updated_value_to_set)
    return await get_kv_value(key)

async def delete_kv_key(key: KVKey) -> None:
    if key.value in _memory_store:
        del _memory_store[key.value]; print(f"[KV] Deleted key '{key.value}'")
        await _sync_store_to_file()
    else: print(f"[KV] Delete failed: Key '{key.value}' not found."); raise ApiError(404, f"Key '{key.value}' not found", "KV_KEY_NOT_FOUND")

async def backup_kv_store() -> None:
    source_path = KV_STORE_BASE_PATH.joinpath(*[str(p) for p in KV_STORE_FILE_PATH])
    if not source_path.exists(): print(f"[KV] Backup skipped: Source file not found at {source_path}"); return
    
    timestamp = datetime.datetime.utcnow().isoformat().replace(":", "-").replace(".", "-")
    backup_dir = KV_STORE_BASE_PATH / 'data' / 'backups'
    backup_dir.mkdir(parents=True, exist_ok=True)
    backup_path = backup_dir / f"kv-store-backup-{timestamp}.json"
    try:
        async with aiofiles.open(source_path, 'rb') as src_f:
            content = await src_f.read()
        async with aiofiles.open(backup_path, 'wb') as dest_f:
            await dest_f.write(content)
        print(f"[KV] Backup created successfully at {backup_path}")
    except Exception as e: print(f"[KV] Error creating backup: {e}"); raise ApiError(500, f"Failed to create backup: {e}", "KV_BACKUP_FAILED")