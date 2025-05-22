from typing import Optional, List, Dict, Any, Literal, Union
from pydantic import BaseModel, Field, ConfigDict, field_validator, validator
from enum import Enum
from app.utils.storage_timestap_utils import convert_timestamp_to_ms_int, convert_id_to_int

# --- Ticket Schemas ---
# Last 5 changes:
# 1. Initial conversion from Zod to Pydantic.
# 2. Mapped various Zod schemas (TicketCreateSchema, TicketReadSchema, etc.) to Pydantic models.
# 3. Handled z.enum, .optional(), .default(), .preprocess().
# 4. Created enums for Status and Priority where z.enum was used with specific values.
# 5. Mapped .openapi() metadata where available (though not present in original Zod for these).
# 6. Changed ID and timestamp fields to int (Unix ms) and added validators.

class TicketStatusEnum(str, Enum):
    OPEN = "open"
    IN_PROGRESS = "in_progress"
    CLOSED = "closed"

class TicketPriorityEnum(str, Enum):
    LOW = "low"
    NORMAL = "normal"
    HIGH = "high"

# Schemas based on the initial Zod definitions (TicketCreateSchema, etc.)
class TicketCreate(BaseModel):
    project_id: int = Field(..., validation_alias="projectId", serialization_alias="projectId")
    title: str
    overview: Optional[str] = None
    status: Optional[str] = None # Or TicketStatusEnum if these should be strictly validated from the start
    priority: Optional[str] = None # Or TicketPriorityEnum
    suggested_file_ids: Optional[List[int]] = Field(None, validation_alias="suggestedFileIds", serialization_alias="suggestedFileIds")
    model_config = ConfigDict(populate_by_name=True)

    _validate_project_id = field_validator('project_id', mode='before')(convert_id_to_int)
    # If suggested_file_ids are IDs, they might also need convert_id_to_int if they come as strings in a list
    @field_validator('suggested_file_ids', mode='before')
    def validate_suggested_file_ids(cls, v):
        if v is None: return None
        if isinstance(v, str): # Handle JSON string input
            try:
                parsed_v = json.loads(v)
            except json.JSONDecodeError:
                raise ValueError("suggested_file_ids must be a valid JSON string representing a list or null")
        elif isinstance(v, list):
            parsed_v = v
        else:
            raise TypeError("suggested_file_ids must be a list or a JSON string list")
        
        if not isinstance(parsed_v, list):
            raise ValueError("suggested_file_ids, if provided, must be a list of IDs.")
        return [convert_id_to_int(id_val) for id_val in parsed_v]


class TicketRead(BaseModel):
    id: int
    project_id: int = Field(..., validation_alias="projectId", serialization_alias="projectId")
    title: str
    overview: str
    status: str # Or TicketStatusEnum
    priority: str # Or TicketPriorityEnum
    suggested_file_ids: str = Field(..., validation_alias="suggestedFileIds", serialization_alias="suggestedFileIds") # Stored as JSON string
    created: int = Field(..., validation_alias="created", serialization_alias="created", example=1678442400000)
    updated: int = Field(..., validation_alias="updated", serialization_alias="updated", example=1678442700000)
    model_config = ConfigDict(populate_by_name=True)

    _validate_ids = field_validator('id', 'project_id', mode='before')(convert_id_to_int)
    _validate_timestamps = field_validator('created', 'updated', mode='before')(convert_timestamp_to_ms_int)

class TicketUpdate(BaseModel):
    title: Optional[str] = None
    overview: Optional[str] = None
    status: Optional[str] = None # Or TicketStatusEnum
    priority: Optional[str] = None # Or TicketPriorityEnum
    suggested_file_ids: Optional[List[int]] = Field(None, validation_alias="suggestedFileIds", serialization_alias="suggestedFileIds")
    model_config = ConfigDict(populate_by_name=True)

    @field_validator('suggested_file_ids', mode='before')
    def validate_suggested_file_ids_update(cls, v): # Same validator as in TicketCreate
        if v is None: return None
        if isinstance(v, str): 
            try: parsed_v = json.loads(v)
            except json.JSONDecodeError: raise ValueError("suggested_file_ids must be a valid JSON string representing a list or null")
        elif isinstance(v, list): parsed_v = v
        else: raise TypeError("suggested_file_ids must be a list or a JSON string list")
        
        if not isinstance(parsed_v, list): raise ValueError("suggested_file_ids, if provided, must be a list of IDs.")
        return [convert_id_to_int(id_val) for id_val in parsed_v]


class TicketFileRead(BaseModel):
    id: int # Assuming TicketFile has its own ID
    ticket_id: int = Field(..., validation_alias="ticketId", serialization_alias="ticketId")
    file_id: int = Field(..., validation_alias="fileId", serialization_alias="fileId")
    uploaded_at: int = Field(..., validation_alias="uploadedAt", serialization_alias="uploadedAt", example=1678442400000) # Assuming it has this
    model_config = ConfigDict(populate_by_name=True)

    _validate_ids = field_validator('id', 'ticket_id', 'file_id', mode='before')(convert_id_to_int)
    _validate_uploaded_at = field_validator('uploaded_at', mode='before')(convert_timestamp_to_ms_int)


class TicketTaskCreate(BaseModel):
    ticket_id: int = Field(..., validation_alias="ticketId", serialization_alias="ticketId")
    content: str
    done: Optional[bool] = None
    order_index: Optional[int] = Field(None, validation_alias="orderIndex", serialization_alias="orderIndex")
    model_config = ConfigDict(populate_by_name=True)

    _validate_ticket_id = field_validator('ticket_id', mode='before')(convert_id_to_int)

class TicketTaskRead(BaseModel):
    id: int
    ticket_id: int = Field(..., validation_alias="ticketId", serialization_alias="ticketId")
    content: str
    done: bool
    order_index: int = Field(..., validation_alias="orderIndex", serialization_alias="orderIndex")
    created: int = Field(..., validation_alias="created", serialization_alias="created", example=1678442400000)
    updated: int = Field(..., validation_alias="updated", serialization_alias="updated", example=1678442700000)
    model_config = ConfigDict(populate_by_name=True)

    _validate_ids = field_validator('id', 'ticket_id', mode='before')(convert_id_to_int)
    _validate_timestamps = field_validator('created', 'updated', mode='before')(convert_timestamp_to_ms_int)

    @validator('done', pre=True)
    def preprocess_done(cls, v):
        if isinstance(v, int):
            return v == 1
        return v

class TaskSuggestionFile(BaseModel):
    file_id: int = Field(..., validation_alias="fileId", serialization_alias="fileId")
    file_name: str = Field(..., validation_alias="fileName", serialization_alias="fileName")
    model_config = ConfigDict(populate_by_name=True)
    _validate_file_id = field_validator('file_id', mode='before')(convert_id_to_int)


class TaskSuggestionItem(BaseModel):
    title: str
    description: Optional[str] = None
    files: Optional[List[TaskSuggestionFile]] = None

class TaskSuggestions(BaseModel):
    tasks: List[TaskSuggestionItem]

TaskSuggestionsModel = TaskSuggestions # Alias for TaskSuggestions

# Schemas based on the refined Zod definitions (createTicketSchema, etc.)
class CreateTicketBody(BaseModel):
    project_id: int = Field(..., min_length=1, validation_alias="projectId", serialization_alias="projectId")
    title: str = Field(..., min_length=1)
    overview: str = ""
    status: TicketStatusEnum = TicketStatusEnum.OPEN
    priority: TicketPriorityEnum = TicketPriorityEnum.NORMAL
    suggested_file_ids: Optional[List[int]] = Field(None, validation_alias="suggestedFileIds", serialization_alias="suggestedFileIds")
    model_config = ConfigDict(populate_by_name=True)

    _validate_project_id = field_validator('project_id', mode='before')(convert_id_to_int)
    @field_validator('suggested_file_ids', mode='before') # Reusing validator logic
    def validate_suggested_file_ids_body(cls, v):
        if v is None: return None
        if not isinstance(v, list): raise TypeError("suggested_file_ids must be a list.")
        return [convert_id_to_int(id_val) for id_val in v]


class UpdateTicketBody(BaseModel):
    title: Optional[str] = Field(None, min_length=1)
    overview: Optional[str] = None
    status: Optional[TicketStatusEnum] = None
    priority: Optional[TicketPriorityEnum] = None
    suggested_file_ids: Optional[List[int]] = Field(None, validation_alias="suggestedFileIds", serialization_alias="suggestedFileIds")
    model_config = ConfigDict(populate_by_name=True)

    @field_validator('suggested_file_ids', mode='before') # Reusing validator logic
    def validate_suggested_file_ids_update_body(cls, v):
        if v is None: return None
        if not isinstance(v, list): raise TypeError("suggested_file_ids must be a list.")
        return [convert_id_to_int(id_val) for id_val in v]

class LinkFilesBody(BaseModel):
    file_ids: List[int] = Field(..., min_items=1, validation_alias="fileIds", serialization_alias="fileIds")
    model_config = ConfigDict(populate_by_name=True)

    @field_validator('file_ids', mode='before')
    def validate_file_ids_body(cls, v):
        if not isinstance(v, list): raise TypeError("file_ids must be a list.")
        return [convert_id_to_int(id_val) for id_val in v]

class SuggestTasksBody(BaseModel):
    user_context: Optional[str] = Field(None, validation_alias="userContext", serialization_alias="userContext")
    model_config = ConfigDict(populate_by_name=True)

class CreateTaskBody(BaseModel):
    content: str = Field(..., min_length=1)

class UpdateTaskBody(BaseModel):
    content: Optional[str] = None
    done: Optional[bool] = None

class ReorderTaskItem(BaseModel):
    task_id: int = Field(..., validation_alias="taskId", serialization_alias="taskId")
    order_index: int = Field(..., ge=0, validation_alias="orderIndex", serialization_alias="orderIndex")
    model_config = ConfigDict(populate_by_name=True)

    _validate_task_id = field_validator('task_id', mode='before')(convert_id_to_int)

class ReorderTasksBody(BaseModel):
    tasks: List[ReorderTaskItem]

class UpdateSuggestedFilesBody(BaseModel):
    suggested_file_ids: List[int] = Field(..., min_items=1, validation_alias="suggestedFileIds", serialization_alias="suggestedFileIds")
    model_config = ConfigDict(populate_by_name=True)

    @field_validator('suggested_file_ids', mode='before')
    def validate_suggested_file_ids_update_sugg_body(cls, v):
        if not isinstance(v, list): raise TypeError("suggested_file_ids must be a list.")
        return [convert_id_to_int(id_val) for id_val in v]

# Params classes for ticketsApiValidation (simplified names for Pydantic)
class TicketIdParams(BaseModel):
    ticket_id: int = Field(..., validation_alias="ticketId", serialization_alias="ticketId")
    model_config = ConfigDict(populate_by_name=True)
    _validate_ticket_id = field_validator('ticket_id', mode='before')(convert_id_to_int)

class TicketAndTaskIdParams(BaseModel):
    ticket_id: int = Field(..., validation_alias="ticketId", serialization_alias="ticketId")
    task_id: int = Field(..., validation_alias="taskId", serialization_alias="taskId")
    model_config = ConfigDict(populate_by_name=True)
    _validate_ids = field_validator('ticket_id', 'task_id', mode='before')(convert_id_to_int)

# Type Aliases based on Zod .infer types (if needed for external use)
# Pydantic models themselves serve as the types.
TicketBase = TicketRead         # Read model includes all necessary fields
TicketTaskBase = TicketTaskRead # Read model includes all necessary fields
TicketFileBase = TicketFileRead # Read model includes all necessary fields

# Need to import json for the suggested_file_ids validator
import json
