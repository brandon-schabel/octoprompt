import json
import os
import time
from pathlib import Path
from typing import Type, TypeVar, Dict, List, Union, Any
from datetime import datetime, timezone
from pydantic import BaseModel, ValidationError
from app.schemas.prompt_schemas import Prompt, PromptProject

# Define the base directory for storing prompt data
DATA_DIR = Path(os.getcwd()) / "data" / "prompt_storage"

# --- Custom Exceptions ---
class StorageError(IOError):
    """Custom exception for storage-related errors."""
    pass

# --- Schemas for Storage ---
# Store all prompts (metadata) as a map (Record) keyed by promptId (now int)
PromptsStorage = Dict[int, Prompt] # Key is now int (timestamp ID)

# Store all prompt-project associations
PromptProjectsStorage = List[PromptProject] # Assuming PromptProject might also have IDs/timestamps

T = TypeVar("T", bound=BaseModel)
StorageDictType = TypeVar("StorageDictType", bound=Dict[int, BaseModel]) # Key is int
StorageListType = TypeVar("StorageListType", bound=List[BaseModel])


# --- Path Helpers ---

def get_prompts_index_path() -> Path:
    """Gets the absolute path to the main prompts index file."""
    return DATA_DIR / "prompts.json"

def get_prompt_projects_path() -> Path:
    """Gets the absolute path to the prompt-projects associations file."""
    return DATA_DIR / "prompt-projects.json"

# --- Core Read/Write Functions ---

def ensure_dir_exists(dir_path: Path) -> None:
    """Ensures the specified directory exists."""
    try: dir_path.mkdir(parents=True, exist_ok=True)
    except FileNotFoundError: raise
    except PermissionError: raise
    except IsADirectoryError: raise # Or handle as success if appropriate for use case
    except OSError as e: raise StorageError(f"Failed to ensure directory exists: {dir_path}. OS error: {e}")
    except Exception as e: raise StorageError(f"An unexpected error occurred creating directory: {dir_path}. Error: {e}")

async def read_validated_json(
    file_path: Path,
    model: Type[T], # For dict values or list items
    default_value: Union[Dict, List]
) -> Union[Dict[int, T], List[T]]: # Adjusted return type for Dict keys
    """Reads and validates JSON data from a file."""
    try:
        ensure_dir_exists(file_path.parent)
        if not file_path.exists(): return default_value

        with open(file_path, "r", encoding="utf-8") as f: json_data = json.load(f)
        
        if isinstance(default_value, dict) and isinstance(json_data, dict):
            validated_data = {}
            # In PromptsStorage = Dict[int, Prompt], model is Prompt
            # Keys from JSON are strings, need to convert to int for our Dict[int, Prompt]
            for k_str, v_data in json_data.items():
                try:
                    k_int = int(k_str) # Convert string key from JSON to int
                    validated_data[k_int] = model.model_validate(v_data)
                except (ValidationError, ValueError): pass # Skip on error
            return validated_data
        elif isinstance(default_value, list) and isinstance(json_data, list):
            validated_list = []
            # In PromptProjectsStorage = List[PromptProject], model is PromptProject
            for item_data in json_data:
                try: validated_list.append(model.model_validate(item_data))
                except ValidationError: pass # Skip on error
            return validated_list
        else: 
            return default_value

    except FileNotFoundError: return default_value # Or re-raise if file must exist
    except PermissionError as e: raise StorageError(f"Permission denied reading {file_path}: {e}")
    except json.JSONDecodeError: return default_value # Or raise custom error for malformed JSON
    except IsADirectoryError as e: raise StorageError(f"Expected a file, but got a directory: {file_path}. Error: {e}")
    except OSError as e: raise StorageError(f"OS error reading {file_path}: {e}")
    except Exception as e: raise StorageError(f"Failed to read/parse JSON: {file_path}. Unexpected error: {e}")

async def write_validated_json(
    file_path: Path,
    data: Union[Dict[int, BaseModel], List[BaseModel], BaseModel],
) -> Union[Dict[int, BaseModel], List[BaseModel], BaseModel]:
    """Writes Pydantic model data (or dict/list of models) to a JSON file."""
    try:
        ensure_dir_exists(file_path.parent)
        json_to_write: Any
        if isinstance(data, BaseModel): json_to_write = data.model_dump(mode="json")
        elif isinstance(data, list): json_to_write = [item.model_dump(mode="json") if isinstance(item, BaseModel) else item for item in data]
        elif isinstance(data, dict): # Dict[int, BaseModel]
            # JSON keys must be strings
            json_to_write = {str(k): v.model_dump(mode="json") if isinstance(v, BaseModel) else v for k, v in data.items()}
        else: json_to_write = data

        json_string = json.dumps(json_to_write, indent=2)
        with open(file_path, "w", encoding="utf-8") as f: f.write(json_string)
        return data
    except FileNotFoundError as e: raise StorageError(f"File not found during write: {file_path}. Error: {e}") # Should not happen if ensure_dir_exists is robust
    except PermissionError as e: raise StorageError(f"Permission denied writing to {file_path}: {e}")
    except IsADirectoryError as e: raise StorageError(f"Cannot write to a directory: {file_path}. Error: {e}")
    except OSError as e: raise StorageError(f"OS error writing to {file_path}: {e}")
    except Exception as e: raise StorageError(f"Failed to write JSON: {file_path}. Unexpected error: {e}")


class PromptStorageUtil:
    async def read_prompts(self) -> PromptsStorage:
        # Pass Prompt model for values, default is empty dict
        return await read_validated_json(get_prompts_index_path(), Prompt, {})

    async def write_prompts(self, prompts: PromptsStorage) -> PromptsStorage:
        return await write_validated_json(get_prompts_index_path(), prompts)

    async def read_prompt_projects(self) -> PromptProjectsStorage:
        # Pass PromptProject model for list items, default is empty list
        return await read_validated_json(get_prompt_projects_path(), PromptProject, [])

    async def write_prompt_projects(self, prompt_projects: PromptProjectsStorage) -> PromptProjectsStorage:
        return await write_validated_json(get_prompt_projects_path(), prompt_projects)

    def generate_id(self) -> int:
        """Generates a unique ID as Unix timestamp in milliseconds."""
        return int(time.time() * 1000)

prompt_storage_util = PromptStorageUtil()