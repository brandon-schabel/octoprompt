# packages/python_backend/app/api/endpoints/ticket_api.py
# - Migrated Hono ticket routes to FastAPI.
# - Defined Pydantic response models for ticket operations.
# - Implemented all 17 ticket and task-related API endpoints.
# - Used Python type hints and FastAPI specific features (Path, Query, Body).
# - Matched request/response structures and status codes from TS.

from typing import List, Optional, Dict, Any
from fastapi import APIRouter, HTTPException, Path, Query, Body, status

from app.schemas.common_schemas import (
    ApiErrorResponse,
    OperationSuccessResponse,
)
from app.schemas.ticket_schemas import (
    TicketBase,
    TicketTaskBase,
    TicketFileBase,
    CreateTicketBody,
    UpdateTicketBody,
    LinkFilesBody,
    SuggestTasksBody,
    CreateTaskBody,
    UpdateTaskBody,
    ReorderTasksBody,
    # For params not explicitly defined as models but used as types
)
from app.services import ticket_service
from pydantic import BaseModel, Field

router = APIRouter()

# --- Pydantic Response Models ---
# These wrap the base schemas with a "success" flag, common in the TS API

class TicketResponse(BaseModel):
    success: bool = True
    ticket: TicketBase

class TicketListResponse(BaseModel):
    success: bool = True
    tickets: List[TicketBase]

class TaskResponse(BaseModel):
    success: bool = True
    task: TicketTaskBase

class TaskListResponse(BaseModel):
    success: bool = True
    tasks: List[TicketTaskBase]

class LinkedFilesResponse(BaseModel):
    success: bool = True
    linkedFiles: List[TicketFileBase] # TS: linkedFiles, schema matches TicketFileBase

class SuggestedTasksResponse(BaseModel):
    success: bool = True
    suggestedTasks: List[str]

class SuggestedFilesBody(BaseModel): # For request body of suggest_files route
    extraUserInput: Optional[str] = None

class SuggestedFilesResponse(BaseModel):
    success: bool = True
    recommendedFileIds: List[str]
    combinedSummaries: Optional[str] = None
    message: Optional[str] = None

class TicketWithTaskCount(BaseModel):
    ticket: TicketBase
    taskCount: int
    completedTaskCount: int

class TicketWithTaskCountListResponse(BaseModel):
    success: bool = True
    ticketsWithCount: List[TicketWithTaskCount]

class TicketWithTasks(BaseModel):
    ticket: TicketBase
    tasks: List[TicketTaskBase]

class TicketWithTasksListResponse(BaseModel):
    success: bool = True
    ticketsWithTasks: List[TicketWithTasks]

class BulkTasksResponse(BaseModel):
    success: bool = True
    tasks: Dict[str, List[TicketTaskBase]]


# --- API Routes ---

common_error_responses = {
    400: {"model": ApiErrorResponse, "description": "Validation Error"},
    404: {"model": ApiErrorResponse, "description": "Not Found"},
    500: {"model": ApiErrorResponse, "description": "Internal Server Error"},
}

@router.post(
    "/tickets",
    response_model=TicketResponse,
    status_code=status.HTTP_201_CREATED,
    tags=["Tickets"],
    summary="Create a new ticket",
    responses={**common_error_responses},
)
async def create_ticket_route(body: CreateTicketBody = Body(...)):
    ticket = await ticket_service.create_ticket(body)
    return TicketResponse(ticket=ticket)

@router.get(
    "/tickets/{ticketId}",
    response_model=TicketResponse,
    tags=["Tickets"],
    summary="Get a ticket by ID",
    responses={**common_error_responses},
)
async def get_ticket_route(ticketId: str = Path(..., description="Ticket identifier")):
    ticket = await ticket_service.get_ticket_by_id(ticketId)
    return TicketResponse(ticket=ticket)

@router.patch(
    "/tickets/{ticketId}",
    response_model=TicketResponse,
    tags=["Tickets"],
    summary="Update a ticket",
    responses={**common_error_responses},
)
async def update_ticket_route(
    ticketId: str = Path(..., description="Ticket identifier"),
    body: UpdateTicketBody = Body(...),
):
    updated_ticket = await ticket_service.update_ticket(ticketId, body)
    return TicketResponse(ticket=updated_ticket)

@router.delete(
    "/tickets/{ticketId}",
    response_model=OperationSuccessResponse,
    tags=["Tickets"],
    summary="Delete a ticket",
    responses={**common_error_responses},
)
async def delete_ticket_route(ticketId: str = Path(..., description="Ticket identifier")):
    await ticket_service.delete_ticket(ticketId)
    return OperationSuccessResponse(message="Ticket deleted successfully")

@router.post(
    "/tickets/{ticketId}/link-files",
    response_model=LinkedFilesResponse,
    tags=["Tickets", "Files"],
    summary="Link files to a ticket",
    responses={**common_error_responses},
)
async def link_files_route(
    ticketId: str = Path(..., description="Ticket identifier"),
    body: LinkFilesBody = Body(...),
):
    linked_files = await ticket_service.link_files_to_ticket(ticketId, body.file_ids)
    return LinkedFilesResponse(linkedFiles=linked_files)

@router.post(
    "/tickets/{ticketId}/suggest-tasks",
    response_model=SuggestedTasksResponse,
    tags=["Tickets", "AI"],
    summary="Get AI suggestions for tasks",
    responses={**common_error_responses},
)
async def suggest_tasks_route(
    ticketId: str = Path(..., description="Ticket identifier"),
    body: SuggestTasksBody = Body(...),
):
    # TS service takes (ticketId, userContext), Python service takes (ticket_id, user_context)
    tasks = await ticket_service.suggest_tasks_for_ticket(ticketId, body.user_context)
    return SuggestedTasksResponse(suggestedTasks=tasks)

@router.post(
    "/tickets/{ticketId}/suggest-files",
    response_model=SuggestedFilesResponse,
    tags=["Tickets", "Files", "AI"],
    summary="Get AI suggestions for relevant files",
    responses={**common_error_responses},
)
async def suggest_files_route(
    ticketId: str = Path(..., description="Ticket identifier"),
    body: SuggestedFilesBody = Body(...), # TS body: { extraUserInput?: string }
):
    # Python service takes options: Optional[Dict[str, Any]]
    options = {"extraUserInput": body.extraUserInput} if body.extraUserInput else {}
    result = await ticket_service.suggest_files_for_ticket(ticketId, options)
    return SuggestedFilesResponse(
        recommendedFileIds=result.get("recommendedFileIds", []),
        combinedSummaries=result.get("combinedSummaries"),
        message=result.get("message"),
    )

@router.get(
    "/projects/{projectId}/tickets",
    response_model=TicketListResponse,
    tags=["Projects", "Tickets"],
    summary="List all tickets for a project",
    responses={500: common_error_responses[500]},
)
async def list_tickets_by_project_route(
    projectId: str = Path(..., description="Project identifier"),
    status: Optional[str] = Query(None, description="Filter tickets by status"),
):
    status_filter = None if status == "all" else status
    tickets = await ticket_service.list_tickets_by_project(projectId, status_filter)
    return TicketListResponse(tickets=tickets)

@router.get(
    "/projects/{projectId}/tickets-with-count",
    response_model=TicketWithTaskCountListResponse,
    tags=["Projects", "Tickets"],
    summary="List tickets with task counts",
    responses={500: common_error_responses[500]},
)
async def list_tickets_with_count_route(
    projectId: str = Path(..., description="Project identifier"),
    status: Optional[str] = Query(None, description="Filter tickets by status (or 'all')"),
):
    status_filter = None if status == "all" else status
    # Service returns List[Dict[str, Any]] which Pydantic models will parse
    results = await ticket_service.list_tickets_with_task_count(projectId, status_filter)
    # Pydantic should auto-map dicts to TicketWithTaskCount if fields match
    return TicketWithTaskCountListResponse(ticketsWithCount=results)


@router.get(
    "/projects/{projectId}/tickets-with-tasks",
    response_model=TicketWithTasksListResponse,
    tags=["Projects", "Tickets", "Tasks"],
    summary="List tickets with their tasks",
    responses={500: common_error_responses[500]},
)
async def list_tickets_with_tasks_route(
    projectId: str = Path(..., description="Project identifier"),
    status: Optional[str] = Query(None, description="Filter tickets by status (or 'all')"),
):
    status_filter = None if status == "all" else status
    # Service returns List[Dict[str, Any]] which Pydantic models will parse
    tickets_with_tasks = await ticket_service.list_tickets_with_tasks(projectId, status_filter)
    return TicketWithTasksListResponse(ticketsWithTasks=tickets_with_tasks)

@router.post(
    "/tickets/{ticketId}/tasks",
    response_model=TaskResponse,
    status_code=status.HTTP_201_CREATED,
    tags=["Tickets", "Tasks"],
    summary="Create a new task for a ticket",
    responses={**common_error_responses},
)
async def create_task_route(
    ticketId: str = Path(..., description="Ticket identifier"),
    body: CreateTaskBody = Body(...),
):
    task = await ticket_service.create_task(ticketId, body.content)
    return TaskResponse(task=task)

@router.get(
    "/tickets/{ticketId}/tasks",
    response_model=TaskListResponse,
    tags=["Tickets", "Tasks"],
    summary="Get all tasks for a ticket",
    responses={**common_error_responses},
)
async def get_tasks_route(ticketId: str = Path(..., description="Ticket identifier")):
    tasks = await ticket_service.get_tasks(ticketId)
    return TaskListResponse(tasks=tasks)

@router.patch(
    "/tickets/{ticketId}/tasks/{taskId}",
    response_model=TaskResponse,
    tags=["Tickets", "Tasks"],
    summary="Update a task",
    responses={**common_error_responses},
)
async def update_task_route(
    ticketId: str = Path(..., description="Ticket identifier"),
    taskId: str = Path(..., description="Task identifier"),
    body: UpdateTaskBody = Body(...),
):
    updated_task = await ticket_service.update_task(ticketId, taskId, body.model_dump(exclude_unset=True))
    return TaskResponse(task=updated_task)

@router.delete(
    "/tickets/{ticketId}/tasks/{taskId}",
    response_model=OperationSuccessResponse,
    tags=["Tickets", "Tasks"],
    summary="Delete a task",
    responses={**common_error_responses},
)
async def delete_task_route(
    ticketId: str = Path(..., description="Ticket identifier"),
    taskId: str = Path(..., description="Task identifier"),
):
    await ticket_service.delete_task(ticketId, taskId)
    return OperationSuccessResponse(message="Task deleted successfully")

@router.patch(
    "/tickets/{ticketId}/tasks/reorder",
    response_model=TaskListResponse,
    tags=["Tickets", "Tasks"],
    summary="Reorder tasks within a ticket",
    responses={**common_error_responses},
)
async def reorder_tasks_route(
    ticketId: str = Path(..., description="Ticket identifier"),
    body: ReorderTasksBody = Body(...),
):
    # The service expects List[Dict[str, Any]] where dicts are {'taskId': str, 'orderIndex': int}
    # Pydantic ReorderTasksBody.tasks is List[ReorderTaskItem], ReorderTaskItem.model_dump() will give dicts
    task_reorders_list = [task_item.model_dump() for task_item in body.tasks]
    updated_tasks = await ticket_service.reorder_tasks(ticketId, task_reorders_list)
    return TaskListResponse(tasks=updated_tasks)

@router.post(
    "/tickets/{ticketId}/auto-generate-tasks",
    response_model=TaskListResponse,
    tags=["Tickets", "Tasks", "AI"],
    summary="Auto-generate tasks from ticket overview",
    responses={**common_error_responses},
)
async def auto_generate_tasks_route(ticketId: str = Path(..., description="Ticket identifier")):
    new_tasks = await ticket_service.auto_generate_tasks_from_overview(ticketId)
    return TaskListResponse(tasks=new_tasks)

@router.get(
    "/tickets/bulk-tasks",
    response_model=BulkTasksResponse,
    tags=["Tickets", "Tasks"],
    summary="Get tasks for multiple tickets",
    responses={500: common_error_responses[500]},
)
async def get_tasks_for_tickets_route(
    ids: str = Query(..., description="Comma-separated list of ticket IDs"),
):
    ticket_ids_list = [item.strip() for item in ids.split(',') if item.strip()]
    if not ticket_ids_list:
        # Or raise HTTPException for bad request if ids param is required but empty after split
        return BulkTasksResponse(tasks={})
    tasks_by_ticket_id = await ticket_service.get_tasks_for_tickets(ticket_ids_list)
    return BulkTasksResponse(tasks=tasks_by_ticket_id)