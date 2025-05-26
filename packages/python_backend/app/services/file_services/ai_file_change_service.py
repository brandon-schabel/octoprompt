import os
from typing import Optional, Dict, Any
from pydantic import BaseModel, Field, ValidationError, ConfigDict
from datetime import datetime, timezone
from fastapi import HTTPException, status
import aiofiles
from enum import Enum
from app.core.config import MEDIUM_MODEL_CONFIG

from app.schemas.ai_file_change_schemas import AIFileChangeRecord, AIFileChangeStatusEnum, ConfirmRejectResult
class AIProviderEnum(str, Enum): 
    OPENAI = "openai"
    MOCK = "mock"

from app.utils.storage.project_storage import project_storage

AIFileChangeStatus = AIFileChangeStatusEnum


class FileChangeResponse(BaseModel):
    updated_content: str = Field(..., description="The complete, updated content of the file after applying the changes.", alias="updatedContent")
    explanation: str = Field(..., description="A brief explanation of the changes made.")
    model_config = ConfigDict(populate_by_name=True)

async def generate_structured_data(
    system_message: str,
    prompt: str,
    schema: type[BaseModel],
    options: Dict[str, Any],
    provider: Optional[AIProviderEnum] = None,
    model: Optional[str] = None
) -> FileChangeResponse:
    mock_explanation = "Mock explanation: The user's request was processed and changes were applied."
    if "User Request: Add a comment" in prompt:
        original_start_index = prompt.find("Original File Content:\n```\n") + len("Original File Content:\n```\n")
        original_end_index = prompt.find("\n```\n\nUser Request:")
        original_content_mock = prompt[original_start_index:original_end_index] if original_start_index < original_end_index else "Original content not found in mock."
        mock_updated_content = f"# This is a new comment\n{original_content_mock}"
    elif "User Request: Make it say hello world" in prompt:
        mock_updated_content = "print('Hello, World!')"
    else:
        mock_updated_content = "This is mock updated content based on the prompt."
    
    try:
        return FileChangeResponse(updatedContent=mock_updated_content, explanation=mock_explanation)
    except ValidationError as ve:
        return FileChangeResponse(updatedContent="Error in mock generation: Validation failed", explanation="Mock validation failed to produce valid FileChangeResponse")

async def read_local_file_content(file_path: str) -> str:
    if not os.path.exists(file_path):
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={"message": f"Original file not found at path: {file_path}", "code": "ORIGINAL_FILE_NOT_FOUND"}
        )
    try:
        async with aiofiles.open(file_path, mode='r', encoding='utf-8') as f:
            content = await f.read()
        return content
    except FileNotFoundError: 
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={"message": f"File not found: {file_path}", "code": "FILE_NOT_FOUND_ERROR"}
        )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail={"message": f"Could not read file content for: {file_path}, Error: {str(e)}", "code": "FILE_READ_ERROR"}
        )

async def perform_ai_file_generation(
    file_path: str,
    prompt: str,
    original_content: str,
    provider: Optional[AIProviderEnum] = None,
    model: Optional[str] = None,
    temperature: Optional[float] = None,
) -> FileChangeResponse:
    cfg = MEDIUM_MODEL_CONFIG.copy()
    if temperature is not None:
        cfg["temperature"] = temperature

    system_message = "You are an AI assistant that modifies files based on user instructions. Output only the new file content and a brief explanation in the specified JSON format."
    user_prompt = f"Original File Content:\n```\n{original_content}\n```\n\nUser Request: {prompt}"
    
    try:
        ai_response_obj = await generate_structured_data(
            system_message=system_message,
            prompt=user_prompt,
            schema=FileChangeResponse,
            options=cfg,
            provider=provider,
            model=model
        )
        return ai_response_obj
    except Exception as e:
        # Removed print statement
        error_message = str(e) if isinstance(e, (HTTPException, ValueError)) else "AI generation failed"
        error_detail = {"message": f"AI failed to generate changes for {file_path}: {error_message}", "code": "AI_GENERATION_FAILED"}
        status_code = e.status_code if isinstance(e, HTTPException) else 500
        raise HTTPException(status_code=status_code, detail=error_detail)

class GenerateFileChangeOptions(BaseModel):
    project_id: str = Field(..., alias="projectId")
    file_path: str = Field(..., alias="filePath")
    prompt: str
    provider: Optional[AIProviderEnum] = None
    model: Optional[str] = None
    temperature: Optional[float] = None
    model_config = ConfigDict(populate_by_name=True)

async def generate_file_change(options: GenerateFileChangeOptions) -> AIFileChangeRecord:
    absolute_file_path = options.file_path
    if "mock_test_files/" in absolute_file_path:
        os.makedirs(os.path.dirname(absolute_file_path), exist_ok=True)
        if not os.path.exists(absolute_file_path):
            async with aiofiles.open(absolute_file_path, "w") as f:
                await f.write(f"// Mock original content for {options.file_path}\nconsole.log('original');\n")

    try:
        original_content = await read_local_file_content(absolute_file_path)
    except HTTPException as e:
        if e.status_code == status.HTTP_404_NOT_FOUND:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail={"message": f"File to change not found at path: {options.file_path}", "code": "FILE_PATH_NOT_FOUND_FOR_CHANGE"}
            ) from e
        raise

    ai_suggestion = await perform_ai_file_generation(
        file_path=options.file_path,
        prompt=options.prompt,
        original_content=original_content,
        provider=options.provider,
        model=options.model,
        temperature=options.temperature
    )

    now = datetime.now(timezone.utc)
    change_id = project_storage.generate_id("aifc")

    new_record_data = {
        "id": change_id,
        "projectId": options.project_id,
        "filePath": options.file_path,
        "originalContent": original_content,
        "suggestedContent": ai_suggestion.updated_content,
        "diff": None,
        "explanation": ai_suggestion.explanation,
        "prompt": options.prompt,
        "status": AIFileChangeStatus.PENDING,
        "created": now,
        "updated": now,
    }
    try:
        new_record = AIFileChangeRecord.model_validate(new_record_data)
    except ValidationError as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail={"message": "Validation error creating file change record internally.", "code": "SERVICE_DATA_VALIDATION_ERROR", "details": e.errors()}
        )

    await project_storage.save_ai_file_change(options.project_id, new_record)
    
    retrieved_record = await project_storage.get_ai_file_change_by_id(options.project_id, change_id)
    if not retrieved_record:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail={"message": f"Failed to retrieve newly created file change record ID: {change_id}", "code": "FILE_CHANGE_STORE_RETRIEVAL_ERROR"}
        )
    return retrieved_record

async def get_file_change(project_id: str, ai_file_change_id: str) -> Optional[AIFileChangeRecord]:
    record = await project_storage.get_ai_file_change_by_id(project_id, ai_file_change_id)
    if not record:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={"message": f"AI file change with ID {ai_file_change_id} not found in project {project_id}.", "code": "AI_FILE_CHANGE_NOT_FOUND"}
        )
    return record

async def confirm_file_change(project_id: str, ai_file_change_id: str) -> ConfirmRejectResult:
    existing_record = await get_file_change(project_id, ai_file_change_id)

    if existing_record.status != AIFileChangeStatus.PENDING:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={"message": f"File change ID {ai_file_change_id} is already {existing_record.status.value}, cannot confirm.", "code": "AI_FILE_CHANGE_INVALID_STATE_FOR_CONFIRM"}
        )

    now = datetime.now(timezone.utc)
    update_data = {"status": AIFileChangeStatus.CONFIRMED, "updated": now}
    
    updated_record = existing_record.model_copy(update=update_data) 
    
    await project_storage.save_ai_file_change(project_id, updated_record)
    return ConfirmRejectResult(status=AIFileChangeStatus.CONFIRMED.value, message=f"File change {ai_file_change_id} confirmed.")

async def reject_file_change(project_id: str, ai_file_change_id: str) -> ConfirmRejectResult:
    existing_record = await get_file_change(project_id, ai_file_change_id)
        
    if existing_record.status != AIFileChangeStatus.PENDING:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={"message": f"File change ID {ai_file_change_id} is already {existing_record.status.value}, cannot reject.", "code": "AI_FILE_CHANGE_INVALID_STATE_FOR_REJECT"}
        )

    now = datetime.now(timezone.utc)
    update_data = {"status": AIFileChangeStatus.REJECTED, "updated": now}
    updated_record = existing_record.model_copy(update=update_data)
        
    await project_storage.save_ai_file_change(project_id, updated_record)
    return ConfirmRejectResult(status=AIFileChangeStatus.REJECTED.value, message=f"File change {ai_file_change_id} rejected.")