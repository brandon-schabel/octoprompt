from typing import Optional, List, Dict, Any, Literal
from pydantic import BaseModel, Field, field_validator, model_validator
from datetime import datetime, timezone
from app.utils.storage_timestamp_utils import convert_timestamp_to_ms_int

class Project(BaseModel):
    id: int
    name: str
    path: str
    currentBranch: Optional[str] = None
    description: Optional[str] = None
    created: int
    updated: int
    files: Optional[List['ProjectFile']] = []

    _validate_timestamps = field_validator('created', 'updated', mode='before')(convert_timestamp_to_ms_int)

    model_config = {
        "openapi_extra": {"title": "Project"}
    }

class CreateProjectBody(BaseModel):
    name: str = Field(..., min_length=1, json_schema_extra={'example': 'My Awesome Project'})
    path: str = Field(..., min_length=1, json_schema_extra={'example': '/path/to/project'})
    description: Optional[str] = Field(None, json_schema_extra={'example': 'Optional project description'})

    model_config = {
        "openapi_extra": {"title": "CreateProjectRequestBody"}
    }

class ProjectFile(BaseModel):
    id: int
    project_id: int
    name: str
    path: str
    extension: Optional[str] = None
    size: int
    content: Optional[str] = None
    extractedSymbols: Optional[Dict[str, Any]] = None
    codeStory: Optional[str] = None
    summary: Optional[str] = None
    summary_last_updated_at: Optional[int] = None
    meta: Optional[str] = None
    checksum: Optional[str] = None
    created: int
    updated: int

    _validate_timestamps = field_validator('created', 'updated', 'summary_last_updated_at', mode='before')(convert_timestamp_to_ms_int)

    model_config = {
        "openapi_extra": {"title": "ProjectFile"}
    }

class ProjectIdParams(BaseModel):
    project_id: int = Field(..., description="The ID of the project", json_schema_extra={'examples': [12345]})

    model_config = {
        "populate_by_name": True,
        "openapi_extra": {"alias": "projectId"}
    }

class UpdateProjectBody(BaseModel):
    name: Optional[str] = Field(None, min_length=1, json_schema_extra={'example': 'Updated Project Name'})
    path: Optional[str] = Field(None, min_length=1, json_schema_extra={'example': '/new/path/to/project'})
    description: Optional[str] = Field(None, json_schema_extra={'example': 'Updated description'})

    @model_validator(mode='before')
    @classmethod
    def check_at_least_one_field(cls, data: Any) -> Any:
        if data is None or not isinstance(data, dict):
            if isinstance(data, cls):
                 if not (data.name or data.path or data.description):
                     raise ValueError('At least one field (name, path, description) must be provided for update')
                 return data
            raise ValueError('Invalid input for UpdateProjectBody. Must be a dictionary or an instance of UpdateProjectBody.')
        if not any(data.get(field) for field in ['name', 'path', 'description']):
            raise ValueError('At least one field (name, path, description) must be provided for update')
        return data

    model_config = {
        "openapi_extra": {"title": "UpdateProjectRequestBody"}
    }

class SuccessResponse(BaseModel):
    success: Literal[True] = True

class ProjectResponse(SuccessResponse):
    data: Project

class ProjectListResponse(SuccessResponse):
    data: List[Project]

class FileListResponse(SuccessResponse):
    data: List[ProjectFile]

class ProjectResponseMultiStatus(ProjectResponse):
    warning: Optional[str] = Field(None, json_schema_extra={'example': "Initial sync encountered a minor issue."})
    error: Optional[str] = Field(None, json_schema_extra={'example': "Failed to start file watcher."})

    model_config = {
        "openapi_extra": {"title": "ProjectResponseMultiStatus"}
    }

class ProjectSummaryResponse(SuccessResponse):
    summary: str = Field(..., json_schema_extra={'example': "This project contains components for user authentication and profile management."})

    model_config = {
        "openapi_extra": {"title": "ProjectSummaryResponse"}
    }

class RemoveSummariesBody(BaseModel):
    fileIds: List[int] = Field(..., min_items=1, json_schema_extra={'example': [12345, 67890]})

    @field_validator('fileIds', mode='after')
    @classmethod
    def check_file_ids_not_empty_list(cls, v: List[int]) -> List[int]:
        if not v: 
            raise ValueError('fileIds list cannot be empty')
        return v

    model_config = {
        "openapi_extra": {"title": "RemoveSummariesRequestBody"}
    }

class SummarizeFilesBody(BaseModel):
    fileIds: List[int] = Field(..., min_items=1, json_schema_extra={'example': [12345, 67890]})
    force: bool = Field(False, json_schema_extra={'example': False}, description='Force re-summarization even if summary exists')

    model_config = {
        "openapi_extra": {"title": "SummarizeFilesRequestBody"}
    }

class SuggestFilesBody(BaseModel):
    userInput: str = Field(..., min_length=1, json_schema_extra={'example': 'Implement authentication using JWT'})

    model_config = {
        "openapi_extra": {"title": "SuggestFilesRequestBody"}
    }

class RefreshQuery(BaseModel):
    folder: Optional[str] = Field(None, json_schema_extra={'example': 'src/components'}, description='Optional folder path to limit the refresh scope')

    model_config = {
        "openapi_extra": {"title": "RefreshQuery"}
    }

ProjectFileMap = Dict[str, ProjectFile]

class FileSyncData(BaseModel):
    path: str
    name: str
    extension: str
    content: str
    size: int
    checksum: str