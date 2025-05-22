# packages/python_backend/app/utils/storage/chat_storage.py
# 1. IDs (Chat.id, ChatMessage.id, ChatMessage.chatId) changed to int (Unix ms).
# 2. Timestamps (Chat.created, Chat.updated, ChatMessage.created) changed to int (Unix ms).
# 3. generate_id updated to return int timestamp.
# 4. Pydantic field_validators updated/added for int conversion and backward compatibility.
# 5. read_validated_json and write_validated_json adapted for int keys in dicts.
# 6. Example usage in main_test updated.
# 7. Imported time.

import asyncio
import json
import os
import uuid # Kept for now, but generate_id uses time
import time
from datetime import datetime, timezone # Added timezone
from enum import Enum
from pathlib import Path
from typing import Dict, Any, TypeVar, Type, Literal, Optional

from pydantic import BaseModel, ValidationError, field_validator
from app.utils.storage_timestap_utils import convert_timestamp_to_ms_int, convert_id_to_int

# --- Directory and File Constants ---
DATA_DIR = Path.cwd() / "data" / "chat_storage"
CHAT_DATA_SUBDIR = "chat_data"

# --- Pydantic Schemas ---

class MessageRoleEnum(str, Enum):
    USER = "user"; ASSISTANT = "assistant"; SYSTEM = "system"; TOOL = "tool"



class Chat(BaseModel):
    id: int
    title: str
    created: int # Unix timestamp in milliseconds
    updated: int # Unix timestamp in milliseconds

    _validate_id = field_validator('id', mode='before')(convert_id_to_int)
    _validate_timestamps = field_validator('created', 'updated', mode='before')(convert_timestamp_to_ms_int)

class ChatMessage(BaseModel):
    id: int
    chatId: int
    role: MessageRoleEnum
    content: str
    created: int # Unix timestamp in milliseconds

    _validate_ids = field_validator('id', 'chatId', mode='before')(convert_id_to_int)
    _validate_timestamp = field_validator('created', mode='before')(convert_timestamp_to_ms_int)

# Storage Schemas (keys are now int)
ChatsStorage = Dict[int, Chat]
ChatMessagesStorage = Dict[int, ChatMessage]

T = TypeVar('T', bound=BaseModel)
StorageType = TypeVar('StorageType') # Generic for Dict[int, T] or List[T]

# --- Path Helpers ---
def get_chats_index_path() -> Path: return DATA_DIR / "chats.json"
def get_chat_data_dir(chat_id: int) -> Path: return DATA_DIR / CHAT_DATA_SUBDIR / str(chat_id)
def get_chat_messages_path(chat_id: int) -> Path: return get_chat_data_dir(chat_id) / "messages.json"

# --- Core Read/Write Functions ---
async def ensure_dir_exists(dir_path: Path) -> None:
    if not dir_path.exists():
        try: os.makedirs(dir_path, exist_ok=True)
        except OSError as e: print(f"Error creating directory {dir_path}: {e}"); raise IOError(f"Failed to ensure directory exists: {dir_path}") from e

async def read_validated_json(
    file_path: Path,
    # schema: Type[StorageType], # Not directly used if model_type is for items
    model_type: Type[T],       # Pydantic model for values in dict or items in list
    default_value: StorageType # Helps determine if a dict or list is expected
) -> StorageType:
    await ensure_dir_exists(file_path.parent)
    if not file_path.exists(): return default_value

    try:
        # Using `Path.read_text` in a thread for async compatibility
        file_content = await asyncio.to_thread(file_path.read_text, encoding='utf-8')
        if not file_content.strip(): return default_value # Handle empty file
        raw_data = json.loads(file_content)
        
        if isinstance(default_value, dict) and isinstance(raw_data, dict): # Expecting Dict[int, T]
            validated_data: Dict[int, T] = {}
            for key_str, value_data in raw_data.items():
                try:
                    key_int = int(key_str) # JSON keys are strings, convert to int
                    validated_data[key_int] = model_type.model_validate(value_data)
                except (ValueError, ValidationError) as e: print(f"Skipping item '{key_str}' in {file_path} due to key/validation error: {e}")
            return validated_data # type: ignore
        elif isinstance(default_value, list) and isinstance(raw_data, list): # Expecting List[T]
             validated_list: List[T] = []
             for item_data in raw_data:
                 try: validated_list.append(model_type.model_validate(item_data))
                 except ValidationError as e: print(f"Skipping item in {file_path} due to validation error: {e}")
             return validated_list # type: ignore
        else: # Fallback or single model object (if default_value indicates that)
            print(f"Data structure in {file_path} or default_value type mismatch. Trying direct validation.")
            if isinstance(raw_data, (dict,list)): return model_type.model_validate(raw_data) # type: ignore
            return default_value


    except FileNotFoundError: return default_value
    except json.JSONDecodeError as e: print(f"Error decoding JSON from {file_path}: {e}"); return default_value
    except Exception as e: print(f"Error reading/parsing JSON from {file_path}: {e}"); return default_value

async def write_validated_json(
    file_path: Path,
    data: StorageType, # Data is Dict[int, PydanticModelInstance] or List[PydanticModelInstance]
    # model_type: Type[T] # Not strictly needed if data is already Pydantic instances
) -> StorageType:
    await ensure_dir_exists(file_path.parent)
    try:
        data_to_write: Any
        if isinstance(data, dict): # Assumes Dict[int, PydanticModel]
            data_to_write = {str(key): value.model_dump(mode='json') for key, value in data.items()}
        elif isinstance(data, list): # Assumes List[PydanticModel]
            data_to_write = [item.model_dump(mode='json') for item in data]
        elif isinstance(data, BaseModel): # Single Pydantic Model
            data_to_write = data.model_dump(mode='json')
        else: raise TypeError("Data to write must be a dict/list of Pydantic models or a single model.")
            
        json_string = json.dumps(data_to_write, indent=2)
        
        async def _write_file():
            with open(file_path, 'w', encoding='utf-8') as f: f.write(json_string)
        await asyncio.to_thread(_write_file)
        return data
    except Exception as e: print(f"Error writing JSON to {file_path}: {e}"); raise IOError(f"Failed to write JSON: {file_path}") from e

# --- Specific Data Accessors ---
class ChatStorage:
    async def read_chats(self) -> ChatsStorage:
        return await read_validated_json(get_chats_index_path(), Chat, {})

    async def write_chats(self, chats: ChatsStorage) -> ChatsStorage:
        return await write_validated_json(get_chats_index_path(), chats)

    async def read_chat_messages(self, chat_id: int) -> ChatMessagesStorage:
        return await read_validated_json(get_chat_messages_path(chat_id), ChatMessage, {})

    async def write_chat_messages(self, chat_id: int, messages: ChatMessagesStorage) -> ChatMessagesStorage:
        return await write_validated_json(get_chat_messages_path(chat_id), messages)

    async def delete_chat_data(self, chat_id: int) -> None:
        dir_path = get_chat_data_dir(chat_id)
        if not dir_path.exists(): print(f"Chat data directory not found: {dir_path}"); return
        try:
            import shutil
            await asyncio.to_thread(shutil.rmtree, dir_path)
        except OSError as e: print(f"Error deleting chat data dir {dir_path}: {e}"); raise IOError(f"Failed to delete dir: {dir_path}") from e

    def generate_id(self) -> int: # Removed prefix
        return int(time.time() * 1000)

chat_storage = ChatStorage()

# Example usage (optional, for testing):
async def main_test():
    if not DATA_DIR.exists(): DATA_DIR.mkdir(parents=True, exist_ok=True)

    test_chat_id = chat_storage.generate_id() # Now int
    test_msg_id = chat_storage.generate_id()  # Now int
    current_time_ms = int(datetime.now(timezone.utc).timestamp() * 1000)

    new_chat = Chat(id=test_chat_id, title="Test Chat", created=current_time_ms, updated=current_time_ms)
    new_message = ChatMessage(id=test_msg_id, chatId=test_chat_id, role=MessageRoleEnum.USER, content="Hello!", created=current_time_ms)

    print("Testing chats...")
    initial_chats = await chat_storage.read_chats()
    initial_chats[new_chat.id] = new_chat
    await chat_storage.write_chats(initial_chats)
    print(f"Chats after adding: {await chat_storage.read_chats()}")
    
    print("\nTesting messages...")
    await ensure_dir_exists(get_chat_data_dir(test_chat_id)) # Ensure dir for messages
    initial_messages = await chat_storage.read_chat_messages(test_chat_id)
    initial_messages[new_message.id] = new_message
    await chat_storage.write_chat_messages(test_chat_id, initial_messages)
    print(f"Messages after adding: {await chat_storage.read_chat_messages(test_chat_id)}")

    print("\nTesting deletion...")
    await chat_storage.delete_chat_data(test_chat_id)
    print(f"Chat data dir exists after deletion: {get_chat_data_dir(test_chat_id).exists()}")
    
    current_chats_after_delete = await chat_storage.read_chats()
    if test_chat_id in current_chats_after_delete:
        del current_chats_after_delete[test_chat_id]
        await chat_storage.write_chats(current_chats_after_delete)
    print(f"Chats after cleanup: {await chat_storage.read_chats()}")

if __name__ == "__main__":
    if not DATA_DIR.exists(): DATA_DIR.mkdir(parents=True, exist_ok=True)
    asyncio.run(main_test())