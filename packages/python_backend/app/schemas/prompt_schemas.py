from typing import Optional, List, Dict, Any, Literal
from pydantic import BaseModel, Field, ConfigDict, field_validator
from enum import Enum
from datetime import datetime

# --- Prompt Schemas ---
# Last 5 changes:
# 1. Initial conversion from Zod to Pydantic.
# 2. Handled .datetime(), .optional(), .refine() (with model_validator).
# 3. Mapped .openapi() metadata including param details.
# 4. Created Pydantic models for all request/response bodies and params.
# 5. Imported ProjectIdParams placeholder.

# Placeholder for ProjectIdParamsSchema if it were in a different file
# from .project_schemas import ProjectIdParamsSchema # Assuming this path
class ProjectIdParams(BaseModel):
    project_id: str = Field(..., min_length=1, validation_alias="projectId", serialization_alias="projectId", json_schema_extra={"param": {"name": "projectId", "in": "path"}}, example="project-abc", description="The ID of the project")
    model_config = ConfigDict(populate_by_name=True)

class Prompt(BaseModel):
    id: str = Field(..., min_length=1, example="p1a2b3c4-e5f6-7890-1234-567890abcdef", description="Prompt ID")
    name: str = Field(..., example="Code Refactoring Prompt", description="Prompt name")
    content: str = Field(..., example="Refactor the following code to be more efficient: {code}", description="Prompt content template")
    project_id: Optional[str] = Field(None, min_length=1, validation_alias="projectId", serialization_alias="projectId", example="project-123", description="Optional Project ID this prompt is linked to (contextual)")
    created_at: datetime = Field(..., validation_alias="createdAt", serialization_alias="createdAt", example="2024-02-01T10:00:00.000Z", description="Creation timestamp (ISO 8601)")
    updated_at: datetime = Field(..., validation_alias="updatedAt", serialization_alias="updatedAt", example="2024-02-01T10:05:00.000Z", description="Last update timestamp (ISO 8601)")
    model_config = ConfigDict(title="Prompt", populate_by_name=True)

class CreatePromptBody(BaseModel):
    project_id: Optional[str] = Field(None, min_length=1, validation_alias="projectId", serialization_alias="projectId", example="project-456", description="Optional Project ID to link the prompt to upon creation")
    name: str = Field(..., min_length=1, example="My New Prompt")
    content: str = Field(..., min_length=1, example="Translate this text: {text}")
    model_config = ConfigDict(title="CreatePromptRequestBody", populate_by_name=True)

class UpdatePromptBody(BaseModel):
    name: Optional[str] = Field(None, min_length=1, example="Updated Prompt Name")
    content: Optional[str] = Field(None, min_length=1, example="Updated content: {variable}")

    from pydantic import model_validator
    @model_validator(mode='after')
    def check_at_least_one_field(self):
        if not self.name and not self.content:
            raise ValueError("At least one of name or content must be provided for update")
        return self
    model_config = ConfigDict(title="UpdatePromptRequestBody")

class PromptIdParams(BaseModel):
    prompt_id: str = Field(..., min_length=1, validation_alias="promptId", serialization_alias="promptId", json_schema_extra={"param": {"name": "promptId", "in": "path"}}, example="p1a2b3c4-e5f6-7890-1234-567890abcdef", description="The ID of the prompt")
    model_config = ConfigDict(title="PromptIdParams", populate_by_name=True)

class ProjectAndPromptIdParams(BaseModel):
    project_id: str = Field(..., min_length=1, validation_alias="projectId", serialization_alias="projectId", json_schema_extra={"param": {"name": "projectId", "in": "path"}}, example="project-abc", description="The ID of the project")
    prompt_id: str = Field(..., min_length=1, validation_alias="promptId", serialization_alias="promptId", json_schema_extra={"param": {"name": "promptId", "in": "path"}}, example="p1a2b3c4-e5f6-7890-1234-567890abcdef", description="The ID of the prompt")
    model_config = ConfigDict(title="ProjectAndPromptIdParams", populate_by_name=True)

class PromptResponse(BaseModel):
    success: Literal[True] = True
    data: Prompt
    model_config = ConfigDict(title="PromptResponse")

class PromptListResponse(BaseModel):
    success: Literal[True] = True
    data: List[Prompt]
    model_config = ConfigDict(title="PromptListResponse")

class OptimizeUserInputRequest(BaseModel):
    project_id: str = Field(..., min_length=1, validation_alias="projectId", serialization_alias="projectId", example="project-123", description="The ID of the project")
    user_context: str = Field(..., min_length=1, validation_alias="userContext", serialization_alias="userContext", example="Make my login form better.", description="The user's initial prompt or context to be optimized.")
    model_config = ConfigDict(title="OptimizePromptRequest", populate_by_name=True)

class OptimizedPromptData(BaseModel):
    optimized_prompt: str = Field(..., validation_alias="optimizedPrompt", serialization_alias="optimizedPrompt", example="Optimize the user experience for the login form, focusing on clarity, security, and accessibility. Suggest improvements for field labels, error handling, password requirements display, and button text.", description="The optimized prompt generated by the service.")
    model_config = ConfigDict(populate_by_name=True)

class OptimizePromptResponse(BaseModel):
    success: Literal[True] = Field(..., description="Indicates successful optimization")
    data: OptimizedPromptData
    model_config = ConfigDict(title="OptimizePromptResponse")

class PromptProject(BaseModel):
    id: str
    prompt_id: str = Field(..., validation_alias="promptId", serialization_alias="promptId")
    project_id: str = Field(..., validation_alias="projectId", serialization_alias="projectId")
    model_config = ConfigDict(populate_by_name=True)
