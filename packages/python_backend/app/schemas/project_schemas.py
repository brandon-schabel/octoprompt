# app/schemas/project_schemas.py
# - Converted ProjectSchema, CreateProjectBodySchema
# - Used Pydantic's BaseModel and Field
# - Mapped Zod types/validators to Pydantic/Python types
# - Matched OpenAPI examples and descriptions
# - Handled optional fields and datetime strings
# - Changed datetime fields to int (Unix ms) and added validators.

from typing import Optional, List, Dict, Any, Literal
from pydantic import BaseModel, Field, validator, field_validator
from datetime import datetime, timezone
from app.utils.storage_timestap_utils import convert_timestamp_to_ms_int

class Project(BaseModel):
    id: int
    name: str
    path: str
    currentBranch: Optional[str] = None
    description: Optional[str] = None
    created: int
    updated: int
    files: Optional[List['ProjectFile']] = [] # List of ProjectFile, can be empty

    _validate_timestamps = field_validator('created', 'updated', mode='before')(convert_timestamp_to_ms_int)

    class Config:
        openapi_extra = {"title": "Project"}
        # No json_encoders needed here as fields are int

class CreateProjectBody(BaseModel):
    name: str = Field(..., min_length=1, example='My Awesome Project')
    path: str = Field(..., min_length=1, example='/path/to/project')
    description: Optional[str] = Field(None, example='Optional project description')

    class Config:
        openapi_extra = {"title": "CreateProjectRequestBody"}

# Similarly, for ProjectFileSchema:
class ProjectFile(BaseModel):
    id: int
    projectid: int
    path: str
    content: Optional[str] = None
    extractedSymbols: Optional[Dict[str, Any]] = None # Can be any nested structure
    codeStory: Optional[str] = None
    summary: Optional[str] = None
    created: int
    updated: int

    _validate_timestamps = field_validator('created', 'updated', mode='before')(convert_timestamp_to_ms_int)

    class Config:
        openapi_extra = {"title": "ProjectFile"}

# For ProjectIdParamsSchema
class ProjectIdParams(BaseModel):
    project_id: int = Field(..., min_length=1, alias="projectId", examples=["proj_1a2b3c4d"], description="The ID of the project")

    model_config = {
        "populate_by_name": True,
    }

# For UpdateProjectBodySchema with refine
class UpdateProjectBody(BaseModel):
    name: Optional[str] = Field(None, min_length=1, example='Updated Project Name')
    path: Optional[str] = Field(None, min_length=1, example='/new/path/to/project')
    description: Optional[str] = Field(None, example='Updated description')

    @validator('*', pre=True, always=True) # Using a root_validator would be more precise for the cross-field check
    def check_at_least_one_field(cls, values):
        if not any(values.get(field) for field in ['name', 'path', 'description']):
            raise ValueError('At least one field (name, path, description) must be provided for update')
        return values

    class Config:
        openapi_extra = {"title": "UpdateProjectRequestBody"}

# Common response structure can also be generic
class SuccessResponse(BaseModel):
    success: Literal[True] = True

class ProjectResponse(SuccessResponse):
    data: Project

class ProjectListResponse(SuccessResponse):
    data: List[Project]

class FileListResponse(SuccessResponse):
    data: List[ProjectFile]

class ProjectResponseMultiStatus(ProjectResponse):
    warning: Optional[str] = Field(None, example="Initial sync encountered a minor issue.")
    error: Optional[str] = Field(None, example="Failed to start file watcher.")

    class Config:
        openapi_extra = {"title": "ProjectResponseMultiStatus"}

class ProjectSummaryResponse(SuccessResponse):
    summary: str = Field(..., example="This project contains components for user authentication and profile management.")

    class Config:
        openapi_extra = {"title": "ProjectSummaryResponse"}

class RemoveSummariesBody(BaseModel):
    fileIds: List[str] = Field(..., min_items=1, example=['file_1a2b3c4d', 'file_e5f6g7h8'])

    @validator('fileIds', each_item=True)
    def check_file_id_min_length(cls, v):
        if len(v) < 1:
            raise ValueError('File ID must have a minimum length of 1')
        return v

    class Config:
        openapi_extra = {"title": "RemoveSummariesRequestBody"}

class SummarizeFilesBody(BaseModel):
    fileIds: List[str] = Field(..., min_items=1, example=['file_1a2b3c4d', 'file_e5f6g7h8'])
    force: bool = Field(False, example=False, description='Force re-summarization even if summary exists')

    @validator('fileIds', each_item=True)
    def check_file_id_min_length(cls, v):
        if len(v) < 1:
            raise ValueError('File ID must have a minimum length of 1')
        return v

    class Config:
        openapi_extra = {"title": "SummarizeFilesRequestBody"}

class SuggestFilesBody(BaseModel):
    userInput: str = Field(..., min_length=1, example='Implement authentication using JWT')

    class Config:
        openapi_extra = {"title": "SuggestFilesRequestBody"}

class RefreshQuery(BaseModel):
    folder: Optional[str] = Field(None, example='src/components', description='Optional folder path to limit the refresh scope')

    class Config:
        openapi_extra = {"title": "RefreshQuery"}

# ProjectFileMap equivalent
ProjectFileMap = Dict[str, ProjectFile]

# Type alias for clarity, though Pydantic models are already types
# type Project = Project (class name itself)
# type ProjectFile = ProjectFile (class name itself)
# type CreateProjectBody = CreateProjectBody (class name itself)
# type UpdateProjectBody = UpdateProjectBody (class name itself)

# Added for agent_coder_service to align with TypeScript's FileSyncData
class FileSyncData(BaseModel):
    path: str
    name: str
    extension: str
    content: str
    size: int
    checksum: str
    # project_id is not part of FileSyncData in TS, it's passed to bulk_create_project_files