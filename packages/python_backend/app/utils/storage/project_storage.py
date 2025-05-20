# packages/python_backend/app/utils/storage/project_storage.py
# - Faithfully converted from TypeScript project-storage.ts
# - Uses Pydantic for validation instead of Zod
# - Manages project and project file data in JSON files
# - Includes path helpers and robust read/write operations
# - Last 5 changes:
#   1. Initial creation based on TypeScript version.
#   2. Implemented path helpers (get_projects_index_path, get_project_data_dir, etc.).
#   3. Implemented _read_validated_json and _write_validated_json with Pydantic.
#   4. Implemented public storage methods (read_projects, write_project_files, etc.).
#   5. Added update_project_file and delete_project_data.

import json
import os
import uuid
from pathlib import Path
from typing import Any, Dict, Type, TypeVar, Optional, Union
from pydantic import BaseModel, ValidationError, RootModel
from datetime import datetime, timezone

# Assuming schemas are in app.schemas
from app.schemas.project_schemas import Project, ProjectFile

# Define the base directory for storing project data, relative to the workspace root
# This should ideally be configurable.
# For now, assuming the script runs from a context where WORKSPACE_ROOT makes sense
# or that this path is adjusted during deployment.
try:
    # Attempt to get workspace root from an environment variable or a known structure
    # This is a placeholder for robust workspace root detection
    WORKSPACE_ROOT = Path(os.getenv("OCTOPROMPT_WORKSPACE_ROOT", Path(__file__).resolve().parent.parent.parent.parent))
except Exception:
    WORKSPACE_ROOT = Path.cwd() # Fallback to current working directory

DATA_DIR = WORKSPACE_ROOT / "data" / "python_project_storage"

# --- Schemas for Storage (using Pydantic's RootModel for top-level dicts) ---
# Store projects as a map (Record) keyed by projectId
ProjectsStorageModel = RootModel[Dict[str, Project]]
# Store files within a project as a map (Record) keyed by fileId
ProjectFilesStorageModel = RootModel[Dict[str, ProjectFile]]

T = TypeVar("T", bound=BaseModel) # For generic Pydantic models in read/write
DictModel = TypeVar("DictModel", bound=RootModel) # For RootModel types

# --- Path Helpers ---

def get_projects_index_path() -> Path:
    return DATA_DIR / "projects.json"

def get_project_data_dir(project_id: str) -> Path:
    return DATA_DIR / "project_data" / project_id

def get_project_files_path(project_id: str) -> Path:
    return get_project_data_dir(project_id) / "files.json"

# --- Core Read/Write Functions ---

async def _ensure_dir_exists(dir_path: Path) -> None:
    try:
        dir_path.mkdir(parents=True, exist_ok=True)
    except Exception as e:
        # Log or handle more gracefully if needed
        print(f"Error creating directory {dir_path}: {e}")
        raise IOError(f"Failed to ensure directory exists: {dir_path}") from e

async def _read_validated_json(
    file_path: Path,
    model_type: Union[Type[T], Type[DictModel]], # Accepts BaseModel or RootModel based types
    default_value: Union[Dict, List] # Adjusted to return simple dict/list for RootModel defaults
) -> Union[T, Dict[str, Any], List[Any]]: # Return type reflects model or raw dict/list
    try:
        await _ensure_dir_exists(file_path.parent)
        if not file_path.exists():
            return default_value
        
        with open(file_path, "r", encoding="utf-8") as f:
            file_content = f.read()
            if not file_content.strip(): # Handle empty file
                return default_value
        
        json_data = json.loads(file_content)
        
        if issubclass(model_type, RootModel):
            # For RootModel, parse and return the root object (which is often a dict or list)
            parsed_model = model_type.model_validate(json_data)
            return parsed_model.root # Access the actual root data
        elif issubclass(model_type, BaseModel):
            return model_type.model_validate(json_data) # For standard BaseModel
        else: # Should not happen with TypeVar constraints but as a fallback
            raise TypeError("model_type must be a Pydantic BaseModel or RootModel subclass")

    except FileNotFoundError:
        return default_value
    except json.JSONDecodeError as e:
        print(f"JSON decoding failed for {file_path}: {e}. Returning default.")
        return default_value
    except ValidationError as e:
        print(f"Pydantic validation failed reading {file_path}: {e}. Returning default.")
        return default_value
    except Exception as e:
        print(f"Error reading or parsing JSON from {file_path}: {e}")
        raise IOError(f"Failed to read/parse JSON file at {file_path}") from e

async def _write_validated_json(
    file_path: Path,
    data: Union[BaseModel, RootModel, Dict, List], # Accept Pydantic models or raw dict/list
    model_type: Union[Type[T], Type[DictModel]] # To validate if raw data is passed
) -> Union[T, Dict[str, Any], List[Any]]:
    try:
        validated_data_to_serialize: Any
        
        if isinstance(data, BaseModel): # Catches Project, ProjectFile
            validated_data_to_serialize = data.model_dump(mode='json')
        elif isinstance(data, RootModel): # Catches ProjectsStorageModel, ProjectFilesStorageModel
            validated_data_to_serialize = data.model_dump(mode='json')
        elif isinstance(data, (dict, list)): # Raw dict or list, attempt validation
            parsed_model = model_type.model_validate(data)
            if isinstance(parsed_model, RootModel):
                 validated_data_to_serialize = parsed_model.model_dump(mode='json') # .root
            else: # BaseModel
                 validated_data_to_serialize = parsed_model.model_dump(mode='json')
        else:
            raise TypeError("Data to write must be a Pydantic model, dict, or list")

        await _ensure_dir_exists(file_path.parent)
        
        json_string = json.dumps(validated_data_to_serialize, indent=2)
        with open(file_path, "w", encoding="utf-8") as f:
            f.write(json_string)
        
        # Return the Python object that was serialized (model instance or validated dict/list)
        if isinstance(data, (BaseModel, RootModel)):
            return data 
        else: # data was raw, return the parsed model
            return model_type.model_validate(data)


    except ValidationError as e:
        print(f"Pydantic validation failed before writing to {file_path}: {e}")
        raise e  # Re-throw Pydantic errors
    except Exception as e:
        print(f"Error writing JSON to {file_path}: {e}")
        raise IOError(f"Failed to write JSON file at {file_path}") from e

class ProjectStorage:
    async def read_projects(self) -> Dict[str, Project]:
        # ProjectsStorageModel is RootModel[Dict[str, Project]]
        # _read_validated_json will return the Dict[str, Project] from model.root
        return await _read_validated_json(get_projects_index_path(), ProjectsStorageModel, {})

    async def write_projects(self, projects: Dict[str, Project]) -> Dict[str, Project]:
        # Wrap the dict in RootModel for validation and serialization
        projects_model = ProjectsStorageModel(root=projects)
        # _write_validated_json will return the RootModel instance, access .root
        written_model = await _write_validated_json(get_projects_index_path(), projects_model, ProjectsStorageModel)
        return written_model.root

    async def read_project_files(self, project_id: str) -> Dict[str, ProjectFile]:
        return await _read_validated_json(get_project_files_path(project_id), ProjectFilesStorageModel, {})

    async def write_project_files(self, project_id: str, files: Dict[str, ProjectFile]) -> Dict[str, ProjectFile]:
        files_model = ProjectFilesStorageModel(root=files)
        written_model = await _write_validated_json(get_project_files_path(project_id), files_model, ProjectFilesStorageModel)
        return written_model.root

    async def read_project_file(self, project_id: str, file_id: str) -> Optional[ProjectFile]:
        files = await self.read_project_files(project_id)
        return files.get(file_id)

    async def update_project_file(
        self,
        project_id: str,
        file_id: str,
        file_update_data: Dict[str, Any] # Partial data for the file
    ) -> ProjectFile:
        current_file = await self.read_project_file(project_id, file_id)
        if not current_file:
            raise FileNotFoundError(f"File not found: {file_id} in project {project_id}")

        # Create a dictionary from the current file model for updates
        updated_file_dict = current_file.model_dump()
        updated_file_dict.update(file_update_data) # Apply partial updates
        updated_file_dict["updated_at"] = datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")
        
        try:
            # Validate the complete structure after update
            validated_file_data = ProjectFile(**updated_file_dict)
        except ValidationError as e:
            print(f"Pydantic validation failed for file {file_id} in project {project_id} during update: {e}")
            raise e

        current_project_files = await self.read_project_files(project_id)
        current_project_files[file_id] = validated_file_data
        
        await self.write_project_files(project_id, current_project_files)
        return validated_file_data

    async def delete_project_data(self, project_id: str) -> None:
        dir_path = get_project_data_dir(project_id)
        try:
            if dir_path.exists():
                import shutil
                shutil.rmtree(dir_path)
        except FileNotFoundError:
            print(f"Project data directory not found, nothing to delete: {dir_path}")
        except Exception as e:
            print(f"Error deleting project data directory {dir_path}: {e}")
            raise IOError(f"Failed to delete project data directory: {dir_path}") from e

    def generate_id(self, prefix: str) -> str:
        return f"{prefix}_{uuid.uuid4().hex[:12]}" # Consistent with typical short UUIDs

# Singleton instance to be imported by services
project_storage = ProjectStorage()
