# app/services/chat_service.py
from datetime import datetime, timezone
import uuid
from typing import List, Optional
from app.schemas.chat_schemas import Chat, ChatMessage, ExtendedChatMessage, CreateChatBody, MessageRoleEnum # and other relevant schemas
from app.utils.storage import chat_storage # The Python chat_storage module
from app.core.custom_errors import ApiError # Custom error class
from pydantic import ValidationError

# Last 5 changes:
# 1. Initial translation structure from TS.
# 2. Integrated Pydantic schemas for validation and data types.
# 3. Adapted storage calls to chat_storage.py equivalents.
# 4. Implemented Pythonic error handling with ApiError.
# 5. Used datetime for timestamps.

class ChatService:
    async def _update_chat_timestamp(self, chat_id: str) -> None:
        all_chats = await chat_storage.read_chats()
        chat_entry = all_chats.data.get(chat_id) # Assuming ChatsStorage.data is the dict
        if not chat_entry:
            raise ApiError(status_code=404, detail=f"Chat with ID {chat_id} not found for timestamp update.", error_code='CHAT_NOT_FOUND')
        chat_entry.updated_at = datetime.now(timezone.utc)
        try:
            Chat.model_validate(chat_entry) # Re-validate
            await chat_storage.write_chats(all_chats)
        except ValidationError as e:
            # Log e.errors()
            raise ApiError(status_code=500, detail=f"Validation failed updating chat timestamp for {chat_id}.", error_code='CHAT_VALIDATION_ERROR', dev_details=e.errors())

    async def create_chat(self, title: str, options: Optional[dict] = None) -> Chat:
        chat_id = chat_storage.generate_id("chat")
        now = datetime.now(timezone.utc)
        new_chat_data = Chat(id=chat_id, title=title, created_at=now, updated_at=now)
        # Pydantic model_validate would happen on instantiation or via parse_obj
        # No need for explicit Chat.model_validate(new_chat_data) unless data is from untrusted source before this point

        all_chats = await chat_storage.read_chats()
        if options and options.get("copyExisting") and options.get("currentChatId"):
            current_chat_id = options["currentChatId"]
            if current_chat_id not in all_chats.data: # Assuming ChatsStorage.data
                raise ApiError(status_code=404, detail=f"Referenced chat {current_chat_id} not found.", error_code='REFERENCED_CHAT_NOT_FOUND')
        if chat_id in all_chats.data:
             raise ApiError(status_code=509, detail=f"Chat ID conflict for {chat_id}", error_code='CHAT_ID_CONFLICT')

        all_chats.data[chat_id] = new_chat_data # Add to the dict within ChatsStorage model
        await chat_storage.write_chats(all_chats)
        await chat_storage.write_chat_messages(chat_id, {"data": {}}) # Initialize empty messages (assuming ChatMessagesStorage has a 'data' field for the dict)

        if options and options.get("copyExisting") and options.get("currentChatId"):
            source_messages_storage = await chat_storage.read_chat_messages(options["currentChatId"])
            messages_to_copy_data = {}
            for msg_id, msg_data in source_messages_storage.data.items():
                new_msg_id = chat_storage.generate_id("msg")
                copied_msg = msg_data.model_copy(update={"id": new_msg_id, "chat_id": chat_id}) # Pydantic's copy method
                # ChatMessage.model_validate(copied_msg) implicitly done by copy and update if types are correct
                messages_to_copy_data[new_msg_id] = copied_msg
            if messages_to_copy_data:
                await chat_storage.write_chat_messages(chat_id, {"data": messages_to_copy_data})
        return new_chat_data

    async def save_message(self, message: ExtendedChatMessage) -> ExtendedChatMessage:
        all_chats = await chat_storage.read_chats()
        if message.chat_id not in all_chats.data:
            raise ApiError(status_code=404, detail=f"Chat {message.chat_id} not found.", error_code='CHAT_NOT_FOUND_FOR_MESSAGE')

        message_id = message.id or chat_storage.generate_id("msg")
        now = datetime.now(timezone.utc)

        # Ensure role is valid if coming as string
        valid_role = MessageRoleEnum(message.role) if isinstance(message.role, str) else message.role

        final_message_data = ChatMessage(
            id=message_id,
            chat_id=message.chat_id,
            role=valid_role,
            content=message.content,
            created_at=message.created_at or now
        )
        # Pydantic validation happens on instantiation

        chat_messages_storage = await chat_storage.read_chat_messages(message.chat_id)
        if message_id in chat_messages_storage.data and message.id: # If ID was provided and exists
             print(f"Warning: Message with ID {message_id} already exists in chat {message.chat_id}. Overwriting.")

        chat_messages_storage.data[message_id] = final_message_data
        await chat_storage.write_chat_messages(message.chat_id, chat_messages_storage)
        await self._update_chat_timestamp(message.chat_id)
        return ExtendedChatMessage(**final_message_data.model_dump(), temp_id=message.temp_id)

    # ... other methods like get_all_chats, get_chat_messages, update_chat, delete_chat, etc.
    # These will call the respective chat_storage functions and perform business logic.
    # Example:
    async def get_all_chats(self) -> List[Chat]:
        chats_storage = await chat_storage.read_chats()
        chat_list = list(chats_storage.data.values())
        chat_list.sort(key=lambda c: c.updated_at, reverse=True)
        return chat_list

    async def get_chat_messages(self, chat_id: str) -> List[ChatMessage]:
        all_chats = await chat_storage.read_chats()
        if chat_id not in all_chats.data:
            raise ApiError(status_code=404, detail=f"Chat with ID {chat_id} not found.", error_code='CHAT_NOT_FOUND')
        messages_storage = await chat_storage.read_chat_messages(chat_id)
        message_list = list(messages_storage.data.values())
        message_list.sort(key=lambda m: m.created_at)
        return message_list

    async def delete_chat(self, chat_id: str) -> None:
        all_chats = await chat_storage.read_chats()
        if chat_id not in all_chats.data:
            raise ApiError(status_code=404, detail=f"Chat {chat_id} not found for deletion.", error_code='CHAT_NOT_FOUND')
        del all_chats.data[chat_id]
        await chat_storage.write_chats(all_chats)
        await chat_storage.delete_chat_data(chat_id) # Delete messages file/dir

    async def fork_chat(self, source_chat_id: str, excluded_message_ids: List[str] = None) -> Chat:
        # ... similar logic to TS version, using Python objects and Pydantic ...
        pass

    async def fork_chat_from_message(self, source_chat_id: str, message_id: str, excluded_message_ids: List[str] = None) -> Chat:
        # ... similar logic to TS version ...
        pass