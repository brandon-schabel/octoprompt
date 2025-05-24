import pytest
from pathlib import Path
from app.services.chat_service import ChatService
from app.schemas.chat_schemas import ExtendedChatMessage, MessageRoleEnum
from app.utils.storage.chat_storage import chat_storage

# Last 5 changes:
# 1. Converted from standalone script to proper pytest test.
# 2. Added pytest.mark.asyncio decorator for async test.
# 3. Removed main function and if __name__ block.
# 4. Updated imports for pytest compatibility.
# 5. Ensured test follows pytest naming conventions.

@pytest.mark.asyncio
async def test_chat_service_fixes():
    """Test that all chat service fixes are working correctly."""
    # Ensure data directory exists
    data_dir = Path("data/chat_storage")
    data_dir.mkdir(parents=True, exist_ok=True)
    
    chat_service = ChatService()
    
    # Test 1: Create a chat
    new_chat = await chat_service.create_chat("Test Chat for Fixes")
    assert new_chat.id is not None
    assert isinstance(new_chat.id, int)
    assert isinstance(new_chat.created, int)
    assert isinstance(new_chat.updated, int)
    assert new_chat.title == "Test Chat for Fixes"
    
    # Test 2: Save a message
    test_message = ExtendedChatMessage(
        id=None,  # Let it generate
        chatId=new_chat.id,
        role=MessageRoleEnum.USER,
        content="Hello, this is a test message!",
        created=None,  # Let it generate
        temp_id="temp_123"
    )
    
    saved_message = await chat_service.save_message(test_message)
    assert saved_message.id is not None
    assert isinstance(saved_message.id, int)
    assert isinstance(saved_message.chatId, int)
    assert saved_message.chatId == new_chat.id
    assert isinstance(saved_message.created, int)
    assert saved_message.content == "Hello, this is a test message!"
    assert saved_message.temp_id == "temp_123"
    
    # Test 3: Get all chats
    all_chats = await chat_service.get_all_chats()
    assert len(all_chats) >= 1
    assert any(chat.id == new_chat.id for chat in all_chats)
    
    # Test 4: Get chat messages
    messages = await chat_service.get_chat_messages(new_chat.id)
    assert len(messages) == 1
    assert messages[0].content == "Hello, this is a test message!"
    
    # Test 5: Update chat
    updated_chat = await chat_service.update_chat(new_chat.id, "Updated Test Chat")
    assert updated_chat.title == "Updated Test Chat"
    assert updated_chat.updated > new_chat.updated
    
    # Test 6: Fork chat
    forked_chat = await chat_service.fork_chat(new_chat.id, [])
    assert forked_chat.id != new_chat.id
    assert "Fork of" in forked_chat.title
    
    # Verify forked chat has the message
    forked_messages = await chat_service.get_chat_messages(forked_chat.id)
    assert len(forked_messages) == 1
    assert forked_messages[0].content == "Hello, this is a test message!"
    assert forked_messages[0].chatId == forked_chat.id
    
    # Test 7: Delete message
    await chat_service.delete_message(new_chat.id, saved_message.id)
    remaining_messages = await chat_service.get_chat_messages(new_chat.id)
    assert len(remaining_messages) == 0
    
    # Test 8: Fork from message (using forked chat which still has messages)
    # Add a new message to the forked chat first
    new_message = ExtendedChatMessage(
        id=None,
        chatId=forked_chat.id,
        role=MessageRoleEnum.ASSISTANT,
        content="This is a response message!",
        created=None,
        temp_id="temp_456"
    )
    second_saved = await chat_service.save_message(new_message)
    
    # Fork from the first message
    fork_from_msg_chat = await chat_service.fork_chat_from_message(
        forked_chat.id, 
        forked_messages[0].id, 
        []
    )
    assert fork_from_msg_chat.id != forked_chat.id
    assert "Fork of" in fork_from_msg_chat.title
    
    # Should only have the first message (up to and including the specified message)
    fork_from_msg_messages = await chat_service.get_chat_messages(fork_from_msg_chat.id)
    assert len(fork_from_msg_messages) == 1
    assert fork_from_msg_messages[0].content == "Hello, this is a test message!"
    
    # Cleanup: Delete test chats
    await chat_service.delete_chat(new_chat.id)
    await chat_service.delete_chat(forked_chat.id)
    await chat_service.delete_chat(fork_from_msg_chat.id)
    
    # Verify cleanup
    final_chats = await chat_service.get_all_chats()
    assert not any(chat.id in [new_chat.id, forked_chat.id, fork_from_msg_chat.id] for chat in final_chats) 