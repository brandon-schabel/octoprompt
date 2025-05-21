import json
import os
import uuid
from pathlib import Path
from typing import Type, TypeVar, Dict, Union, List

from pydantic import BaseModel, ValidationError

from app.schemas.provider_key_schemas import ProviderKey

# Define the base directory for storing provider key data
DATA_DIR = Path(os.getcwd()) / "data" / "provider_key_storage"

# --- Schemas for Storage ---
# Store all provider keys as a map (Record) keyed by keyId
ProviderKeysStorage = Dict[str, ProviderKey]

T = TypeVar("T", bound=BaseModel)

# --- Path Helpers ---

def get_provider_keys_index_path() -> Path:
    """Gets the absolute path to the main provider keys index file."""
    return DATA_DIR / "provider_keys.json"

# --- Core Read/Write Functions (adapted from prompt_storage.py) ---

def ensure_dir_exists(dir_path: Path) -> None:
    """Ensures the specified directory exists."""
    try:
        dir_path.mkdir(parents=True, exist_ok=True)
    except Exception as e:
        print(f"Error creating directory {dir_path}: {e}")
        raise IOError(f"Failed to ensure directory exists: {dir_path}")

async def read_validated_json_provider_keys(
    file_path: Path,
    model: Type[ProviderKey], # Value type in the dict
    default_value: Dict
) -> ProviderKeysStorage:
    """Reads and validates JSON data for ProviderKeysStorage from a file."""
    try:
        ensure_dir_exists(file_path.parent)
        if not file_path.exists():
            return default_value

        with open(file_path, "r", encoding="utf-8") as f:
            json_data = json.load(f)
        
        if not isinstance(json_data, dict):
            print(f"Data in {file_path} is not a dictionary as expected for ProviderKeysStorage.")
            return default_value

        validated_data: ProviderKeysStorage = {}
        for k, v_data in json_data.items():
            try:
                validated_data[k] = model.model_validate(v_data)
            except ValidationError as e:
                print(f"Validation failed for provider key item {k} in {file_path}: {e.errors()}")
                # Optionally, skip invalid items or handle error more strictly
        return validated_data

    except FileNotFoundError:
        return default_value
    except json.JSONDecodeError as e:
        print(f"Error decoding JSON from {file_path}: {e}")
        return default_value
    except Exception as e:
        print(f"Error reading or parsing JSON from {file_path}: {e}")
        raise IOError(f"Failed to read/parse JSON file at {file_path}. Reason: {str(e)}")

async def write_validated_json_provider_keys(
    file_path: Path,
    data: ProviderKeysStorage,
) -> ProviderKeysStorage:
    """Writes ProviderKeysStorage data to a JSON file."""
    try:
        ensure_dir_exists(file_path.parent)
        
        json_to_write = {
            k: v.model_dump(mode="json") for k, v in data.items()
        }

        json_string = json.dumps(json_to_write, indent=2)
        with open(file_path, "w", encoding="utf-8") as f:
            f.write(json_string)
        return data
    except Exception as e:
        print(f"Error writing JSON to {file_path}: {e}")
        raise IOError(f"Failed to write JSON file at {file_path}. Reason: {str(e)}")


class ProviderKeyStorageUtil:
    async def read_provider_keys(self) -> ProviderKeysStorage:
        return await read_validated_json_provider_keys(get_provider_keys_index_path(), ProviderKey, {})

    async def write_provider_keys(self, keys: ProviderKeysStorage) -> ProviderKeysStorage:
        return await write_validated_json_provider_keys(get_provider_keys_index_path(), keys)

    def generate_id(self, prefix: str = "key") -> str: # Default prefix for keys
        return f"{prefix}_{uuid.uuid4()}"

provider_key_storage_util = ProviderKeyStorageUtil()
