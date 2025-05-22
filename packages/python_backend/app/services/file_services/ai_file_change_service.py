import os
from typing import Optional, Dict, Any
from pydantic import BaseModel, Field, ValidationError, ConfigDict
from datetime import datetime, timezone
from fastapi import HTTPException, status # Added status for HTTP codes
import aiofiles
from enum import Enum

from app.schemas.ai_file_change_schemas import AIFileChangeRecord, AIFileChangeStatusEnum, ConfirmRejectResult
# Assuming AIProviderEnum might not be defined if provider_key_schemas.py is not available.
# from app.schemas.provider_key_schemas import AIProviderEnum
class AIProviderEnum(str, Enum): # Placeholder if not available
    OPENAI = "openai"
    MOCK = "mock"

from app.utils.storage.project_storage import project_storage # Assuming this exists and is configured

AIFileChangeStatus = AIFileChangeStatusEnum # Alias for convenience

MEDIUM_MODEL_CONFIG = {"temperature": 0.5, "max_tokens": 2000}

class FileChangeResponse(BaseModel): # Internal DTO for AI response
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
    print(f"\n--- MOCKING generate_structured_data for {schema.__name__} ---")
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
        print(f"Mock validation error for FileChangeResponse: {ve}")
        # Fallback to ensure it always returns the schema type
        return FileChangeResponse(updatedContent="Error in mock generation: Validation failed", explanation="Mock validation failed to produce valid FileChangeResponse")


async def read_local_file_content(file_path: str) -> str:
    # This mock might need adjustment based on actual project base paths if file_path is relative
    # For now, assuming file_path could be an absolute path or a path that can be found.
    if not os.path.isabs(file_path): # Simple check; real app needs better path logic
        # Try to make it relative to a mock project root if needed for testing
        # For this example, let's assume it refers to a path that might exist or will be created.
        pass

    if not os.path.exists(file_path):
        print(f"Mock file not found: {file_path}, returning placeholder content.")
        # For 'generate_file_change', the file *must* exist to get original_content.
        # If it's called, it implies the file should be there or the caller handles it.
        # Raising an error might be more appropriate here if the file is expected.
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={"message": f"Original file not found at path: {file_path}", "code": "ORIGINAL_FILE_NOT_FOUND"}
        )
    try:
        async with aiofiles.open(file_path, mode='r', encoding='utf-8') as f:
            content = await f.read()
        return content
    except FileNotFoundError: # Should be caught by os.path.exists for this mock
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

    system_message = "You are an AI assistant that modifies files based on user instructions. Output only the new file content and a brief explanation in the specified JSON format." # Simplified
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
        print(f"[AIFileChangeService] Failed to generate AI file change for {file_path}: {e}")
        error_message = str(e) if isinstance(e, (HTTPException, ValueError)) else "AI generation failed"
        error_detail = {"message": f"AI failed to generate changes for {file_path}: {error_message}", "code": "AI_GENERATION_FAILED"}
        status_code = e.status_code if isinstance(e, HTTPException) else 500
        raise HTTPException(status_code=status_code, detail=error_detail)

# This DTO is for passing options to the generate_file_change service function
class GenerateFileChangeOptions(BaseModel):
    project_id: str = Field(..., alias="projectId")
    file_path: str = Field(..., alias="filePath") # Relative to project root in TS, ensure consistency
    prompt: str
    provider: Optional[AIProviderEnum] = None
    model: Optional[str] = None
    temperature: Optional[float] = None
    model_config = ConfigDict(populate_by_name=True)


async def generate_file_change(options: GenerateFileChangeOptions) -> AIFileChangeRecord:
    # Assuming options.file_path is a path that read_local_file_content can handle.
    # In a real app, project_id would be used to resolve the absolute path for options.file_path.
    # For this mock, let's assume options.file_path can be used directly or is made absolute.
    
    # Mock: Create a dummy file if it doesn't exist to simulate reading original content
    # This part is for making the mock runnable without pre-existing files.
    # A real service would rely on the file system / project context.
    absolute_file_path = options.file_path # Simplification
    if "mock_test_files/" in absolute_file_path: # Example condition for test setup
        os.makedirs(os.path.dirname(absolute_file_path), exist_ok=True)
        if not os.path.exists(absolute_file_path):
            async with aiofiles.open(absolute_file_path, "w") as f:
                await f.write(f"// Mock original content for {options.file_path}\nconsole.log('original');\n")

    try:
        original_content = await read_local_file_content(absolute_file_path)
    except HTTPException as e:
        # Re-raise if file not found, as it's a prerequisite
        if e.status_code == status.HTTP_404_NOT_FOUND:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST, # Or 404 if project context implies file should exist
                detail={"message": f"File to change not found at path: {options.file_path}", "code": "FILE_PATH_NOT_FOUND_FOR_CHANGE"}
            ) from e
        raise # Re-raise other read errors

    ai_suggestion = await perform_ai_file_generation(
        file_path=options.file_path, # Relative path is fine for AI context
        prompt=options.prompt,
        original_content=original_content,
        provider=options.provider,
        model=options.model,
        temperature=options.temperature
    )

    now = datetime.now(timezone.utc)
    change_id = project_storage.generate_id("aifc") # Assumes project_storage is available

    new_record_data = {
        "id": change_id,
        "projectId": options.project_id,
        "filePath": options.file_path,
        "originalContent": original_content,
        "suggestedContent": ai_suggestion.updated_content,
        "diff": None, # Diff generation would be a separate step or part of AI
        "explanation": ai_suggestion.explanation,
        "prompt": options.prompt,
        "status": AIFileChangeStatus.PENDING,
        "created": now,
        "updated": now,
    }
    try:
        # AIFileChangeRecord model has populate_by_name=True and aliases.
        # So, initializing with keys like "projectId" is fine.
        new_record = AIFileChangeRecord.model_validate(new_record_data)
    except ValidationError as e:
        # This indicates an issue with the data generated by the service for its own schema.
        print(f"SERVICE VALIDATION ERROR: {e.errors()}")
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
    existing_record = await get_file_change(project_id, ai_file_change_id) # Uses the one that raises 404

    if existing_record.status != AIFileChangeStatus.PENDING:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={"message": f"File change ID {ai_file_change_id} is already {existing_record.status.value}, cannot confirm.", "code": "AI_FILE_CHANGE_INVALID_STATE_FOR_CONFIRM"}
        )

    now = datetime.now(timezone.utc)
    update_data = {"status": AIFileChangeStatus.CONFIRMED, "updated": now}
    
    # Pydantic v2: .model_copy(update=...)
    # Pydantic v1: .copy(update=...)
    updated_record = existing_record.model_copy(update=update_data) 
    
    await project_storage.save_ai_file_change(project_id, updated_record)
    return ConfirmRejectResult(status=AIFileChangeStatus.CONFIRMED.value, message=f"File change {ai_file_change_id} confirmed.")


async def reject_file_change(project_id: str, ai_file_change_id: str) -> ConfirmRejectResult:
    existing_record = await get_file_change(project_id, ai_file_change_id) # Uses the one that raises 404
        
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