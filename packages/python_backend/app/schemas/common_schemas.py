from typing import Optional, Dict, Any, Literal
from pydantic import BaseModel, Field, ConfigDict
from enum import Enum

class ErrorDetail(BaseModel):
    message: str = Field(..., example="An error occurred")
    code: Optional[str] = Field(None, example="ERROR_CODE")
    details: Optional[Dict[str, Any]] = Field(None, default_factory=dict)

class ApiErrorResponse(BaseModel):
    success: Literal[False] = False
    error: ErrorDetail
    model_config = ConfigDict(title="ApiErrorResponse")

class OperationSuccessResponse(BaseModel):
    success: Literal[True] = True
    message: str = Field(..., example='Operation completed successfully')
    model_config = ConfigDict(title="OperationSuccessResponse")

class MessageRoleEnum(str, Enum):
    ASSISTANT = 'assistant'
    USER = 'user'
    SYSTEM = 'system'
    # Note: TypeScript version doesn't include 'tool' and 'function'