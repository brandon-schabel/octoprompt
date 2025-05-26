
import asyncio
from pathlib import Path
import uuid 
import time
from typing import Type, TypeVar, Any, Dict, List
from pydantic import BaseModel, ValidationError, field_validator 
from datetime import datetime, timezone
import json # Added import for json.JSONDecodeError

from app.schemas.ticket_schemas import (
    TicketBase as TicketBaseSchema,
    TicketTaskBase as TicketTaskBaseSchema,
    TicketFileBase as TicketFileBaseSchema
)
from app.utils.json_scribe import json_scribe

TicketBase = TicketBaseSchema
TicketTaskBase = TicketTaskBaseSchema
TicketFileBase = TicketFileBaseSchema

TicketsStorageModel = Dict[int, TicketBase]
TicketTasksStorageModel = Dict[int, TicketTaskBase]
TicketFilesStorageModel = List[TicketFileBase] 

DATA_DIR = Path.cwd() / 'data' / 'ticket_storage'
TICKETS_FILE = 'tickets.json'
TICKET_DATA_SUBDIR = 'ticket_data'

T_Schema = TypeVar('T_Schema') # More generic now

async def _ensure_dir_exists(dir_path: Path) -> None:
    try: dir_path.mkdir(parents=True, exist_ok=True)
    except Exception as e: raise IOError(f"Failed to ensure directory exists: {dir_path}") from e

async def _read_validated_json(file_path: Path, model_type: Type[Any], default_value: Any) -> Any:
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
                except (ValidationError, ValueError): pass
            return validated_data
        elif isinstance(default_value, list): # Expecting List[PydanticModel]
            validated_list: List[Any] = []
            if not isinstance(raw_content, list): return default_value # Or raise error
            for item_data in raw_content:
                try: validated_list.append(model_type.model_validate(item_data))
                except ValidationError: pass
            return validated_list
        else: # Single object (not primary use case here)
            return model_type.model_validate(raw_content)
            
    except FileNotFoundError: return default_value
    except (ValidationError, json.JSONDecodeError): return default_value
    except Exception as e: raise IOError(f"Failed to read/parse {file_path}") from e

async def _write_validated_json(file_path: Path, data: Any) -> Any:
    try:
        await _ensure_dir_exists(file_path.parent)
        serializable_data: Any
        if isinstance(data, dict): 
            serializable_data = {str(k): v.model_dump(mode='json') for k, v in data.items()}
        elif isinstance(data, list): 
            serializable_data = [item.model_dump(mode='json') for item in data]
        elif isinstance(data, BaseModel): # Single model
             serializable_data = data.model_dump(mode='json')
        else: serializable_data = data 

        await json_scribe.write(path_list=[file_path.name], base_path=str(file_path.parent), data=serializable_data)
        return data
    except ValidationError as e: raise e
    except Exception as e: raise IOError(f"Failed to write {file_path}") from e

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
        except Exception as e: raise IOError(f"Failed to delete {dir_path}") from e
    def generate_id(self) -> int: # Removed prefix
        return int(time.time() * 1000)

ticket_storage = TicketStorage()