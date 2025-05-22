# packages/python_backend/app/utils/storage/project_storage.py
# 1. IDs and timestamps (createdAt, updatedAt) changed to int (Unix ms).
# 2. generate_id updated to return int timestamp.
# 3. Pydantic schemas (Project, ProjectFile, AIFileChangeRecord) assumed to be updated.
#    - Added conceptual timestamp validator.
# 4. _read_validated_json and _write_validated_json adapted for int keys in dicts.
# 5. Imported time, Any. WORKSPACE_ROOT logic simplified for focus.
# 6. `datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")` replaced with int timestamp.
# 7. Updated ProjectFile.summary_last_updated to summary_last_updated_at and included in validator.
# 8. Removed local definitions of convert_timestamp_to_ms_int and convert_id_to_int, now imported.

import json
import os
import uuid
import time
from pathlib import Path
from typing import Any, Dict, Type, TypeVar, Optional, Union, List
from pydantic import BaseModel, ValidationError, RootModel, field_validator, Field
from datetime import datetime, timezone

# Import the centralized conversion utilities
from app.utils.storage_timestap_utils import convert_timestamp_to_ms_int, convert_id_to_int

from app.schemas.project_schemas import Project as OriginalProject, ProjectFile as OriginalProjectFile
from app.schemas.ai_file_change_schemas import AIFileChangeRecord as OriginalAIFileChangeRecord

# Removed local definitions of convert_timestamp_to_ms_int and convert_id_to_int

class Project(OriginalProject if OriginalProject else BaseModel):
    id: int
    # name: str (from OriginalProject)
    # path: str (from OriginalProject)
    # description: Optional[str] (from OriginalProject)
    created: int
    updated: int

    _validate_timestamps = field_validator('created', 'updated', mode='before', check_fields=False)(convert_timestamp_to_ms_int)
    _validate_id = field_validator('id', mode='before', check_fields=False)(convert_id_to_int)
    class Config:
        arbitrary_types_allowed = True
        populate_by_name = True

class ProjectFile(OriginalProjectFile if OriginalProjectFile else BaseModel):
    id: int
    project_id: int
    # name: str (from OriginalProjectFile)
    # path: str (from OriginalProjectFile)
    # extension: Optional[str] (from OriginalProjectFile)
    # content: Optional[str] (from OriginalProjectFile)
    # size: int (from OriginalProjectFile)
    created: int
    updated: int
    summary_last_updated_at: Optional[int] = None # Renamed and type set

    _validate_pf_timestamps = field_validator('created', 'updated', 'summary_last_updated_at', mode='before', check_fields=False)(convert_timestamp_to_ms_int)
    _validate_pf_ids = field_validator('id', 'project_id', mode='before', check_fields=False)(convert_id_to_int)

    class Config:
        arbitrary_types_allowed = True
        populate_by_name = True

class AIFileChangeRecord(OriginalAIFileChangeRecord if OriginalAIFileChangeRecord else BaseModel):
    id: int
    project_id: int
    file_id: int
    timestamp: int
    _validate_timestamp = field_validator('timestamp', mode='before', check_fields=False)(convert_timestamp_to_ms_int)
    _validate_ids = field_validator('id', 'project_id', 'file_id', mode='before', check_fields=False)(convert_id_to_int)
    class Config:
        arbitrary_types_allowed = True
        populate_by_name = True


WORKSPACE_ROOT = Path.cwd()
DATA_DIR = WORKSPACE_ROOT / "data" / "python_project_storage"

ProjectsStorageModel = RootModel[Dict[int, Project]]
ProjectFilesStorageModel = RootModel[Dict[int, ProjectFile]]
AIFileChangesStorageModel = RootModel[Dict[int, AIFileChangeRecord]]

T = TypeVar("T", bound=BaseModel)
DictModel = TypeVar("DictModel", bound=RootModel)

def get_projects_index_path() -> Path: return DATA_DIR / "projects.json"
def get_project_data_dir(project_id: int) -> Path: return DATA_DIR / "project_data" / str(project_id)
def get_project_files_path(project_id: int) -> Path: return get_project_data_dir(project_id) / "files.json"
def get_ai_file_changes_path(project_id: int) -> Path: return get_project_data_dir(project_id) / "ai_file_changes.json"

async def _ensure_dir_exists(dir_path: Path) -> None:
    try: dir_path.mkdir(parents=True, exist_ok=True)
    except Exception as e: print(f"Error creating directory {dir_path}: {e}"); raise IOError(f"Failed to ensure directory exists: {dir_path}") from e

async def _read_validated_json(
    file_path: Path,
    model_type: Union[Type[T], Type[DictModel]],
    default_value: Union[Dict, List]
) -> Union[T, Dict[int, Any], List[Any]]:
    try:
        await _ensure_dir_exists(file_path.parent)
        if not file_path.exists(): return default_value

        with open(file_path, "r", encoding="utf-8") as f: file_content = f.read()
        if not file_content.strip(): return default_value

        json_data = json.loads(file_content)

        if hasattr(model_type, 'model_fields') and 'root' in model_type.model_fields and \
           isinstance(model_type.model_fields['root'].annotation, type(RootModel[Any])) and \
           hasattr(model_type.model_fields['root'].annotation, '__args__') and \
           len(model_type.model_fields['root'].annotation.__args__) > 0 and \
           isinstance(model_type.model_fields['root'].annotation.__args__[0], type(Dict[int, Any])):

            value_model_type_hint = model_type.model_fields['root'].annotation.__args__[0]
            if hasattr(value_model_type_hint, '__args__') and len(value_model_type_hint.__args__) == 2:
                value_model_type = value_model_type_hint.__args__[1]
                parsed_dict = {}
                if isinstance(json_data, dict):
                    for str_k, v_data in json_data.items():
                        try:
                            int_k = int(str_k)
                            parsed_dict[int_k] = value_model_type.model_validate(v_data)
                        except (ValueError, ValidationError) as e:
                            print(f"Skipping item {str_k} due to key/validation error: {e} in file {file_path}")
                            continue
                return model_type(root=parsed_dict).root
            else:
                parsed_model = model_type.model_validate(json_data)
                return parsed_model.root
        elif issubclass(model_type, RootModel):
            parsed_model = model_type.model_validate(json_data)
            return parsed_model.root
        elif issubclass(model_type, BaseModel):
            return model_type.model_validate(json_data)
        else: raise TypeError("model_type must be a Pydantic BaseModel or RootModel subclass")

    except FileNotFoundError: return default_value
    except json.JSONDecodeError as e: print(f"JSON decoding failed for {file_path}: {e}. Returning default."); return default_value
    except ValidationError as e: print(f"Pydantic validation failed reading {file_path}: {e}. Returning default."); return default_value
    except Exception as e: print(f"Error reading or parsing JSON from {file_path}: {e}"); raise IOError(f"Failed to read/parse JSON: {file_path}") from e

async def _write_validated_json(
    file_path: Path,
    data: Union[BaseModel, RootModel, Dict[int, Any], List],
    model_type: Union[Type[T], Type[DictModel]]
) -> Union[T, Dict[int, Any], List[Any]]:
    try:
        validated_data_to_serialize: Any
        output_data_structure: Any

        if isinstance(data, BaseModel):
            validated_data_to_serialize = data.model_dump(mode='json')
            output_data_structure = data
        elif isinstance(data, RootModel):
            internal_data = data.root
            if isinstance(internal_data, dict):
                validated_data_to_serialize = {str(k): v.model_dump(mode='json') if isinstance(v, BaseModel) else v for k,v in internal_data.items()}
            else:
                validated_data_to_serialize = data.model_dump(mode='json')
            output_data_structure = data
        elif isinstance(data, dict):
            temp_root_model = model_type(root={k:v for k,v in data.items()})
            internal_dict = temp_root_model.root
            validated_data_to_serialize = {str(k): v.model_dump(mode='json') if isinstance(v, BaseModel) else v for k,v in internal_dict.items()}
            output_data_structure = temp_root_model
        elif isinstance(data, list):
            parsed_model = model_type.model_validate(data)
            validated_data_to_serialize = parsed_model.model_dump(mode='json')
            output_data_structure = parsed_model
        else: raise TypeError("Data to write must be a Pydantic model, RootModel, dict, or list")

        await _ensure_dir_exists(file_path.parent)
        json_string = json.dumps(validated_data_to_serialize, indent=2)
        with open(file_path, "w", encoding="utf-8") as f: f.write(json_string)

        if isinstance(output_data_structure, RootModel): return output_data_structure.root
        return output_data_structure

    except ValidationError as e: print(f"Pydantic validation failed before writing {file_path}: {e}"); raise e
    except Exception as e: print(f"Error writing JSON to {file_path}: {e}"); raise IOError(f"Failed to write JSON: {file_path}") from e

class ProjectStorage:
    async def read_projects(self) -> Dict[int, Project]:
        return await _read_validated_json(get_projects_index_path(), ProjectsStorageModel, {})

    async def write_projects(self, projects: Dict[int, Union[Project, Dict]]) -> Dict[int, Project]:
        return await _write_validated_json(get_projects_index_path(), projects, ProjectsStorageModel)


    async def read_project_files(self, project_id: int) -> Dict[int, ProjectFile]:
        return await _read_validated_json(get_project_files_path(project_id), ProjectFilesStorageModel, {})

    async def write_project_files(self, project_id: int, files: Dict[int, Union[ProjectFile, Dict]]) -> Dict[int, ProjectFile]:
        return await _write_validated_json(get_project_files_path(project_id), files, ProjectFilesStorageModel)

    async def read_ai_file_changes(self, project_id: int) -> Dict[int, AIFileChangeRecord]:
        return await _read_validated_json(get_ai_file_changes_path(project_id), AIFileChangesStorageModel, {})

    async def write_ai_file_changes(self, project_id: int, changes: Dict[int, Union[AIFileChangeRecord, Dict]]) -> Dict[int, AIFileChangeRecord]:
        return await _write_validated_json(get_ai_file_changes_path(project_id), changes, AIFileChangesStorageModel)

    async def read_project_file(self, project_id: int, file_id: int) -> Optional[ProjectFile]:
        files = await self.read_project_files(project_id)
        return files.get(file_id)

    async def update_project_file(
        self, project_id: int, file_id: int, file_update_data: Dict[str, Any]
    ) -> ProjectFile:
        current_file = await self.read_project_file(project_id, file_id)
        if not current_file: raise FileNotFoundError(f"File not found: {file_id} in project {project_id}")

        if "updated" not in file_update_data or not isinstance(file_update_data["updated"], int):
                 file_update_data["updated"] = int(datetime.now(timezone.utc).timestamp() * 1000)

        updated_file_model = current_file.model_copy(update=file_update_data)

        try: validated_file_data = ProjectFile(**updated_file_model.model_dump())
        except ValidationError as e: print(f"Validation failed for file {file_id} update: {e}"); raise e

        current_project_files = await self.read_project_files(project_id)
        current_project_files[file_id] = validated_file_data
        await self.write_project_files(project_id, current_project_files)
        return validated_file_data


    async def get_ai_file_change_by_id(self, project_id: int, change_id: int) -> Optional[AIFileChangeRecord]:
        changes = await self.read_ai_file_changes(project_id)
        return changes.get(change_id)

    async def save_ai_file_change(self, project_id: int, record: AIFileChangeRecord) -> None:
        changes = await self.read_ai_file_changes(project_id)
        changes[record.id] = record
        await self.write_ai_file_changes(project_id, changes)

    async def delete_project_data(self, project_id: int) -> None:
        dir_path = get_project_data_dir(project_id)
        try:
            if dir_path.exists(): import shutil; shutil.rmtree(dir_path)
        except FileNotFoundError: print(f"Project data dir not found: {dir_path}")
        except Exception as e: print(f"Error deleting project data dir {dir_path}: {e}"); raise IOError(f"Failed to delete dir: {dir_path}") from e

    def generate_id(self) -> int:
        return int(time.time() * 1000)

project_storage = ProjectStorage()