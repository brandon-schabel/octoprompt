from typing import Optional, List, Dict, Any, Literal, Union
from pydantic import BaseModel, Field, ConfigDict, field_validator
from datetime import datetime
from enum import Enum
from app.core.config import LOW_MODEL_CONFIG as CORE_LOW_MODEL_CONFIG
from app.schemas.common_schemas import MessageRoleEnum

def convert_timestamp_to_ms_int(value: Any) -> Optional[int]:
    if value is None:
        return None
    if isinstance(value, str):
        try:
            dt_obj = datetime.fromisoformat(value.replace('Z', '+00:00'))
            return int(dt_obj.timestamp() * 1000)
        except ValueError:
            raise ValueError(f"Invalid timestamp string format: {value}")
    elif isinstance(value, (int, float)):
        return int(value)
    elif isinstance(value, datetime):
        return int(value.timestamp() * 1000)
    raise TypeError(f"Timestamp must be an ISO string, int, float, datetime, or None, got {type(value)}")

try:
    from .gen_ai_schemas import AiSdkOptions, UnifiedModel, AiMessage
except ImportError:
    class AiSdkOptions(BaseModel):
        model_config = ConfigDict(title="AiSdkOptions", extra="allow")
        pass
    class UnifiedModel(BaseModel):
        id: int
        name: str
        provider: str
        context_length: Optional[int] = None
        model_config = ConfigDict(title="UnifiedModel", extra="allow")
        pass
    class AiMessage(BaseModel):
        role: MessageRoleEnum
        content: str
        model_config = ConfigDict(title="AiMessage")

class ModelOptions(BaseModel):
    model: Optional[str] = None
    max_tokens: Optional[int] = Field(None, alias="maxTokens")
    temperature: Optional[float] = None
    top_p: Optional[float] = Field(None, alias="topP")
    top_k: Optional[int] = Field(None, alias="topK")
    frequency_penalty: Optional[float] = Field(None, alias="frequencyPenalty")
    presence_penalty: Optional[float] = Field(None, alias="presencePenalty")
    stop: Optional[Union[str, List[str]]] = None
    provider: Optional[str] = None
    model_config = ConfigDict(populate_by_name=True)

def _get_default_chat_model_config():
    config_data = CORE_LOW_MODEL_CONFIG.copy()
    return ModelOptions(**config_data)

class Chat(BaseModel):
    id: int = Field(..., example=20384029823848)
    title: str
    created: int = Field(..., example=1678442400000, description="Creation timestamp (Unix ms)")
    updated: int = Field(..., example=1678442700000, description="Last update timestamp (Unix ms)")
    model_config = ConfigDict(title="Chat")

class ChatMessage(BaseModel):
    id: int = Field(..., example=20384029823848, description="Message ID")
    chat_id: int = Field(..., alias="chatId", example=20384029823848, description="Parent Chat ID")
    role: MessageRoleEnum = Field(..., example="user", description="Role of the message sender")
    content: str = Field(..., example="Hello, world!", description="Message content")
    created: int = Field(..., example=1640995205000, description="Creation timestamp (Unix ms)")
    model_config = ConfigDict(populate_by_name=True)

class ChatIdParams(BaseModel):
    chat_id: int = Field(..., alias="chatId", description="The ID of the chat", json_schema_extra={'param': {'name': 'chatId', 'in': 'path'}, 'example': 20384029823848})
    model_config = ConfigDict(title="ChatIdParams", populate_by_name=True)

class CreateChatBody(BaseModel):
    title: str = Field(..., min_length=1, example="New Chat Session")
    copy_existing: Optional[bool] = Field(None, alias="copyExisting", description="Copy messages from currentChatId if true")
    current_chat_id: Optional[int] = Field(None, alias="currentChatId", example=20384029823848)
    model_config = ConfigDict(populate_by_name=True)

class UpdateChatBody(BaseModel):
    title: str = Field(..., min_length=1, example="Updated Chat Title")

class CreateChatMessageBody(BaseModel):
    role: str = Field(..., example="user", description="Message role (user, assistant, system)")
    content: str = Field(..., min_length=1, example="How can I implement authentication?")

class ChatResponse(BaseModel):
    success: Literal[True] = True
    data: Chat

class ChatListResponse(BaseModel):
    success: Literal[True] = True
    data: List[Chat]

class ChatMessageResponse(BaseModel):
    success: Literal[True] = True
    data: ChatMessage

class ChatMessagesListResponse(BaseModel):
    success: Literal[True] = True
    data: List[ChatMessage]

class OperationSuccessResponse(BaseModel):
    success: Literal[True] = True
    detail: Optional[str] = Field(None, example="Operation completed successfully.")

class MessageListResponse(BaseModel):
    success: Literal[True] = True
    data: List[ChatMessage]

class UnifiedModel(BaseModel):
    id: str = Field(..., description="Model identifier")
    name: str = Field(..., description="User-friendly model name")
    provider: str = Field(..., description="Provider ID")
    context_length: Optional[int] = Field(None, alias="contextLength", description="Context window size in tokens")
    model_config = ConfigDict(title="UnifiedModel", populate_by_name=True)

class ModelListResponse(BaseModel):
    success: Literal[True] = True
    data: List[UnifiedModel]

class GetMessagesParams(BaseModel):
    chat_id: int = Field(..., alias="chatId", description="The ID of the chat to retrieve messages for", json_schema_extra={'param': {'name': 'chatId', 'in': 'path'}, 'example': 20384029823848})
    model_config = ConfigDict(populate_by_name=True)

class ForkChatParams(BaseModel):
    chat_id: int = Field(..., alias="chatId", description="The ID of the chat to fork", json_schema_extra={'param': {'name': 'chatId', 'in': 'path'}, 'example': 20384029823848})
    model_config = ConfigDict(populate_by_name=True)

class ForkChatBody(BaseModel):
    excluded_message_ids: List[int] = Field(default=[], alias="excludedMessageIds", description="Optional list of message IDs to exclude from the fork", json_schema_extra={'example': [20384029823848]})
    model_config = ConfigDict(populate_by_name=True)

class ForkChatFromMessageParams(BaseModel):
    chat_id: int = Field(..., alias="chatId", description="The ID of the chat to fork", json_schema_extra={'param': {'name': 'chatId', 'in': 'path'}, 'example': 20384029823848})
    message_id: int = Field(..., alias="messageId", description="The ID of the message to fork from", json_schema_extra={'param': {'name': 'messageId', 'in': 'path'}, 'example': 20384029823849})
    model_config = ConfigDict(populate_by_name=True)

class ForkChatFromMessageBody(BaseModel):
    excluded_message_ids: List[int] = Field(default=[], alias="excludedMessageIds", description="Optional list of message IDs to exclude from the fork", json_schema_extra={'example': [20384029823848]})
    model_config = ConfigDict(populate_by_name=True)

class UpdateChatParams(BaseModel):
    chat_id: int = Field(..., alias="chatId", description="The ID of the chat to update", json_schema_extra={'param': {'name': 'chatId', 'in': 'path'}, 'example': 20384029823848})
    model_config = ConfigDict(title="UpdateChatParams", populate_by_name=True)

class DeleteChatParams(BaseModel):
    chat_id: int = Field(..., alias="chatId", description="The ID of the chat to delete", json_schema_extra={'param': {'name': 'chatId', 'in': 'path'}, 'example': 20384029823848})
    model_config = ConfigDict(title="DeleteChatParams", populate_by_name=True)

class DeleteMessageParams(BaseModel):
    chat_id: int = Field(..., alias="chatId", description="The ID of the chat containing the message", json_schema_extra={'param': {'name': 'chatId', 'in': 'path'}, 'example': 20384029823848})
    message_id: int = Field(..., alias="messageId", description="The ID of the message to delete", json_schema_extra={'param': {'name': 'messageId', 'in': 'path'}, 'example': 20384029823849})
    model_config = ConfigDict(populate_by_name=True)

class ModelsQuery(BaseModel):
    provider: str = Field(..., description="The provider to filter models by", example="openrouter")
    model_config = ConfigDict(title="ModelsQuery")

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

class AiChatStreamRequest(BaseModel):
    chat_id: int = Field(..., alias="chatId", example=20384029823848, description="Required ID of the chat session to continue.")
    user_message: str = Field(..., min_length=1, alias="userMessage", description="The latest message content from the user.", example="Thanks! Can you elaborate on the E=mc^2 part?")
    options: Optional[AiSdkOptions] = Field(None, description="Optional parameters for the AI model.")
    system_message: Optional[str] = Field(None, alias="systemMessage", example="Respond concisely.", description="Optional system message override for this specific request.")
    temp_id: Optional[int] = Field(None, alias="tempId", example=1677657600000, description="Temporary client-side ID for optimistic UI updates.")
    debug: Optional[bool] = Field(None, example=True, description="Enable debug mode for detailed logging.")
    model_config = ConfigDict(title="AiChatStreamRequest", populate_by_name=True)

class ExtendedChatMessage(BaseModel):
    id: Optional[int] = Field(None, example=20384029823848, description="Message ID")
    chat_id: int = Field(..., alias="chatId", example=20384029823848, description="Parent Chat ID")
    role: MessageRoleEnum = Field(..., example="user", description="Role of the message sender")
    content: str = Field(..., example="Hello, world!", description="Message content")
    created: Optional[int] = Field(None, example=1640995205000, description="Creation timestamp (Unix ms)")
    temp_id: Optional[int] = Field(None, alias="tempId")
    model_config = ConfigDict(title="ExtendedChatMessage", populate_by_name=True)

