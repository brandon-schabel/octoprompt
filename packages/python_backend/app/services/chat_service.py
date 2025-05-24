# app/services/chat_service.py
from datetime import datetime, timezone
import time
from typing import List, Optional
from app.schemas.chat_schemas import (
    Chat, ChatMessage, ExtendedChatMessage, CreateChatBody, MessageRoleEnum, ModelOptions
)
from app.utils.storage.chat_storage import chat_storage
from app.error_handling.api_error import ApiError
from app.core.config import LOW_MODEL_CONFIG
from pydantic import ValidationError

class ChatService:
    async def _update_chat_timestamp(self, chat_id: int) -> None:
        all_chats = await chat_storage.read_chats()
        chat_entry = all_chats.get(chat_id)
        if not chat_entry:
            raise ApiError(status=404, message=f"Chat with ID {chat_id} not found for timestamp update.", code='CHAT_NOT_FOUND')
        now_ms = int(datetime.now(timezone.utc).timestamp() * 1000)
        chat_entry = chat_entry.model_copy(update={"updated": now_ms})
        all_chats[chat_id] = chat_entry
        await chat_storage.write_chats(all_chats)

    async def create_chat(self, title: str, copy_existing: Optional[bool] = None, current_chat_id: Optional[int] = None, model_config: Optional[ModelOptions] = None) -> Chat:
        chat_id = chat_storage.generate_id()
        now_ms = int(datetime.now(timezone.utc).timestamp() * 1000)
        chat_model_config = model_config or ModelOptions(**LOW_MODEL_CONFIG)
        new_chat_data = Chat(id=chat_id, title=title, created=now_ms, updated=now_ms, chat_model_config=chat_model_config)
        all_chats = await chat_storage.read_chats()
        if copy_existing and current_chat_id:
            if current_chat_id not in all_chats:
                raise ApiError(status=404, message=f"Referenced chat {current_chat_id} not found.", code='REFERENCED_CHAT_NOT_FOUND')
        if chat_id in all_chats:
            raise ApiError(status=409, message=f"Chat ID conflict for {chat_id}", code='CHAT_ID_CONFLICT')

        all_chats[chat_id] = new_chat_data
        await chat_storage.write_chats(all_chats)
        await chat_storage.write_chat_messages(chat_id, {})

        if copy_existing and current_chat_id:
            source_messages = await chat_storage.read_chat_messages(current_chat_id)
            messages_to_copy = {}
            for msg_id, msg_data in source_messages.items():
                new_msg_id = chat_storage.generate_id()
                copied_msg = msg_data.model_copy(update={"id": new_msg_id, "chatId": chat_id})
                messages_to_copy[new_msg_id] = copied_msg
            if messages_to_copy:
                await chat_storage.write_chat_messages(chat_id, messages_to_copy)
        return new_chat_data

    async def save_message(self, message: ExtendedChatMessage) -> ExtendedChatMessage:
        all_chats = await chat_storage.read_chats()
        chat_id = int(message.chat_id) if hasattr(message, 'chat_id') else int(message.chatId)
        if chat_id not in all_chats:
            raise ApiError(status=404, message=f"Chat {chat_id} not found.", code='CHAT_NOT_FOUND_FOR_MESSAGE')

        message_id = message.id or chat_storage.generate_id()
        now_ms = int(datetime.now(timezone.utc).timestamp() * 1000)
        valid_role = MessageRoleEnum(message.role) if isinstance(message.role, str) else message.role
        final_message_data = ChatMessage(id=message_id, chatId=chat_id, role=valid_role, content=message.content, created=message.created or now_ms)
        chat_messages = await chat_storage.read_chat_messages(chat_id)
        chat_messages[message_id] = final_message_data
        await chat_storage.write_chat_messages(chat_id, chat_messages)
        await self._update_chat_timestamp(chat_id)
        return ExtendedChatMessage(**final_message_data.model_dump(), temp_id=getattr(message, 'temp_id', None))

    async def get_all_chats(self) -> List[Chat]:
        chats_storage = await chat_storage.read_chats()
        chat_list = list(chats_storage.values())
        chat_list.sort(key=lambda c: c.updated, reverse=True)
        return chat_list

    async def get_chat_messages(self, chat_id: int) -> List[ChatMessage]:
        all_chats = await chat_storage.read_chats()
        if chat_id not in all_chats:
            raise ApiError(status=404, message=f"Chat with ID {chat_id} not found.", code='CHAT_NOT_FOUND')
        messages = await chat_storage.read_chat_messages(chat_id)
        message_list = list(messages.values())
        message_list.sort(key=lambda m: m.created)
        return message_list

    async def update_chat(self, chat_id: int, title: str) -> Chat:
        all_chats = await chat_storage.read_chats()
        if chat_id not in all_chats:
            raise ApiError(status=404, message=f"Chat {chat_id} not found for update.", code='CHAT_NOT_FOUND')
        now_ms = int(datetime.now(timezone.utc).timestamp() * 1000)
        updated_chat = all_chats[chat_id].model_copy(update={"title": title, "updated": now_ms})
        all_chats[chat_id] = updated_chat
        await chat_storage.write_chats(all_chats)
        return updated_chat

    async def delete_chat(self, chat_id: int) -> None:
        all_chats = await chat_storage.read_chats()
        if chat_id not in all_chats:
            raise ApiError(status=404, message=f"Chat {chat_id} not found for deletion.", code='CHAT_NOT_FOUND')
        del all_chats[chat_id]
        await chat_storage.write_chats(all_chats)
        await chat_storage.delete_chat_data(chat_id)

    async def delete_message(self, chat_id: int, message_id: int) -> None:
        all_chats = await chat_storage.read_chats()
        if chat_id not in all_chats:
            raise ApiError(status=404, message=f"Chat {chat_id} not found.", code='CHAT_NOT_FOUND')
        messages = await chat_storage.read_chat_messages(chat_id)
        if message_id not in messages:
            raise ApiError(status=404, message=f"Message {message_id} not found in chat {chat_id}.", code='MESSAGE_NOT_FOUND')
        del messages[message_id]
        await chat_storage.write_chat_messages(chat_id, messages)
        await self._update_chat_timestamp(chat_id)

    async def fork_chat(self, source_chat_id: int, excluded_message_ids: List[int] = None) -> Chat:
        excluded_message_ids = excluded_message_ids or []
        all_chats = await chat_storage.read_chats()
        if source_chat_id not in all_chats:
            raise ApiError(status=404, message=f"Source chat {source_chat_id} not found.", code='SOURCE_CHAT_NOT_FOUND')
        source_chat = all_chats[source_chat_id]
        fork_title = f"Fork of {source_chat.title}"
        new_chat = await self.create_chat(fork_title)
        source_messages = await chat_storage.read_chat_messages(source_chat_id)
        messages_to_copy = {}
        for msg_id, msg_data in source_messages.items():
            if msg_id not in excluded_message_ids:
                new_msg_id = chat_storage.generate_id()
                copied_msg = msg_data.model_copy(update={"id": new_msg_id, "chatId": new_chat.id})
                messages_to_copy[new_msg_id] = copied_msg
        if messages_to_copy:
            await chat_storage.write_chat_messages(new_chat.id, messages_to_copy)
        return new_chat

    async def fork_chat_from_message(self, source_chat_id: int, message_id: int, excluded_message_ids: List[int] = None) -> Chat:
        excluded_message_ids = excluded_message_ids or []
        all_chats = await chat_storage.read_chats()
        if source_chat_id not in all_chats:
            raise ApiError(status=404, message=f"Source chat {source_chat_id} not found.", code='SOURCE_CHAT_NOT_FOUND')
        source_chat = all_chats[source_chat_id]
        source_messages = await chat_storage.read_chat_messages(source_chat_id)
        if message_id not in source_messages:
            raise ApiError(status=404, message=f"Message {message_id} not found in chat {source_chat_id}.", code='MESSAGE_NOT_FOUND')
        fork_title = f"Fork of {source_chat.title} from message"
        new_chat = await self.create_chat(fork_title)
        messages_to_copy = {}
        target_message = source_messages[message_id]
        target_timestamp = target_message.created
        for msg_id, msg_data in source_messages.items():
            if (msg_data.created <= target_timestamp and msg_id not in excluded_message_ids):
                new_msg_id = chat_storage.generate_id()
                copied_msg = msg_data.model_copy(update={"id": new_msg_id, "chatId": new_chat.id})
                messages_to_copy[new_msg_id] = copied_msg
        if messages_to_copy:
            await chat_storage.write_chat_messages(new_chat.id, messages_to_copy)
        return new_chat