# app/schemas/common_schemas.py
# - Converted ApiErrorResponseSchema, OperationSuccessResponseSchema
# - Converted MessageRoleEnum
# - Used Pydantic BaseModel, Field, and Python's Enum
# - Matched OpenAPI examples and descriptions

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

class MessageRoleEnum(str, Enum): # Inheriting from str makes it JSON serializable as a string directly
    ASSISTANT = 'assistant'
    USER = 'user'
    SYSTEM = 'system'
    # TOOL = 'tool'
    # FUNCTION = 'function'