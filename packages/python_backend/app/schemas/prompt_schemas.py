from typing import Optional, List, Dict, Any, Literal
from pydantic import BaseModel, Field, ConfigDict, field_validator, model_validator
from enum import Enum
from app.utils.storage_timestap_utils import convert_timestamp_to_ms_int, convert_id_to_int, convert_optional_id_to_int

# --- Prompt Schemas ---
# Last 5 changes:
# 1. Initial conversion from Zod to Pydantic.
# 2. Handled .datetime(), .optional(), .refine() (with model_validator).
# 3. Mapped .openapi() metadata including param details.
# 4. Created Pydantic models for all request/response bodies and params.
# 5. Imported ProjectIdParams placeholder.
# 6. Changed ID and timestamp fields to int (Unix ms) and added validators.

# Placeholder for ProjectIdParamsSchema if it were in a different file
# from .project_schemas import ProjectIdParamsSchema # Assuming this path
class ProjectIdParams(BaseModel):
    project_id: int = Field(..., validation_alias="projectId", serialization_alias="projectId", json_schema_extra={"param": {"name": "projectId", "in": "path"}}, example=1677657600000, description="The ID of the project (Unix ms)")
    model_config = ConfigDict(populate_by_name=True)
    _validate_project_id = field_validator('project_id', mode='before')(convert_id_to_int)

class Prompt(BaseModel):
    id: int = Field(..., example=1675248000000, description="Prompt ID (Unix ms)")
    name: str = Field(..., example="Code Refactoring Prompt", description="Prompt name")
    content: str = Field(..., example="Refactor the following code to be more efficient: {code}", description="Prompt content template")
    project_id: Optional[int] = Field(None, validation_alias="projectId", serialization_alias="projectId", example=1677657600000, description="Optional Project ID this prompt is linked to (Unix ms)")
    created: int = Field(..., validation_alias="created", serialization_alias="created", example=1675248000000, description="Creation timestamp (Unix ms)")
    updated: int = Field(..., validation_alias="updated", serialization_alias="updated", example=1675248300000, description="Last update timestamp (Unix ms)")
    model_config = ConfigDict(title="Prompt", populate_by_name=True)

    _validate_id = field_validator('id', mode='before')(convert_id_to_int)
    _validate_project_id = field_validator('project_id', mode='before')(convert_optional_id_to_int)
    _validate_timestamps = field_validator('created', 'updated', mode='before')(convert_timestamp_to_ms_int)

class CreatePromptBody(BaseModel):
    project_id: Optional[int] = Field(None, validation_alias="projectId", serialization_alias="projectId", example=1677657600000, description="Optional Project ID to link the prompt to upon creation (Unix ms)")
    name: str = Field(..., min_length=1, example="My New Prompt")
    content: str = Field(..., min_length=1, example="Translate this text: {text}")
    model_config = ConfigDict(title="CreatePromptRequestBody", populate_by_name=True)

    _validate_project_id = field_validator('project_id', mode='before')(convert_optional_id_to_int)

class UpdatePromptBody(BaseModel):
    name: Optional[str] = Field(None, min_length=1, example="Updated Prompt Name")
    content: Optional[str] = Field(None, min_length=1, example="Updated content: {variable}")

    @model_validator(mode='after')
    def check_at_least_one_field(self):
        if not self.name and not self.content:
            raise ValueError("At least one of name or content must be provided for update")
        return self
    model_config = ConfigDict(title="UpdatePromptRequestBody")

class PromptIdParams(BaseModel):
    prompt_id: int = Field(..., validation_alias="promptId", serialization_alias="promptId", json_schema_extra={"param": {"name": "promptId", "in": "path"}}, example=1675248000000, description="The ID of the prompt (Unix ms)")
    model_config = ConfigDict(title="PromptIdParams", populate_by_name=True)
    _validate_prompt_id = field_validator('prompt_id', mode='before')(convert_id_to_int)

class ProjectAndPromptIdParams(BaseModel):
    project_id: int = Field(..., validation_alias="projectId", serialization_alias="projectId", json_schema_extra={"param": {"name": "projectId", "in": "path"}}, example=1677657600000, description="The ID of the project (Unix ms)")
    prompt_id: int = Field(..., validation_alias="promptId", serialization_alias="promptId", json_schema_extra={"param": {"name": "promptId", "in": "path"}}, example=1675248000000, description="The ID of the prompt (Unix ms)")
    model_config = ConfigDict(title="ProjectAndPromptIdParams", populate_by_name=True)
    _validate_ids = field_validator('project_id', 'prompt_id', mode='before')(convert_id_to_int)

class PromptResponse(BaseModel):
    success: Literal[True] = True
    data: Prompt
    model_config = ConfigDict(title="PromptResponse")

class PromptListResponse(BaseModel):
    success: Literal[True] = True
    data: List[Prompt]
    model_config = ConfigDict(title="PromptListResponse")

class OptimizeUserInputRequest(BaseModel):
    project_id: int = Field(..., validation_alias="projectId", serialization_alias="projectId", example=1677657600000, description="The ID of the project (Unix ms)")
    user_context: str = Field(..., min_length=1, validation_alias="userContext", serialization_alias="userContext", example="Make my login form better.", description="The user's initial prompt or context to be optimized.")
    model_config = ConfigDict(title="OptimizePromptRequest", populate_by_name=True)
    _validate_project_id = field_validator('project_id', mode='before')(convert_id_to_int)

class OptimizedPromptData(BaseModel):
    optimized_prompt: str = Field(..., validation_alias="optimizedPrompt", serialization_alias="optimizedPrompt", example="Optimize the user experience for the login form, focusing on clarity, security, and accessibility. Suggest improvements for field labels, error handling, password requirements display, and button text.", description="The optimized prompt generated by the service.")
    model_config = ConfigDict(populate_by_name=True)

class OptimizePromptResponse(BaseModel):
    success: Literal[True] = Field(..., description="Indicates successful optimization")
    data: OptimizedPromptData
    model_config = ConfigDict(title="OptimizePromptResponse")

class PromptProject(BaseModel):
    id: int
    prompt_id: int = Field(..., validation_alias="promptId", serialization_alias="promptId")
    project_id: int = Field(..., validation_alias="projectId", serialization_alias="projectId")
    created: Optional[int] = Field(None, validation_alias="created", serialization_alias="created")
    model_config = ConfigDict(populate_by_name=True)

    _validate_ids = field_validator('id', 'prompt_id', 'project_id', mode='before')(convert_id_to_int)
    _validate_created_at = field_validator('created', mode='before')(convert_timestamp_to_ms_int)
