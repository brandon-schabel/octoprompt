# app/services/ticket_service.py
# 1. Migrated from ticket-service.ts.
# 2. Uses ticket_storage, Pydantic models, ApiError.
# 3. Implemented all service functions with async/await.
# 4. Placeholder/mock imports for project_storage, gen_ai_services, get_full_project_summary.
# 5. Handles JSON string for suggestedFileIds.
from datetime import datetime, timezone
import json
from typing import List, Dict, Any, Optional, Tuple
from pydantic import ValidationError
from app.error_handling.api_error import ApiError
from app.schemas.ticket_schemas import (
    TicketBase, TicketTaskBase, TicketFileBase,
    TicketCreate, TicketUpdate, TaskSuggestionsModel,
    TicketsStorageModel, TicketTasksStorageModel, TicketFilesStorageModel
)
from app.utils.storage.ticket_storage import ticket_storage
# --- Placeholders for external dependencies ---
# (These would be actual imports in a full application)
class PlaceholderProjectStorage: # Mock for project_storage
    async def read_project_files(self, project_id: str) -> Dict[str, Any]:
        print(f"Mock: Reading project files for {project_id}")
        if project_id == "valid_project_id_for_files":
            return {"file_abc": {"id": "file_abc", "name": "file_abc.py"}, "file_xyz": {"id": "file_xyz", "name": "file_xyz.txt"}}
        return {}
project_storage = PlaceholderProjectStorage()

class PlaceholderGenAIService: # Mock for gen_ai_services
    MEDIUM_MODEL_CONFIG = {"model": "mock-ai-model"}
    async def generate_structured_data(self, prompt: str, system_message: str, schema: Any, options: Dict) -> Any:
        print(f"Mock: Generating structured data for schema {schema.__name__}")
        if schema is TaskSuggestionsModel: return type('obj', (object,), {'object': TaskSuggestionsModel(tasks=[{'title': 'AI Suggested Task 1'}])})()
        return type('obj', (object,), {'object': schema()})() # Default empty model
gen_ai_services = PlaceholderGenAIService()

async def get_full_project_summary(project_id: str) -> str: # Mock
    return f"<project_summary>Mock summary for {project_id}</project_summary>"
# --- End Placeholders ---

VALID_TASK_FORMAT_PROMPT = """IMPORTANT: Return ONLY valid JSON matching this schema: {"tasks": [{"title": "Task title", "description": "Optional desc"}]}"""
DEFAULT_TASK_PROMPT = f"""You are a technical project manager... Each task clear and actionable.\n{VALID_TASK_FORMAT_PROMPT}"""

async def _update_ticket_timestamp_and_save(ticket_id: str, all_tickets: TicketsStorageModel) -> TicketsStorageModel:
    if ticket_id in all_tickets:
        all_tickets[ticket_id].updatedAt = datetime.now(timezone.utc)
        # No need to re-parse, Pydantic model is updated directly
    await ticket_storage.write_tickets(all_tickets)
    return all_tickets

async def fetch_task_suggestions_for_ticket(ticket: TicketBase, user_context: str | None) -> TaskSuggestionsModel:
    project_summary = await get_full_project_summary(ticket.projectId)
    user_message = f"<goal>Suggest tasks...</goal><ticket_title>{ticket.title}</ticket_title><ticket_overview>{ticket.overview}</ticket_overview>"
    if user_context: user_message += f"<user_context>Additional Context: {user_context}</user_context>"
    user_message += project_summary
    if not gen_ai_services.MEDIUM_MODEL_CONFIG.get("model"): raise ApiError(500, "Model not configured", "CONFIG_ERROR")
    result = await gen_ai_services.generate_structured_data(
        prompt=user_message, system_message=DEFAULT_TASK_PROMPT,
        schema=TaskSuggestionsModel, options=gen_ai_services.MEDIUM_MODEL_CONFIG
    )
    return result.object

async def create_ticket(data: TicketCreate) -> TicketBase:
    ticket_id = ticket_storage.generate_id('tkt'); now = datetime.now(timezone.utc)
    new_ticket_data = TicketBase(
        id=ticket_id, projectId=data.projectId, title=data.title, overview=data.overview or "",
        status=data.status or "open", priority=data.priority or "normal",
        suggestedFileIds=json.dumps(data.suggestedFileIds or []), createdAt=now, updatedAt=now
    )
    try:
        # Validation happens on Pydantic model instantiation
        all_tickets = await ticket_storage.read_tickets()
        if ticket_id in all_tickets: raise ApiError(509, f"Ticket ID conflict for {ticket_id}", 'TICKET_ID_CONFLICT')
        all_tickets[ticket_id] = new_ticket_data
        await ticket_storage.write_tickets(all_tickets)
        await ticket_storage.write_ticket_tasks(ticket_id, {})
        await ticket_storage.write_ticket_files(ticket_id, [])
        return new_ticket_data
    except ValidationError as e: print(f"Validation failed for new ticket: {e.errors()}"); raise ApiError(500, "Validation error", "TICKET_VALIDATION_ERROR", e.errors())
    except ApiError: raise
    except Exception as e: print(f"Failed to create ticket: {e}"); raise ApiError(500, "Failed to create ticket", "CREATE_TICKET_FAILED", {"originalError": str(e)})

async def get_ticket_by_id(ticket_id: str) -> TicketBase:
    all_tickets = await ticket_storage.read_tickets()
    ticket_data = all_tickets.get(ticket_id)
    if not ticket_data: raise ApiError(404, f"Ticket {ticket_id} not found", 'TICKET_NOT_FOUND')
    return ticket_data

async def list_tickets_by_project(project_id: str, status_filter: Optional[str] = None) -> List[TicketBase]:
    all_tickets = await ticket_storage.read_tickets()
    tickets = [t for t in all_tickets.values() if t.projectId == project_id]
    if status_filter: tickets = [t for t in tickets if t.status == status_filter]
    return sorted(tickets, key=lambda t: t.createdAt, reverse=True)

async def update_ticket(ticket_id: str, data: TicketUpdate) -> TicketBase:
    all_tickets = await ticket_storage.read_tickets()
    existing_ticket = all_tickets.get(ticket_id)
    if not existing_ticket: raise ApiError(404, f"Ticket {ticket_id} not found for update", 'TICKET_NOT_FOUND')
    
    update_data_dict = data.model_dump(exclude_unset=True)
    if 'suggestedFileIds' in update_data_dict and update_data_dict['suggestedFileIds'] is not None:
        project_files = await project_storage.read_project_files(existing_ticket.projectId)
        for file_id in update_data_dict['suggestedFileIds']:
            if file_id not in project_files: raise ApiError(400, f"File {file_id} not in project", 'FILE_NOT_FOUND_IN_PROJECT')
        update_data_dict['suggestedFileIds'] = json.dumps(update_data_dict['suggestedFileIds'])

    updated_ticket = existing_ticket.model_copy(update=update_data_dict)
    updated_ticket.updatedAt = datetime.now(timezone.utc)
    try:
        # Validate the whole model again (Pydantic does this implicitly on copy+update if types change, but good to be aware)
        all_tickets[ticket_id] = TicketBase.model_validate(updated_ticket.model_dump()) # Ensure it's a clean TicketBase
        await ticket_storage.write_tickets(all_tickets)
        return all_tickets[ticket_id]
    except ValidationError as e: raise ApiError(500, f"Validation failed updating ticket {ticket_id}", "TICKET_VALIDATION_ERROR", e.errors())
    except ApiError: raise
    except Exception as e: raise ApiError(500, f"Failed to update ticket {ticket_id}", "UPDATE_TICKET_FAILED", {"originalError": str(e)})

async def delete_ticket(ticket_id: str) -> None:
    all_tickets = await ticket_storage.read_tickets()
    if ticket_id not in all_tickets: raise ApiError(404, f"Ticket {ticket_id} not found for deletion", 'TICKET_NOT_FOUND')
    del all_tickets[ticket_id]
    await ticket_storage.write_tickets(all_tickets)
    await ticket_storage.delete_ticket_data(ticket_id)

async def link_files_to_ticket(ticket_id: str, file_ids: List[str]) -> List[TicketFileBase]:
    ticket = await get_ticket_by_id(ticket_id)
    project_files = await project_storage.read_project_files(ticket.projectId)
    for file_id in file_ids:
        if file_id not in project_files: raise ApiError(400, f"File {file_id} not found in project", 'FILE_NOT_FOUND_IN_PROJECT')
    
    ticket_links = await ticket_storage.read_ticket_files(ticket_id)
    existing_file_ids = {link.fileId for link in ticket_links}
    new_links_made = False
    for file_id in file_ids:
        if file_id not in existing_file_ids:
            ticket_links.append(TicketFileBase(ticketId=ticket_id, fileId=file_id)); new_links_made = True
    
    if new_links_made:
        await ticket_storage.write_ticket_files(ticket_id, ticket_links)
        all_tickets = await ticket_storage.read_tickets()
        await _update_ticket_timestamp_and_save(ticket_id, all_tickets)
    return ticket_links

async def get_ticket_files(ticket_id: str) -> List[TicketFileBase]:
    await get_ticket_by_id(ticket_id) # Ensures ticket exists
    return await ticket_storage.read_ticket_files(ticket_id)

async def suggest_tasks_for_ticket(ticket_id: str, user_context: Optional[str] = None) -> List[str]:
    ticket = await get_ticket_by_id(ticket_id)
    try:
        suggestions = await fetch_task_suggestions_for_ticket(ticket, user_context)
        return [task.title for task in suggestions.tasks]
    except Exception as e:
        print(f"Error in task suggestion for {ticket_id}: {e}")
        if isinstance(e, ApiError): raise e
        raise ApiError(500, "Failed to suggest tasks", "TASK_SUGGESTION_FAILED", {"originalError": str(e)})

async def get_tickets_with_files(project_id: str) -> List[Dict[str, Any]]:
    project_tickets = await list_tickets_by_project(project_id)
    results = []
    for ticket in project_tickets:
        links = await ticket_storage.read_ticket_files(ticket.id)
        ticket_dict = ticket.model_dump(); ticket_dict['fileIds'] = [link.fileId for link in links]
        results.append(ticket_dict)
    return results

async def create_task(ticket_id: str, content: str) -> TicketTaskBase:
    await get_ticket_by_id(ticket_id) # Ensure ticket exists
    task_id = ticket_storage.generate_id('task'); now = datetime.now(timezone.utc)
    ticket_tasks = await ticket_storage.read_ticket_tasks(ticket_id)
    order_idx = max([t.orderIndex for t in ticket_tasks.values()], default=0) + 1
    new_task_data = TicketTaskBase(id=task_id, ticketId=ticket_id, content=content, orderIndex=order_idx, createdAt=now, updatedAt=now)
    try:
        if task_id in ticket_tasks: raise ApiError(509, "Task ID conflict", "TASK_ID_CONFLICT")
        ticket_tasks[task_id] = new_task_data
        await ticket_storage.write_ticket_tasks(ticket_id, ticket_tasks)
        all_tickets = await ticket_storage.read_tickets()
        await _update_ticket_timestamp_and_save(ticket_id, all_tickets)
        return new_task_data
    except ValidationError as e: raise ApiError(500, "Task validation failed", "TASK_VALIDATION_ERROR", e.errors())
    except ApiError: raise
    except Exception as e: raise ApiError(500, "Failed to create task", "CREATE_TASK_FAILED", {"originalError": str(e)})

async def get_tasks(ticket_id: str) -> List[TicketTaskBase]:
    await get_ticket_by_id(ticket_id) # Ensure ticket exists
    ticket_tasks_data = await ticket_storage.read_ticket_tasks(ticket_id)
    return sorted(list(ticket_tasks_data.values()), key=lambda t: t.orderIndex)

async def delete_task(ticket_id: str, task_id: str) -> None:
    await get_ticket_by_id(ticket_id) # Ensure ticket exists
    ticket_tasks = await ticket_storage.read_ticket_tasks(ticket_id)
    if task_id not in ticket_tasks: raise ApiError(404, "Task not found for ticket", "TASK_NOT_FOUND_FOR_TICKET")
    del ticket_tasks[task_id]
    await ticket_storage.write_ticket_tasks(ticket_id, ticket_tasks)
    all_tickets = await ticket_storage.read_tickets()
    await _update_ticket_timestamp_and_save(ticket_id, all_tickets)

async def reorder_tasks(ticket_id: str, task_reorders: List[Dict[str, Any]]) -> List[TicketTaskBase]: #taskId, orderIndex
    await get_ticket_by_id(ticket_id)
    ticket_tasks = await ticket_storage.read_ticket_tasks(ticket_id); changed = False; now = datetime.now(timezone.utc)
    for reorder_info in task_reorders:
        task_id, order_index = reorder_info.get('taskId'), reorder_info.get('orderIndex')
        if not task_id or order_index is None: continue # or raise error
        task = ticket_tasks.get(task_id)
        if not task: raise ApiError(404, f"Task {task_id} not found for reorder", "TASK_NOT_FOUND_FOR_TICKET")
        if task.orderIndex != order_index: task.orderIndex = order_index; task.updatedAt = now; changed = True
    if changed:
        await ticket_storage.write_ticket_tasks(ticket_id, ticket_tasks)
        all_tickets = await ticket_storage.read_tickets()
        await _update_ticket_timestamp_and_save(ticket_id, all_tickets)
    return sorted(list(ticket_tasks.values()), key=lambda t: t.orderIndex)

async def auto_generate_tasks_from_overview(ticket_id: str) -> List[TicketTaskBase]:
    ticket = await get_ticket_by_id(ticket_id)
    titles = await suggest_tasks_for_ticket(ticket_id, ticket.overview or '')
    inserted_tasks: List[TicketTaskBase] = []
    if titles:
        ticket_tasks = await ticket_storage.read_ticket_tasks(ticket_id)
        current_max_order = max([t.orderIndex for t in ticket_tasks.values()], default=0); now = datetime.now(timezone.utc)
        for content in titles:
            current_max_order += 1; task_id = ticket_storage.generate_id('task')
            new_task_data = TicketTaskBase(id=task_id, ticketId=ticket_id, content=content, orderIndex=current_max_order, createdAt=now, updatedAt=now)
            try:
                ticket_tasks[task_id] = new_task_data # Assumes TicketTaskBase is validated on creation
                inserted_tasks.append(new_task_data)
            except ValidationError as e: print(f"Validation failed for auto-gen task '{content}': {e.errors()}") # Skip or throw
        if inserted_tasks:
            await ticket_storage.write_ticket_tasks(ticket_id, ticket_tasks)
            all_tickets = await ticket_storage.read_tickets()
            await _update_ticket_timestamp_and_save(ticket_id, all_tickets)
    return inserted_tasks

async def list_tickets_with_task_count(project_id: str, status_filter: Optional[str] = None) -> List[Dict[str, Any]]:
    tickets = await list_tickets_by_project(project_id, status_filter); results = []
    for ticket in tickets:
        tasks_data = await ticket_storage.read_ticket_tasks(ticket.id)
        tasks_array = list(tasks_data.values())
        ticket_dict = ticket.model_dump()
        ticket_dict.update({'taskCount': len(tasks_array), 'completedTaskCount': sum(1 for t in tasks_array if t.done)})
        results.append(ticket_dict)
    return results

async def get_tasks_for_tickets(ticket_ids: List[str]) -> Dict[str, List[TicketTaskBase]]:
    if not ticket_ids: return {}
    tasks_by_ticket: Dict[str, List[TicketTaskBase]] = {}
    all_tickets_map = await ticket_storage.read_tickets() # Fetch all tickets metadata once
    for ticket_id in ticket_ids:
        if ticket_id in all_tickets_map: # Check if ticket exists
            tasks_data = await ticket_storage.read_ticket_tasks(ticket_id)
            tasks_by_ticket[ticket_id] = sorted(list(tasks_data.values()), key=lambda t: t.orderIndex)
    return tasks_by_ticket

async def list_tickets_with_tasks(project_id: str, status_filter: Optional[str] = None) -> List[Dict[str, Any]]:
    base_tickets = await list_tickets_by_project(project_id, status_filter)
    if not base_tickets: return []
    tasks_by_ticket = await get_tasks_for_tickets([t.id for t in base_tickets])
    return [{**t.model_dump(), 'tasks': tasks_by_ticket.get(t.id, [])} for t in base_tickets]

async def get_ticket_with_suggested_files(ticket_id: str) -> Optional[Dict[str, Any]]:
    ticket = await get_ticket_by_id(ticket_id)
    if not ticket: return None
    parsed_file_ids: List[str] = []
    try:
        if ticket.suggestedFileIds:
            parsed = json.loads(ticket.suggestedFileIds)
            if isinstance(parsed, list): parsed_file_ids = [str(id_val) for id_val in parsed if isinstance(id_val, (str, int))] # basic filter
    except json.JSONDecodeError: print(f"Could not parse suggestedFileIds for {ticket_id}")
    
    ticket_dict = ticket.model_dump()
    ticket_dict['parsedSuggestedFileIds'] = parsed_file_ids
    return ticket_dict

async def update_task(ticket_id: str, task_id: str, updates: Dict[str, Any]) -> TicketTaskBase:
    await get_ticket_by_id(ticket_id) # Ensure ticket exists
    ticket_tasks = await ticket_storage.read_ticket_tasks(ticket_id)
    existing_task = ticket_tasks.get(task_id)
    if not existing_task: raise ApiError(404, "Task not found for ticket", "TASK_NOT_FOUND_FOR_TICKET")
    
    changed = False
    update_data_dict = {k:v for k,v in updates.items() if v is not None} # Filter None values from updates
    if 'content' in update_data_dict and existing_task.content != update_data_dict['content']: changed = True
    if 'done' in update_data_dict and existing_task.done != update_data_dict['done']: changed = True

    if changed:
        updated_task_model = existing_task.model_copy(update=update_data_dict)
        updated_task_model.updatedAt = datetime.now(timezone.utc)
        try:
            ticket_tasks[task_id] = TicketTaskBase.model_validate(updated_task_model.model_dump()) # Re-validate
            await ticket_storage.write_ticket_tasks(ticket_id, ticket_tasks)
            all_tickets = await ticket_storage.read_tickets()
            await _update_ticket_timestamp_and_save(ticket_id, all_tickets)
            return ticket_tasks[task_id]
        except ValidationError as e: raise ApiError(500, f"Validation failed updating task {task_id}", "TASK_VALIDATION_ERROR", e.errors())
    return existing_task

async def suggest_files_for_ticket(ticket_id: str, options: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
    ticket = await get_ticket_by_id(ticket_id)
    try: # Simplified logic from TS version
        project_files_map = await project_storage.read_project_files(ticket.projectId)
        project_file_ids = list(project_files_map.keys())
        if not project_file_ids: return {"recommendedFileIds": [], "message": "No files in project."}
        
        recommended_ids = project_file_ids[:min(5, len(project_file_ids))]
        summaries = f"Placeholder summary for files in project {ticket.projectId} related to ticket: {ticket.title}"
        return {"recommendedFileIds": recommended_ids, "combinedSummaries": summaries, "message": "Files suggested (simple logic)."}
    except Exception as e:
        print(f"Error suggesting files for {ticket_id}: {e}")
        if isinstance(e, ApiError): raise e
        raise ApiError(500, "Failed to suggest files", "FILE_SUGGESTION_FAILED", {"originalError": str(e)})