# tests/test_prompt_storage.py
# 1. Mock file system ops for read/write_validated_json.
# 2. Test Pydantic model validation with int IDs/timestamps.
# 3. Cover CRUD-like ops for prompts and prompt-project links.
# 4. Ensure correct key types (int in memory, str in JSON for prompt dict).
# 5. Verify generate_id produces int timestamps.

import pytest
import json
import time
from pathlib import Path
from datetime import datetime, timezone
from unittest.mock import patch, mock_open, MagicMock, AsyncMock

from pydantic import ValidationError

from app.utils.storage.prompt_storage import (
    prompt_storage_util,
    Prompt, PromptProject, # Schemas used by storage
    PromptsStorage, PromptProjectsStorage, # Type hints for storage structures
    get_prompts_index_path, get_prompt_projects_path,
    ensure_dir_exists, read_validated_json, write_validated_json,
    StorageError  # Import StorageError from the module
)


# Use fixed timestamps for predictability
FIXED_TIMESTAMP_BASE = int(datetime(2023, 2, 1, 0, 0, 0, tzinfo=timezone.utc).timestamp() * 1000)
MOCK_PROMPT_ID_1 = FIXED_TIMESTAMP_BASE + 100
MOCK_PROMPT_ID_2 = FIXED_TIMESTAMP_BASE + 200
MOCK_PROJECT_ID_1 = FIXED_TIMESTAMP_BASE + 300
MOCK_LINK_ID_1 = FIXED_TIMESTAMP_BASE + 400
FIXED_CREATED_TS = FIXED_TIMESTAMP_BASE + 10
FIXED_UPDATED_TS = FIXED_TIMESTAMP_BASE + 20

@pytest.fixture
def mock_prompt_data_dict():
    return {
        "id": MOCK_PROMPT_ID_1, "name": "Test Prompt", "content": "Test content {var}",
        "project_id": MOCK_PROJECT_ID_1, # Can be None as well
        "created": FIXED_CREATED_TS, "updated": FIXED_UPDATED_TS
    }

@pytest.fixture
def mock_prompt_project_link_data_dict():
    return {
        "id": MOCK_LINK_ID_1, "prompt_id": MOCK_PROMPT_ID_1,
        "project_id": MOCK_PROJECT_ID_1, "created": FIXED_CREATED_TS
    }

@pytest.fixture(autouse=True)
def mock_time_for_storage():
    # time.time() returns seconds
    with patch('app.utils.storage.prompt_storage.time.time', return_value=FIXED_TIMESTAMP_BASE / 1000):
        yield

@pytest.mark.asyncio
async def test_ensure_dir_exists_storage():
    mock_path = MagicMock(spec=Path)
    ensure_dir_exists(mock_path) # This is synchronous
    mock_path.mkdir.assert_called_once_with(parents=True, exist_ok=True)

    mock_path_error = MagicMock(spec=Path)
    mock_path_error.mkdir = MagicMock(side_effect=OSError("Test OS Error"))
    with pytest.raises(StorageError, match="Failed to ensure directory exists"):
        ensure_dir_exists(mock_path_error)
    mock_path_error.mkdir.assert_called_once_with(parents=True, exist_ok=True)


@pytest.mark.asyncio
async def test_read_validated_json_dict_type(mock_prompt_data_dict):
    mock_path = MagicMock(spec=Path)
    mock_path.parent = MagicMock(spec=Path)
    prompt_instance = Prompt(**mock_prompt_data_dict)
    # JSON stores keys as strings
    json_content = json.dumps({str(MOCK_PROMPT_ID_1): prompt_instance.model_dump(mode='json')})

    # File exists and valid
    mock_path.exists.return_value = True
    with patch('app.utils.storage.prompt_storage.ensure_dir_exists'):
        with patch('builtins.open', mock_open(read_data=json_content)) as m_open:
            result = await read_validated_json(mock_path, Prompt, {})
            assert isinstance(result, dict)
            assert MOCK_PROMPT_ID_1 in result
            assert isinstance(result[MOCK_PROMPT_ID_1], Prompt)
            assert result[MOCK_PROMPT_ID_1].name == "Test Prompt"
            m_open.assert_called_once_with(mock_path, "r", encoding="utf-8")

    # File not found
    mock_path.exists.return_value = False
    with patch('app.utils.storage.prompt_storage.ensure_dir_exists'):
        result_default = await read_validated_json(mock_path, Prompt, {"default": True})
        assert result_default == {"default": True}

    # Invalid JSON
    mock_path.exists.return_value = True
    with patch('app.utils.storage.prompt_storage.ensure_dir_exists'):
        with patch('builtins.open', mock_open(read_data="{invalid")):
            result_invalid = await read_validated_json(mock_path, Prompt, {"fallback": True})
            assert result_invalid == {"fallback": True} # Returns default

    # Pydantic validation error for value
    invalid_value_json = json.dumps({str(MOCK_PROMPT_ID_1): {"id": MOCK_PROMPT_ID_1, "name": "Incomplete"}}) # Missing fields
    with patch('app.utils.storage.prompt_storage.ensure_dir_exists'):
        with patch('builtins.open', mock_open(read_data=invalid_value_json)):
            result_val_error = await read_validated_json(mock_path, Prompt, {})
            assert MOCK_PROMPT_ID_1 not in result_val_error # Item with error is skipped

@pytest.mark.asyncio
async def test_read_validated_json_list_type(mock_prompt_project_link_data_dict):
    mock_path = MagicMock(spec=Path)
    mock_path.parent = MagicMock(spec=Path)
    link_instance = PromptProject(**mock_prompt_project_link_data_dict)
    json_content = json.dumps([link_instance.model_dump(mode='json')])

    mock_path.exists.return_value = True
    with patch('app.utils.storage.prompt_storage.ensure_dir_exists'):
        with patch('builtins.open', mock_open(read_data=json_content)) as m_open:
            result = await read_validated_json(mock_path, PromptProject, [])
            assert isinstance(result, list)
            assert len(result) == 1
            assert isinstance(result[0], PromptProject)
            assert result[0].project_id == MOCK_PROJECT_ID_1
            m_open.assert_called_once_with(mock_path, "r", encoding="utf-8")

@pytest.mark.asyncio
async def test_write_validated_json_dict_type(mock_prompt_data_dict):
    mock_path = MagicMock(spec=Path)
    mock_path.parent = MagicMock(spec=Path)
    prompt_instance = Prompt(**mock_prompt_data_dict)
    data_to_write: PromptsStorage = {MOCK_PROMPT_ID_1: prompt_instance}

    written_content = ""
    def capture_write(content):
        nonlocal written_content
        written_content = content
    
    m_file = mock_open()
    m_file.return_value.write = MagicMock(side_effect=capture_write)

    with patch('app.utils.storage.prompt_storage.ensure_dir_exists'):
        with patch('builtins.open', m_file) as m_open_call:
            await write_validated_json(mock_path, data_to_write)
            m_open_call.assert_called_once_with(mock_path, "w", encoding="utf-8")
            # Check that int key was converted to str for JSON
            assert f'"{MOCK_PROMPT_ID_1}"' in written_content
            deserialized_written = json.loads(written_content)
            assert deserialized_written[str(MOCK_PROMPT_ID_1)]["name"] == "Test Prompt"

def test_prompt_storage_util_generate_id(mock_time_for_storage):
    # Relies on mocked time.time from mock_time_for_storage
    # prompt_storage_util is an instance, generate_id is a method
    expected_id = FIXED_TIMESTAMP_BASE
    assert prompt_storage_util.generate_id() == expected_id

@pytest.mark.asyncio
@patch('app.utils.storage.prompt_storage.read_validated_json', new_callable=AsyncMock)
async def test_prompt_storage_read_prompts(mock_read_json, mock_prompt_data_dict):
    prompt_instance = Prompt(**mock_prompt_data_dict)
    mock_read_json.return_value = {MOCK_PROMPT_ID_1: prompt_instance}
    
    result = await prompt_storage_util.read_prompts()
    assert result == {MOCK_PROMPT_ID_1: prompt_instance}
    mock_read_json.assert_called_once_with(get_prompts_index_path(), Prompt, {})

@pytest.mark.asyncio
@patch('app.utils.storage.prompt_storage.write_validated_json', new_callable=AsyncMock)
async def test_prompt_storage_write_prompts(mock_write_json, mock_prompt_data_dict):
    prompt_instance = Prompt(**mock_prompt_data_dict)
    prompts_to_write: PromptsStorage = {MOCK_PROMPT_ID_1: prompt_instance}
    mock_write_json.return_value = prompts_to_write # Simulate successful write
    
    result = await prompt_storage_util.write_prompts(prompts_to_write)
    assert result == prompts_to_write
    mock_write_json.assert_called_once_with(get_prompts_index_path(), prompts_to_write)

@pytest.mark.asyncio
@patch('app.utils.storage.prompt_storage.read_validated_json', new_callable=AsyncMock)
async def test_prompt_storage_read_prompt_projects(mock_read_json, mock_prompt_project_link_data_dict):
    link_instance = PromptProject(**mock_prompt_project_link_data_dict)
    mock_read_json.return_value = [link_instance]
        
    result = await prompt_storage_util.read_prompt_projects()
    assert result == [link_instance]
    mock_read_json.assert_called_once_with(get_prompt_projects_path(), PromptProject, [])

@pytest.mark.asyncio
@patch('app.utils.storage.prompt_storage.write_validated_json', new_callable=AsyncMock)
async def test_prompt_storage_write_prompt_projects(mock_write_json, mock_prompt_project_link_data_dict):
    link_instance = PromptProject(**mock_prompt_project_link_data_dict)
    links_to_write: PromptProjectsStorage = [link_instance]
    mock_write_json.return_value = links_to_write
            
    result = await prompt_storage_util.write_prompt_projects(links_to_write)
    assert result == links_to_write
    mock_write_json.assert_called_once_with(get_prompt_projects_path(), links_to_write)

def test_prompt_schema_validation_from_storage_like_data(mock_prompt_data_dict):
    data_str_ids = mock_prompt_data_dict.copy()
    data_str_ids["id"] = str(MOCK_PROMPT_ID_1)
    data_str_ids["project_id"] = str(MOCK_PROJECT_ID_1)
    
    prompt = Prompt(**data_str_ids)
    assert prompt.id == MOCK_PROMPT_ID_1
    assert prompt.project_id == MOCK_PROJECT_ID_1
    assert prompt.created == FIXED_CREATED_TS
    assert prompt.updated == FIXED_UPDATED_TS

def test_prompt_project_schema_validation_from_storage_like_data(mock_prompt_project_link_data_dict):
    data_str_ids = mock_prompt_project_link_data_dict.copy()
    data_str_ids["id"] = str(MOCK_LINK_ID_1)
    data_str_ids["prompt_id"] = str(MOCK_PROMPT_ID_1)
    data_str_ids["project_id"] = str(MOCK_PROJECT_ID_1)
    
    link = PromptProject(**data_str_ids)
    assert link.id == MOCK_LINK_ID_1
    assert link.prompt_id == MOCK_PROMPT_ID_1
    assert link.project_id == MOCK_PROJECT_ID_1
    assert link.created == FIXED_CREATED_TS