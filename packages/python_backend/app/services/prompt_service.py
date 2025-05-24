from datetime import datetime, timezone
from typing import List, Optional
from fastapi import HTTPException
from pydantic import ValidationError

from app.schemas.prompt_schemas import (
    Prompt,
    CreatePromptBody,
    UpdatePromptBody,
    PromptProject
)
from app.utils.storage.prompt_storage import prompt_storage_util, PromptsStorage, PromptProjectsStorage
from app.utils.storage_timestap_utils import convert_timestamp_to_ms_int

# Last 5 changes (from .ts):
# 1. Converted createPrompt
# 2. Converted addPromptToProject and its specific logic for single project association
# 3. Converted list, get, update, delete operations for prompts
# 4. Converted project-specific prompt operations (listByProject, removeFromProject)
# 5. Adapted error handling to FastAPI's HTTPException
# 6. Changed ID and timestamp generation/handling to use integer Unix ms.

async def create_prompt(data: CreatePromptBody) -> Prompt:
    prompt_id = prompt_storage_util.generate_id()
    now_ms = prompt_storage_util.generate_id()

    new_prompt_data_dict = {
        "id": prompt_id,
        "name": data.name,
        "content": data.content,
        "created": now_ms,
        "updated": now_ms
        # projectId is handled by association, not part of core Prompt model attribute in Python version
    }

    try:
        # Validate with Pydantic model before adding to storage
        new_prompt = Prompt.model_validate(new_prompt_data_dict)
    except ValidationError as e:
        print(f"Validation failed for new prompt data: {e.errors()}")
        raise HTTPException(status_code=500, detail={"message": "Internal validation error creating prompt.", "code": "PROMPT_VALIDATION_ERROR", "errors": e.errors()})

    all_prompts = await prompt_storage_util.read_prompts()

    if prompt_id in all_prompts:
        raise HTTPException(status_code=500, detail={"message": f"Prompt ID conflict for {prompt_id}", "code": "PROMPT_ID_CONFLICT"})

    all_prompts[prompt_id] = new_prompt
    await prompt_storage_util.write_prompts(all_prompts)

    if data.project_id:
        project_id_int = int(data.project_id) if isinstance(data.project_id, str) else data.project_id
        await add_prompt_to_project(new_prompt.id, project_id_int)

    return new_prompt

async def add_prompt_to_project(prompt_id: int, project_id: int) -> None:
    all_prompts = await prompt_storage_util.read_prompts()
    if prompt_id not in all_prompts:
        raise HTTPException(status_code=404, detail={"message": f"Prompt with ID {prompt_id} not found.", "code": "PROMPT_NOT_FOUND"})

    prompt_projects = await prompt_storage_util.read_prompt_projects()

    # Replicate original TS logic: a prompt is assigned to at most one project via this flow.
    # Filter out existing links for this promptId, then add the new one.
    updated_prompt_projects = [link for link in prompt_projects if link.prompt_id != prompt_id]

    new_link_data = {
        "id": prompt_storage_util.generate_id(),
        "prompt_id": prompt_id,
        "project_id": project_id,
        "created": prompt_storage_util.generate_id()
    }
    try:
        new_link = PromptProject.model_validate(new_link_data)
    except ValidationError as e:
        print(f"Validation failed for new prompt-project link: {e.errors()}")
        raise HTTPException(status_code=500, detail={"message": "Internal validation error linking prompt to project.", "code": "PROMPT_LINK_VALIDATION_ERROR", "errors": e.errors()})
    
    updated_prompt_projects.append(new_link)
    await prompt_storage_util.write_prompt_projects(updated_prompt_projects)

async def remove_prompt_from_project(prompt_id: int, project_id: int) -> None:
    prompt_projects = await prompt_storage_util.read_prompt_projects()
    initial_link_count = len(prompt_projects)

    updated_prompt_projects = [link for link in prompt_projects if not (link.prompt_id == prompt_id and link.project_id == project_id)]

    if len(updated_prompt_projects) == initial_link_count:
        all_prompts = await prompt_storage_util.read_prompts()
        if prompt_id not in all_prompts:
            raise HTTPException(status_code=404, detail={"message": f"Prompt with ID {prompt_id} not found.", "code": "PROMPT_NOT_FOUND"})
        raise HTTPException(
            status_code=404,
            detail={"message": f"Association between prompt {prompt_id} and project {project_id} not found.", "code": "PROMPT_PROJECT_LINK_NOT_FOUND"}
        )

    await prompt_storage_util.write_prompt_projects(updated_prompt_projects)

async def get_prompt_by_id(prompt_id: int) -> Prompt:
    all_prompts = await prompt_storage_util.read_prompts()
    found = all_prompts.get(prompt_id)
    if not found:
        raise HTTPException(status_code=404, detail={"message": f"Prompt with ID {prompt_id} not found.", "code": "PROMPT_NOT_FOUND"})
    return found # Already a Prompt object due to read_prompts validation

async def list_all_prompts() -> List[Prompt]:
    all_prompts_data = await prompt_storage_util.read_prompts()
    prompt_list = list(all_prompts_data.values())
    prompt_list.sort(key=lambda p: (p.name or "").lower()) # Sort by name, case-insensitive
    return prompt_list

async def get_prompts_by_ids(prompt_ids: List[int]) -> List[Prompt]:
    all_prompts = await prompt_storage_util.read_prompts()
    return [all_prompts[id_] for id_ in prompt_ids if id_ in all_prompts]

async def list_prompts_by_project(project_id: int) -> List[Prompt]:
    prompt_projects = await prompt_storage_util.read_prompt_projects()
    relevant_prompt_ids = [link.prompt_id for link in prompt_projects if link.project_id == project_id]

    if not relevant_prompt_ids:
        return []
    
    all_prompts = await prompt_storage_util.read_prompts()
    # Filter out None if a link exists for a deleted prompt
    return [all_prompts[prompt_id] for prompt_id in relevant_prompt_ids if prompt_id in all_prompts]

async def update_prompt(prompt_id: int, data: UpdatePromptBody) -> Prompt:
    all_prompts = await prompt_storage_util.read_prompts()
    existing_prompt = all_prompts.get(prompt_id)

    if not existing_prompt:
        raise HTTPException(status_code=404, detail={"message": f"Prompt with ID {prompt_id} not found for update.", "code": "PROMPT_NOT_FOUND"})

    update_data_dict = data.model_dump(exclude_unset=True) # Get only provided fields
    
    updated_prompt_data = existing_prompt.model_copy(update=update_data_dict)
    updated_prompt_data.updated = prompt_storage_util.generate_id()

    try:
        # Re-validate the whole model. Pydantic will ensure type correctness.
        # UpdatePromptBody already has a validator for at least one field present.
        Prompt.model_validate(updated_prompt_data.model_dump()) 
    except ValidationError as e:
        print(f"Validation failed updating prompt {prompt_id}: {e.errors()}")
        raise HTTPException(status_code=500, detail={"message": "Internal validation error updating prompt.", "code": "PROMPT_VALIDATION_ERROR", "errors": e.errors()})

    all_prompts[prompt_id] = updated_prompt_data
    await prompt_storage_util.write_prompts(all_prompts)
    return updated_prompt_data

async def delete_prompt(prompt_id: int) -> bool:
    all_prompts = await prompt_storage_util.read_prompts()
    if prompt_id not in all_prompts:
        return False # Prompt not found, nothing to delete

    del all_prompts[prompt_id]
    await prompt_storage_util.write_prompts(all_prompts)

    # Also remove any associations for this prompt
    prompt_projects = await prompt_storage_util.read_prompt_projects()
    initial_link_count = len(prompt_projects)
    updated_prompt_projects = [link for link in prompt_projects if link.prompt_id != prompt_id]

    if len(updated_prompt_projects) < initial_link_count:
        await prompt_storage_util.write_prompt_projects(updated_prompt_projects)

    return True

async def get_prompt_projects(prompt_id: int) -> List[PromptProject]:
    prompt_projects = await prompt_storage_util.read_prompt_projects()
    return [link for link in prompt_projects if link.prompt_id == prompt_id]
