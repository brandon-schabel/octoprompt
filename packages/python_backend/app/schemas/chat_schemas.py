from typing import Optional, List, Dict, Any, Literal, Union
from pydantic import BaseModel, Field, ConfigDict, field_validator
from datetime import datetime
from enum import Enum
from app.core.config import LOW_MODEL_CONFIG as CORE_LOW_MODEL_CONFIG

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
    from .common_schemas import MessageRoleEnum
except ImportError:
    class MessageRoleEnum(str, Enum):
        USER = "user"
        ASSISTANT = "assistant"
        SYSTEM = "system"
        TOOL = "tool"
        FUNCTION = "function"

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
    max_tokens: Optional[int] = Field(None, validation_alias="maxTokens", serialization_alias="maxTokens")
    temperature: Optional[float] = None
    top_p: Optional[float] = Field(None, validation_alias="topP", serialization_alias="topP")
    top_k: Optional[int] = Field(None, validation_alias="topK", serialization_alias="topK")
    frequency_penalty: Optional[float] = Field(None, validation_alias="frequencyPenalty", serialization_alias="frequencyPenalty")
    presence_penalty: Optional[float] = Field(None, validation_alias="presencePenalty", serialization_alias="presencePenalty")
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
    chat_model_config: ModelOptions = Field(default_factory=_get_default_chat_model_config)
    model_config = ConfigDict(title="Chat", populate_by_name=True)

class ChatMessage(BaseModel):
    id: int = Field(..., example=20384029823848, description="Message ID")
    chatId: int = Field(..., example=20384029823848, description="Parent Chat ID")
    role: MessageRoleEnum = Field(..., example="user", description="Role of the message sender")
    content: str = Field(..., example="Hello, world!", description="Message content")
    created: int = Field(..., example=1640995205000, description="Creation timestamp (Unix ms)")

class ChatIdParams(BaseModel):
    chat_id: int = Field(..., validation_alias="chatId", serialization_alias="chatId", description="The ID of the chat", json_schema_extra={'param': {'name': 'chatId', 'in': 'path'}, 'example': 20384029823848})
    model_config = ConfigDict(title="ChatIdParams", populate_by_name=True)

class CreateChatBody(BaseModel):
    title: str = Field(..., min_length=1, example="New Chat Session")
    copy_existing: Optional[bool] = Field(None, alias="copyExisting", description="Copy messages from currentChatId if true")
    current_chat_id: Optional[int] = Field(None, alias="currentChatId", example=20384029823848)
    chat_model_config: Optional[ModelOptions] = Field(None, alias="modelConfig", description="Optional model configuration for the chat")

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

class ModelListResponse(BaseModel):
    success: Literal[True] = True
    data: List[UnifiedModel]

class GetMessagesParams(BaseModel):
    chat_id: int = Field(..., validation_alias="chatId", serialization_alias="chatId", description="The ID of the chat to retrieve messages for", json_schema_extra={'param': {'name': 'chatId', 'in': 'path'}, 'example': 20384029823848})

class ForkChatParams(BaseModel):
    chat_id: int = Field(..., validation_alias="chatId", serialization_alias="chatId", description="The ID of the chat to fork", json_schema_extra={'param': {'name': 'chatId', 'in': 'path'}, 'example': 20384029823848})

class ForkChatBody(BaseModel):
    excluded_message_ids: List[int] = Field(default=[], validation_alias="excludedMessageIds", serialization_alias="excludedMessageIds", description="Optional list of message IDs to exclude from the fork", json_schema_extra={'example': [20384029823848]})

class ForkChatFromMessageParams(BaseModel):
    chat_id: int = Field(..., validation_alias="chatId", serialization_alias="chatId", description="The ID of the chat to fork", json_schema_extra={'param': {'name': 'chatId', 'in': 'path'}, 'example': 20384029823848})
    message_id: int = Field(..., validation_alias="messageId", serialization_alias="messageId", description="The ID of the message to fork from", json_schema_extra={'param': {'name': 'messageId', 'in': 'path'}, 'example': 20384029823849})

class ForkChatFromMessageBody(BaseModel):
    excluded_message_ids: List[int] = Field(default=[], validation_alias="excludedMessageIds", serialization_alias="excludedMessageIds", description="Optional list of message IDs to exclude from the fork", json_schema_extra={'example': [20384029823848]})

class UpdateChatParams(BaseModel):
    chat_id: int = Field(..., validation_alias="chatId", serialization_alias="chatId", description="The ID of the chat to update", json_schema_extra={'param': {'name': 'chatId', 'in': 'path'}, 'example': 20384029823848})
    model_config = ConfigDict(title="UpdateChatParams", populate_by_name=True)

class DeleteChatParams(BaseModel):
    chat_id: int = Field(..., validation_alias="chatId", serialization_alias="chatId", description="The ID of the chat to delete", json_schema_extra={'param': {'name': 'chatId', 'in': 'path'}, 'example': 20384029823848})
    model_config = ConfigDict(title="DeleteChatParams", populate_by_name=True)

class DeleteMessageParams(BaseModel):
    chat_id: int = Field(..., validation_alias="chatId", serialization_alias="chatId", description="The ID of the chat containing the message", json_schema_extra={'param': {'name': 'chatId', 'in': 'path'}, 'example': 20384029823848})
    message_id: int = Field(..., validation_alias="messageId", serialization_alias="messageId", description="The ID of the message to delete", json_schema_extra={'param': {'name': 'messageId', 'in': 'path'}, 'example': 20384029823849})

class ModelsQuery(BaseModel):
    provider: str = Field(..., description="The provider to filter models by", example="openrouter") # Example from LOW_MODEL_CONFIG.provider
    model_config = ConfigDict(title="ModelsQuery")

class AiChatStreamRequest(BaseModel):
    chat_id: int = Field(..., validation_alias="chatId", serialization_alias="chatId", example=20384029823848, description="Required ID of the chat session to continue.")
    user_message: str = Field(..., min_length=1, validation_alias="userMessage", serialization_alias="userMessage", description="The latest message content from the user.", example="Thanks! Can you elaborate on the E=mc^2 part?")
    options: Optional[AiSdkOptions] = Field(None, description="Optional parameters for the AI model.")
    system_message: Optional[str] = Field(None, validation_alias="systemMessage", serialization_alias="systemMessage", example="Respond concisely.", description="Optional system message override for this specific request.")
    temp_id: Optional[str] = Field(None, validation_alias="tempId", serialization_alias="tempId", example="temp_msg_456", description="Temporary client-side ID for optimistic UI updates.")
    debug: Optional[bool] = Field(None, example=True, description="Enable debug mode for detailed logging.")
    model_config = ConfigDict(title="AiChatStreamRequest", populate_by_name=True)

class ExtendedChatMessage(BaseModel):
    id: Optional[int] = Field(None, example=20384029823848, description="Message ID")
    chatId: int = Field(..., validation_alias="chatId", serialization_alias="chatId", example=20384029823848, description="Parent Chat ID")
    role: MessageRoleEnum = Field(..., example="user", description="Role of the message sender")
    content: str = Field(..., example="Hello, world!", description="Message content")
    created: Optional[int] = Field(None, validation_alias="created", serialization_alias="created", example=1640995205000, description="Creation timestamp (Unix ms)")
    temp_id: Optional[str] = Field(None, validation_alias="tempId", serialization_alias="tempId")
    model_config = ConfigDict(title="ExtendedChatMessage", populate_by_name=True)

