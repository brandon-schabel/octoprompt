from fastapi import APIRouter, Depends, HTTPException, status, Body
from app.services.chat_service import ChatService # Assuming a class-based service
from app.schemas.chat_schemas import (
    ChatListResponse, ChatResponse, CreateChatBody, GetMessagesParams, # (use as path/query param classes if needed)
    MessageListResponse, AiChatStreamRequest, ForkChatBody, UpdateChatBody, # etc.
    ChatIdParams, ForkChatParams, ForkChatFromMessageParams, DeleteMessageParams, UpdateChatParams, DeleteChatParams,
    OperationSuccessResponse # Added for success/failure messages
)
from app.core.custom_errors import ApiError # For catching service errors
from fastapi.responses import StreamingResponse # For streaming responses

router = APIRouter(prefix="/api/chats", tags=["Chats"])
chat_service_dependency = ChatService() # Or a more sophisticated dependency provider

def get_chat_service(): # Simple dependency callable
    return chat_service_dependency

@router.get("/", response_model=ChatListResponse)
async def get_all_chats_endpoint(service: ChatService = Depends(get_chat_service)):
    try:
        chats = await service.get_all_chats()
        return ChatListResponse(success=True, data=chats)
    except ApiError as e:
        raise HTTPException(status_code=e.status_code, detail=e.detail)
    except Exception as e: # Catchall for unexpected
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/", response_model=ChatResponse, status_code=status.HTTP_201_CREATED)
async def create_chat_endpoint(body: CreateChatBody, service: ChatService = Depends(get_chat_service)):
    try:
        chat = await service.create_chat(body.title, options={"copyExisting": body.copy_existing, "currentChatId": body.current_chat_id})
        return ChatResponse(success=True, data=chat)
    except ApiError as e:
        raise HTTPException(status_code=e.status_code, detail=e.detail)

@router.get("/{chat_id}/messages", response_model=MessageListResponse, summary="Get messages for a specific chat")
async def get_chat_messages_endpoint(params: GetMessagesParams = Depends(), service: ChatService = Depends(get_chat_service)):
    try:
        messages = await service.get_chat_messages(params.chat_id)
        # Assuming service.get_chat_messages returns messages in the correct format
        return MessageListResponse(success=True, data=messages)
    except ApiError as e:
        raise HTTPException(status_code=e.status_code, detail=e.detail)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# This route path starts with / to override the APIRouter prefix for /api/ai/chat
@router.post("/api/ai/chat", tags=["AI"], summary="Chat completion (streaming, chat-associated)", status_code=status.HTTP_200_OK)
async def post_ai_chat_sdk_endpoint(body: AiChatStreamRequest, service: ChatService = Depends(get_chat_service)):
    try:
        # Assuming service has a method like handle_ai_chat_stream that returns an async generator or a streamable response
        # The service method would internally call the equivalent of handleChatMessage from gen-ai-services
        # Headers like 'Content-Type: text/event-stream' should be set by StreamingResponse or manually if needed.
        async def event_stream():
            # Placeholder: replace with actual streaming logic from service
            # The service method should handle interaction with unified-provider-service
            # and format events according to Vercel AI SDK
            async for chunk in service.handle_ai_chat_stream(
                chat_id=body.chat_id,
                user_message=body.user_message,
                options=body.options,
                system_message=body.system_message,
                temp_id=body.temp_id
            ):
                yield chunk # Or format as "data: xxx\n\n" if not handled by service

        # FastAPI's StreamingResponse handles the SSE headers automatically if media_type is 'text/event-stream'
        return StreamingResponse(event_stream(), media_type="text/event-stream")

    except ApiError as e:
        raise HTTPException(status_code=e.status_code, detail=e.detail)
    except Exception as e:
        # Log error details for debugging
        print(f"Error in /api/ai/chat: {e}")
        raise HTTPException(status_code=500, detail=f"Internal Server Error: {str(e)}")

@router.post("/{chat_id}/fork", response_model=ChatResponse, status_code=status.HTTP_201_CREATED, summary="Fork a chat session")
async def fork_chat_endpoint(body: ForkChatBody, params: ForkChatParams = Depends(), service: ChatService = Depends(get_chat_service)):
    try:
        # Ensure ForkChatParams correctly extracts chat_id from path
        chat = await service.fork_chat(params.chat_id, body.excluded_message_ids)
        return ChatResponse(success=True, data=chat)
    except ApiError as e:
        raise HTTPException(status_code=e.status_code, detail=e.detail)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/{chat_id}/fork/{message_id}", response_model=ChatResponse, status_code=status.HTTP_201_CREATED, summary="Fork a chat session from a specific message")
async def fork_chat_from_message_endpoint(body: ForkChatBody, params: ForkChatFromMessageParams = Depends(), service: ChatService = Depends(get_chat_service)):
    try:
        # ForkChatFromMessageParams for chat_id and message_id from path
        # ForkChatBody for excluded_message_ids from body
        chat = await service.fork_chat_from_message(params.chat_id, params.message_id, body.excluded_message_ids)
        return ChatResponse(success=True, data=chat)
    except ApiError as e:
        raise HTTPException(status_code=e.status_code, detail=e.detail)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.delete("/{chat_id}/messages/{message_id}", response_model=OperationSuccessResponse, summary="Delete a specific message")
async def delete_message_endpoint(params: DeleteMessageParams = Depends(), service: ChatService = Depends(get_chat_service)):
    try:
        await service.delete_message(params.chat_id, params.message_id)
        return OperationSuccessResponse(success=True, message="Message deleted successfully")
    except ApiError as e:
        raise HTTPException(status_code=e.status_code, detail=e.detail)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.patch("/{chat_id}", response_model=ChatResponse, summary="Update chat properties (e.g., title)")
async def update_chat_endpoint(body: UpdateChatBody, params: UpdateChatParams = Depends(), service: ChatService = Depends(get_chat_service)):
    try:
        # UpdateChatParams for chat_id from path
        # UpdateChatBody for title (and potentially other fields) from body
        updated_chat = await service.update_chat(params.chat_id, body.title) # Assuming body.title for simplicity
        return ChatResponse(success=True, data=updated_chat)
    except ApiError as e:
        raise HTTPException(status_code=e.status_code, detail=e.detail)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.delete("/{chat_id}", response_model=OperationSuccessResponse, summary="Delete a chat session and its messages")
async def delete_chat_endpoint(params: DeleteChatParams = Depends(), service: ChatService = Depends(get_chat_service)):
    try:
        await service.delete_chat(params.chat_id)
        return OperationSuccessResponse(success=True, message="Chat deleted successfully")
    except ApiError as e:
        raise HTTPException(status_code=e.status_code, detail=e.detail)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# Ensure this comment is at the end if no more routes
# ... other endpoints for get_chat_messages, fork_chat, delete_message, etc.
# Example for path parameter usage with Pydantic model for validation:
# @router.get("/{chat_id}/messages", response_model=MessageListResponse)
# async def get_chat_messages_endpoint(params: GetMessagesParams = Depends(), service: ChatService = Depends(get_chat_service)):
#     # FastAPI automatically validates params.chat_id based on GetMessagesParams
#     messages = await service.get_chat_messages(params.chat_id)
#     return MessageListResponse(success=True, data=messages)