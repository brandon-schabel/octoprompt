import os
from typing import Optional, Dict, Any
from pydantic import BaseModel, Field, ValidationError
from datetime import datetime, timezone
from fastapi import HTTPException
import aiofiles # For async file operations

# Assuming these schemas will be defined in your Python project
# from app.schemas.ai_file_change_schemas import AIFileChangeRecord, AIFileChangeStatus
# from app.schemas.project_schemas import ProjectId # If needed
from app.schemas.provider_key_schemas import AIProviderEnum # If provider selection is used

# Placeholder for shared schemas until fully defined in Python project
class AIFileChangeStatus(str, Enum):
    PENDING = "pending"
    CONFIRMED = "confirmed"
    REJECTED = "rejected"
    FAILED = "failed"

class AIFileChangeRecord(BaseModel):
    id: str
    project_id: str = Field(..., alias="projectId")
    file_path: str = Field(..., alias="filePath")
    original_content: str = Field(..., alias="originalContent")
    suggested_content: str = Field(..., alias="suggestedContent")
    diff: Optional[str] = None
    explanation: str
    prompt: str
    status: AIFileChangeStatus
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc), alias="createdAt")
    updated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc), alias="updatedAt")

    model_config = {"populate_by_name": True, "arbitrary_types_allowed": True}


# Placeholder for project_storage_util - this needs to be implemented
# from app.utils.storage.project_storage import project_storage_util
class MockProjectStorageUtil: # Replace with actual implementation
    def generate_id(self, prefix: str) -> str:
        import uuid
        return f"{prefix}_{uuid.uuid4()}"

    async def save_ai_file_change(self, project_id: str, record: AIFileChangeRecord) -> None:
        print(f"[MockProjectStorage] Saving AIFileChangeRecord {record.id} for project {project_id}")
        # Actual implementation would save to DB/file
        # For now, we can store in a dictionary if needed for basic flow
        if not hasattr(self, '_ai_file_changes'):
            self._ai_file_changes = {}
        if project_id not in self._ai_file_changes:
            self._ai_file_changes[project_id] = {}
        self._ai_file_changes[project_id][record.id] = record.model_dump(by_alias=True)


    async def get_ai_file_change_by_id(self, project_id: str, change_id: str) -> Optional[AIFileChangeRecord]:
        print(f"[MockProjectStorage] Getting AIFileChangeRecord {change_id} for project {project_id}")
        # Actual implementation would fetch from DB/file
        if hasattr(self, '_ai_file_changes') and project_id in self._ai_file_changes and change_id in self._ai_file_changes[project_id]:
             return AIFileChangeRecord.model_validate(self._ai_file_changes[project_id][change_id])
        return None

project_storage_util = MockProjectStorageUtil() # Use actual instance


# Placeholder for gen-ai services - this needs to be implemented
# from app.services.gen_ai_services import generate_structured_data
# from app.constants.model_default_configs import MEDIUM_MODEL_CONFIG # Python equivalent
MEDIUM_MODEL_CONFIG = {"temperature": 0.5, "max_tokens": 2000} # Example

class FileChangeResponse(BaseModel):
    updated_content: str = Field(..., description="The complete, updated content of the file after applying the changes.", alias="updatedContent")
    explanation: str = Field(..., description="A brief explanation of the changes made.")
    model_config = {"populate_by_name": True}

async def generate_structured_data(
    system_message: str,
    prompt: str,
    schema: BaseModel, # Actually Type[BaseModel]
    options: Dict[str, Any],
    provider: Optional[AIProviderEnum] = None, # Added provider and model
    model: Optional[str] = None
) -> FileChangeResponse: # Should return an instance of the schema
    print(f"\n--- MOCKING generate_structured_data ---")
    print(f"System Message: {system_message[:100]}...")
    print(f"Prompt: {prompt[:100]}...")
    print(f"Schema: {schema.__name__}") # Pydantic model name
    print(f"Options: {options}")
    print(f"Provider: {provider}, Model: {model}")
    # This is a mock. In a real scenario, this would call an LLM.
    # We need to return something that matches FileChangeResponseSchema.
    mock_explanation = "Mock explanation: The user's request was processed and changes were applied."
    # Attempt to find some markers in the prompt to make a pseudo-change
    if "User Request: Add a comment" in prompt:
        original_start_index = prompt.find("Original File Content:\n```\n") + len("Original File Content:\n```\n")
        original_end_index = prompt.find("\n```\n\nUser Request:")
        original_content_mock = prompt[original_start_index:original_end_index]
        mock_updated_content = f"# This is a new comment\n{original_content_mock}"
    elif "User Request: Make it say hello world" in prompt:
        mock_updated_content = "print('Hello, World!')"
    else:
        mock_updated_content = "This is mock updated content based on the prompt."
    
    print(f"Mocked Updated Content: {mock_updated_content[:100]}...")
    print(f"--- END MOCK ---")

    # Validate mock output against the schema
    try:
        return FileChangeResponse(updatedContent=mock_updated_content, explanation=mock_explanation)
    except ValidationError as ve:
        print(f"Mock validation error: {ve}")
        # Fallback if validation fails for some reason during mock
        return FileChangeResponse(updatedContent="Error in mock generation", explanation="Mock validation failed")


# Equivalent of resolvePath - assuming it's relative to a workspace root or similar concept
def resolve_path_py(file_path: str) -> str:
    # This is a simplified version. In a real app, this might involve
    # checking against a project's root directory or other security checks.
    # For now, assume file_path is relative to the current working directory or an absolute path.
    # If it's meant to be relative to a specific project root, that needs to be passed or configured.
    # return os.path.abspath(file_path)
    # Based on TS, it's likely resolving from CWD or a project base.
    # For now, let's just ensure it's an absolute path.
    # If project context is available, it should be `Path(project.path) / file_path`
    return os.path.join(os.getcwd(), file_path) if not os.path.isabs(file_path) else file_path


async def read_local_file_content(file_path: str) -> str:
    try:
        # In Python, we need to handle path resolution carefully.
        # The TS version uses a utility `resolvePath`. We need an equivalent.
        # resolved_path = resolve_path_py(file_path) # Needs proper project context
        # For now, assume filePath is an absolute path or resolvable from CWD by the caller.
        async with aiofiles.open(file_path, mode='r', encoding='utf-8') as f:
            content = await f.read()
        return content
    except FileNotFoundError:
        print(f"File not found: {file_path}")
        raise HTTPException(status_code=404, detail=f"File not found: {file_path}")
    except Exception as e:
        print(f"Failed to read file: {file_path}, Error: {e}")
        raise HTTPException(status_code=500, detail=f"Could not read file content for: {file_path}")


async def perform_ai_file_generation(
    file_path: str,
    prompt: str,
    original_content: str,
    provider: Optional[AIProviderEnum] = None,
    model: Optional[str] = None,
    temperature: Optional[float] = None,
) -> FileChangeResponse:
    cfg = MEDIUM_MODEL_CONFIG.copy() # Use a copy to modify
    if temperature is not None:
        cfg["temperature"] = temperature
    # model and provider can be passed to generate_structured_data if it supports them

    system_message = f"""
You are an expert coding assistant. You will be given the content of a file and a user request describing changes.
Your task is to:
1. Understand the user's request and apply the necessary modifications to the file content.
2. Output a JSON object containing:
   - "updatedContent": The *entire* file content after applying the changes.
   - "explanation": A concise summary of the modifications you made.
Strictly adhere to the JSON output format. Only output the JSON object.
File Path: {file_path}
"""

    user_prompt = f"""
Original File Content:
```
{original_content}
```

User Request: {prompt}
"""

    try:
        # Assuming generate_structured_data is adapted for Pydantic and Python
        ai_response_obj = await generate_structured_data(
            system_message=system_message,
            prompt=user_prompt,
            schema=FileChangeResponse, # Pass the Pydantic model itself
            options=cfg,
            provider=provider, # Pass through
            model=model        # Pass through
        )
        return ai_response_obj # Already a Pydantic object
    except Exception as e:
        print(f"[AIFileChangeService] Failed to generate AI file change for {file_path}: {e}")
        error_message = str(e) if isinstance(e, (HTTPException, ValueError)) else "AI generation failed"
        error_code = "AI_FILE_CHANGE_GENERATION_FAILED"
        status_code = e.status_code if isinstance(e, HTTPException) else 500
        raise HTTPException(
            status_code=status_code,
            detail={"message": f"AI failed to generate changes for {file_path}: {error_message}", "code": error_code}
        )

class GenerateFileChangeOptions(BaseModel):
    project_id: str = Field(..., alias="projectId")
    file_path: str = Field(..., alias="filePath") # Should be relative to project root
    prompt: str
    # Optional: provider, model, temperature can be added if needed for API call
    provider: Optional[AIProviderEnum] = None
    model: Optional[str] = None
    temperature: Optional[float] = None
    model_config = {"populate_by_name": True}


async def generate_file_change(options: GenerateFileChangeOptions) -> AIFileChangeRecord:
    # Path resolution needs to be handled carefully. filePath is relative to project.
    # For read_local_file_content, we need an absolute path.
    # This assumes a global way to get project path, or options.project_path if available.
    # Placeholder: project_root = get_project_root(options.project_id)
    # absolute_file_path = os.path.join(project_root, options.file_path)
    # For now, if options.filePath is already absolute or resolvable by readLocalFileContent, it might work.
    # Let's assume for now options.filePath is the path that read_local_file_content can handle.
    # In a real app, you'd construct absolute_file_path = Path(project.path) / options.filePath
    
    # This part needs a way to get the project's base path to make options.file_path absolute
    # For this conversion, we'll assume options.file_path is directly usable by read_local_file_content
    # or that resolve_path_py is configured correctly outside this service.
    # Let's assume options.file_path is relative and needs to be made absolute based on a known project root.
    # This detail depends on how projects and their paths are managed in the Python backend.
    # For this example, we'll proceed as if options.file_path is directly usable or becomes absolute.
    # A robust solution would involve fetching project by options.project_id to get its root path.

    # Simplified path for now, assuming it is handled by caller or a global config.
    # In a real app: project = await project_service.get_project_by_id(options.project_id)
    # if not project: raise HTTPException(404, "Project not found")
    # absolute_file_path = Path(project.path) / options.filePath
    # For now, let's make a big assumption that options.file_path is an absolute path for the demo
    absolute_file_path = options.file_path # This is a temporary simplification.

    original_content = await read_local_file_content(absolute_file_path)

    ai_suggestion = await perform_ai_file_generation(
        file_path=options.file_path, # Use relative path for AI context
        prompt=options.prompt,
        original_content=original_content,
        provider=options.provider,
        model=options.model,
        temperature=options.temperature
    )

    now = datetime.now(timezone.utc)
    change_id = project_storage_util.generate_id("aifc") # Using the mock/actual storage util

    new_record_data = {
        "id": change_id,
        "project_id": options.project_id,
        "file_path": options.file_path, # Store relative path
        "original_content": original_content,
        "suggested_content": ai_suggestion.updated_content,
        "diff": None, # Diff generation can be a separate step if needed
        "explanation": ai_suggestion.explanation,
        "prompt": options.prompt,
        "status": AIFileChangeStatus.PENDING,
        "created_at": now,
        "updated_at": now,
    }
    try:
        new_record = AIFileChangeRecord.model_validate(new_record_data)
    except ValidationError as e:
        raise HTTPException(status_code=500, detail=f"Validation error creating file change record: {e.errors()}")


    await project_storage_util.save_ai_file_change(options.project_id, new_record)

    retrieved_record = await project_storage_util.get_ai_file_change_by_id(options.project_id, change_id)
    if not retrieved_record:
        raise HTTPException(status_code=500, detail={"message": f"Failed to retrieve newly created file change record with ID: {change_id}", "code": "FILE_CHANGE_STORE_FAILED"})
    return retrieved_record


async def get_file_change(project_id: str, ai_file_change_id: str) -> Optional[AIFileChangeRecord]:
    record = await project_storage_util.get_ai_file_change_by_id(project_id, ai_file_change_id)
    return record # Will be None if not found, Pydantic model if found


async def confirm_file_change(project_id: str, ai_file_change_id: str) -> Dict[str, Any]:
    existing_record = await project_storage_util.get_ai_file_change_by_id(project_id, ai_file_change_id)

    if not existing_record:
        raise HTTPException(status_code=404, detail={"message": f"File change with ID {ai_file_change_id} not found in project {project_id}.", "code": "AI_FILE_CHANGE_NOT_FOUND"})
    
    if existing_record.status != AIFileChangeStatus.PENDING:
        raise HTTPException(status_code=400, detail={"message": f"File change with ID {ai_file_change_id} is already {existing_record.status.value}.", "code": "AI_FILE_CHANGE_INVALID_STATE"})

    now = datetime.now(timezone.utc)
    
    # Create a dictionary of updates
    update_data = {
        "status": AIFileChangeStatus.CONFIRMED,
        "updated_at": now
    }
    # Use model_copy for safe updating of Pydantic models
    updated_record = existing_record.model_copy(update=update_data)
    
    await project_storage_util.save_ai_file_change(project_id, updated_record) # Save the updated Pydantic model

    return {"status": AIFileChangeStatus.CONFIRMED.value, "message": f"File change {ai_file_change_id} confirmed successfully."}


async def reject_file_change(project_id: str, ai_file_change_id: str) -> Dict[str, Any]:
    existing_record = await project_storage_util.get_ai_file_change_by_id(project_id, ai_file_change_id)

    if not existing_record:
        raise HTTPException(status_code=404, detail={"message": f"File change with ID {ai_file_change_id} not found in project {project_id}.", "code": "AI_FILE_CHANGE_NOT_FOUND"})
    
    if existing_record.status != AIFileChangeStatus.PENDING:
        raise HTTPException(status_code=400, detail={"message": f"File change with ID {ai_file_change_id} is already {existing_record.status.value}.", "code": "AI_FILE_CHANGE_INVALID_STATE"})

    now = datetime.now(timezone.utc)
    update_data = {
        "status": AIFileChangeStatus.REJECTED,
        "updated_at": now
    }
    updated_record = existing_record.model_copy(update=update_data)
    
    await project_storage_util.save_ai_file_change(project_id, updated_record)

    return {"status": AIFileChangeStatus.REJECTED.value, "message": f"File change {ai_file_change_id} rejected."}
