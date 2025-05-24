
import json
import os
import time
from pathlib import Path
from typing import Any, Dict, Type, TypeVar, Optional, Union, List
from pydantic import BaseModel, ValidationError, RootModel
from datetime import datetime, timezone

# Import the authoritative schemas
from app.schemas.project_schemas import Project, ProjectFile
from app.schemas.ai_file_change_schemas import AIFileChangeRecord

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
    except Exception as e: raise IOError(f"Failed to ensure directory exists: {dir_path}") from e

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
                        except (ValueError, ValidationError):
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
    except json.JSONDecodeError: return default_value
    except ValidationError: return default_value
    except Exception as e: raise IOError(f"Failed to read/parse JSON: {file_path}") from e

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

    except ValidationError as e: raise e
    except Exception as e: raise IOError(f"Failed to write JSON: {file_path}") from e

class ProjectStorage:
    def __init__(self):
        self._last_timestamp: int = 0
        self._sequence_counter: int = 0
    
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
        except ValidationError as e: raise e

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
        except FileNotFoundError: pass
        except Exception as e: raise IOError(f"Failed to delete dir: {dir_path}") from e

    def generate_id(self) -> int:
        current_timestamp = int(time.time() * 1000)
        if current_timestamp == self._last_timestamp:
            self._sequence_counter += 1
            unique_id = current_timestamp + self._sequence_counter
        else:
            self._last_timestamp = current_timestamp
            self._sequence_counter = 0
            unique_id = current_timestamp
        return unique_id

project_storage = ProjectStorage()