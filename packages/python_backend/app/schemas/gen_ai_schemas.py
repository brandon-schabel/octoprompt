from typing import Optional, List, Dict, Any, Literal, Union
from pydantic import BaseModel, Field, ConfigDict
from enum import Enum
from .common_schemas import MessageRoleEnum
from .project_schemas import ProjectFile

# --- Schema for individual messages ---
class AiMessage(BaseModel):
    role: MessageRoleEnum
    content: str

    model_config = ConfigDict(title="AiMessage")

# --- Schema for AI SDK Options ---
class AiSdkOptions(BaseModel):
    temperature: Optional[float] = Field(None, ge=0, le=2, description="Controls randomness of output")
    max_tokens: Optional[int] = Field(None, gt=0, description="Maximum tokens to generate")
    top_p: Optional[float] = Field(None, ge=0, le=1, description="Controls diversity via nucleus sampling")
    frequency_penalty: Optional[float] = Field(None, ge=-2, le=2, description="Penalty for token frequency")
    presence_penalty: Optional[float] = Field(None, ge=-2, le=2, description="Penalty for token presence")
    top_k: Optional[int] = Field(None, gt=0, description="Restricts token choices to top k")
    stop: Optional[Union[str, List[str]]] = Field(None, description="Stop sequences")
    response_format: Optional[Dict[str, Any]] = Field(None, description="Response format specification")
    provider: Optional[str] = Field(None, description="AI provider")
    model: Optional[str] = Field(None, description="Model identifier")


# --- Schema for Available Models ---
class UnifiedModel(BaseModel):
    id: int = Field(..., description="Model identifier")
    name: str = Field(..., description="User-friendly model name")
    provider: str = Field(..., description="Provider ID")
    context_length: Optional[int] = Field(None, description="Context window size in tokens")

    model_config = ConfigDict(title="UnifiedModel")

class ModelsListResponse(BaseModel):
    success: Literal[True] = True
    data: List[UnifiedModel]

    model_config = ConfigDict(title="ModelsListResponse")

# --- Schema for Text Generation ---
class AiGenerateTextRequest(BaseModel):
    prompt: str = Field(..., min_length=1, description="The text prompt for the AI")
    options: Optional[AiSdkOptions] = Field(None, description="Optional model parameters")
    system_message: Optional[str] = Field(None, description="Optional system message")

    model_config = ConfigDict(title="AiGenerateTextRequest")

class AiTextResponseData(BaseModel):
    text: str

class AiGenerateTextResponse(BaseModel):
    success: Literal[True] = True
    data: AiTextResponseData

    model_config = ConfigDict(title="AiGenerateTextResponse")

# --- Schema for Structured Data Generation ---
class BaseStructuredDataConfig(BaseModel):
    name: str = Field(..., min_length=1)
    description: str = Field(..., min_length=1)
    model_settings: Optional[AiSdkOptions] = None
    system_prompt: Optional[str] = None
    prompt_template: Optional[str] = Field(None, min_length=1)

    model_config = ConfigDict(title="BaseStructuredDataConfig")

class FilenameSuggestionOutput(BaseModel):
    suggestions: List[str] = Field(..., min_items=5, max_items=5)
    reasoning: Optional[str] = None

    model_config = ConfigDict(title="FilenameSuggestionOutput")

class BasicSummaryOutput(BaseModel):
    summary: str = Field(..., description="The generated summary.")

    model_config = ConfigDict(title="BasicSummaryOutput")

class AiGenerateStructuredRequest(BaseModel):
    schema_key: str = Field(..., min_length=1)
    user_input: str = Field(..., min_length=1)
    options: Optional[AiSdkOptions] = None

    model_config = ConfigDict(title="AiGenerateStructuredRequest")

class AiStructuredResponseData(BaseModel):
    output: Any

class AiGenerateStructuredResponse(BaseModel):
    success: Literal[True] = True
    data: AiStructuredResponseData

    model_config = ConfigDict(title="AiGenerateStructuredResponse")

# --- File-related schemas ---
class FileSuggestions(BaseModel):
    file_ids: List[str]

    model_config = ConfigDict(title="FileSuggestions")

# --- Response schemas ---
class FileSummaryListResponse(BaseModel):
    success: Literal[True] = True
    data: List[ProjectFile]

    model_config = ConfigDict(title="FileSummaryListResponse")

class SummarizeFilesResponse(BaseModel):
    success: Literal[True] = True
    included: int
    skipped: int
    updated_files: List[ProjectFile]
    message: str

    model_config = ConfigDict(title="SummarizeFilesResponse")

class RemoveSummariesResponse(BaseModel):
    success: Literal[True] = True
    removed_count: int
    message: str

    model_config = ConfigDict(title="RemoveSummariesResponse")

class SuggestFilesResponse(BaseModel):
    success: Literal[True] = True
    recommended_file_ids: List[str] = Field(..., min_length=1)

    model_config = ConfigDict(title="SuggestFilesResponse")
