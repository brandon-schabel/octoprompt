from typing import Optional, List, Dict, Any, Literal, Union
from pydantic import BaseModel, Field, ConfigDict
from enum import Enum
from .common_schemas import MessageRoleEnum
from .project_schemas import ProjectFile

class AiMessage(BaseModel):
    role: MessageRoleEnum
    content: str
    model_config = ConfigDict(title="AiMessage")

class AiSdkOptions(BaseModel):
    temperature: Optional[float] = Field(None, ge=0, le=2, description="Controls randomness of output")
    max_tokens: Optional[int] = Field(None, gt=0, alias="maxTokens", description="Maximum tokens to generate")
    top_p: Optional[float] = Field(None, ge=0, le=1, alias="topP", description="Controls diversity via nucleus sampling")
    frequency_penalty: Optional[float] = Field(None, ge=-2, le=2, alias="frequencyPenalty", description="Penalty for token frequency")
    presence_penalty: Optional[float] = Field(None, ge=-2, le=2, alias="presencePenalty", description="Penalty for token presence")
    top_k: Optional[int] = Field(None, gt=0, alias="topK", description="Restricts token choices to top k")
    stop: Optional[Union[str, List[str]]] = Field(None, description="Stop sequences")
    response_format: Optional[Dict[str, Any]] = Field(None, alias="responseFormat", description="Response format specification")
    provider: Optional[str] = Field(None, description="AI provider")
    model: Optional[str] = Field(None, description="Model identifier")
    model_config = ConfigDict(populate_by_name=True)

class UnifiedModel(BaseModel):
    id: str = Field(..., description="Model identifier")
    name: str = Field(..., description="User-friendly model name")
    provider: str = Field(..., description="Provider ID")
    context_length: Optional[int] = Field(None, alias="contextLength", description="Context window size in tokens")
    model_config = ConfigDict(title="UnifiedModel", populate_by_name=True)

class ModelsListResponse(BaseModel):
    success: Literal[True] = True
    data: List[UnifiedModel]
    model_config = ConfigDict(title="ModelsListResponse")

class AiGenerateTextRequest(BaseModel):
    prompt: str = Field(..., min_length=1, description="The text prompt for the AI")
    options: Optional[AiSdkOptions] = Field(None, description="Optional model parameters")
    system_message: Optional[str] = Field(None, alias="systemMessage", description="Optional system message")
    model_config = ConfigDict(title="AiGenerateTextRequest", populate_by_name=True)

class AiTextResponseData(BaseModel):
    text: str

class AiGenerateTextResponse(BaseModel):
    success: Literal[True] = True
    data: AiTextResponseData
    model_config = ConfigDict(title="AiGenerateTextResponse")

class BaseStructuredDataConfig(BaseModel):
    name: str = Field(..., min_length=1)
    description: str = Field(..., min_length=1)
    model_settings: Optional[AiSdkOptions] = Field(None, alias="modelSettings")
    system_prompt: Optional[str] = Field(None, alias="systemPrompt")
    prompt_template: Optional[str] = Field(None, min_length=1, alias="promptTemplate")
    model_config = ConfigDict(title="BaseStructuredDataConfig", populate_by_name=True)

class FilenameSuggestionOutput(BaseModel):
    suggestions: List[int] = Field(..., min_items=5, max_items=5)
    reasoning: Optional[str] = None
    model_config = ConfigDict(title="FilenameSuggestionOutput")

class BasicSummaryOutput(BaseModel):
    summary: str = Field(..., description="The generated summary.")
    model_config = ConfigDict(title="BasicSummaryOutput")

class AiGenerateStructuredRequest(BaseModel):
    schema_key: str = Field(..., min_length=1, alias="schemaKey")
    user_input: str = Field(..., min_length=1, alias="userInput")
    options: Optional[AiSdkOptions] = None
    model_config = ConfigDict(title="AiGenerateStructuredRequest", populate_by_name=True)

class AiStructuredResponseData(BaseModel):
    output: Any

class AiGenerateStructuredResponse(BaseModel):
    success: Literal[True] = True
    data: AiStructuredResponseData
    model_config = ConfigDict(title="AiGenerateStructuredResponse")

class FileSuggestions(BaseModel):
    file_ids: List[int] = Field(..., alias="fileIds")
    model_config = ConfigDict(title="FileSuggestions", populate_by_name=True)

class FileSummaryListResponse(BaseModel):
    success: Literal[True] = True
    data: List[ProjectFile]
    model_config = ConfigDict(title="FileSummaryListResponse")

class SummarizeFilesResponse(BaseModel):
    success: Literal[True] = True
    included: int
    skipped: int
    updated_files: List[ProjectFile] = Field(..., alias="updatedFiles")
    message: str
    model_config = ConfigDict(title="SummarizeFilesResponse", populate_by_name=True)

class RemoveSummariesResponse(BaseModel):
    success: Literal[True] = True
    removed_count: int = Field(..., alias="removedCount")
    message: str
    model_config = ConfigDict(title="RemoveSummariesResponse", populate_by_name=True)

class SuggestFilesResponse(BaseModel):
    success: Literal[True] = True
    recommended_file_ids: List[int] = Field(..., min_length=1, alias="recommendedFileIds")
    model_config = ConfigDict(title="SuggestFilesResponse", populate_by_name=True)