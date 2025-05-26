

from typing import Optional, Dict, Any, Literal as TypingLiteral
from pydantic import BaseModel, Field
from enum import Enum

class ErrorDetail(BaseModel):
    message: str
    code: Optional[str] = None
    details: Optional[Dict[str, Any]] = None

class ApiErrorResponse(BaseModel):
    success: bool = Field(default=False)
    error: ErrorDetail

    class Config:
        openapi_extra = {"title": "ApiErrorResponse"}

class OperationSuccessResponse(BaseModel):
    success: TypingLiteral[True] = True
    message: str = Field(..., example='Operation completed successfully')

    class Config:
        openapi_extra = {"title": "OperationSuccessResponse"}

class MessageRoleEnum(str, Enum):
    ASSISTANT = 'assistant'
    USER = 'user'
    SYSTEM = 'system'