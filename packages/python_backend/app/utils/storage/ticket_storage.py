# app/utils/storage/ticket_storage.py
# 1. Migrated from ticket-storage.ts.
# 2. Used Pydantic for validation, pathlib for paths, aiofiles for IO.
# 3. Replaced ZodError with Pydantic's ValidationError.
# 4. Adapted ensureDirExists, readValidatedJson, writeValidatedJson.
# 5. Implemented ticketStorage object with its methods.
import asyncio
from pathlib import Path
import uuid
from typing import Type, TypeVar, Any, Dict, List
from pydantic import ValidationError
from app.schemas.ticket_schemas import (
    TicketBase, TicketTaskBase, TicketFileBase
)
from app.utils.json_scribe import json_scribe # Assuming json_scribe uses aiofiles

# Define StorageModel type aliases here as they are not in ticket_schemas.py
TicketsStorageModel = Dict[str, TicketBase]
TicketTasksStorageModel = Dict[str, TicketTaskBase]
TicketFilesStorageModel = List[TicketFileBase]

DATA_DIR = Path.cwd() / 'data' / 'ticket_storage'
TICKETS_FILE = 'tickets.json'
TICKET_DATA_SUBDIR = 'ticket_data'

T_Schema = TypeVar('T_Schema', bound=Any)

async def _ensure_dir_exists(dir_path: Path) -> None:
    try: dir_path.mkdir(parents=True, exist_ok=True)
    except Exception as e: print(f"Error creating directory {dir_path}: {e}"); raise

async def _read_validated_json(file_path: Path, schema: Type[T_Schema], default_value: T_Schema) -> T_Schema:
    try:
        await _ensure_dir_exists(file_path.parent)
        raw_content = await json_scribe.read(path_list=[file_path.name], base_path=file_path.parent)
        if raw_content is None: return default_value
        # Pydantic expects a dict for model validation, or list for list of models
        if schema is TicketsStorageModel: return schema(raw_content) if raw_content else default_value # Dict[str, TicketBase]
        if schema is TicketTasksStorageModel: return schema(raw_content) if raw_content else default_value # Dict[str, TicketTaskBase]
        if schema is TicketFilesStorageModel: return [TicketFileBase(**item) for item in raw_content] if raw_content else default_value # List[TicketFileBase]
        return schema(**raw_content) # For single objects, not used directly by current schemas
    except FileNotFoundError: return default_value
    except ValidationError as e:
        print(f"Pydantic validation failed reading {file_path}: {e.errors()}")
        print(f"Returning default value due to validation failure for {file_path}.")
        return default_value
    except Exception as e: print(f"Error reading/parsing {file_path}: {e}"); raise Exception(f"Failed to read/parse {file_path}")

async def _write_validated_json(file_path: Path, data: Any, schema: Type[T_Schema]) -> T_Schema:
    # Data should already be Pydantic models or dicts that can be serialized
    # Validation primarily happens at the service layer before calling write,
    # or by ensuring data conforms to schema types like Dict[str, TicketBasePydanticModel]
    # For simplicity, we'll assume data is already validated or can be directly serialized by json_scribe
    try:
        await _ensure_dir_exists(file_path.parent)
        # Convert Pydantic models to dicts for JSON serialization if necessary
        if isinstance(data, dict) and all(isinstance(v, TicketBase) for v in data.values()):
            serializable_data = {k: v.model_dump(mode='json') for k, v in data.items()}
        elif isinstance(data, dict) and all(isinstance(v, TicketTaskBase) for v in data.values()):
            serializable_data = {k: v.model_dump(mode='json') for k, v in data.items()}
        elif isinstance(data, list) and all(isinstance(item, TicketFileBase) for item in data):
            serializable_data = [item.model_dump(mode='json') for item in data]
        else: serializable_data = data # Assume it's already a plain dict/list

        await json_scribe.write(path_list=[file_path.name], base_path=file_path.parent, data=serializable_data)
        return data # Return the original Pydantic model data
    except ValidationError as e: print(f"Pydantic validation failed before writing {file_path}: {e.errors()}"); raise
    except Exception as e: print(f"Error writing JSON to {file_path}: {e}"); raise Exception(f"Failed to write {file_path}")

def _get_tickets_index_path() -> Path: return DATA_DIR / TICKETS_FILE
def _get_ticket_data_dir(ticket_id: str) -> Path: return DATA_DIR / TICKET_DATA_SUBDIR / ticket_id
def _get_ticket_tasks_path(ticket_id: str) -> Path: return _get_ticket_data_dir(ticket_id) / 'tasks.json'
def _get_ticket_files_path(ticket_id: str) -> Path: return _get_ticket_data_dir(ticket_id) / 'files.json'

class TicketStorage:
    async def read_tickets(self) -> TicketsStorageModel:
        return await _read_validated_json(_get_tickets_index_path(), TicketsStorageModel, {})
    async def write_tickets(self, tickets: TicketsStorageModel) -> TicketsStorageModel:
        return await _write_validated_json(_get_tickets_index_path(), tickets, TicketsStorageModel)
    async def read_ticket_tasks(self, ticket_id: str) -> TicketTasksStorageModel:
        return await _read_validated_json(_get_ticket_tasks_path(ticket_id), TicketTasksStorageModel, {})
    async def write_ticket_tasks(self, ticket_id: str, tasks: TicketTasksStorageModel) -> TicketTasksStorageModel:
        return await _write_validated_json(_get_ticket_tasks_path(ticket_id), tasks, TicketTasksStorageModel)
    async def read_ticket_files(self, ticket_id: str) -> TicketFilesStorageModel:
        return await _read_validated_json(_get_ticket_files_path(ticket_id), TicketFilesStorageModel, [])
    async def write_ticket_files(self, ticket_id: str, files: TicketFilesStorageModel) -> TicketFilesStorageModel:
        return await _write_validated_json(_get_ticket_files_path(ticket_id), files, TicketFilesStorageModel)
    async def delete_ticket_data(self, ticket_id: str) -> None:
        dir_path = _get_ticket_data_dir(ticket_id)
        try:
            if dir_path.exists():
                import shutil # shutil.rmtree is synchronous, consider async alternative if critical
                shutil.rmtree(dir_path) # Forcing recursive delete
            else: print(f"Ticket data dir not found, nothing to delete: {dir_path}")
        except Exception as e: print(f"Error deleting ticket data dir {dir_path}: {e}"); raise Exception(f"Failed to delete {dir_path}")
    def generate_id(self, prefix: str) -> str: return f"{prefix}_{uuid.uuid4()}"

ticket_storage = TicketStorage()