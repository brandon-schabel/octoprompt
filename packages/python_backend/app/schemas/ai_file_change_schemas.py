from typing import Optional, List, Dict, Any, Literal
from pydantic import BaseModel, Field, ConfigDict
from enum import Enum
from datetime import datetime

# --- AI File Change Schemas ---

class AIFileChangeStatusEnum(str, Enum):
    PENDING = "pending"
    CONFIRMED = "confirmed"
    REJECTED = "rejected"
    # Removed FAILED to match TS schema: ['pending', 'confirmed', 'rejected']

class AIFileChangeRecord(BaseModel):
    id: str = Field(..., description="Unique ID for the AI file change record", example="aifc_123abc")
    project_id: str = Field(..., alias="projectId", description="ID of the project this change belongs to")
    file_path: str = Field(..., alias="filePath", description="Path to the file that was modified", example="src/components/Button.tsx")
    original_content: str = Field(..., alias="originalContent", description="The original content of the file before changes.")
    suggested_content: str = Field(..., alias="suggestedContent", description="The AI suggested content for the file.")
    diff: Optional[str] = Field(None, description="The diff between original and suggested content, or an explanation.")
    prompt: Optional[str] = Field(None, description="The user prompt that initiated this change.")
    status: AIFileChangeStatusEnum = Field(..., description="Status of the file change.")
    created_at: datetime = Field(..., alias="createdAt", description="Timestamp of when the change was created.")
    updated_at: datetime = Field(..., alias="updatedAt", description="Timestamp of when the change was last updated.")
    explanation: Optional[str] = Field(None, description="Explanation from the AI about the change.")
    
    model_config = ConfigDict(
        title="AIFileChangeRecord", # Matches .openapi('AIFileChangeRecord')
        populate_by_name=True, # Handles camelCase input for snake_case fields if aliases are set
        alias_generator=lambda field_name: field_name.replace("project_id", "projectId") # Example specific alias if needed
                                      .replace("file_path", "filePath")
                                      .replace("original_content", "originalContent")
                                      .replace("suggested_content", "suggestedContent")
                                      .replace("created_at", "createdAt")
                                      .replace("updated_at", "updatedAt"),
        allow_population_by_field_name=True # Allows population by snake_case field name too
    )

# Corresponds to AIFileChangeRecordSchema.openapi('AIFileChangeRecordResponse')
# This is used as the type for 'result' or 'fileChange' in successful responses.
class AIFileChangeRecordResponse(AIFileChangeRecord):
    model_config = ConfigDict(
        title="AIFileChangeRecordResponse", # Explicit OpenAPI name
        populate_by_name=True
    )

AIFileChangesStorage = Dict[str, AIFileChangeRecord] # Corresponds to AIFileChangesStorageSchema

# Corresponds to GenerateChangeBodySchema in ai-file-change.schemas.ts (the one with projectId)
class FullGenerateChangeBody(BaseModel):
    project_id: str = Field(..., alias="projectId", description="ID of the project")
    file_path: str = Field(..., min_length=1, alias="filePath", example="src/components/Button.tsx", description="Path to the file to modify")
    prompt: str = Field(..., min_length=1, example="Add hover effects to the button", description="Instruction for the AI to follow")
    
    model_config = ConfigDict(
        title="GenerateAIChangeBody", # from .openapi('GenerateAIChangeBody') in TS
        populate_by_name=True
    )

# This is the actual request body for the generate route: AIChangeGenerateBodySchema.omit({ projectId: true })
class GenerateAIFileChangeBody(BaseModel):
    file_path: str = Field(..., min_length=1, alias="filePath", serialization_alias="filePath", example="src/components/Button.tsx", description="Path to the file to modify")
    prompt: str = Field(..., min_length=1, example="Add hover effects to the button", description="Instruction for the AI to follow")

    model_config = ConfigDict(
        populate_by_name=True,
        # No specific title for the omitted version in TS, but can be added for clarity in Python spec
        title="GenerateAIFileChangeRequestBody" 
    )

# Corresponds to FileChangeIdParamsSchema in ai-file-change.schemas.ts
# Used for path parameters in routes needing projectId and aiFileChangeId
class FileChangeIdParams(BaseModel):
    project_id: str = Field(
        ..., 
        alias="projectId", 
        description="ID of the project",
        json_schema_extra={"param": {"name": "projectId", "in": "path"}, "example": "proj_1a2b3c4d"} # For OpenAPI path param
    )
    ai_file_change_id: str = Field(
        ..., 
        alias="aiFileChangeId",
        description="ID of the AI file change record",
        json_schema_extra={
            "param": {"name": "aiFileChangeId", "in": "path"}, # from .openapi()
            "example": "aifc_xyz789"
        }
    )
    model_config = ConfigDict(
        title="AIFileChangeIdParams", # from .openapi('AIFileChangeIdParams')
        populate_by_name=True, # Allows FastAPI to map path params to these fields via aliases
        extra='ignore' # Important for Depends with path params
    )

# --- Response Schemas from ai-file-change-routes.ts ---

class GenerateAIFileChangeResponse(BaseModel):
    success: Literal[True] = True
    result: AIFileChangeRecordResponse # TS: AIFileChangeRecordResponseSchema
    
    model_config = ConfigDict(
        title="GenerateAIFileChangeResponse", # from .openapi(...)
        populate_by_name=True
    )

class GetAIFileChangeDetailsResponse(BaseModel):
    success: Literal[True] = True
    file_change: AIFileChangeRecordResponse = Field(..., alias="fileChange") # TS: fileChange: AIFileChangeRecordResponseSchema
    
    model_config = ConfigDict(
        title="GetAIFileChangeDetailsResponse", # from .openapi(...)
        populate_by_name=True
    )

class ConfirmRejectResult(BaseModel):
    status: str
    message: str

class ConfirmAIFileChangeResponse(BaseModel):
    success: Literal[True] = True
    result: ConfirmRejectResult
    
    model_config = ConfigDict(
        title="ConfirmAIFileChangeResponse", # from .openapi(...)
        populate_by_name=True
    )

# Schema for common API error responses
class ErrorDetail(BaseModel):
    message: str
    code: str
    details: Dict[str, Any] = Field(default_factory=dict)

class ApiErrorResponse(BaseModel):
    success: Literal[False] = False
    error: ErrorDetail
    model_config = ConfigDict(
        title="ApiErrorResponse" # Matches ApiErrorResponseSchema.openapi('ApiErrorResponse')
    )