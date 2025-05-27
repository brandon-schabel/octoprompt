from typing import Optional, List, Dict, Any, Literal, Union
from pydantic import BaseModel, Field, ConfigDict, field_validator, validator
from enum import Enum
from app.utils.storage_timestamp_utils import convert_timestamp_to_ms_int

class TicketStatusEnum(str, Enum):
    OPEN = "open"
    IN_PROGRESS = "in_progress"
    DONE = "done"
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
    status: Optional[str] = None
    priority: Optional[str] = None
    suggested_file_ids: Optional[List[int]] = Field(None, validation_alias="suggestedFileIds", serialization_alias="suggestedFileIds")
    model_config = ConfigDict(populate_by_name=True)

    @field_validator('suggested_file_ids', mode='before')
    def validate_suggested_file_ids(cls, v):
        if v is None: return None
        if isinstance(v, str):
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
        return [id_val for id_val in parsed_v]


class TicketRead(BaseModel):
    id: int
    project_id: int = Field(..., validation_alias="projectId", serialization_alias="projectId")
    title: str
    overview: str
    status: Literal['open', 'in_progress', 'done', 'closed']
    priority: Literal['low', 'normal', 'high']
    suggested_file_ids: List[int] = Field(default=[], validation_alias="suggestedFileIds", serialization_alias="suggestedFileIds")
    created: int = Field(..., validation_alias="created", serialization_alias="created", example=1678442400000)
    updated: int = Field(..., validation_alias="updated", serialization_alias="updated", example=1678442700000)
    model_config = ConfigDict(populate_by_name=True)

class TicketUpdate(BaseModel):
    title: Optional[str] = None
    overview: Optional[str] = None
    status: Optional[Literal['open', 'in_progress', 'done', 'closed']] = None
    priority: Optional[Literal['low', 'normal', 'high']] = None
    suggested_file_ids: Optional[List[int]] = Field(None, validation_alias="suggestedFileIds", serialization_alias="suggestedFileIds")
    model_config = ConfigDict(populate_by_name=True)

    @field_validator('suggested_file_ids', mode='before')
    def validate_suggested_file_ids_update(cls, v):
        if v is None: return None
        if isinstance(v, str): 
            try: parsed_v = json.loads(v)
            except json.JSONDecodeError: raise ValueError("suggested_file_ids must be a valid JSON string representing a list or null")
        elif isinstance(v, list): parsed_v = v
        else: raise TypeError("suggested_file_ids must be a list or a JSON string list")
        
        if not isinstance(parsed_v, list): raise ValueError("suggested_file_ids, if provided, must be a list of IDs.")
        return [id_val for id_val in parsed_v]


class TicketFileRead(BaseModel):
    id: int
    ticket_id: int = Field(..., validation_alias="ticketId", serialization_alias="ticketId")
    file_id: int = Field(..., validation_alias="fileId", serialization_alias="fileId")
    uploaded_at: int = Field(..., validation_alias="uploadedAt", serialization_alias="uploadedAt", example=1678442400000)
    model_config = ConfigDict(populate_by_name=True)


class TicketTaskCreate(BaseModel):
    ticket_id: int = Field(..., validation_alias="ticketId", serialization_alias="ticketId")
    content: str
    done: Optional[bool] = None
    order_index: Optional[int] = Field(None, validation_alias="orderIndex", serialization_alias="orderIndex")
    model_config = ConfigDict(populate_by_name=True)

class TicketTaskRead(BaseModel):
    id: int
    ticket_id: int = Field(..., validation_alias="ticketId", serialization_alias="ticketId")
    content: str
    done: bool
    order_index: int = Field(..., validation_alias="orderIndex", serialization_alias="orderIndex")
    created: int = Field(..., validation_alias="created", serialization_alias="created", example=1678442400000)
    updated: int = Field(..., validation_alias="updated", serialization_alias="updated", example=1678442700000)
    model_config = ConfigDict(populate_by_name=True)

    @field_validator('done', mode='before')
    def preprocess_done(cls, v):
        if isinstance(v, int):
            return v == 1
        return v

class TaskSuggestionFile(BaseModel):
    file_id: int = Field(..., validation_alias="fileId", serialization_alias="fileId")
    file_name: str = Field(..., validation_alias="fileName", serialization_alias="fileName")
    model_config = ConfigDict(populate_by_name=True)

class TaskSuggestionItem(BaseModel):
    title: str
    description: Optional[str] = None
    files: Optional[List[TaskSuggestionFile]] = None

class TaskSuggestions(BaseModel):
    tasks: List[TaskSuggestionItem]

TaskSuggestionsModel = TaskSuggestions

# Schemas based on the refined Zod definitions (createTicketSchema, etc.)
class CreateTicketBody(BaseModel):
    project_id: int = Field(..., validation_alias="projectId", serialization_alias="projectId")
    title: str = Field(..., min_length=1)
    overview: str = ""
    status: Literal['open', 'in_progress', 'closed'] = 'open'
    priority: Literal['low', 'normal', 'high'] = 'normal'
    suggested_file_ids: Optional[List[int]] = Field(None, validation_alias="suggestedFileIds", serialization_alias="suggestedFileIds")
    model_config = ConfigDict(populate_by_name=True)

    @field_validator('suggested_file_ids', mode='before')
    def validate_suggested_file_ids_body(cls, v):
        if v is None: return None
        if not isinstance(v, list): raise TypeError("suggested_file_ids must be a list.")
        return [id_val for id_val in v]


class UpdateTicketBody(BaseModel):
    title: Optional[str] = Field(None, min_length=1)
    overview: Optional[str] = None
    status: Optional[Literal['open', 'in_progress', 'done', 'closed']] = None
    priority: Optional[Literal['low', 'normal', 'high']] = None
    suggested_file_ids: Optional[List[int]] = Field(None, validation_alias="suggestedFileIds", serialization_alias="suggestedFileIds")
    model_config = ConfigDict(populate_by_name=True)

    @field_validator('suggested_file_ids', mode='before')
    def validate_suggested_file_ids_update_body(cls, v):
        if v is None: return None
        if not isinstance(v, list): raise TypeError("suggested_file_ids must be a list.")
        return [id_val for id_val in v]

class LinkFilesBody(BaseModel):
    file_ids: List[int] = Field(..., min_items=1, validation_alias="fileIds", serialization_alias="fileIds")
    model_config = ConfigDict(populate_by_name=True)

    @field_validator('file_ids', mode='before')
    def validate_file_ids_body(cls, v):
        if not isinstance(v, list): raise TypeError("file_ids must be a list.")
        return [id_val for id_val in v]

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


class ReorderTasksBody(BaseModel):
    tasks: List[ReorderTaskItem]

class UpdateSuggestedFilesBody(BaseModel):
    suggested_file_ids: List[int] = Field(..., min_items=1, validation_alias="suggestedFileIds", serialization_alias="suggestedFileIds")
    model_config = ConfigDict(populate_by_name=True)

    @field_validator('suggested_file_ids', mode='before')
    def validate_suggested_file_ids_update_sugg_body(cls, v):
        if not isinstance(v, list): raise TypeError("suggested_file_ids must be a list.")
        return [id_val for id_val in v]

# Params classes for ticketsApiValidation (simplified names for Pydantic)
class TicketIdParams(BaseModel):
    ticket_id: int = Field(..., validation_alias="ticketId", serialization_alias="ticketId")
    model_config = ConfigDict(populate_by_name=True)

class TicketAndTaskIdParams(BaseModel):
    ticket_id: int = Field(..., validation_alias="ticketId", serialization_alias="ticketId")
    task_id: int = Field(..., validation_alias="taskId", serialization_alias="taskId")
    model_config = ConfigDict(populate_by_name=True)

# Type Aliases based on Zod .infer types (if needed for external use)
TicketBase = TicketRead
TicketTaskBase = TicketTaskRead
TicketFileBase = TicketFileRead

# Need to import json for the suggested_file_ids validator
import json
