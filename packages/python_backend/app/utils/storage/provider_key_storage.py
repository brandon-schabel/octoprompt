
import json
import os
import time
from pathlib import Path
from typing import Type, TypeVar, Dict, Union, Any
from pydantic import BaseModel, ValidationError
from app.schemas.provider_key_schemas import ProviderKey

DATA_DIR = Path(os.getcwd()) / "data" / "provider_key_storage"
ProviderKeysStorage = Dict[int, ProviderKey]
T = TypeVar("T", bound=BaseModel)

def get_provider_keys_index_path() -> Path: return DATA_DIR / "provider_keys.json"

def ensure_dir_exists(dir_path: Path) -> None:
    try: dir_path.mkdir(parents=True, exist_ok=True)
    except Exception as e: raise IOError(f"Failed to ensure directory exists: {dir_path}")

async def read_validated_json_provider_keys(
    file_path: Path,
    model: Type[ProviderKey],
    default_value: Dict
) -> ProviderKeysStorage:
    try:
        ensure_dir_exists(file_path.parent)
        if not file_path.exists(): return default_value.copy()

        with open(file_path, "r", encoding="utf-8") as f: json_data = json.load(f)
        
        if not isinstance(json_data, dict): return default_value.copy()

        validated_data: ProviderKeysStorage = {}
        for k_str, v_data in json_data.items():
            try:
                k_int = int(k_str)
                validated_data[k_int] = model.model_validate(v_data)
            except (ValidationError, ValueError): pass
        return validated_data

    except FileNotFoundError: return default_value.copy()
    except json.JSONDecodeError: return default_value.copy()
    except Exception as e: raise IOError(f"Failed to read/parse JSON: {file_path}")

async def write_validated_json_provider_keys(
    file_path: Path,
    data: ProviderKeysStorage,
) -> ProviderKeysStorage:
    try:
        ensure_dir_exists(file_path.parent)
        json_to_write = {str(k): v.model_dump(mode="json") for k, v in data.items()}
        json_string = json.dumps(json_to_write, indent=2)
        with open(file_path, "w", encoding="utf-8") as f: f.write(json_string)
        return data
    except Exception as e: raise IOError(f"Failed to write JSON: {file_path}")

class ProviderKeyStorageUtil:
    async def read_provider_keys(self) -> ProviderKeysStorage:
        return await read_validated_json_provider_keys(get_provider_keys_index_path(), ProviderKey, {})

    async def write_provider_keys(self, keys: ProviderKeysStorage) -> ProviderKeysStorage:
        return await write_validated_json_provider_keys(get_provider_keys_index_path(), keys)

    def generate_id(self) -> int:
        return int(time.time() * 1000)

provider_key_storage_util = ProviderKeyStorageUtil()