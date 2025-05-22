from typing import Optional, List, Dict, Any, Literal, Union
from pydantic import BaseModel, Field, ConfigDict, field_validator
from datetime import datetime
from enum import Enum

# --- Chat Schemas ---
# Last 5 changes:
# 1. Initial conversion from Zod to Pydantic.
# 2. Added try-except import placeholders for common_schemas and gen_ai_schemas.
# 3. Used datetime for Zod's .datetime().
# 4. Mapped z.enum to Python Enum and z.literal to Literal.
# 5. Handled .openapi() metadata (title, example, param details via json_schema_extra and aliases).
# 6. Changed datetime fields to int (Unix ms) and added validators.

# Validator for timestamps (int Unix ms)
def convert_timestamp_to_ms_int(value: Any) -> int:
    if isinstance(value, str):
        try:
            # Handle ISO format strings, including those with 'Z'
            dt_obj = datetime.fromisoformat(value.replace('Z', '+00:00'))
            return int(dt_obj.timestamp() * 1000)
        except ValueError:
            raise ValueError(f"Invalid timestamp string format: {value}")
    elif isinstance(value, (int, float)):
        return int(value) # Assume it's already in ms or can be directly converted
    elif isinstance(value, datetime):
        return int(value.timestamp() * 1000)
    raise TypeError(f"Timestamp must be an ISO string, int, float, or datetime, got {type(value)}")

# Assuming these are available from other schema files in the Python backend
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
    model_config = ConfigDict(populate_by_name=True)

class Chat(BaseModel):
    id: int = Field(..., example=20384029823848)
    title: str
    created: int = Field(..., validation_alias="created", serialization_alias="created", example=1678442400000) # Unix ms
    updated: int = Field(..., validation_alias="updated", serialization_alias="updated", example=1678442700000) # Unix ms
    model_config = ConfigDict(title="Chat", populate_by_name=True)

    _validate_timestamps = field_validator('created', 'updated', mode='before')(convert_timestamp_to_ms_int)

class ChatMessage(BaseModel):
    id: int = Field(..., min_length=1, example=20384029823848, description="Message ID")
    chat_id: int = Field(..., min_length=1, validation_alias="chatId", serialization_alias="chatId", example="chat-a1b2c3d4", description="Parent Chat ID")
    role: MessageRoleEnum = Field(..., example="user", description="Role of the message sender")
    content: str = Field(..., example="Hello, world!", description="Message content")
    created: int = Field(..., validation_alias="created", serialization_alias="created", example=1640995205000, description="Creation timestamp (Unix ms)") # Unix ms
    model_config = ConfigDict(title="ChatMessage", populate_by_name=True)

    _validate_timestamp = field_validator('created', mode='before')(convert_timestamp_to_ms_int)

class ChatIdParams(BaseModel):
    chat_id: int = Field(..., min_length=1, validation_alias="chatId", serialization_alias="chatId", description="The ID of the chat", json_schema_extra={'param': {'name': 'chatId', 'in': 'path'}, 'example': "chat_1a2b3c4d"})
    model_config = ConfigDict(title="ChatIdParams", populate_by_name=True)

class CreateChatBody(BaseModel):
    title: str = Field(..., min_length=1, example="New Chat Session")
    copy_existing: Optional[bool] = Field(None, validation_alias="copyExisting", serialization_alias="copyExisting", description="Copy messages from currentChatId if true")
    current_chat_id: Optional[str] = Field(None, min_length=1, validation_alias="currentChatId", serialization_alias="currentChatId", example="chat-a1b2c3d4")
    model_config = ConfigDict(title="CreateChatRequestBody", populate_by_name=True)

class UpdateChatBody(BaseModel):
    title: str = Field(..., min_length=1, example="Updated Chat Title")
    model_config = ConfigDict(title="UpdateChatRequestBody")

class CreateChatMessageBody(BaseModel):
    role: str = Field(..., example="user", description="Message role (user, assistant, system)")
    content: str = Field(..., min_length=1, example="How can I implement authentication?")
    model_config = ConfigDict(title="CreateChatMessageRequestBody")

class ChatResponse(BaseModel):
    success: Literal[True] = True
    data: Chat
    model_config = ConfigDict(title="ChatResponse")

class ChatListResponse(BaseModel):
    success: Literal[True] = True
    data: List[Chat]
    model_config = ConfigDict(title="ChatListResponse")

class ChatMessageResponse(BaseModel):
    success: Literal[True] = True
    data: ChatMessage
    model_config = ConfigDict(title="ChatMessageResponse")

class ChatMessagesListResponse(BaseModel):
    success: Literal[True] = True
    data: List[ChatMessage]
    model_config = ConfigDict(title="ChatMessagesListResponse")

class OperationSuccessResponse(BaseModel):
    success: Literal[True] = True
    detail: Optional[str] = Field(None, example="Operation completed successfully.")
    model_config = ConfigDict(title="OperationSuccessResponse")

class MessageListResponse(BaseModel):
    success: Literal[True] = True
    data: List[ChatMessage]
    model_config = ConfigDict(title="MessageListResponse")

class ModelListResponse(BaseModel):
    success: Literal[True] = True
    data: List[UnifiedModel]
    model_config = ConfigDict(title="ModelListResponse")

class GetMessagesParams(BaseModel):
    chat_id: int = Field(..., min_length=1, validation_alias="chatId", serialization_alias="chatId", description="The ID of the chat to retrieve messages for", json_schema_extra={'param': {'name': 'chatId', 'in': 'path'}, 'example': "chat-a1b2c3d4"})
    model_config = ConfigDict(title="GetMessagesParams", populate_by_name=True)

class ForkChatParams(BaseModel):
    chat_id: int = Field(..., min_length=1, validation_alias="chatId", serialization_alias="chatId", description="The ID of the chat to fork", json_schema_extra={'param': {'name': 'chatId', 'in': 'path'}, 'example': "chat-a1b2c3d4"})
    model_config = ConfigDict(title="ForkChatParams", populate_by_name=True)

class ForkChatBody(BaseModel):
    excluded_message_ids: List[str] = Field(default=[], validation_alias="excludedMessageIds", serialization_alias="excludedMessageIds", description="Optional list of message IDs to exclude from the fork", json_schema_extra={'example': ["msg-m1a2b3c4"]})
    model_config = ConfigDict(title="ForkChatRequestBody", populate_by_name=True)

class ForkChatFromMessageParams(BaseModel):
    chat_id: int = Field(..., min_length=1, validation_alias="chatId", serialization_alias="chatId", description="The ID of the chat to fork", json_schema_extra={'param': {'name': 'chatId', 'in': 'path'}, 'example': "chat-a1b2c3d4"})
    message_id: int = Field(..., min_length=1, validation_alias="messageId", serialization_alias="messageId", description="The ID of the message to fork from", json_schema_extra={'param': {'name': 'messageId', 'in': 'path'}, 'example': "msg-m1a2b3c4"})
    model_config = ConfigDict(title="ForkChatFromMessageParams", populate_by_name=True)

class ForkChatFromMessageBody(BaseModel):
    excluded_message_ids: List[str] = Field(default=[], validation_alias="excludedMessageIds", serialization_alias="excludedMessageIds", description="Optional list of message IDs to exclude from the fork", json_schema_extra={'example': ["msg-m1a2b3c4"]})
    model_config = ConfigDict(title="ForkChatFromMessageRequestBody", populate_by_name=True)

class UpdateChatParams(BaseModel):
    chat_id: int = Field(..., min_length=1, validation_alias="chatId", serialization_alias="chatId", description="The ID of the chat to update", json_schema_extra={'param': {'name': 'chatId', 'in': 'path'}, 'example': "chat-a1b2c3d4"})
    model_config = ConfigDict(title="UpdateChatParams", populate_by_name=True)

class DeleteChatParams(BaseModel):
    chat_id: int = Field(..., min_length=1, validation_alias="chatId", serialization_alias="chatId", description="The ID of the chat to delete", json_schema_extra={'param': {'name': 'chatId', 'in': 'path'}, 'example': "chat-a1b2c3d4"})
    model_config = ConfigDict(title="DeleteChatParams", populate_by_name=True)

class DeleteMessageParams(BaseModel):
    chat_id: int = Field(..., min_length=1, validation_alias="chatId", serialization_alias="chatId", description="The ID of the chat to delete", json_schema_extra={'param': {'name': 'chatId', 'in': 'path'}, 'example': "chat-a1b2c3d4"})
    message_id: int = Field(..., min_length=1, validation_alias="messageId", serialization_alias="messageId", description="The ID of the message to delete", json_schema_extra={'param': {'name': 'messageId', 'in': 'path'}, 'example': "msg-m1a2b3c4"})
    model_config = ConfigDict(title="DeleteMessageParams", populate_by_name=True)

class ModelsQuery(BaseModel):
    provider: str = Field(..., description="The provider to filter models by", example="openrouter") # Example from LOW_MODEL_CONFIG.provider
    model_config = ConfigDict(title="ModelsQuery")

class AiChatStreamRequest(BaseModel):
    chat_id: int = Field(..., min_length=1, validation_alias="chatId", serialization_alias="chatId", example="chat-a1b2c3d4", description="Required ID of the chat session to continue.")
    user_message: str = Field(..., min_length=1, validation_alias="userMessage", serialization_alias="userMessage", description="The latest message content from the user.", example="Thanks! Can you elaborate on the E=mc^2 part?")
    options: Optional[AiSdkOptions] = Field(None, description="Optional parameters for the AI model.")
    system_message: Optional[str] = Field(None, validation_alias="systemMessage", serialization_alias="systemMessage", example="Respond concisely.", description="Optional system message override for this specific request.")
    temp_id: Optional[str] = Field(None, validation_alias="tempId", serialization_alias="tempId", example="temp_msg_456", description="Temporary client-side ID for optimistic UI updates.")
    debug: Optional[bool] = Field(None, example=True, description="Enable debug mode for detailed logging.")
    model_config = ConfigDict(title="AiChatStreamRequest", populate_by_name=True)

class ExtendedChatMessage(ChatMessage):
    temp_id: Optional[str] = Field(None, validation_alias="tempId", serialization_alias="tempId")
    model_config = ConfigDict(populate_by_name=True)
