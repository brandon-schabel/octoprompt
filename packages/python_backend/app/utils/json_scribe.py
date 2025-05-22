# json_scribe.py
# 1. Initial Python conversion from TypeScript.
# 2. Using Pydantic for optional schema validation.
# 3. Using aiofiles for async file I/O.
# 4. Simplified path resolution logic.
# 5. Adapted error handling to Pythonic exceptions.
# No changes directly needed in this file as it's a generic utility.
# The Pydantic models using it will now provide serializable integer timestamps.

import os
import json
from typing import Any, List, Union, Optional, Type, TypeVar
from pydantic import BaseModel, ValidationError as PydanticValidationError
import aiofiles
import aiofiles.os # For aiofiles.os.path.exists

DataT = TypeVar('DataT')
PydanticModelT = TypeVar('PydanticModelT', bound=BaseModel)

def _resolve_and_ensure_json_path(
    raw_path: Union[str, List[str]], 
    base_path: Optional[str] = None
) -> str:
    """Resolves input to an absolute path string ending with '.json'."""
    eff_base = base_path if base_path is not None else os.getcwd()
    
    path_str: str
    if isinstance(raw_path, list):
        segments = [s for s in raw_path if isinstance(s, str) and s.strip()]
        if not segments: raise ValueError("Path array invalid: empty or only empty strings.")
        path_str = os.path.join(*segments)
    elif isinstance(raw_path, str) and raw_path.strip():
        path_str = raw_path.strip()
    else:
        raise ValueError("Path invalid: must be non-empty string or list of non-empty strings.")
    
    if not path_str.lower().endswith(".json"): path_str += ".json"
    
    return os.path.abspath(os.path.join(eff_base, path_str))

async def write_json(
    path: Union[str, List[str]],
    data: DataT,
    schema: Optional[Type[PydanticModelT]] = None,
    base_path: Optional[str] = None
) -> Union[PydanticModelT, DataT]:
    """Writes data to JSON, optionally validating with a Pydantic schema.
    Returns the validated Pydantic model instance if schema is used, else original data.
    """
    file_path = _resolve_and_ensure_json_path(path, base_path)
    data_to_serialize: Any = data
    validated_data_obj: Union[PydanticModelT, DataT] = data

    try:
        if schema:
            try:
                validated_model_instance = schema.model_validate(data)
                data_to_serialize = validated_model_instance.model_dump(mode="json")
                validated_data_obj = validated_model_instance
            except PydanticValidationError as e:
                raise PydanticValidationError(f"Validation failed for {file_path}: {e.errors()}") from e
        
        json_string = json.dumps(data_to_serialize, indent=2)
        
        dir_name = os.path.dirname(file_path)
        if dir_name: # Create directories if they don't exist
            os.makedirs(dir_name, exist_ok=True) 
            
        async with aiofiles.open(file_path, 'w', encoding='utf-8') as f:
            await f.write(json_string)
        
        return validated_data_obj
    except PydanticValidationError: # Re-raise if it's a Pydantic error
        raise
    except Exception as e: # Catch other IOErrors or general errors
        raise IOError(f"Failed to write JSON file at {file_path}. Reason: {str(e)}") from e

async def read_json(
    path: Union[str, List[str]],
    base_path: Optional[str] = None
) -> Optional[Any]:
    """Reads and parses a JSON file.
    Returns None if file not found, raises error on parsing or other read issues.
    """
    file_path = _resolve_and_ensure_json_path(path, base_path)
    
    try:
        async with aiofiles.open(file_path, 'r', encoding='utf-8') as f:
            content = await f.read()
        return json.loads(content)
    except FileNotFoundError:
        return None # File does not exist
    except json.JSONDecodeError as e:
        raise ValueError(f"Failed to parse JSON from {file_path}. Reason: {str(e)}") from e
    except Exception as e: # Catch other IOErrors
        raise IOError(f"Failed to read JSON file at {file_path}. Reason: {str(e)}") from e

json_scribe = {
    "write": write_json,
    "read": read_json,
}