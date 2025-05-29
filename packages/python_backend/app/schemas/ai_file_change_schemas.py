from typing import Optional, List, Dict, Any, Literal
from pydantic import BaseModel, Field, ConfigDict, field_validator
from enum import Enum
from app.utils.storage_timestamp_utils import convert_timestamp_to_ms_int

# --- AI File Change Schemas ---

class AIFileChangeStatusEnum(str, Enum):
    PENDING = "pending"
    CONFIRMED = "confirmed"
    REJECTED = "rejected"
    # Removed FAILED to match TS schema: ['pending', 'confirmed', 'rejected']

class AIFileChangeRecord(BaseModel):
    id: int = Field(..., description="Unique ID for the AI file change record (Unix ms)", example=1678886400000)
    project_id: int = Field(..., alias="projectId", description="ID of the project this change belongs to (Unix ms)")
    file_path: str = Field(..., alias="filePath", description="Path to the file that was modified", example="src/components/Button.tsx")
    original_content: str = Field(..., alias="originalContent", description="The original content of the file before changes.")
    suggested_content: str = Field(..., alias="suggestedContent", description="The AI suggested content for the file.")
    diff: Optional[str] = Field(None, description="The diff between original and suggested content, or an explanation.")
    prompt: Optional[str] = Field(None, description="The user prompt that initiated this change.")
    status: AIFileChangeStatusEnum = Field(..., description="Status of the file change.")
    created: int = Field(..., description="Timestamp of when the change was created (Unix ms)", example=1678886400000)
    updated: int = Field(..., description="Timestamp of when the change was last updated (Unix ms)", example=1678886500000)
    explanation: Optional[str] = Field(None, description="Explanation from the AI about the change.")
    
    model_config = ConfigDict(
        title="AIFileChangeRecord",
        populate_by_name=True
    )

# Corresponds to AIFileChangeRecordSchema.openapi('AIFileChangeRecordResponse')
# This is used as the type for 'result' or 'fileChange' in successful responses.
class AIFileChangeRecordResponse(AIFileChangeRecord):
    model_config = ConfigDict(
        title="AIFileChangeRecordResponse",
        populate_by_name=True
    )

# Fixed to use string keys to match TypeScript z.record(z.string(), AIFileChangeRecordSchema)
AIFileChangesStorage = Dict[str, AIFileChangeRecord]

# Corresponds to GenerateChangeBodySchema in ai-file-change.schemas.ts (the one with projectId)
class FullGenerateChangeBody(BaseModel):
    project_id: int = Field(..., alias="projectId", description="ID of the project (Unix ms)")
    file_path: str = Field(..., min_length=1, alias="filePath", example="src/components/Button.tsx", description="Path to the file to modify")
    prompt: str = Field(..., min_length=1, example="Add hover effects to the button", description="Instruction for the AI to follow")
    
    model_config = ConfigDict(
        title="GenerateAIChangeBody",
        populate_by_name=True
    )

# This is the actual request body for the generate route: AIChangeGenerateBodySchema.omit({ projectId: true })
class GenerateAIFileChangeBody(BaseModel):
    file_path: str = Field(..., min_length=1, alias="filePath", example="src/components/Button.tsx", description="Path to the file to modify")
    prompt: str = Field(..., min_length=1, example="Add hover effects to the button", description="Instruction for the AI to follow")

    model_config = ConfigDict(
        title="GenerateAIFileChangeRequestBody",
        populate_by_name=True
    )

# Corresponds to FileChangeIdParamsSchema in ai-file-change.schemas.ts
# Used for path parameters in routes needing projectId and aiFileChangeId
class FileChangeIdParams(BaseModel):
    project_id: int = Field(..., alias="projectId", description="ID of the project (Unix ms)", json_schema_extra={"param": {"name": "projectId", "in": "path"}, "example": 1678886400001})
    ai_file_change_id: int = Field(..., alias="aiFileChangeId", description="ID of the AI file change record (Unix ms)", json_schema_extra={"param": {"name": "aiFileChangeId", "in": "path"}, "example": 1678886400002})

    model_config = ConfigDict(
        title="AIFileChangeIdParams",
        populate_by_name=True
    )

# --- Response Schemas from ai-file-change-routes.ts ---

class GenerateAIFileChangeResponse(BaseModel):
    success: Literal[True] = True
    result: AIFileChangeRecordResponse
    
    model_config = ConfigDict(
        title="GenerateAIFileChangeResponse",
        populate_by_name=True
    )

class GetAIFileChangeDetailsResponse(BaseModel):
    success: Literal[True] = True
    file_change: AIFileChangeRecordResponse = Field(..., alias="fileChange")
    
    model_config = ConfigDict(
        title="GetAIFileChangeDetailsResponse",
        populate_by_name=True
    )

class ConfirmRejectResult(BaseModel):
    status: str
    message: str

class ConfirmAIFileChangeResponse(BaseModel):
    success: Literal[True] = True
    result: ConfirmRejectResult
    
    model_config = ConfigDict(
        title="ConfirmAIFileChangeResponse",
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
    model_config = ConfigDict(title="ApiErrorResponse")