from typing import Optional, List, Dict, Any, Literal
from pydantic import BaseModel, Field, ConfigDict
from enum import Enum
from datetime import datetime

# --- AI File Change Schemas ---
# Last 5 changes:
# 1. Initial conversion from Zod to Pydantic.
# 2. Mapped z.enum to Python Enum.
# 3. Used datetime for Zod's .datetime().
# 4. Handled z.record as Dict[str, AIFileChangeRecord].
# 5. Mapped .openapi() metadata.

class AIFileChangeStatusEnum(str, Enum):
    PENDING = "pending"
    CONFIRMED = "confirmed"
    REJECTED = "rejected"

class AIFileChangeRecord(BaseModel):
    id: str = Field(..., description="Unique ID for the AI file change record", example="aifc_123abc")
    project_id: str = Field(..., validation_alias="projectId", serialization_alias="projectId", description="ID of the project this change belongs to")
    file_path: str = Field(..., validation_alias="filePath", serialization_alias="filePath", description="Path to the file that was modified", example="src/components/Button.tsx")
    original_content: str = Field(..., validation_alias="originalContent", serialization_alias="originalContent", description="The original content of the file before changes.")
    suggested_content: str = Field(..., validation_alias="suggestedContent", serialization_alias="suggestedContent", description="The AI suggested content for the file.")
    diff: Optional[str] = Field(None, description="The diff between original and suggested content, or an explanation.")
    prompt: Optional[str] = Field(None, description="The user prompt that initiated this change.")
    status: AIFileChangeStatusEnum = Field(..., description="Status of the file change.")
    created_at: datetime = Field(..., validation_alias="createdAt", serialization_alias="createdAt", description="Timestamp of when the change was created.")
    updated_at: datetime = Field(..., validation_alias="updatedAt", serialization_alias="updatedAt", description="Timestamp of when the change was last updated.")
    explanation: Optional[str] = Field(None, description="Explanation from the AI about the change.")
    model_config = ConfigDict(title="AIFileChangeRecord", populate_by_name=True)

AIFileChangesStorage = Dict[str, AIFileChangeRecord]

class GenerateChangeBody(BaseModel):
    project_id: str = Field(..., validation_alias="projectId", serialization_alias="projectId", description="ID of the project")
    file_path: str = Field(..., min_length=1, validation_alias="filePath", serialization_alias="filePath", example="src/components/Button.tsx", description="Path to the file to modify")
    prompt: str = Field(..., min_length=1, example="Add hover effects to the button", description="Instruction for the AI to follow")
    model_config = ConfigDict(title="GenerateAIChangeBody", populate_by_name=True)

class FileChangeIdParams(BaseModel):
    project_id: str = Field(..., validation_alias="projectId", serialization_alias="projectId", description="ID of the project")
    ai_file_change_id: str = Field(..., validation_alias="aiFileChangeId", serialization_alias="aiFileChangeId", json_schema_extra={"param": {"name": "aiFileChangeId", "in": "path"}, "example": "aifc_xyz789"}, description="ID of the AI file change record")
    model_config = ConfigDict(title="AIFileChangeIdParams", populate_by_name=True)
