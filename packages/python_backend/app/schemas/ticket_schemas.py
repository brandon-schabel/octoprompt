from typing import Optional, List, Dict, Any, Literal, Union
from pydantic import BaseModel, Field, ConfigDict, field_validator, validator
from enum import Enum
from datetime import datetime

# --- Ticket Schemas ---
# Last 5 changes:
# 1. Initial conversion from Zod to Pydantic.
# 2. Mapped various Zod schemas (TicketCreateSchema, TicketReadSchema, etc.) to Pydantic models.
# 3. Handled z.enum, .optional(), .default(), .preprocess().
# 4. Created enums for Status and Priority where z.enum was used with specific values.
# 5. Mapped .openapi() metadata where available (though not present in original Zod for these).

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
    project_id: str = Field(..., validation_alias="projectId", serialization_alias="projectId")
    title: str
    overview: Optional[str] = None
    status: Optional[str] = None # Or TicketStatusEnum if these should be strictly validated from the start
    priority: Optional[str] = None # Or TicketPriorityEnum
    suggested_file_ids: Optional[str] = Field(None, validation_alias="suggestedFileIds", serialization_alias="suggestedFileIds") # This seems like it should be List[str] based on later schemas
    model_config = ConfigDict(populate_by_name=True)

class TicketRead(BaseModel):
    id: str
    project_id: str = Field(..., validation_alias="projectId", serialization_alias="projectId")
    title: str
    overview: str
    status: str # Or TicketStatusEnum
    priority: str # Or TicketPriorityEnum
    suggested_file_ids: str = Field(..., validation_alias="suggestedFileIds", serialization_alias="suggestedFileIds") # Again, likely List[str]
    created_at: datetime = Field(..., validation_alias="createdAt", serialization_alias="createdAt")
    updated_at: datetime = Field(..., validation_alias="updatedAt", serialization_alias="updatedAt")
    model_config = ConfigDict(populate_by_name=True)

class TicketUpdate(BaseModel):
    title: Optional[str] = None
    overview: Optional[str] = None
    status: Optional[str] = None # Or TicketStatusEnum
    priority: Optional[str] = None # Or TicketPriorityEnum
    suggested_file_ids: Optional[str] = Field(None, validation_alias="suggestedFileIds", serialization_alias="suggestedFileIds") # Likely List[str]
    model_config = ConfigDict(populate_by_name=True)

class TicketFileRead(BaseModel):
    ticket_id: str = Field(..., validation_alias="ticketId", serialization_alias="ticketId")
    file_id: str = Field(..., validation_alias="fileId", serialization_alias="fileId")
    model_config = ConfigDict(populate_by_name=True)

class TicketTaskCreate(BaseModel):
    ticket_id: str = Field(..., validation_alias="ticketId", serialization_alias="ticketId")
    content: str
    done: Optional[bool] = None
    order_index: Optional[int] = Field(None, validation_alias="orderIndex", serialization_alias="orderIndex")
    model_config = ConfigDict(populate_by_name=True)

class TicketTaskRead(BaseModel):
    id: str
    ticket_id: str = Field(..., validation_alias="ticketId", serialization_alias="ticketId")
    content: str
    done: bool
    order_index: int = Field(..., validation_alias="orderIndex", serialization_alias="orderIndex")
    created_at: datetime = Field(..., validation_alias="createdAt", serialization_alias="createdAt")
    updated_at: datetime = Field(..., validation_alias="updatedAt", serialization_alias="updatedAt")
    model_config = ConfigDict(populate_by_name=True)

    @validator('done', pre=True)
    def preprocess_done(cls, v):
        if isinstance(v, int):
            return v == 1
        return v

class TaskSuggestionFile(BaseModel):
    file_id: str = Field(..., validation_alias="fileId", serialization_alias="fileId")
    file_name: str = Field(..., validation_alias="fileName", serialization_alias="fileName")
    model_config = ConfigDict(populate_by_name=True)

class TaskSuggestionItem(BaseModel):
    title: str
    description: Optional[str] = None
    files: Optional[List[TaskSuggestionFile]] = None

class TaskSuggestions(BaseModel):
    tasks: List[TaskSuggestionItem]

# Schemas based on the refined Zod definitions (createTicketSchema, etc.)
class CreateTicketBody(BaseModel):
    project_id: str = Field(..., min_length=1, validation_alias="projectId", serialization_alias="projectId")
    title: str = Field(..., min_length=1)
    overview: str = ""
    status: TicketStatusEnum = TicketStatusEnum.OPEN
    priority: TicketPriorityEnum = TicketPriorityEnum.NORMAL
    suggested_file_ids: Optional[List[str]] = Field(None, validation_alias="suggestedFileIds", serialization_alias="suggestedFileIds")
    model_config = ConfigDict(populate_by_name=True)

class UpdateTicketBody(BaseModel):
    title: Optional[str] = Field(None, min_length=1)
    overview: Optional[str] = None
    status: Optional[TicketStatusEnum] = None
    priority: Optional[TicketPriorityEnum] = None
    suggested_file_ids: Optional[List[str]] = Field(None, validation_alias="suggestedFileIds", serialization_alias="suggestedFileIds")
    model_config = ConfigDict(populate_by_name=True)

class LinkFilesBody(BaseModel):
    file_ids: List[str] = Field(..., min_items=1, validation_alias="fileIds", serialization_alias="fileIds")
    model_config = ConfigDict(populate_by_name=True)

class SuggestTasksBody(BaseModel):
    user_context: Optional[str] = Field(None, validation_alias="userContext", serialization_alias="userContext")
    model_config = ConfigDict(populate_by_name=True)

class CreateTaskBody(BaseModel):
    content: str = Field(..., min_length=1)

class UpdateTaskBody(BaseModel):
    content: Optional[str] = None
    done: Optional[bool] = None

class ReorderTaskItem(BaseModel):
    task_id: str = Field(..., validation_alias="taskId", serialization_alias="taskId")
    order_index: int = Field(..., ge=0, validation_alias="orderIndex", serialization_alias="orderIndex")
    model_config = ConfigDict(populate_by_name=True)

class ReorderTasksBody(BaseModel):
    tasks: List[ReorderTaskItem]

class UpdateSuggestedFilesBody(BaseModel):
    suggested_file_ids: List[str] = Field(..., min_items=1, validation_alias="suggestedFileIds", serialization_alias="suggestedFileIds")
    model_config = ConfigDict(populate_by_name=True)

# Params classes for ticketsApiValidation (simplified names for Pydantic)
class TicketIdParams(BaseModel):
    ticket_id: str = Field(..., validation_alias="ticketId", serialization_alias="ticketId")
    model_config = ConfigDict(populate_by_name=True)

class TicketAndTaskIdParams(BaseModel):
    ticket_id: str = Field(..., validation_alias="ticketId", serialization_alias="ticketId")
    task_id: str = Field(..., validation_alias="taskId", serialization_alias="taskId")
    model_config = ConfigDict(populate_by_name=True)

# Type Aliases based on Zod .infer types (if needed for external use)
# Pydantic models themselves serve as the types.
# Example: Ticket = TicketRead
# Example: TicketTask = TicketTaskRead
