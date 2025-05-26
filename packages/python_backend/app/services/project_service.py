# packages/python_backend/app/services/project_service.py
# - Changed project_id parameters from str to int.
# - Changed file_id parameters from str to int where applicable.
# - Changed List[str] for file IDs to List[int].
# - Changed BulkUpdateItem.fileId to int.
# - Standardized "projectId" to "project_id" in new_file_data.
# - Ensured summary_last_updated_at consistency and int type.
# - Ensured 'updated' timestamp in remove_summaries_from_files is int.
# - Fixed bulk ID conflict by using sequence counter in ProjectStorage.generate_id().

import json
import os
import uuid
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Dict, List, Optional, Union, Tuple, Callable

from pydantic import BaseModel, ValidationError, RootModel # Added BaseModel

# Schemas (ensure these are correctly imported from your project structure)
from app.schemas.project_schemas import (
    Project,
    CreateProjectBody,
    UpdateProjectBody,
    ProjectFile,
    FileSyncData, # Added for bulk operations
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

# Import AI service functions
from app.services.gen_ai_service import generate_single_text, generate_structured_data
from app.schemas.gen_ai_schemas import AiSdkOptions # For AI options
from app.core.config import LOW_MODEL_CONFIG

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
# These are now imported from gen_ai_service.py

# --- Placeholder for File Sync Service (from ./file-services/file-sync-service-unified) ---
async def sync_project(project: Project) -> None: # project.id is int
    print(f"[project_service.py] Placeholder: sync_project called for project {project.id}")
    pass

# --- Project Service Functions ---

async def create_project(data: CreateProjectBody) -> Project:
    project_id = project_storage.generate_id() # Returns int
    now_ms = int(datetime.now(timezone.utc).timestamp() * 1000) # For new schema
    new_project_data = {
        "id": project_id, # int
        "name": data.name,
        "path": data.path,
        "description": data.description or "",
        "created": now_ms, # int
        "updated": now_ms  # int
    }
    try:
        validated_project = Project(**new_project_data)
        projects = await project_storage.read_projects() # Dict[int, Project]
        if project_id in projects: raise ApiError(409, f"Project ID conflict for {project_id}", "PROJECT_ID_CONFLICT")
        projects[project_id] = validated_project.model_dump(mode='json') # project_id key is int
        await project_storage.write_projects(projects)
        await project_storage.write_project_files(project_id, {}) # project_id is int
        return validated_project
    except ValidationError as e: raise ApiError(400, f"Validation failed creating project: {e.errors()}", "PROJECT_VALIDATION_ERROR", e.errors())
    except ApiError as e: raise e
    except Exception as e: raise ApiError(500, f"Failed to create project {data.name}. Reason: {str(e)}", "PROJECT_CREATION_FAILED")

async def get_project_by_id(project_id: int) -> Optional[Project]: # Changed to int
    try:
        projects = await project_storage.read_projects() # Dict[int, Project]
        project_data = projects.get(project_id) # project_id is int
        
        if project_data:
            if isinstance(project_data, Project): return project_data
            if isinstance(project_data, dict): return Project(**project_data)
            else:
                print(f"Warning: Corrupted project data for ID {project_id}. Type: {type(project_data)}")
                raise ApiError(500, f"Corrupted project data for ID {project_id}", "PROJECT_DATA_CORRUPT")
        return None
    except ApiError as e: raise e
    except Exception as e: raise ApiError(500, f"Error getting project {project_id}: {str(e)}", "PROJECT_GET_FAILED_STORAGE")

async def list_projects() -> List[Project]:
    try:
        projects_dict = await project_storage.read_projects() # Dict[int, Project]
        project_list = list(projects_dict.values()) # Values are Project instances
        project_list.sort(key=lambda p: p.updated, reverse=True)
        return project_list
    except ApiError as e: raise e
    except Exception as e: raise ApiError(500, f"Failed to list projects. Reason: {str(e)}", "PROJECT_LIST_FAILED")

async def update_project(project_id: int, data: UpdateProjectBody) -> Optional[Project]: # Changed to int
    try:
        projects = await project_storage.read_projects() # Dict[int, Project]
        existing_project_model = projects.get(project_id) # project_id is int, returns Project instance
        if not existing_project_model: return None
        
        update_fields = data.model_dump(exclude_unset=True)
        if not update_fields: raise ApiError(400, "At least one field (name, path, description) must be provided for update", "UPDATE_NO_FIELDS")
        
        updated_project_model = existing_project_model.model_copy(update=update_fields)
        updated_project_model.updated = int(datetime.now(timezone.utc).timestamp() * 1000) # Ensure updated is int
        
        validated_project = Project(**updated_project_model.model_dump())  
        projects[project_id] = validated_project.model_dump(mode='json') # project_id key is int
        await project_storage.write_projects(projects)
        return validated_project
    except ValidationError as e: raise ApiError(400, f"Validation failed updating project {project_id}: {e.errors()}", "PROJECT_VALIDATION_ERROR", e.errors())
    except ApiError as e: raise e
    except Exception as e: raise ApiError(500, f"Failed to update project {project_id}. Reason: {str(e)}", "PROJECT_UPDATE_FAILED")

async def delete_project(project_id: int) -> bool: # Changed to int
    try:
        projects = await project_storage.read_projects() # Dict[int, Project]
        if project_id not in projects: raise ApiError(404, f"Project not found with ID {project_id} for deletion.", "PROJECT_NOT_FOUND")
        del projects[project_id] # project_id key is int
        await project_storage.write_projects(projects)
        await project_storage.delete_project_data(project_id) # project_id is int
        return True
    except ApiError as e: raise e
    except Exception as e: raise ApiError(500, f"Failed to delete project {project_id}. Reason: {str(e)}", "PROJECT_DELETE_FAILED")

async def get_project_files(project_id: int) -> Optional[List[ProjectFile]]: # Changed to int
    try:
        project = await get_project_by_id(project_id) # project_id is int
        if not project:
            print(f"[ProjectService] Attempted to get files for non-existent project: {project_id}")
            return None
        
        files_map = await project_storage.read_project_files(project_id) # project_id is int, returns Dict[int, ProjectFile]
        return list(files_map.values()) # Values are ProjectFile instances
    except ApiError as e: raise e
    except Exception as e:
        raise ApiError(500, f"Failed to get files for project {project_id}. Reason: {str(e)}", "PROJECT_FILES_GET_FAILED")

async def update_file_content(project_id: int, file_id: int, content: str, options: Optional[Dict[str, datetime]] = None) -> ProjectFile: # Changed project_id and file_id to int
    try:
        now_ms = int(datetime.now(timezone.utc).timestamp() * 1000)
        updated_at_ms = int(options["updated"].timestamp() * 1000) if options and options.get("updated") else now_ms
        
        update_payload: Dict[str, Any] = {
            "content": content,
            "size": len(content.encode('utf-8')),
            "updated": updated_at_ms # int timestamp
        }
        
        updated_file = await project_storage.update_project_file(project_id, file_id, update_payload) # project_id, file_id are int
        if not updated_file:
            raise ApiError(404, f"File not found with ID {file_id} in project {project_id}", "FILE_NOT_FOUND")
        return updated_file
    except ApiError as e: raise e
    except ValidationError as e:  
        raise ApiError(400, f"Internal validation failed for file content {file_id}: {e.errors()}", "FILE_VALIDATION_ERROR_INTERNAL", e.errors())
    except Exception as e:
        raise ApiError(500, f"Failed to update file content for {file_id}. Reason: {str(e)}", "FILE_CONTENT_UPDATE_FAILED")

async def create_project_file_record(project_id: int, file_path: str, initial_content: str = "") -> ProjectFile: # Changed project_id to int
    project = await get_project_by_id(project_id) # project_id is int
    if not project: raise ApiError(404, f"Project not found with ID {project_id}", "PROJECT_NOT_FOUND")

    absolute_project_path = Path(resolve_path(project.path))
    absolute_file_path = Path(resolve_path(str(absolute_project_path), file_path))
    
    try:
        normalized_relative_path = str(absolute_file_path.relative_to(absolute_project_path))
    except ValueError:
        raise ApiError(400, f"File path '{file_path}' is not within the project path '{project.path}'.", "FILE_PATH_INVALID")

    file_id = project_storage.generate_id() # Returns int
    now_ms = int(datetime.now(timezone.utc).timestamp() * 1000)
    
    new_file_data = {
        "id": file_id, # int
        "project_id": project_id, # int
        "name": absolute_file_path.name,
        "path": normalized_relative_path,  
        "extension": absolute_file_path.suffix.lower() or None, 
        "size": len(initial_content.encode('utf-8')),  
        "content": initial_content,
        "summary": None,  
        "summary_last_updated_at": None, # int timestamp, snake_case
        "meta": "{}",  
        "checksum": None, 
        "created": now_ms, # int
        "updated": now_ms, # int
    }
    try:
        validated_file = ProjectFile(**new_file_data)
        files = await project_storage.read_project_files(project_id) # Dict[int, ProjectFile]
        if file_id in files: raise ApiError(409, f"File ID conflict for {file_id} in project {project_id}", "FILE_ID_CONFLICT")
        if any(f.path == validated_file.path for f in files.values()):
            raise ApiError(409, f"File path conflict for '{validated_file.path}' in project {project_id}", "FILE_PATH_CONFLICT")

        files[file_id] = validated_file 
        await project_storage.write_project_files(project_id, {k: v.model_dump(mode='json') for k, v in files.items()})
        return validated_file
    except ValidationError as e: raise ApiError(400, f"Validation failed creating file record for {file_path}: {e.errors()}", "FILE_VALIDATION_ERROR", e.errors())
    except ApiError as e: raise e
    except Exception as e: raise ApiError(500, f"Failed to create file record for {file_path}. Reason: {str(e)}", "PROJECT_FILE_CREATE_FAILED")

class BulkUpdateItem(BaseModel):  
    fileId: int # Changed to int
    data: FileSyncData

async def bulk_create_project_files(project_id: int, files_to_create: List[FileSyncData]) -> List[ProjectFile]: # Changed project_id to int
    if not files_to_create: return []
    project = await get_project_by_id(project_id) # project_id is int
    if not project: raise ApiError(404, f"Project not found with ID {project_id} for bulk file creation.", "PROJECT_NOT_FOUND")
    
    created_files: List[ProjectFile] = []
    now_ms = int(datetime.now(timezone.utc).timestamp() * 1000)
    files_map: Dict[int, ProjectFile] = await project_storage.read_project_files(project_id) # Dict[int, ProjectFile]
    existing_paths = {f.path for f in files_map.values()}

    try:
        for file_data in files_to_create:
            if file_data.path in existing_paths:
                print(f"[ProjectService] Skipping duplicate path in bulk create: {file_data.path} in project {project_id}")
                continue

            file_id = project_storage.generate_id() # int with sequence counter ensures uniqueness
            # ID conflicts should no longer occur with sequence counter implementation
            if file_id in files_map:  
                print(f"[ProjectService] Unexpected ID conflict during bulk create: {file_id}. This should not happen with sequence counter.")
                continue

            new_file_obj_data = {
                "id": file_id, # int
                "project_id": project_id, # int
                "name": file_data.name,  
                "path": file_data.path,
                "extension": file_data.extension,  
                "size": file_data.size,  
                "content": file_data.content,
                "summary": None,  
                "summary_last_updated_at": None, # int, snake_case
                "meta": "{}",  
                "checksum": file_data.checksum,
                "created": now_ms, # int
                "updated": now_ms  # int
            }
            try:
                validated_file = ProjectFile(**new_file_obj_data)
                files_map[file_id] = validated_file # file_id key is int
                created_files.append(validated_file)
                existing_paths.add(validated_file.path)
            except ValidationError as ve:
                print(f"[ProjectService] Validation failed for file {file_data.path} during bulk create: {ve.errors()}")
                continue
        
        if created_files:
            await project_storage.write_project_files(project_id, {k: v.model_dump(mode='json') for k, v in files_map.items()})
        return created_files
    except ApiError as e: raise e
    except Exception as e:
        raise ApiError(500, f"Bulk file creation failed for project {project_id}. Reason: {str(e)}", "PROJECT_BULK_CREATE_FAILED")

async def bulk_update_project_files(project_id: int, updates: List[BulkUpdateItem]) -> List[ProjectFile]: # Changed project_id to int
    if not updates: return []
    project = await get_project_by_id(project_id) # project_id is int
    if not project: raise ApiError(404, f"Project not found with ID {project_id} for bulk file update.", "PROJECT_NOT_FOUND")

    updated_files_result: List[ProjectFile] = []
    now_ms = int(datetime.now(timezone.utc).timestamp() * 1000)
    files_map = await project_storage.read_project_files(project_id) # Dict[int, ProjectFile]
    changes_made = False

    try:
        for item in updates:
            file_id = item.fileId # int
            data = item.data
            existing_file = files_map.get(file_id) # file_id is int
            if not existing_file:
                print(f"[ProjectService] File ID {file_id} not found during bulk update for project {project_id}. Skipping.")
                continue
            
            update_payload = {
                "content": data.content, "extension": data.extension, "size": data.size,
                "checksum": data.checksum, "updated": now_ms, "name": data.name, "path": data.path
            }
            updated_file = existing_file.model_copy(update=update_payload)
            
            try:  
                validated_file = ProjectFile(**updated_file.model_dump())
                files_map[file_id] = validated_file # file_id key is int
                updated_files_result.append(validated_file)
                changes_made = True
            except ValidationError as ve:
                print(f"[ProjectService] Validation failed for file {file_id} ({existing_file.path}) during bulk update: {ve.errors()}")
                continue
        
        if changes_made:
            await project_storage.write_project_files(project_id, {k: v.model_dump(mode='json') for k, v in files_map.items()})
        return updated_files_result
    except ApiError as e: raise e
    except Exception as e:
        raise ApiError(500, f"Bulk file update failed for project {project_id}. Reason: {str(e)}", "PROJECT_BULK_UPDATE_FAILED")

async def bulk_delete_project_files(project_id: int, file_ids_to_delete: List[int]) -> Dict[str, int]: # Changed project_id and List type
    if not file_ids_to_delete: return {"deleted_count": 0}
    project = await get_project_by_id(project_id) # project_id is int
    if not project: raise ApiError(404, f"Project not found with ID {project_id} for bulk file deletion.", "PROJECT_NOT_FOUND")

    files_map = await project_storage.read_project_files(project_id) # Dict[int, ProjectFile]
    deleted_count = 0
    changes_made = False
    try:
        for file_id in file_ids_to_delete: # file_id is int
            if file_id in files_map:
                del files_map[file_id] # file_id key is int
                deleted_count += 1
                changes_made = True
            else:
                print(f"[ProjectService] File ID {file_id} not found during bulk delete for project {project_id}.")
        
        if changes_made:
            await project_storage.write_project_files(project_id, {k: v.model_dump(mode='json') for k, v in files_map.items()})
        return {"deleted_count": deleted_count} # TS schema uses deletedCount
    except ApiError as e: raise e
    except Exception as e:
        raise ApiError(500, f"Bulk file deletion failed for project {project_id}. Reason: {str(e)}", "PROJECT_BULK_DELETE_FAILED")

async def get_project_files_by_ids(project_id: int, file_ids: List[int]) -> List[ProjectFile]: # Changed project_id and List type
    if not file_ids: return []
    project = await get_project_by_id(project_id) # project_id is int
    if not project: raise ApiError(404, f"Project not found with ID {project_id} when fetching files by IDs.", "PROJECT_NOT_FOUND")
    unique_file_ids = sorted(list(set(file_ids))) # file_ids are int
    try:
        files_map = await project_storage.read_project_files(project_id) # Dict[int, ProjectFile]
        result_files: List[ProjectFile] = [files_map[f_id] for f_id in unique_file_ids if f_id in files_map] # f_id is int
        return result_files
    except ApiError as e: raise e
    except Exception as e:  
        raise ApiError(500, f"Failed to fetch files by IDs for project {project_id}. Reason: {str(e)}", "PROJECT_FILES_GET_BY_IDS_FAILED")



class SummarySchema(BaseModel):  
    summary: str

async def summarize_single_file(file: ProjectFile) -> Optional[ProjectFile]: # file.id and file.project_id are int
    file_content = file.content or ""
    if not file_content.strip():
        print(f"[SummarizeSingleFile] File {file.path} (ID: {file.id}) in project {file.project_id} is empty, skipping summarization.")
        return None

    system_prompt = f"""
## You are a coding assistant specializing in concise code summaries.
1. Provide a short overview of what the file does.
2. Outline main exports (functions/classes).
3. Respond with only the textual summary, minimal fluff, no suggestions or code blocks.
Ensure your output is valid JSON that conforms to the following Pydantic schema:
{SummarySchema.model_json_schema()}"""
    
    model_id = LOW_MODEL_CONFIG.get("model")
    if not model_id:
        print(f"[SummarizeSingleFile] Model not configured for summarize-file task for file {file.path}.")
        raise ApiError(500, f"AI Model not configured for summarize-file task (file {file.path}).", "AI_MODEL_NOT_CONFIGURED", {"project_id": file.project_id, "file_id": file.id})
    
    try:
        ai_options = AiSdkOptions(**LOW_MODEL_CONFIG)
        
        structured_response = await generate_structured_data(
            prompt=file_content,  
            output_schema=SummarySchema,  
            options=ai_options,
            system_message_content=system_prompt,
        )
        
        raw_summary_data = structured_response.get("object")

        if isinstance(raw_summary_data, dict):
            try: summary_data = SummarySchema(**raw_summary_data)
            except ValidationError as ve:
                print(f"[SummarizeSingleFile] Failed to validate AI summary for {file.path}: {ve.errors()}")
                raise ApiError(500, "AI produced invalid summary structure", "AI_INVALID_SUMMARY_STRUCTURE", ve.errors())
        elif isinstance(raw_summary_data, SummarySchema):  
            summary_data = raw_summary_data
        else:  
            print(f"[SummarizeSingleFile] Unexpected summary data type from AI")
            raise ApiError(500, "AI returned unexpected summary object type", "AI_UNEXPECTED_SUMMARY_TYPE")
        
        trimmed_summary = summary_data.summary.strip()
        now_ms = int(datetime.now(timezone.utc).timestamp() * 1000)
        updated_file = await project_storage.update_project_file(
            file.project_id, # int
            file.id, # int
            {
                "summary": trimmed_summary,
                "summary_last_updated_at": now_ms 
            }
        )
        print(f"[SummarizeSingleFile] Successfully summarized and updated file: {file.path} in project {file.project_id}")
        return updated_file
    except ApiError as e: raise
    except Exception as e:
        print(f"[SummarizeSingleFile] Error during summarization for {file.path}: {str(e)}")
        raise ApiError(500, f"Failed to summarize file {file.path}. Reason: {str(e)}", "FILE_SUMMARIZE_FAILED", {"originalError": str(e), "project_id": file.project_id, "file_id": file.id})

async def summarize_files(project_id: int, file_ids_to_summarize: List[int]) -> Dict[str, Any]: # Changed project_id and List type
    all_project_files_map = await project_storage.read_project_files(project_id) # project_id is int, returns Dict[int, ProjectFile]
    if not all_project_files_map:
        print(f"[BatchSummarize] No files map found for project {project_id}.")
        return {"included": 0, "skipped": 0, "updated_files": []}

    files_to_process = [
        all_project_files_map[fid] for fid in file_ids_to_summarize # fid is int
        if fid in all_project_files_map and isinstance(all_project_files_map.get(fid), ProjectFile)
    ]
    if not files_to_process:
        print(f"[BatchSummarize] No valid files to process for project {project_id} from given IDs.")
        return {"included": 0, "skipped": len(file_ids_to_summarize), "updated_files": []}


    updated_files_result: List[ProjectFile] = []
    summarized_count = 0
    skipped_by_empty_count = 0
    error_count = 0

    for file_obj in files_to_process: # file_obj is ProjectFile
        try:
            updated_file = await summarize_single_file(file_obj)  
            if updated_file:
                updated_files_result.append(updated_file)
                summarized_count +=1
            else: skipped_by_empty_count += 1
        except Exception as e: # Catch ApiError and others
            print(f"[BatchSummarize] Error processing file {file_obj.path} (ID: {file_obj.id}) for summarization: {str(e)}")
            error_count += 1
            # Optionally include error details per file if the return structure supports it

    total_to_process = len(files_to_process)
    final_skipped_count = skipped_by_empty_count + error_count
    
    return {"included": summarized_count, "skipped": final_skipped_count, "updated_files": updated_files_result}

async def resummarize_all_files(project_id: int) -> None: # Changed project_id to int
    project = await get_project_by_id(project_id)
    if not project: raise ApiError(404, f"Project not found with ID {project_id} for resummarize all.", "PROJECT_NOT_FOUND")
    
    await sync_project(project) # Placeholder sync

    all_files_list = await get_project_files(project_id) # Uses the new get_project_files
    if not all_files_list: # Check if list is None or empty (simplified check)
        print(f"[ProjectService] No files found for project {project_id} after sync during resummarize all.")
        return
    
    file_ids = [f.id for f in all_files_list if isinstance(f, ProjectFile)] # f.id is int
    if not file_ids:
        print(f"[ProjectService] No valid file IDs to resummarize for project {project_id}.")
        return

    try:
        summary_results = await summarize_files(project_id, file_ids) # project_id is int, file_ids is List[int]
    except ApiError as e: raise e
    except Exception as e:
        raise ApiError(500, f"Failed during resummarization process for project {project_id}. Reason: {str(e)}", "RESUMMARIZE_ALL_FAILED")

async def remove_summaries_from_files(project_id: int, file_ids: List[int]) -> Dict[str, Any]: # Changed project_id to int, file_ids to List[int]
    if not file_ids: return {"removed_count": 0, "message": "No file IDs provided"}
    
    project = await get_project_by_id(project_id) # project_id is int
    if not project: raise ApiError(404, f"Project not found with ID {project_id} for removing summaries.", "PROJECT_NOT_FOUND")

    files_map = await project_storage.read_project_files(project_id) # project_id is int, files_map keys are int
    removed_count = 0
    now_ms = int(datetime.now(timezone.utc).timestamp() * 1000) # Use int timestamp
    changes_made = False
    
    try:
        for file_id in file_ids: # file_id is int
            if file_id in files_map:
                file = files_map[file_id]
                if file.summary is not None or file.summary_last_updated_at is not None:
                    updated_file = file.model_copy(update={
                        "summary": None,  
                        "summary_last_updated_at": None,  
                        "updated": now_ms # Use int timestamp
                    })
                    files_map[file_id] = updated_file
                    removed_count += 1
                    changes_made = True
            else:
                print(f"[ProjectService] File ID {file_id} not found in project {project_id} for remove summary.")
        
        if changes_made:
            await project_storage.write_project_files(project_id, {fid: f.model_dump(mode='json') for fid, f in files_map.items()})
        
        return {"removed_count": removed_count, "message": f"Removed summaries from {removed_count} files."}
    except ValidationError as e: 
        raise ApiError(400, f"Validation error removing summaries for project {project_id}: {e.errors()}", "PROJECT_VALIDATION_ERROR_INTERNAL", e.errors())
    except ApiError as e: raise e
    except Exception as e:
        raise ApiError(500, f"Error removing summaries: {str(e)}", "REMOVE_SUMMARIES_FAILED")

async def optimize_user_input(project_id: int, user_context: str) -> str: # Changed project_id to int
    # Assuming get_full_project_summary expects project_id as int
    project_summary = await get_full_project_summary(project_id) 
    
    system_message = f"""
<SystemPrompt>
You are the Promptimizer, a specialized assistant that refines or rewrites user queries into
more effective prompts based on the project context. Given the user's context or goal, output ONLY the single optimized prompt.
No additional commentary, no extraneous text, no markdown formatting.
</SystemPrompt>

<ProjectSummary>
{project_summary}
</ProjectSummary>

<Reasoning>
Follow the style guidelines and key requirements below:
{prompts_map.get("contemplativePrompt", "Produce concise and effective prompts.")}
</Reasoning>
""" 

    user_message = user_context.strip()
    if not user_message: return ""

    try:
        ai_options = AiSdkOptions(**LOW_MODEL_CONFIG)

        ai_response_text = await generate_single_text(
            system_message_content=system_message, 
            prompt=user_message,
            options=ai_options
        )
        return ai_response_text.strip() 
    except ApiError as e: raise e
    except Exception as e:
        print(f'[OptimizeUserInput] Failed to optimize prompt: {str(e)}')
        raise ApiError(500, f"Failed to optimize prompt: {getattr(e, 'message', str(e))}", "PROMPT_OPTIMIZE_ERROR", {"originalError": str(e)})