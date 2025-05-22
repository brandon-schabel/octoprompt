# app/utils/storage/ticket_storage.py
# 1. Migrated IDs and timestamps to Unix ms (int).
# 2. Updated generate_id method.
# 3. Added conceptual timestamp validator to schemas.
# 4. Adapted read/write helpers for int keys in dicts.
# 5. Imported time, Any, datetime, timezone.
import asyncio
from pathlib import Path
import uuid # Kept for now, but generate_id will use time
import time
from typing import Type, TypeVar, Any, Dict, List
from pydantic import BaseModel, ValidationError, field_validator # Added BaseModel for schema def
from datetime import datetime, timezone

from app.schemas.ticket_schemas import (
    TicketBase as TicketBaseSchema, # Renaming to avoid conflict if defining new ones here
    TicketTaskBase as TicketTaskBaseSchema,
    TicketFileBase as TicketFileBaseSchema
)
from app.utils.json_scribe import json_scribe
from app.utils.storage_timestap_utils import convert_timestamp_to_ms_int, convert_id_to_int

# --- Re-define or Assume Schema Updates ---
# The schemas TicketBase, TicketTaskBase, TicketFileBase in app.schemas.ticket_schemas.py
# should be updated to use int for their ID and timestamp fields (e.g., id, createdAt, updatedAt, ticketId, uploadedAt).
# They should also use the convert_timestamp_to_ms_int and convert_id_to_int functions
# from app.utils.storage_timestap_utils for Pydantic field_validators on these fields.
# For example, in app.schemas.ticket_schemas.py:
# class TicketBase(OriginalTicketBaseModel):
#     id: int
#     created: int
#     updated: int
#     # ... other fields
#     _validate_timestamps = field_validator('created', 'updated', mode='before')(convert_timestamp_to_ms_int)
#     _validate_id = field_validator('id', mode='before')(convert_id_to_int)

# class TicketTaskBase(OriginalTicketTaskModel):
#     id: int
#     ticketId: int
#     created: int
#     updated: int
#     # ... other fields
#     _validate_timestamps = field_validator('created', 'updated', mode='before')(convert_timestamp_to_ms_int)
#     _validate_ids = field_validator('id', 'ticketId', mode='before')(convert_id_to_int)

# class TicketFileBase(OriginalTicketFileModel):
#     id: int # Assuming TicketFile also has its own ID
#     ticketId: int
#     fileId: int # Assuming fileId refers to an int ID from project_storage
#     uploadedAt: int
#     # ... other fields
#     _validate_timestamps = field_validator('uploadedAt', mode='before')(convert_timestamp_to_ms_int)
#     _validate_ids = field_validator('id', 'ticketId', 'fileId', mode='before')(convert_id_to_int)

# Using original schema names from import for type hints, assuming they will be updated
TicketBase = TicketBaseSchema
TicketTaskBase = TicketTaskBaseSchema
TicketFileBase = TicketFileBaseSchema

# StorageModel type aliases with int keys
TicketsStorageModel = Dict[int, TicketBase]
TicketTasksStorageModel = Dict[int, TicketTaskBase]
TicketFilesStorageModel = List[TicketFileBase] # List of models, IDs are within models

DATA_DIR = Path.cwd() / 'data' / 'ticket_storage'
TICKETS_FILE = 'tickets.json'
TICKET_DATA_SUBDIR = 'ticket_data'

T_Schema = TypeVar('T_Schema') # More generic now

async def _ensure_dir_exists(dir_path: Path) -> None:
    try: dir_path.mkdir(parents=True, exist_ok=True)
    except Exception as e: print(f"Error creating directory {dir_path}: {e}"); raise

async def _read_validated_json(file_path: Path, model_type: Type[Any], default_value: Any) -> Any:
    # model_type is the Pydantic model for items (e.g., TicketBase for dict values, TicketFileBase for list items)
    # default_value helps determine if we expect a dict or list
    try:
        await _ensure_dir_exists(file_path.parent)
        raw_content = await json_scribe.read(path_list=[file_path.name], base_path=str(file_path.parent))
        if raw_content is None: return default_value

        if isinstance(default_value, dict): # Expecting Dict[int, PydanticModel]
            validated_data: Dict[int, Any] = {}
            if not isinstance(raw_content, dict): return default_value # Or raise error
            for k_str, v_data in raw_content.items():
                try:
                    k_int = int(k_str)
                    validated_data[k_int] = model_type.model_validate(v_data)
                except (ValidationError, ValueError) as e: print(f"Validation/Key error for {k_str} in {file_path}: {e}")
            return validated_data
        elif isinstance(default_value, list): # Expecting List[PydanticModel]
            validated_list: List[Any] = []
            if not isinstance(raw_content, list): return default_value # Or raise error
            for item_data in raw_content:
                try: validated_list.append(model_type.model_validate(item_data))
                except ValidationError as e: print(f"Validation error for item in {file_path}: {e}")
            return validated_list
        else: # Single object (not primary use case here)
            return model_type.model_validate(raw_content)
            
    except FileNotFoundError: return default_value
    except (ValidationError, json.JSONDecodeError) as e:
        print(f"Validation/JSON error reading {file_path}: {e}. Returning default.")
        return default_value
    except Exception as e: print(f"Error reading/parsing {file_path}: {e}"); raise Exception(f"Failed to read/parse {file_path}")

async def _write_validated_json(file_path: Path, data: Any) -> Any:
    # Data should be Pydantic models or dicts/lists of Pydantic models
    try:
        await _ensure_dir_exists(file_path.parent)
        serializable_data: Any
        if isinstance(data, dict): # Handles TicketsStorageModel, TicketTasksStorageModel
            serializable_data = {str(k): v.model_dump(mode='json') for k, v in data.items()}
        elif isinstance(data, list): # Handles TicketFilesStorageModel
            serializable_data = [item.model_dump(mode='json') for item in data]
        elif isinstance(data, BaseModel): # Single model
             serializable_data = data.model_dump(mode='json')
        else: serializable_data = data # Should not happen if used correctly

        await json_scribe.write(path_list=[file_path.name], base_path=str(file_path.parent), data=serializable_data)
        return data
    except ValidationError as e: print(f"Pydantic validation failed before writing {file_path}: {e.errors()}"); raise
    except Exception as e: print(f"Error writing JSON to {file_path}: {e}"); raise Exception(f"Failed to write {file_path}")

def _get_tickets_index_path() -> Path: return DATA_DIR / TICKETS_FILE
def _get_ticket_data_dir(ticket_id: int) -> Path: return DATA_DIR / TICKET_DATA_SUBDIR / str(ticket_id)
def _get_ticket_tasks_path(ticket_id: int) -> Path: return _get_ticket_data_dir(ticket_id) / 'tasks.json'
def _get_ticket_files_path(ticket_id: int) -> Path: return _get_ticket_data_dir(ticket_id) / 'files.json'

class TicketStorage:
    async def read_tickets(self) -> TicketsStorageModel:
        return await _read_validated_json(_get_tickets_index_path(), TicketBase, {})
    async def write_tickets(self, tickets: TicketsStorageModel) -> TicketsStorageModel:
        return await _write_validated_json(_get_tickets_index_path(), tickets)
    async def read_ticket_tasks(self, ticket_id: int) -> TicketTasksStorageModel:
        return await _read_validated_json(_get_ticket_tasks_path(ticket_id), TicketTaskBase, {})
    async def write_ticket_tasks(self, ticket_id: int, tasks: TicketTasksStorageModel) -> TicketTasksStorageModel:
        return await _write_validated_json(_get_ticket_tasks_path(ticket_id), tasks)
    async def read_ticket_files(self, ticket_id: int) -> TicketFilesStorageModel:
        return await _read_validated_json(_get_ticket_files_path(ticket_id), TicketFileBase, [])
    async def write_ticket_files(self, ticket_id: int, files: TicketFilesStorageModel) -> TicketFilesStorageModel:
        return await _write_validated_json(_get_ticket_files_path(ticket_id), files)
    async def delete_ticket_data(self, ticket_id: int) -> None:
        dir_path = _get_ticket_data_dir(ticket_id)
        try:
            if dir_path.exists():
                import shutil
                await asyncio.to_thread(shutil.rmtree, dir_path)
            else: print(f"Ticket data dir not found, nothing to delete: {dir_path}")
        except Exception as e: print(f"Error deleting ticket data dir {dir_path}: {e}"); raise Exception(f"Failed to delete {dir_path}")
    def generate_id(self) -> int: # Removed prefix
        return int(time.time() * 1000)

ticket_storage = TicketStorage()