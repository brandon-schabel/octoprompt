# packages/python_backend/app/utils/storage/provider_key_storage.py
# 1. Migrated to Unix ms timestamps for ID and time fields.
# 2. Updated generate_id to return Unix ms timestamp.
# 3. Assumed ProviderKey schema has createdAt/updatedAt, changed to int.
# 4. Added field_validator for backward compatibility of timestamps (conceptual).
# 5. Imported time, Any, datetime, timezone.
import json
import os
import uuid # Kept for now, but generate_id will use time
import time
from pathlib import Path
from typing import Type, TypeVar, Dict, Union, List, Any
from datetime import datetime, timezone

from pydantic import BaseModel, ValidationError, field_validator

from app.schemas.provider_key_schemas import ProviderKey # Assuming this will be updated
from app.utils.storage_timestap_utils import convert_timestamp_to_ms_int, convert_id_to_int

# Define the base directory for storing provider key data
DATA_DIR = Path(os.getcwd()) / "data" / "provider_key_storage"

# --- Schemas for Storage ---
# Store all provider keys as a map (Record) keyed by keyId (now int)
ProviderKeysStorage = Dict[int, ProviderKey] # Key is now int

T = TypeVar("T", bound=BaseModel)

# Placeholder for convert_timestamp_to_ms_int, assuming it's defined in ProviderKey schema
# from app.schemas.common_validators import convert_timestamp_to_ms_int # Example

# --- Update ProviderKey schema (conceptual) ---
# The ProviderKey schema in app.schemas.provider_key_schemas.py should be updated
# to use int for IDs and timestamps, and use convert_timestamp_to_ms_int and
# convert_id_to_int from app.utils.storage_timestap_utils for validation.
# Example fields in ProviderKey schema after update:
# id: int
# created: int
# updated: int
# _validate_timestamps = field_validator('created', 'updated', mode='before')(convert_timestamp_to_ms_int)
# _validate_id = field_validator('id', mode='before')(convert_id_to_int)


# --- Path Helpers ---

def get_provider_keys_index_path() -> Path:
    """Gets the absolute path to the main provider keys index file."""
    return DATA_DIR / "provider_keys.json"

# --- Core Read/Write Functions (adapted from prompt_storage.py) ---

def ensure_dir_exists(dir_path: Path) -> None:
    try: dir_path.mkdir(parents=True, exist_ok=True)
    except Exception as e: print(f"Error creating directory {dir_path}: {e}"); raise IOError(f"Failed to ensure directory exists: {dir_path}")

async def read_validated_json_provider_keys( # Renamed for clarity, but logic similar to generic read_validated_json
    file_path: Path,
    model: Type[ProviderKey], # Value type in the dict
    default_value: Dict # Should be ProviderKeysStorage type hint, which is Dict[int, ProviderKey]
) -> ProviderKeysStorage:
    """Reads and validates JSON data for ProviderKeysStorage from a file."""
    try:
        ensure_dir_exists(file_path.parent)
        if not file_path.exists(): return default_value.copy() # Return a copy of default

        with open(file_path, "r", encoding="utf-8") as f: json_data = json.load(f)
        
        if not isinstance(json_data, dict):
            print(f"Data in {file_path} is not a dictionary. Returning default.")
            return default_value.copy()

        validated_data: ProviderKeysStorage = {}
        for k_str, v_data in json_data.items(): # Keys from JSON are strings
            try:
                k_int = int(k_str) # Convert string key from JSON to int
                validated_data[k_int] = model.model_validate(v_data)
            except (ValidationError, ValueError) as e: print(f"Validation/KeyConv failed for item {k_str} in {file_path}: {e}")
        return validated_data

    except FileNotFoundError: return default_value.copy()
    except json.JSONDecodeError as e: print(f"Error decoding JSON from {file_path}: {e}"); return default_value.copy()
    except Exception as e: print(f"Error reading/parsing JSON from {file_path}: {e}"); raise IOError(f"Failed to read/parse JSON: {file_path}")

async def write_validated_json_provider_keys( # Renamed for clarity
    file_path: Path,
    data: ProviderKeysStorage,
) -> ProviderKeysStorage:
    """Writes ProviderKeysStorage data to a JSON file."""
    try:
        ensure_dir_exists(file_path.parent)
        # JSON keys must be strings
        json_to_write = {str(k): v.model_dump(mode="json") for k, v in data.items()}

        json_string = json.dumps(json_to_write, indent=2)
        with open(file_path, "w", encoding="utf-8") as f: f.write(json_string)
        return data
    except Exception as e: print(f"Error writing JSON to {file_path}: {e}"); raise IOError(f"Failed to write JSON: {file_path}")


class ProviderKeyStorageUtil:
    async def read_provider_keys(self) -> ProviderKeysStorage:
        return await read_validated_json_provider_keys(get_provider_keys_index_path(), ProviderKey, {})

    async def write_provider_keys(self, keys: ProviderKeysStorage) -> ProviderKeysStorage:
        return await write_validated_json_provider_keys(get_provider_keys_index_path(), keys)

    def generate_id(self) -> int: # Removed prefix, default prefix was "key"
        """Generates a unique ID as Unix timestamp in milliseconds."""
        return int(time.time() * 1000)

provider_key_storage_util = ProviderKeyStorageUtil()