# tests/test_prompt_service.py
# 1. Mock prompt_storage_util extensively.
# 2. Test prompt and prompt-project association CRUD operations.
# 3. Verify HTTPException is raised appropriately with correct codes/details.
# 4. Ensure IDs and timestamps are handled as int (Unix ms).

import pytest
from unittest.mock import AsyncMock, MagicMock, patch, call
from fastapi import HTTPException
import time # For generating mock IDs in sequence

from app.services.prompt_service import (
    create_prompt, add_prompt_to_project, remove_prompt_from_project,
    get_prompt_by_id, list_all_prompts, get_prompts_by_ids,
    list_prompts_by_project, update_prompt, delete_prompt, get_prompt_projects
)
from app.schemas.prompt_schemas import (
    Prompt, CreatePromptBody, UpdatePromptBody, PromptProject
)

# Use fixed timestamps from a base for predictability in services
FIXED_SERVICE_TIMESTAMP_BASE = int(time.time() * 1000) # Ensures unique from storage test if run together
MOCK_SERVICE_PROMPT_ID_1 = FIXED_SERVICE_TIMESTAMP_BASE + 1000
MOCK_SERVICE_PROMPT_ID_2 = FIXED_SERVICE_TIMESTAMP_BASE + 1001
MOCK_SERVICE_PROJECT_ID_1 = FIXED_SERVICE_TIMESTAMP_BASE + 2000
MOCK_SERVICE_LINK_ID_1 = FIXED_SERVICE_TIMESTAMP_BASE + 3000
MOCK_NOW_TS = FIXED_SERVICE_TIMESTAMP_BASE # For 'created' or 'updated'

@pytest.fixture
def mock_prompt_storage_util():
    with patch('app.services.prompt_service.prompt_storage_util', new_callable=AsyncMock) as mock_psu:
        # Configure generate_id as a MagicMock for synchronous return values
        # Needs to provide enough IDs for all calls within a single test function
        mock_psu.generate_id = MagicMock(side_effect=[
            MOCK_SERVICE_PROMPT_ID_1, MOCK_NOW_TS, # For create_prompt (prompt_id, now_ms)
            MOCK_SERVICE_LINK_ID_1, MOCK_NOW_TS,   # For add_prompt_to_project (link_id, created_ts)
            MOCK_SERVICE_PROMPT_ID_2, MOCK_NOW_TS + 10, # Another create_prompt
            MOCK_NOW_TS + 20, # For an update timestamp
            # Add more if a test makes many calls
            FIXED_SERVICE_TIMESTAMP_BASE + 4000, FIXED_SERVICE_TIMESTAMP_BASE + 4001,
            FIXED_SERVICE_TIMESTAMP_BASE + 4002, FIXED_SERVICE_TIMESTAMP_BASE + 4003,
        ])
        yield mock_psu

@pytest.fixture
def sample_prompt_data_service():
    # Uses MOCK_SERVICE_PROMPT_ID_1 and MOCK_NOW_TS from generate_id side_effect
    return {
        "id": MOCK_SERVICE_PROMPT_ID_1, "name": "Service Test Prompt", "content": "Content here",
        "project_id": None, # Default, can be overridden
        "created": MOCK_NOW_TS, "updated": MOCK_NOW_TS
    }

@pytest.fixture
def sample_prompt_project_link_data_service():
    # Uses MOCK_SERVICE_LINK_ID_1 and MOCK_NOW_TS from generate_id side_effect
     return {
        "id": MOCK_SERVICE_LINK_ID_1, "prompt_id": MOCK_SERVICE_PROMPT_ID_1,
        "project_id": MOCK_SERVICE_PROJECT_ID_1, "created": MOCK_NOW_TS
    }


@pytest.mark.asyncio
async def test_create_prompt_no_project(mock_prompt_storage_util, sample_prompt_data_service):
    create_body = CreatePromptBody(name="New Prompt", content="Prompt content")
    
    # generate_id will provide MOCK_SERVICE_PROMPT_ID_1, MOCK_NOW_TS
    expected_prompt_dict = {
        "id": MOCK_SERVICE_PROMPT_ID_1, "name": create_body.name, "content": create_body.content,
        "project_id": None, "created": MOCK_NOW_TS, "updated": MOCK_NOW_TS
    }
    expected_prompt = Prompt(**expected_prompt_dict)

    mock_prompt_storage_util.read_prompts.return_value = {} # No existing prompts
    mock_prompt_storage_util.write_prompts.return_value = {MOCK_SERVICE_PROMPT_ID_1: expected_prompt} # Simulate write

    result = await create_prompt(create_body)

    assert result.id == MOCK_SERVICE_PROMPT_ID_1
    assert result.name == create_body.name
    assert result.content == create_body.content
    assert result.created == MOCK_NOW_TS
    assert result.updated == MOCK_NOW_TS
    assert result.project_id is None # Not passed in CreatePromptBody initially for this path

    mock_prompt_storage_util.read_prompts.assert_called_once()
    mock_prompt_storage_util.write_prompts.assert_called_once_with({MOCK_SERVICE_PROMPT_ID_1: expected_prompt})
    # add_prompt_to_project should not be called
    assert mock_prompt_storage_util.read_prompt_projects.call_count == 0 


@pytest.mark.asyncio
async def test_create_prompt_with_project(mock_prompt_storage_util, sample_prompt_data_service, sample_prompt_project_link_data_service):
    create_body = CreatePromptBody(
        name="Prompt For Project", 
        content="Content for project", 
        project_id=MOCK_SERVICE_PROJECT_ID_1
    )
    
    # generate_id for prompt: MOCK_SERVICE_PROMPT_ID_1, MOCK_NOW_TS
    # generate_id for link: MOCK_SERVICE_LINK_ID_1, MOCK_NOW_TS (from fixture setup for generate_id)
    
    prompt_dict = {
        "id": MOCK_SERVICE_PROMPT_ID_1, "name": create_body.name, "content": create_body.content,
        "project_id": None, "created": MOCK_NOW_TS, "updated": MOCK_NOW_TS
    }
    created_prompt = Prompt(**prompt_dict)

    link_dict = {
        "id": MOCK_SERVICE_LINK_ID_1, "prompt_id": MOCK_SERVICE_PROMPT_ID_1,
        "project_id": MOCK_SERVICE_PROJECT_ID_1, "created": MOCK_NOW_TS
    }
    created_link = PromptProject(**link_dict)

    mock_prompt_storage_util.read_prompts.return_value = {} # Initial prompts empty
    mock_prompt_storage_util.write_prompts.return_value = {MOCK_SERVICE_PROMPT_ID_1: created_prompt}
    
    # For add_prompt_to_project part
    # First read_prompts is for create_prompt, second is for add_prompt_to_project
    mock_prompt_storage_util.read_prompts.side_effect = [{}, {MOCK_SERVICE_PROMPT_ID_1: created_prompt}]
    mock_prompt_storage_util.read_prompt_projects.return_value = [] # Initial links empty
    mock_prompt_storage_util.write_prompt_projects.return_value = [created_link]

    result_prompt = await create_prompt(create_body)

    assert result_prompt.id == MOCK_SERVICE_PROMPT_ID_1
    # Note: result_prompt itself won't have project_id populated by create_prompt directly
    # The association is stored in prompt-projects.json

    # Verify create_prompt calls
    assert mock_prompt_storage_util.generate_id.call_count >= 2 # At least prompt_id, now_ms
    
    # Verify add_prompt_to_project calls
    # generate_id is called again for link_id and link_created_ts
    # total generate_id calls: prompt_id, now_ms, link_id, link_created_ts
    assert mock_prompt_storage_util.generate_id.call_count >= 4 
    
    mock_prompt_storage_util.write_prompts.assert_called_once() # Only for the prompt itself
    
    # Check calls for add_prompt_to_project
    # Second read_prompts call (to verify prompt exists before linking)
    # read_prompt_projects call (to get existing links)
    # write_prompt_projects call (to save the new link)
    assert mock_prompt_storage_util.read_prompts.call_count == 2
    mock_prompt_storage_util.read_prompt_projects.assert_called_once()
    mock_prompt_storage_util.write_prompt_projects.assert_called_once_with([created_link])


@pytest.mark.asyncio
async def test_create_prompt_id_conflict(mock_prompt_storage_util):
    create_body = CreatePromptBody(name="Conflict Prompt", content="Content")
    existing_prompt = Prompt(id=MOCK_SERVICE_PROMPT_ID_1, name="Old", content="Old C", created=MOCK_NOW_TS-100, updated=MOCK_NOW_TS-100)
    mock_prompt_storage_util.read_prompts.return_value = {MOCK_SERVICE_PROMPT_ID_1: existing_prompt}
    # generate_id will return MOCK_SERVICE_PROMPT_ID_1 as the first ID

    with pytest.raises(HTTPException) as excinfo:
        await create_prompt(create_body)
    assert excinfo.value.status_code == 500
    assert excinfo.value.detail["code"] == "PROMPT_ID_CONFLICT"

@pytest.mark.asyncio
async def test_add_prompt_to_project_prompt_not_found(mock_prompt_storage_util):
    mock_prompt_storage_util.read_prompts.return_value = {} # Prompt does not exist
    with pytest.raises(HTTPException) as excinfo:
        await add_prompt_to_project(MOCK_SERVICE_PROMPT_ID_1, MOCK_SERVICE_PROJECT_ID_1)
    assert excinfo.value.status_code == 404
    assert excinfo.value.detail["code"] == "PROMPT_NOT_FOUND"

@pytest.mark.asyncio
async def test_get_prompt_by_id(mock_prompt_storage_util, sample_prompt_data_service):
    prompt_obj = Prompt(**sample_prompt_data_service)
    mock_prompt_storage_util.read_prompts.return_value = {MOCK_SERVICE_PROMPT_ID_1: prompt_obj}
    
    result = await get_prompt_by_id(MOCK_SERVICE_PROMPT_ID_1)
    assert result == prompt_obj

    mock_prompt_storage_util.read_prompts.return_value = {} # Not found
    with pytest.raises(HTTPException) as excinfo:
        await get_prompt_by_id(MOCK_SERVICE_PROMPT_ID_1 + 99)
    assert excinfo.value.status_code == 404

@pytest.mark.asyncio
async def test_list_all_prompts(mock_prompt_storage_util, sample_prompt_data_service):
    prompt1_data = sample_prompt_data_service
    prompt2_data = {**sample_prompt_data_service, "id": MOCK_SERVICE_PROMPT_ID_2, "name": "Alpha Prompt"}
    prompt1 = Prompt(**prompt1_data) # Name: "Service Test Prompt"
    prompt2 = Prompt(**prompt2_data) # Name: "Alpha Prompt"

    mock_prompt_storage_util.read_prompts.return_value = {
        MOCK_SERVICE_PROMPT_ID_1: prompt1,
        MOCK_SERVICE_PROMPT_ID_2: prompt2
    }
    result = await list_all_prompts()
    assert len(result) == 2
    assert result[0].name == "Alpha Prompt" # Sorted by name
    assert result[1].name == "Service Test Prompt"

@pytest.mark.asyncio
async def test_update_prompt(mock_prompt_storage_util, sample_prompt_data_service):
    # generate_id will be called for the 'updated' timestamp
    
    original_prompt = Prompt(**sample_prompt_data_service)
    mock_prompt_storage_util.read_prompts.return_value = {MOCK_SERVICE_PROMPT_ID_1: original_prompt}
    
    update_body = UpdatePromptBody(name="Updated Name", content="Updated Content")
    
    # Configure generate_id to return a specific timestamp for this test
    expected_updated_ts = MOCK_NOW_TS + 1000  # A distinct timestamp for this update
    mock_prompt_storage_util.generate_id.return_value = expected_updated_ts
    
    async def mock_write_prompts(prompts_map):
        # This map should contain the updated prompt
        assert prompts_map[MOCK_SERVICE_PROMPT_ID_1].name == "Updated Name"
        assert prompts_map[MOCK_SERVICE_PROMPT_ID_1].content == "Updated Content"
        # Check that the updated timestamp is greater than the original (don't hardcode the exact value)
        assert prompts_map[MOCK_SERVICE_PROMPT_ID_1].updated > original_prompt.updated
        return prompts_map
    mock_prompt_storage_util.write_prompts.side_effect = mock_write_prompts

    result = await update_prompt(MOCK_SERVICE_PROMPT_ID_1, update_body)

    assert result.name == "Updated Name"
    assert result.content == "Updated Content"
    assert result.updated > original_prompt.updated  # Verify the updated timestamp is newer
    
    # Ensure write_prompts was called with the correctly updated prompt data
    # The side_effect above already asserts the content of the written map.
    mock_prompt_storage_util.write_prompts.assert_called_once()


@pytest.mark.asyncio
async def test_delete_prompt(mock_prompt_storage_util, sample_prompt_data_service, sample_prompt_project_link_data_service):
    prompt_to_delete = Prompt(**sample_prompt_data_service)
    link_to_delete = PromptProject(**sample_prompt_project_link_data_service) # Assumes this link involves prompt_to_delete.id

    mock_prompt_storage_util.read_prompts.return_value = {MOCK_SERVICE_PROMPT_ID_1: prompt_to_delete}
    mock_prompt_storage_util.read_prompt_projects.return_value = [link_to_delete]
    
    # Mock write calls to verify they are made
    mock_prompt_storage_util.write_prompts = AsyncMock()
    mock_prompt_storage_util.write_prompt_projects = AsyncMock()

    delete_result = await delete_prompt(MOCK_SERVICE_PROMPT_ID_1)
    assert delete_result is True

    # Verify prompt is removed from prompts storage
    mock_prompt_storage_util.write_prompts.assert_called_once()
    written_prompts_arg = mock_prompt_storage_util.write_prompts.call_args[0][0]
    assert MOCK_SERVICE_PROMPT_ID_1 not in written_prompts_arg

    # Verify link is removed from prompt_projects storage
    mock_prompt_storage_util.write_prompt_projects.assert_called_once_with([])


@pytest.mark.asyncio
async def test_list_prompts_by_project(mock_prompt_storage_util, sample_prompt_data_service, sample_prompt_project_link_data_service):
    prompt1 = Prompt(**sample_prompt_data_service) # id MOCK_SERVICE_PROMPT_ID_1
    prompt2_data = {**sample_prompt_data_service, "id": MOCK_SERVICE_PROMPT_ID_2, "name": "Other Prompt"}
    prompt2 = Prompt(**prompt2_data)

    # Link prompt1 to MOCK_SERVICE_PROJECT_ID_1
    link1 = PromptProject(**sample_prompt_project_link_data_service) # Uses MOCK_SERVICE_PROMPT_ID_1 and MOCK_SERVICE_PROJECT_ID_1

    mock_prompt_storage_util.read_prompt_projects.return_value = [link1]
    mock_prompt_storage_util.read_prompts.return_value = {
        MOCK_SERVICE_PROMPT_ID_1: prompt1,
        MOCK_SERVICE_PROMPT_ID_2: prompt2
    }

    result = await list_prompts_by_project(MOCK_SERVICE_PROJECT_ID_1)
    assert len(result) == 1
    assert result[0].id == MOCK_SERVICE_PROMPT_ID_1

    result_other_project = await list_prompts_by_project(MOCK_SERVICE_PROJECT_ID_1 + 999)
    assert len(result_other_project) == 0