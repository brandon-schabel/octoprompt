import asyncio
import json
import os
import uuid
from datetime import datetime
from enum import Enum
from pathlib import Path
from typing import Dict, Any, TypeVar, Type, Literal, Optional

from pydantic import BaseModel, ValidationError, field_validator

# --- Directory and File Constants ---
# Matches process.cwd(), 'data', 'chat_storage'
DATA_DIR = Path.cwd() / "data" / "chat_storage"
CHAT_DATA_SUBDIR = "chat_data"

# --- Pydantic Schemas ---

class MessageRoleEnum(str, Enum):
    USER = "user"
    ASSISTANT = "assistant"
    SYSTEM = "system"
    TOOL = "tool" # Assuming 'tool' based on common patterns

class Chat(BaseModel):
    id: str
    title: str
    createdAt: datetime
    updatedAt: datetime

class ChatMessage(BaseModel):
    id: str
    chatId: str
    role: MessageRoleEnum
    content: str
    createdAt: datetime

    @field_validator('createdAt', mode='before')
    @classmethod
    def parse_datetime(cls, value: Any) -> datetime:
        if isinstance(value, str):
            return datetime.fromisoformat(value.replace('Z', '+00:00'))
        return value

# Storage Schemas
ChatsStorage = Dict[str, Chat]
ChatMessagesStorage = Dict[str, ChatMessage]

T = TypeVar('T', bound=BaseModel) # Type variable for Pydantic models
StorageType = TypeVar('StorageType') # Type variable for storage dicts (e.g. ChatsStorage)


# --- Path Helpers ---

def get_chats_index_path() -> Path:
    """Gets the absolute path to the main chats index file."""
    return DATA_DIR / "chats.json"

def get_chat_data_dir(chat_id: str) -> Path:
    """Gets the absolute path to a specific chat's data directory."""
    return DATA_DIR / CHAT_DATA_SUBDIR / chat_id

def get_chat_messages_path(chat_id: str) -> Path:
    """Gets the absolute path to a specific chat's messages file."""
    return get_chat_data_dir(chat_id) / "messages.json"


# --- Core Read/Write Functions ---

async def ensure_dir_exists(dir_path: Path) -> None:
    """Ensures the specified directory exists."""
    if not dir_path.exists():
        try:
            # equivalent to fs.mkdir(dirPath, { recursive: true })
            os.makedirs(dir_path, exist_ok=True)
        except OSError as e:
            # Consider more specific error handling if needed
            print(f"Error creating directory {dir_path}: {e}")
            raise IOError(f"Failed to ensure directory exists: {dir_path}") from e

async def read_validated_json(
    file_path: Path,
    schema: Type[StorageType], # Expecting Dict[str, Model]
    model_type: Type[T],      # Pydantic model for values in the dict
    default_value: StorageType
) -> StorageType:
    """Reads and validates JSON data from a file.
    
    Args:
        file_path: Path to the JSON file.
        schema: The type of the expected dictionary (e.g., Dict[str, Chat]).
        model_type: The Pydantic model for items in the dictionary.
        default_value: Value to return if file not found or validation fails.
    Returns:
        Validated data or default value.
    """
    await ensure_dir_exists(file_path.parent)
    if not file_path.exists():
        return default_value
    
    try:
        async with asyncio.to_thread(file_path.read_text, encoding='utf-8') as f_content:
            raw_data = json.loads(f_content)
        
        # Validate each item in the dictionary
        validated_data = {}
        if not isinstance(raw_data, dict):
            print(f"Data in {file_path} is not a dictionary. Returning default.")
            return default_value

        for key, value in raw_data.items():
            try:
                validated_data[key] = model_type.model_validate(value)
            except ValidationError as e:
                print(f"Zod-like validation failed for item '{key}' in {file_path}: {e.errors()}")
                print(f"Returning default value due to validation failure for {file_path}.")
                return default_value # Or handle partially valid data
        return validated_data # type: ignore
    except FileNotFoundError:
        return default_value
    except json.JSONDecodeError as e:
        print(f"Error decoding JSON from {file_path}: {e}")
        return default_value
    except Exception as e: # Catch any other errors during read/parse
        print(f"Error reading or parsing JSON from {file_path}: {e}")
        # In TS, this threw an error. Here, we return default to match schema,
        # but logging is important.
        return default_value


async def write_validated_json(
    file_path: Path,
    data: StorageType, # Data is Dict[str, PydanticModelInstance]
    model_type: Type[T] # Pydantic model for values
) -> StorageType:
    """Validates data (implicitly, as it should already be Dict[str, ModelInstance]) and writes it to a JSON file.
    
    Pydantic models are validated on instantiation. This function primarily handles serialization.
    The original TS function did a schema.safeParseAsync(data) before writing.
    Here, we assume 'data' is already composed of validated Pydantic model instances.
    We will serialize them using model_dump.
    """
    await ensure_dir_exists(file_path.parent)
    
    try:
        # Serialize Pydantic models to dicts for JSON
        data_to_write = {key: value.model_dump(mode='json') for key, value in data.items()} # type: ignore
        
        json_string = json.dumps(data_to_write, indent=2)
        
        async def write_file():
            with open(file_path, 'w', encoding='utf-8') as f:
                f.write(json_string)
        
        await asyncio.to_thread(write_file)
        return data
    except Exception as e: # Broad catch, can be more specific
        print(f"Error writing JSON to {file_path}: {e}")
        # The original TS code re-threw ZodError or a new Error.
        # Depending on desired behavior, could raise a custom error here.
        raise IOError(f"Failed to write JSON file at {file_path}. Reason: {str(e)}")


# --- Specific Data Accessors ---

class ChatStorage:
    async def read_chats(self) -> ChatsStorage:
        """Reads the main chats metadata file."""
        return await read_validated_json(
            get_chats_index_path(), 
            ChatsStorage, # Expected type: Dict[str, Chat]
            Chat,         # Model type for values
            {}
        )

    async def write_chats(self, chats: ChatsStorage) -> ChatsStorage:
        """Writes the main chats metadata file."""
        return await write_validated_json(
            get_chats_index_path(), 
            chats,
            Chat
        )

    async def read_chat_messages(self, chat_id: str) -> ChatMessagesStorage:
        """Reads a specific chat's messages file."""
        return await read_validated_json(
            get_chat_messages_path(chat_id), 
            ChatMessagesStorage, # Expected type: Dict[str, ChatMessage]
            ChatMessage,         # Model type for values
            {}
        )

    async def write_chat_messages(
        self, chat_id: str, messages: ChatMessagesStorage
    ) -> ChatMessagesStorage:
        """Writes a specific chat's messages file."""
        return await write_validated_json(
            get_chat_messages_path(chat_id), 
            messages,
            ChatMessage
        )

    async def delete_chat_data(self, chat_id: str) -> None:
        """Deletes a chat's data directory (including its messages.json)."""
        dir_path = get_chat_data_dir(chat_id)
        if not dir_path.exists():
            print(f"Chat data directory not found, nothing to delete: {dir_path}")
            return

        try:
            # For removing a directory and its contents, shutil.rmtree is typically used.
            # Doing it with Pathlib and os for async compatibility or manual recursion:
            async def remove_dir_contents(p: Path):
                for child in p.iterdir():
                    if child.is_file():
                        os.remove(child)
                    elif child.is_dir():
                        # If subdirectories could exist and need removal.
                        # For messages.json, this is not strictly necessary.
                        # await remove_dir_contents(child) # if recursive needed
                        # os.rmdir(child) # after contents removed
                        pass # Not expecting sub-dirs in CHAT_DATA_SUBDIR/chat_id/
                os.rmdir(p)
            
            # More robust: use shutil.rmtree in a thread
            import shutil
            await asyncio.to_thread(shutil.rmtree, dir_path)

        except FileNotFoundError: # Should be caught by dir_path.exists() already
             print(f"Chat data directory not found during deletion attempt: {dir_path}")
        except OSError as e:
            print(f"Error deleting chat data directory {dir_path}: {e}")
            raise IOError(f"Failed to delete chat data directory: {dir_path}. Reason: {str(e)}")

    def generate_id(self, prefix: str) -> str:
        """Generates a unique ID."""
        return f"{prefix}_{uuid.uuid4()}"

# Instantiate the storage utility
chat_storage = ChatStorage()

# Example usage (optional, for testing):
async def main_test():
    # Ensure data directory exists for testing
    if not DATA_DIR.exists():
        DATA_DIR.mkdir(parents=True, exist_ok=True)

    test_chat_id = chat_storage.generate_id("chat")
    test_msg_id = chat_storage.generate_id("msg")

    # Create a sample chat
    new_chat = Chat(
        id=test_chat_id,
        title="Test Chat",
        createdAt=datetime.now(),
        updatedAt=datetime.now()
    )
    
    # Create a sample message
    new_message = ChatMessage(
        id=test_msg_id,
        chatId=test_chat_id,
        role=MessageRoleEnum.USER,
        content="Hello from Python!",
        createdAt=datetime.now()
    )

    # --- Test Chats ---
    print("Testing chats...")
    initial_chats = await chat_storage.read_chats()
    print(f"Initial chats: {initial_chats}")

    initial_chats[new_chat.id] = new_chat
    await chat_storage.write_chats(initial_chats)
    print(f"Chats after adding one: {await chat_storage.read_chats()}")
    
    # --- Test Messages ---
    print("\nTesting messages...")
    chat_messages_path = get_chat_messages_path(test_chat_id) # for checking
    
    # Ensure chat specific dir exists before writing messages
    await ensure_dir_exists(get_chat_data_dir(test_chat_id))
    
    initial_messages = await chat_storage.read_chat_messages(test_chat_id)
    print(f"Initial messages for {test_chat_id} (path: {chat_messages_path}): {initial_messages}")

    initial_messages[new_message.id] = new_message
    await chat_storage.write_chat_messages(test_chat_id, initial_messages)
    print(f"Messages after adding one: {await chat_storage.read_chat_messages(test_chat_id)}")

    # --- Test Deletion ---
    print("\nTesting deletion...")
    await chat_storage.delete_chat_data(test_chat_id)
    print(f"Chat data directory exists after deletion: {get_chat_data_dir(test_chat_id).exists()}")
    
    # Clean up main chats.json if the test chat was added
    current_chats = await chat_storage.read_chats()
    if test_chat_id in current_chats:
        del current_chats[test_chat_id]
        await chat_storage.write_chats(current_chats)
    print(f"Chats after cleanup: {await chat_storage.read_chats()}")


if __name__ == "__main__":
    # This setup is for running the test directly.
    # In a FastAPI app, you'd import and use chat_storage instance.
    
    # Create a dummy data dir if it doesn't exist for the test
    if not DATA_DIR.exists():
        print(f"Creating {DATA_DIR} for test...")
        DATA_DIR.mkdir(parents=True, exist_ok=True)
        
    asyncio.run(main_test())
