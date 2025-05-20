# packages/python_backend/app/services/project_service.py
# - Initial conversion of project-service.ts to Python
# - Implemented Project CRUD (create, get, list, update, delete)
# - Placeholder for ProjectStorage, gen_ai_services, file_sync_service
# - Uses Pydantic schemas from app.schemas.project_schemas
# - Basic error handling with ApiError and Pydantic ValidationError

import json
import os
import uuid
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Dict, List, Optional, Union, Tuple

from pydantic import ValidationError, RootModel

# Schemas (ensure these are correctly imported from your project structure)
from app.schemas.project_schemas import (
    Project,
    CreateProjectBody,
    UpdateProjectBody,
    ProjectFile, 
    # ProjectFileSchema, # Pydantic models are themselves the schemas
    # ProjectIdParams, # Handled by FastAPI path params
)
# Import ProjectFileSchema directly if needed for Pydantic validation outside models
from app.schemas.project_schemas import ProjectFile as ProjectFileSchemaPydantic # Alias for clarity
from app.schemas.project_schemas import Project as ProjectSchemaPydantic # Alias for clarity

# Assuming prompts_map.py is in app.utils
from app.utils.prompts_map import prompts_map
# Assuming get_full_project_summary.py is in app.utils
from app.utils.get_full_project_summary import get_full_project_summary

# Import the new project_storage instance
from app.utils.storage.project_storage import project_storage, ProjectFilesStorageModel # Import the model for validation if needed elsewhere

# --- Error Handling ---
class ApiError(Exception):
    def __init__(self, status_code: int, message: str, code: str, details: Any = None):
        super().__init__(message)
        self.status_code = status_code
        self.message = message
        self.code = code
        self.details = details

    def to_dict(self) -> Dict[str, Any]:
        return {
            "message": self.message,
            "code": self.code,
            "details": self.details
        }

# --- Placeholder for Path Utilities (from @/utils/path-utils) ---
def resolve_path(base_path: str, relative_or_absolute_path: Optional[str] = None) -> str:
    if relative_or_absolute_path is None:
        return str(Path(base_path).resolve())
    path_obj = Path(relative_or_absolute_path)
    if path_obj.is_absolute() or relative_or_absolute_path.startswith('~'):
        return str(path_obj.expanduser().resolve())
    return str((Path(base_path) / path_obj).resolve())

# --- Placeholder for AI Services (from ./gen-ai-services) ---
# These need to be implemented, potentially calling external APIs or local models
class MockAIResponse:
    def __init__(self, text: Optional[str] = None, object_data: Optional[Dict[str,Any]] = None):
        self.text = text or ""
        self.object = object_data or {}

async def generate_single_text(params: Dict[str, Any]) -> MockAIResponse:
    print(f"[project_service.py] Placeholder: generate_single_text called with prompt: {params.get('prompt')[:50]}...")
    return MockAIResponse(text="Optimized: " + params.get('prompt', ""))

async def generate_structured_data(params: Dict[str, Any]) -> MockAIResponse:
    print(f"[project_service.py] Placeholder: generate_structured_data called with prompt: {params.get('prompt')[:50]}...")
    # params.schema is a Pydantic model class
    # Example: return the schema's example if available, or a default based on schema
    if hasattr(params.get('schema'), "model_json_schema"):
        # This is a simplistic mock. A real implementation would use the LLM.
        mock_data = {} 
        try:
          # Attempt to generate mock data based on schema properties
          schema_props = params['schema'].model_json_schema().get("properties", {})
          for field_name, field_props in schema_props.items():
              if field_props.get("type") == "string":
                  mock_data[field_name] = f"mock {field_name}"
              elif field_props.get("type") == "integer":
                  mock_data[field_name] = 123
              # Add more types as needed
          # For the specific use in summarizeSingleFile:
          if 'summary' in schema_props:
             mock_data['summary'] = "This is a mock summary of the file content."
          return MockAIResponse(object_data=mock_data)
        except Exception as e:
          print(f"Error generating mock structured data: {e}") 
          return MockAIResponse(object_data={"summary": "Mock summary error"})
    return MockAIResponse(object_data={"summary": "Default mock summary"})

# --- Placeholder for File Sync Service (from ./file-services/file-sync-service-unified) ---
async def sync_project(project: Project) -> None:
    print(f"[project_service.py] Placeholder: sync_project called for project {project.id}")
    # This would involve file system operations, content reading, checksums etc.
    pass

# --- Project Service Functions ---

async def create_project(data: CreateProjectBody) -> Project:
    project_id = project_storage.generate_id("proj")
    now_iso = datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")

    new_project_data = {
        "id": project_id,
        "name": data.name,
        "path": data.path,
        "description": data.description or "",
        "created_at": now_iso,
        "updated_at": now_iso,
    }

    try:
        validated_project = Project(**new_project_data)
        projects = await project_storage.read_projects()
        if project_id in projects:
            raise ApiError(409, f"Project ID conflict for {project_id}", "PROJECT_ID_CONFLICT")
        
        projects[project_id] = validated_project.model_dump(mode='json')
        await project_storage.write_projects(projects)
        await project_storage.write_project_files(project_id, {}) # Create empty files list

        return validated_project
    except ValidationError as e:
        raise ApiError(
            400, # Changed from 500 to 400 for validation errors from client
            f"Validation failed creating project: {e.errors()}",
            "PROJECT_VALIDATION_ERROR",
            e.errors()
        )
    except ApiError as e:
        raise e
    except Exception as e:
        raise ApiError(
            500,
            f"Failed to create project {data.name}. Reason: {str(e)}",
            "PROJECT_CREATION_FAILED",
        )

async def get_project_by_id(project_id: str) -> Optional[Project]:
    try:
        projects = await project_storage.read_projects()
        project_data = projects.get(project_id)
        if project_data:
            # Ensure project_data is a dict before parsing with Project
            if isinstance(project_data, dict):
                return Project(**project_data)
            else:
                # This case should ideally not happen if write_projects serializes correctly
                print(f"Warning: Corrupted project data for ID {project_id}. Type: {type(project_data)}")
                raise ApiError(500, f"Corrupted project data for ID {project_id}", "PROJECT_DATA_CORRUPT")
        return None
    except ApiError as e:
        raise e
    except Exception as e:
        raise ApiError(
            500,
            f"Error getting project {project_id}: {str(e)}",
            "PROJECT_GET_FAILED_STORAGE",
        )

async def list_projects() -> List[Project]:
    try:
        projects_dict = await project_storage.read_projects()
        project_list = [Project(**data) for data in projects_dict.values() if isinstance(data, dict)]
        # Sort by updatedAt descending (datetime strings)
        project_list.sort(key=lambda p: p.updated_at, reverse=True)
        return project_list
    except ApiError as e:
        raise e
    except Exception as e:
        raise ApiError(
            500,
            f"Failed to list projects. Reason: {str(e)}",
            "PROJECT_LIST_FAILED",
        )

async def update_project(project_id: str, data: UpdateProjectBody) -> Optional[Project]:
    try:
        projects = await project_storage.read_projects()
        existing_project_data = projects.get(project_id)

        if not existing_project_data or not isinstance(existing_project_data, dict):
            return None # Or raise ApiError(404, ...) if preferred

        existing_project = Project(**existing_project_data)

        update_fields = data.model_dump(exclude_unset=True) # Get only fields that were set in request
        if not update_fields: # Check if any fields were actually provided for update
            # Pydantic schema refine should catch this, but as a safeguard:
             raise ApiError(400, "At least one field (name, path, description) must be provided for update", "UPDATE_NO_FIELDS")

        updated_project_data = existing_project.model_copy(update=update_fields)
        updated_project_data.updated_at = datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")
        
        # Validate the final structure (optional if model_copy is trusted, but good practice)
        validated_project = Project(**updated_project_data.model_dump())

        projects[project_id] = validated_project.model_dump(mode='json')
        await project_storage.write_projects(projects)

        return validated_project
    except ValidationError as e:
        raise ApiError(
            400, # Changed from 500 to 400 for validation errors
            f"Validation failed updating project {project_id}: {e.errors()}",
            "PROJECT_VALIDATION_ERROR",
            e.errors()
        )
    except ApiError as e:
        raise e
    except Exception as e:
        raise ApiError(
            500,
            f"Failed to update project {project_id}. Reason: {str(e)}",
            "PROJECT_UPDATE_FAILED",
        )

async def delete_project(project_id: str) -> bool:
    try:
        projects = await project_storage.read_projects()
        if project_id not in projects:
            raise ApiError(404, f"Project not found with ID {project_id} for deletion.", "PROJECT_NOT_FOUND")

        del projects[project_id]
        await project_storage.write_projects(projects)
        await project_storage.delete_project_data(project_id) # Delete associated files

        return True
    except ApiError as e:
        raise e
    except Exception as e:
        raise ApiError(
            500,
            f"Failed to delete project {project_id}. Reason: {str(e)}",
            "PROJECT_DELETE_FAILED",
        )

# --- Constants for AI Service (from shared) ---
# These would typically be in a config file or module
LOW_MODEL_CONFIG = {
    "provider": "openai", # Default provider, can be overridden by actual key service
    "model": "gpt-3.5-turbo", # Example model
    # Add other relevant config from LOW_MODEL_CONFIG in TS if needed
}

async def get_project_files_by_ids(project_id: str, file_ids: List[str]) -> List[ProjectFile]:
    project = await get_project_by_id(project_id)
    if not project:
        raise ApiError(404, f"Project not found with ID {project_id} when fetching files by IDs.", "PROJECT_NOT_FOUND")

    unique_file_ids = sorted(list(set(file_ids))) # Sort for consistent ordering if it matters

    try:
        # project_storage.read_project_files returns Dict[str, ProjectFile]
        files_map = await project_storage.read_project_files(project_id)
        result_files: List[ProjectFile] = []
        for f_id in unique_file_ids:
            if f_id in files_map:
                result_files.append(files_map[f_id])
        return result_files
    except ApiError as e:
        raise e

async def summarize_single_file(file: ProjectFile) -> Optional[ProjectFile]:
    file_content = file.content or ""

    if not file_content.strip():
        print(
            f"[SummarizeSingleFile] File {file.path} (ID: {file.id}) in project {file.project_id} is empty, skipping summarization."
        )
        return None # Return None, not the original file object if no summary

    # Ensure Zod-like schema for generate_structured_data is a Pydantic model
    # The schema is z.object({ summary: z.string() })
    # In Pydantic, this would be:
    class SummarySchema(BaseModel):
        summary: str

    system_prompt = f"""
## You are a coding assistant specializing in concise code summaries.
1. Provide a short overview of what the file does.
2. Outline main exports (functions/classes).
3. Respond with only the textual summary, minimal fluff, no suggestions or code blocks.
Ensure your output is valid JSON that conforms to the following Pydantic schema:
{SummarySchema.model_json_schema(indent=2)}
"""
    # cfg = LOW_MODEL_CONFIG # Already defined globally
    provider = LOW_MODEL_CONFIG.get("provider", "openai") # Use .get for safety
    model_id = LOW_MODEL_CONFIG.get("model")

    if not model_id:
        print(f"[SummarizeSingleFile] Model not configured for summarize-file task for file {file.path}.")
        raise ApiError(
            500,
            f"AI Model not configured for summarize-file task (file {file.path}).",
            "AI_MODEL_NOT_CONFIGURED",
            {"project_id": file.project_id, "file_id": file.id},
        )
    
    try:
        # generate_structured_data should return a Pydantic model or a dict that can be parsed
        ai_response_obj = await generate_structured_data({
            "prompt": file_content,
            "options": LOW_MODEL_CONFIG, # Pass the whole config
            "schema": SummarySchema, # Pass the Pydantic model class
            "system_message": system_prompt,
        })

        # Assuming ai_response_obj.object is a dict or already an instance of SummarySchema
        if isinstance(ai_response_obj.object, SummarySchema):
            summary_data = ai_response_obj.object
        elif isinstance(ai_response_obj.object, dict):
            try:
                summary_data = SummarySchema(**ai_response_obj.object)
            except ValidationError as ve:
                print(f"[SummarizeSingleFile] Failed to validate AI summary for {file.path}: {ve.errors()}")
                raise ApiError(500, "AI produced invalid summary structure", "AI_INVALID_SUMMARY_STRUCTURE", ve.errors())
        else:
            raise ApiError(500, "AI returned unexpected summary object type", "AI_UNEXPECTED_SUMMARY_TYPE")

        trimmed_summary = summary_data.summary.strip()
        
        # project_storage.update_project_file handles reading the old file, merging, and writing back
        updated_file = await project_storage.update_project_file(
            file.project_id, 
            file.id, 
            {
                "summary": trimmed_summary,
                "summary_last_updated_at": datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")
            }
        )

        print(
            f"[SummarizeSingleFile] Successfully summarized and updated file: {file.path} in project {file.project_id}"
        )
        return updated_file
    except ApiError as e: # Re-raise ApiErrors directly
        raise
    except Exception as e: # Catch other errors (network, unexpected from AI service)
        print(f"[SummarizeSingleFile] Error during summarization for {file.path}: {str(e)}")
        raise ApiError(
            500,
            f"Failed to summarize file {file.path} in project {file.project_id}. Reason: {str(e)}",
            "FILE_SUMMARIZE_FAILED",
            {"originalError": str(e), "project_id": file.project_id, "file_id": file.id},
        )

async def summarize_files(
    project_id: str,
    files_to_process: List[ProjectFile],
    summarize_single_file_func: Callable[[ProjectFile], Optional[ProjectFile]]
) -> List[ProjectFile]:
    if not files_to_process:
        return []

    updated_files: List[ProjectFile] = []
    skipped_by_empty_count = 0
    error_count = 0

    for file in files_to_process:
        try:
            updated_file = await summarize_single_file_func(file)
            if updated_file:
                updated_files.append(updated_file)
            else:
                skipped_by_empty_count += 1
        except ApiError as e:
            print(f"[BatchSummarize] Error during summarization for {file.path}: {e}")
            error_count += 1

    total_processed = len(files_to_process) # Use len() for list
    final_skipped_count = skipped_by_empty_count + error_count

    if final_skipped_count > 0:
        print(f"[BatchSummarize] {final_skipped_count} files skipped or failed to summarize in project {project_id}")

    return updated_files
