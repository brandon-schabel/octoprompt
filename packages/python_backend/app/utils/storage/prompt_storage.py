import json
import os
import uuid
from pathlib import Path
from typing import Type, TypeVar, Dict, List, Union

from pydantic import BaseModel, ValidationError

from app.schemas.prompt_schemas import Prompt, PromptProject

# Define the base directory for storing prompt data
DATA_DIR = Path(os.getcwd()) / "data" / "prompt_storage"

# --- Schemas for Storage ---
# Store all prompts (metadata) as a map (Record) keyed by promptId
PromptsStorage = Dict[str, Prompt]

# Store all prompt-project associations
PromptProjectsStorage = List[PromptProject]

T = TypeVar("T", bound=BaseModel)
StorageDictType = TypeVar("StorageDictType", bound=Dict[str, BaseModel])
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
    try:
        dir_path.mkdir(parents=True, exist_ok=True)
    except Exception as e:
        print(f"Error creating directory {dir_path}: {e}")
        raise IOError(f"Failed to ensure directory exists: {dir_path}")

async def read_validated_json(
    file_path: Path,
    model: Type[T],
    default_value: Union[Dict, List]
) -> T:
    """Reads and validates JSON data from a file."""
    try:
        ensure_dir_exists(file_path.parent)
        if not file_path.exists():
            return default_value

        with open(file_path, "r", encoding="utf-8") as f:
            json_data = json.load(f)
        
        # For top-level dictionaries (like PromptsStorage)
        if isinstance(default_value, dict) and isinstance(json_data, dict):
            # Assuming model is Dict[str, SomePydanticModel]
            # Pydantic doesn't directly validate Dict[str, Model] as a whole type easily.
            # We validate each item.
            # This simplified approach assumes the structure and validates items.
            # A more robust approach might involve a wrapper model if strict validation of the dict structure itself is needed.
            # For now, let's parse it as a generic dict and assume downstream code using Prompt model handles individual items.
            # If model is actually a Pydantic model that wraps a dict, this would be: return model.model_validate(json_data)
            # Given PromptsStorage = Dict[str, Prompt], this is a bit tricky.
            # Let's assume for Dict[str, Prompt] it will be a dictionary of Prompt objects.
            # The schema argument refers to the value type in the dict.
            validated_data = {}
            item_model = model.__args__[1] if hasattr(model, '__args__') and len(model.__args__) > 1 else model
            for k, v_data in json_data.items():
                try:
                    validated_data[k] = item_model.model_validate(v_data)
                except ValidationError as e:
                    print(f"Validation failed for item {k} in {file_path}: {e.errors()}")
                    # Decide handling: skip item, use default for item, or raise overall error
            return validated_data
        # For top-level lists (like PromptProjectsStorage)
        elif isinstance(default_value, list) and isinstance(json_data, list):
            # Assuming model is List[SomePydanticModel]
            item_model = model.__args__[0] if hasattr(model, '__args__') and model.__args__ else model
            validated_list = []
            for item_data in json_data:
                try:
                    validated_list.append(item_model.model_validate(item_data))
                except ValidationError as e:
                    print(f"Validation failed for an item in list {file_path}: {e.errors()}")
                    # Decide handling
            return validated_list
        else: # Direct model validation
            return model.model_validate(json_data)

    except FileNotFoundError:
        return default_value
    except json.JSONDecodeError as e:
        print(f"Error decoding JSON from {file_path}: {e}")
        print(f"Returning default value due to JSON decode failure for {file_path}.")
        return default_value
    except ValidationError as e:
        print(f"Pydantic validation failed reading {file_path}: {e.errors()}")
        print(f"Returning default value due to validation failure for {file_path}.")
        return default_value
    except Exception as e:
        print(f"Error reading or parsing JSON from {file_path}: {e}")
        raise IOError(f"Failed to read/parse JSON file at {file_path}. Reason: {str(e)}")

async def write_validated_json(
    file_path: Path,
    data: Union[Dict, List, BaseModel],
    # model: Type[T] # We infer schema from data if it's a Pydantic model, or assume it's pre-validated
) -> Union[Dict, List, BaseModel]:
    """Validates data (if Pydantic model) and writes it to a JSON file."""
    try:
        ensure_dir_exists(file_path.parent)
        
        # Prepare data for JSON serialization
        # If data is a Pydantic model or list/dict of Pydantic models, dump them
        if isinstance(data, BaseModel):
            json_to_write = data.model_dump(mode="json")
        elif isinstance(data, list):
            json_to_write = [item.model_dump(mode="json") if isinstance(item, BaseModel) else item for item in data]
        elif isinstance(data, dict):
            json_to_write = {
                k: v.model_dump(mode="json") if isinstance(v, BaseModel) else v
                for k, v in data.items()
            }
        else:
            json_to_write = data # Should not happen if types are correct

        json_string = json.dumps(json_to_write, indent=2)
        with open(file_path, "w", encoding="utf-8") as f:
            f.write(json_string)
        return data # Return original (validated) data structure
    except ValidationError as e: # Should be caught by service layer ideally before write
        print(f"Pydantic validation failed before writing to {file_path}: {e.errors()}")
        raise
    except Exception as e:
        print(f"Error writing JSON to {file_path}: {e}")
        raise IOError(f"Failed to write JSON file at {file_path}. Reason: {str(e)}")


class PromptStorageUtil:
    async def read_prompts(self) -> PromptsStorage:
        # The `model` argument to read_validated_json should ideally be `Dict[str, Prompt]`
        # but Pydantic's `model_validate` works on model instances.
        # We'll pass Prompt and handle the dict structure in read_validated_json
        return await read_validated_json(get_prompts_index_path(), Prompt, {})

    async def write_prompts(self, prompts: PromptsStorage) -> PromptsStorage:
        return await write_validated_json(get_prompts_index_path(), prompts)

    async def read_prompt_projects(self) -> PromptProjectsStorage:
        # Pass PromptProject, read_validated_json handles list of models
        return await read_validated_json(get_prompt_projects_path(), PromptProject, [])

    async def write_prompt_projects(self, prompt_projects: PromptProjectsStorage) -> PromptProjectsStorage:
        return await write_validated_json(get_prompt_projects_path(), prompt_projects)

    def generate_id(self, prefix: str) -> str:
        return f"{prefix}_{uuid.uuid4()}"

prompt_storage_util = PromptStorageUtil()
