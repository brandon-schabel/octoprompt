# OctoPrompt Python API Client
# Recent changes:
# 1. Initial creation of comprehensive type-safe API client
# 2. Modular service-based architecture for each API endpoint group
# 3. Full Pydantic validation for requests and responses
# 4. Async/await support with httpx for performance
# 5. Custom exception handling for API errors
# 6. Aligned ChatService with TypeScript client, updated _request method.

import asyncio
from typing import Optional, List, Dict, Any, Union, AsyncIterator
import httpx
from pydantic import BaseModel, ValidationError
import json
import time # Added import for time

# Import your existing schemas
from app.schemas.chat_schemas import (
    Chat, ChatMessage, CreateChatBody, UpdateChatBody, AiChatStreamRequest,
    ChatResponse, ChatListResponse, ChatMessageResponse, ChatMessagesListResponse,
    ForkChatBody, ForkChatFromMessageBody # Ensure these are correctly defined/imported
)
from app.schemas.project_schemas import (
    Project, ProjectFile, CreateProjectBody, UpdateProjectBody,
    ProjectResponse, ProjectListResponse, FileListResponse,
    SummarizeFilesBody, RemoveSummariesBody, SuggestFilesBody, RefreshQuery,
    FileSyncData
)
from app.schemas.prompt_schemas import (
    Prompt, CreatePromptBody, UpdatePromptBody, OptimizeUserInputRequest,
    PromptResponse, PromptListResponse, OptimizePromptResponse
)
from app.schemas.provider_key_schemas import (
    ProviderKey, CreateProviderKeyBody, UpdateProviderKeyBody,
    ProviderKeyResponse, ProviderKeyListResponse
)
from app.schemas.ticket_schemas import (
    TicketRead, TicketTaskRead, CreateTicketBody, UpdateTicketBody,
    CreateTaskBody, UpdateTaskBody, LinkFilesBody, SuggestTasksBody,
    ReorderTasksBody, TicketResponseSchema, TaskResponseSchema
)
from app.schemas.common_schemas import ApiErrorResponse, OperationSuccessResponse

class OctoPromptError(Exception):
    """Base exception for OctoPrompt API errors"""
    def __init__(self, message: str, status_code: Optional[int] = None, error_code: Optional[str] = None, details: Optional[Any] = None):
        super().__init__(message)
        self.status_code = status_code 
        self.error_code = error_code
        self.details = details

def ms_timestamp() -> int:
    """Generate unix timestamp in milliseconds"""
    # import time # Moved to top-level import
    return int(time.time() * 1000)

class BaseApiClient:
    """Base client with common HTTP functionality"""
    
    def __init__(self, base_url: str = "http://localhost:3000", timeout: float = 30.0):
        self.base_url = base_url.rstrip('/')
        self.timeout = timeout
        self._client: Optional[httpx.AsyncClient] = None
    
    async def __aenter__(self):
        self._client = httpx.AsyncClient(timeout=self.timeout)
        return self
    
    async def __aexit__(self, exc_type, exc_val, exc_tb):
        if self._client:
            await self._client.aclose()
    
    @property
    def client(self) -> httpx.AsyncClient:
        if not self._client:
            raise RuntimeError("Client not initialized. Use 'async with' context manager.")
        return self._client
    
    async def _request(self, method: str, endpoint: str, 
                      json_data: Optional[Dict] = None, 
                      params: Optional[Dict] = None,
                      response_model: Optional[Any] = None) -> Any: # Changed BaseModel to Any for response_model type
        """Make HTTP request with error handling and validation"""
        url = f"{self.base_url}/api{endpoint}"
        
        try:
            response = await self.client.request(
                method=method,
                url=url,
                json=json_data,
                params=params,
                headers={"Content-Type": "application/json"} if json_data else None
            )
            
            if not response.is_success:
                error_data: Optional[Dict[str, Any]] = None
                error_message = f"HTTP error {response.status_code}"
                error_code_val: Optional[str] = None
                error_details: Optional[Any] = None
                try:
                    error_payload = response.json()
                    if isinstance(error_payload, dict):
                        error_data = error_payload
                        error_message = error_data.get("message", error_message)
                        error_code_val = error_data.get("errorCode") # Match TS client
                        error_details = error_data.get("details")
                except json.JSONDecodeError:
                    error_message = response.text or error_message
                
                raise OctoPromptError(
                    message=error_message, 
                    status_code=response.status_code, 
                    error_code=error_code_val,
                    details=error_details
                )

            # No content responses
            if response.status_code == 204:
                return None

            data = response.json()
            
            if response_model:
                try:
                    return response_model.model_validate(data)
                except ValidationError as e:
                    raise OctoPromptError(
                        message="Invalid API response structure",
                        status_code=response.status_code,
                        error_code="VALIDATION_ERROR",
                        details=e.errors()
                    )
            
            return data
            
        except httpx.RequestError as e:
            raise OctoPromptError(f"Request failed: {e}")
        except OctoPromptError: # Re-raise OctoPromptError if already caught
            raise
        except Exception as e: # Catch any other unexpected errors
            raise OctoPromptError(f"An unexpected error occurred: {str(e)}")

class ChatService(BaseApiClient):
    """Chat API operations"""
    
    async def list_chats(self) -> List[Chat]:
        result = await self._request("GET", "/chats", response_model=ChatListResponse)
        return result.data
    
    async def create_chat(self, data: CreateChatBody) -> Chat:
        result = await self._request("POST", "/chats", json_data=data.model_dump(exclude_none=True), response_model=ChatResponse)
        return result.data
    
    async def get_chat(self, chat_id: int) -> Chat:
        result = await self._request("GET", f"/chats/{chat_id}", response_model=ChatResponse)
        return result.data
    
    async def update_chat(self, chat_id: int, data: UpdateChatBody) -> Chat:
        result = await self._request("PATCH", f"/chats/{chat_id}", json_data=data.model_dump(exclude_none=True), response_model=ChatResponse)
        return result.data
    
    async def delete_chat(self, chat_id: int) -> bool:
        result = await self._request("DELETE", f"/chats/{chat_id}", response_model=OperationSuccessResponse)
        return result.success
    
    async def get_messages(self, chat_id: int) -> List[ChatMessage]:
        result = await self._request("GET", f"/chats/{chat_id}/messages", response_model=ChatMessagesListResponse)
        return result.data
    
    async def fork_chat(self, chat_id: int, data: ForkChatBody) -> Chat:
        result = await self._request("POST", f"/chats/{chat_id}/fork", json_data=data.model_dump(exclude_none=True), response_model=ChatResponse)
        return result.data
    
    async def fork_chat_from_message(self, chat_id: int, message_id: int, data: ForkChatFromMessageBody) -> Chat:
        result = await self._request("POST", f"/chats/{chat_id}/messages/{message_id}/fork", json_data=data.model_dump(exclude_none=True), response_model=ChatResponse)
        return result.data
    
    async def delete_message(self, chat_id: int, message_id: int) -> bool:
        result = await self._request("DELETE", f"/chats/{chat_id}/messages/{message_id}", response_model=OperationSuccessResponse)
        return result.success

    async def stream_chat(self, data: AiChatStreamRequest) -> httpx.Response:
        """
        Initiates a streaming chat session.
        Returns the raw httpx.Response object. The caller is responsible for handling the stream,
        e.g., by iterating over `response.aiter_bytes()`.
        """
        url = f"{self.base_url}/api/chats/stream"
        # Note: httpx.stream context manager is preferred for consuming streams.
        # This method returns the response object for the caller to manage.
        
        # We are not using self._request here because it tries to parse response.json()
        # which is not applicable for streams.
        try:
            # Open a stream request. Note: httpx.stream() is for consuming.
            # For sending a request that expects a stream, a normal request is made.
            # The server will respond with a streaming body.
            response = await self.client.post(
                url,
                json=data.model_dump(exclude_none=True),
                headers={"Content-Type": "application/json", "Accept": "text/event-stream"} # Or appropriate Accept header
            )
            response.raise_for_status() # Check for HTTP errors before returning the stream
            return response
        except httpx.HTTPStatusError as e:
            # Attempt to parse error details if possible
            error_message = f"HTTP error {e.response.status_code}"
            error_code_val: Optional[str] = None
            error_details: Optional[Any] = None
            try:
                error_payload = e.response.json()
                if isinstance(error_payload, dict):
                    error_message = error_payload.get("message", error_message)
                    error_code_val = error_payload.get("errorCode")
                    error_details = error_payload.get("details")
            except json.JSONDecodeError:
                error_message = e.response.text or error_message
            raise OctoPromptError(
                message=error_message,
                status_code=e.response.status_code,
                error_code=error_code_val,
                details=error_details
            )
        except httpx.RequestError as e:
            raise OctoPromptError(f"Request failed: {e}")


class ProjectService(BaseApiClient):
    """Project API operations"""
    
    async def list_projects(self) -> List[Project]:
        result = await self._request("GET", "/projects", response_model=ProjectListResponse)
        return result.data
    
    async def create_project(self, name: str, path: str, description: Optional[str] = None) -> Project:
        body = CreateProjectBody(name=name, path=path, description=description)
        result = await self._request("POST", "/projects", body.model_dump(exclude_none=True), response_model=ProjectResponse)
        return result.data
    
    async def get_project(self, project_id: int) -> Project:
        result = await self._request("GET", f"/projects/{project_id}", response_model=ProjectResponse)
        return result.data
    
    async def update_project(self, project_id: int, name: Optional[str] = None, 
                           path: Optional[str] = None, description: Optional[str] = None) -> Project:
        body = UpdateProjectBody(name=name, path=path, description=description)
        result = await self._request("PATCH", f"/projects/{project_id}", body.model_dump(exclude_none=True), response_model=ProjectResponse)
        return result.data
    
    async def delete_project(self, project_id: int) -> bool:
        await self._request("DELETE", f"/projects/{project_id}", response_model=OperationSuccessResponse)
        return True
    
    async def sync_project(self, project_id: int) -> bool:
        await self._request("POST", f"/projects/{project_id}/sync", response_model=OperationSuccessResponse)
        return True
    
    async def get_project_files(self, project_id: int) -> List[ProjectFile]:
        result = await self._request("GET", f"/projects/{project_id}/files", response_model=FileListResponse)
        return result.data
    
    async def refresh_project(self, project_id: int, folder: Optional[str] = None) -> List[ProjectFile]:
        params = {"folder": folder} if folder else None
        result = await self._request("POST", f"/projects/{project_id}/refresh", params=params, response_model=FileListResponse)
        return result.data
    
    async def get_project_summary(self, project_id: int) -> str:
        result = await self._request("GET", f"/projects/{project_id}/summary")
        return result.get("summary", "")
    
    async def suggest_files(self, project_id: int, user_input: str) -> List[int]:
        body = SuggestFilesBody(userInput=user_input)
        result = await self._request("POST", f"/projects/{project_id}/suggest-files", body.model_dump())
        return result.get("recommendedFileIds", [])
    
    async def summarize_files(self, project_id: int, file_ids: List[int], force: bool = False) -> Dict[str, Any]:
        body = SummarizeFilesBody(fileIds=file_ids, force=force)
        result = await self._request("POST", f"/projects/{project_id}/summarize", body.model_dump())
        return result
    
    async def remove_summaries(self, project_id: int, file_ids: List[int]) -> Dict[str, Any]:
        body = RemoveSummariesBody(fileIds=file_ids)
        result = await self._request("POST", f"/projects/{project_id}/remove-summaries", body.model_dump())
        return result
    
    async def bulk_create_project_files(self, project_id: int, file_sync_data_list: List[FileSyncData]) -> List[ProjectFile]:
        """
        Bulk create project files from FileSyncData
        """
        # Convert FileSyncData to API format
        api_files = []
        for file_data in file_sync_data_list:
            api_files.append({
                "path": file_data.path,
                "name": file_data.name,
                "extension": file_data.extension,
                "content": file_data.content,
                "size": file_data.size,
                "checksum": file_data.checksum
            })
        
        body = {"files": api_files}
        result = await self._request("POST", f"/projects/{project_id}/files/bulk", body)
        
        # Convert response data to ProjectFile objects
        created_files = []
        for file_data in result["data"]:
            created_files.append(ProjectFile.model_validate(file_data))
        
        return created_files
        
    async def update_file(self, project_id: int, file_id: int, content: str) -> ProjectFile:
        """
        Update a project file's content
        """
        body = {"content": content}
        result = await self._request("PUT", f"/projects/{project_id}/files/{file_id}", body)
        return ProjectFile.model_validate(result["data"])

    async def bulk_update_project_files(self, project_id: int, updates: List[Dict[str, Any]]) -> List[ProjectFile]:
        """
        Bulk update project files content
        
        Args:
            project_id: The project ID
            updates: List of dicts with 'fileId' and 'content' keys
        """
        body = {"updates": updates}
        result = await self._request("PUT", f"/projects/{project_id}/files/bulk", body)
        
        # Convert response data to ProjectFile objects
        updated_files = []
        for file_data in result["data"]:
            updated_files.append(ProjectFile.model_validate(file_data))
        
        return updated_files

class PromptService(BaseApiClient):
    """Prompt API operations"""
    
    async def list_prompts(self) -> List[Prompt]:
        result = await self._request("GET", "/prompts", response_model=PromptListResponse)
        return result.data
    
    async def create_prompt(self, name: str, content: str, project_id: Optional[int] = None) -> Prompt:
        body = CreatePromptBody(name=name, content=content, projectId=project_id)
        result = await self._request("POST", "/prompts", body.model_dump(exclude_none=True), response_model=PromptResponse)
        return result.data
    
    async def get_prompt(self, prompt_id: int) -> Prompt:
        result = await self._request("GET", f"/prompts/{prompt_id}", response_model=PromptResponse)
        return result.data
    
    async def update_prompt(self, prompt_id: int, name: Optional[str] = None, content: Optional[str] = None) -> Prompt:
        body = UpdatePromptBody(name=name, content=content)
        result = await self._request("PATCH", f"/prompts/{prompt_id}", body.model_dump(exclude_none=True), response_model=PromptResponse)
        return result.data
    
    async def delete_prompt(self, prompt_id: int) -> bool:
        await self._request("DELETE", f"/prompts/{prompt_id}", response_model=OperationSuccessResponse)
        return True
    
    async def list_project_prompts(self, project_id: int) -> List[Prompt]:
        result = await self._request("GET", f"/projects/{project_id}/prompts", response_model=PromptListResponse)
        return result.data
    
    async def add_prompt_to_project(self, project_id: int, prompt_id: int) -> bool:
        await self._request("POST", f"/projects/{project_id}/prompts/{prompt_id}", response_model=OperationSuccessResponse)
        return True
    
    async def remove_prompt_from_project(self, project_id: int, prompt_id: int) -> bool:
        await self._request("DELETE", f"/projects/{project_id}/prompts/{prompt_id}", response_model=OperationSuccessResponse)
        return True
    
    async def optimize_user_input(self, project_id: int, user_context: str) -> str:
        body = OptimizeUserInputRequest(projectId=project_id, userContext=user_context)
        result = await self._request("POST", "/prompt/optimize", body.model_dump(), response_model=OptimizePromptResponse)
        return result.data.optimizedPrompt

class ProviderKeyService(BaseApiClient):
    """Provider Key API operations"""
    
    async def list_keys(self) -> List[ProviderKey]:
        result = await self._request("GET", "/keys", response_model=ProviderKeyListResponse)
        return result.data
    
    async def create_key(self, name: str, provider: str, key: str, is_default: bool = False) -> ProviderKey:
        body = CreateProviderKeyBody(name=name, provider=provider, key=key, isDefault=is_default)
        result = await self._request("POST", "/keys", body.model_dump(), response_model=ProviderKeyResponse)
        return result.data
    
    async def get_key(self, key_id: int) -> ProviderKey:
        result = await self._request("GET", f"/keys/{key_id}", response_model=ProviderKeyResponse)
        return result.data
    
    async def update_key(self, key_id: int, name: Optional[str] = None, provider: Optional[str] = None,
                        key: Optional[str] = None, is_default: Optional[bool] = None) -> ProviderKey:
        body = UpdateProviderKeyBody(name=name, provider=provider, key=key, isDefault=is_default)
        result = await self._request("PATCH", f"/keys/{key_id}", body.model_dump(exclude_none=True), response_model=ProviderKeyResponse)
        return result.data
    
    async def delete_key(self, key_id: int) -> bool:
        await self._request("DELETE", f"/keys/{key_id}", response_model=OperationSuccessResponse)
        return True

class TicketService(BaseApiClient):
    """Ticket API operations"""
    
    async def create_ticket(self, project_id: int, title: str, overview: str = "", 
                          status: str = "open", priority: str = "normal",
                          suggested_file_ids: Optional[List[int]] = None) -> TicketRead:
        body = CreateTicketBody(
            projectId=project_id, title=title, overview=overview,
            status=status, priority=priority, suggestedFileIds=suggested_file_ids
        )
        result = await self._request("POST", "/tickets", body.model_dump(exclude_none=True))
        return TicketRead.model_validate(result["ticket"])
    
    async def get_ticket(self, ticket_id: int) -> TicketRead:
        result = await self._request("GET", f"/tickets/{ticket_id}")
        return TicketRead.model_validate(result["ticket"])
    
    async def update_ticket(self, ticket_id: int, title: Optional[str] = None, overview: Optional[str] = None,
                          status: Optional[str] = None, priority: Optional[str] = None,
                          suggested_file_ids: Optional[List[int]] = None) -> TicketRead:
        body = UpdateTicketBody(
            title=title, overview=overview, status=status, 
            priority=priority, suggestedFileIds=suggested_file_ids
        )
        result = await self._request("PATCH", f"/tickets/{ticket_id}", body.model_dump(exclude_none=True))
        return TicketRead.model_validate(result["ticket"])
    
    async def delete_ticket(self, ticket_id: int) -> bool:
        await self._request("DELETE", f"/tickets/{ticket_id}", response_model=OperationSuccessResponse)
        return True
    
    async def list_project_tickets(self, project_id: int, status: Optional[str] = None) -> List[TicketRead]:
        params = {"status": status} if status else None
        result = await self._request("GET", f"/projects/{project_id}/tickets", params=params)
        return [TicketRead.model_validate(ticket) for ticket in result["tickets"]]
    
    async def create_task(self, ticket_id: int, content: str) -> TicketTaskRead:
        body = CreateTaskBody(content=content)
        result = await self._request("POST", f"/tickets/{ticket_id}/tasks", body.model_dump())
        return TicketTaskRead.model_validate(result["task"])
    
    async def get_tasks(self, ticket_id: int) -> List[TicketTaskRead]:
        result = await self._request("GET", f"/tickets/{ticket_id}/tasks")
        return [TicketTaskRead.model_validate(task) for task in result["tasks"]]
    
    async def update_task(self, ticket_id: int, task_id: int, content: Optional[str] = None, 
                         done: Optional[bool] = None) -> TicketTaskRead:
        body = UpdateTaskBody(content=content, done=done)
        result = await self._request("PATCH", f"/tickets/{ticket_id}/tasks/{task_id}", body.model_dump(exclude_none=True))
        return TicketTaskRead.model_validate(result["task"])
    
    async def delete_task(self, ticket_id: int, task_id: int) -> bool:
        await self._request("DELETE", f"/tickets/{ticket_id}/tasks/{task_id}", response_model=OperationSuccessResponse)
        return True
    
    async def link_files_to_ticket(self, ticket_id: int, file_ids: List[int]) -> Dict[str, Any]:
        body = LinkFilesBody(fileIds=file_ids)
        result = await self._request("POST", f"/tickets/{ticket_id}/link-files", body.model_dump())
        return result
    
    async def suggest_tasks(self, ticket_id: int, user_context: Optional[str] = None) -> Dict[str, Any]:
        body = SuggestTasksBody(userContext=user_context)
        result = await self._request("POST", f"/tickets/{ticket_id}/suggest-tasks", body.model_dump(exclude_none=True))
        return result

class OctoPromptClient:
    """Main client combining all services"""
    
    def __init__(self, base_url: str = "http://localhost:3000", timeout: float = 30.0):
        self.base_url = base_url
        self.timeout = timeout
        
        # Initialize services
        self.chats = ChatService(base_url, timeout)
        self.projects = ProjectService(base_url, timeout)
        self.prompts = PromptService(base_url, timeout)
        self.keys = ProviderKeyService(base_url, timeout)
        self.tickets = TicketService(base_url, timeout)
    
    async def __aenter__(self):
        await self.chats.__aenter__()
        await self.projects.__aenter__()
        await self.prompts.__aenter__()
        await self.keys.__aenter__()
        await self.tickets.__aenter__()
        return self
    
    async def __aexit__(self, exc_type, exc_val, exc_tb):
        await self.chats.__aexit__(exc_type, exc_val, exc_tb)
        await self.projects.__aexit__(exc_type, exc_val, exc_tb)
        await self.prompts.__aexit__(exc_type, exc_val, exc_tb)
        await self.keys.__aexit__(exc_type, exc_val, exc_tb)
        await self.tickets.__aexit__(exc_type, exc_val, exc_tb)

# # Example usage
# async def example_usage():
#     """Example of how to use the OctoPrompt client"""
    
#     async with OctoPromptClient() as client:
#         try:
#             # Chat operations
#             chats = await client.chats.list_chats()
#             print(f"Found {len(chats)} chats")
            
#             if chats:
#                 chat = chats[0]
#                 messages = await client.chats.get_messages(chat.id)
#                 print(f"Chat '{chat.title}' has {len(messages)} messages")
            
#             # Project operations  
#             projects = await client.projects.list_projects()
#             print(f"Found {len(projects)} projects")
            
#             if projects:
#                 project = projects[0]
#                 files = await client.projects.get_project_files(project.id)
#                 print(f"Project '{project.name}' has {len(files)} files")
                
#                 # Get project summary
#                 summary = await client.projects.get_project_summary(project.id)
#                 print(f"Project summary: {summary[:100]}...")
            
#             # Prompt operations
#             prompts = await client.prompts.list_prompts()
#             print(f"Found {len(prompts)} prompts")
            
#             # Provider key operations (list only for security)
#             keys = await client.keys.list_keys()
#             print(f"Found {len(keys)} provider keys")
            
#             # Ticket operations
#             if projects:
#                 tickets = await client.tickets.list_project_tickets(projects[0].id)
#                 print(f"Project has {len(tickets)} tickets")
                
#                 if tickets:
#                     tasks = await client.tickets.get_tasks(tickets[0].id)
#                     print(f"First ticket has {len(tasks)} tasks")
        
#         except OctoPromptError as e:
#             print(f"API Error: {e} (Status: {e.status_code}, Code: {e.error_code})")
#         except Exception as e:
#             print(f"Unexpected error: {e}")

# if __name__ == "__main__":
#     asyncio.run(example_usage())