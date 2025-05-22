# tests/test_project_storage.py
# 1. Mock file system ops for _read/_write_validated_json.
# 2. Test Pydantic model validation with int IDs/timestamps.
# 3. Cover CRUD for projects, files, AI changes.
# 4. Ensure correct key types (int in memory, str in JSON).
# 5. Verify delete_project_data calls shutil.rmtree.

import pytest
import json
import time
from pathlib import Path
from datetime import datetime, timezone
from unittest.mock import patch, mock_open, MagicMock, AsyncMock

from pydantic import ValidationError

# Assuming project_storage.py is in app.utils.storage
# and schemas are accessible via app.schemas
from app.utils.storage.project_storage import (
    project_storage,
    Project, ProjectFile, AIFileChangeRecord, # Internal Pydantic models for storage
    ProjectsStorageModel, ProjectFilesStorageModel, AIFileChangesStorageModel,
    get_projects_index_path, get_project_files_path, get_ai_file_changes_path,
    get_project_data_dir,
    _ensure_dir_exists, _read_validated_json, _write_validated_json
)
# Import original schemas for comparison or if needed
from app.schemas.project_schemas import Project as OriginalProjectSchema
from app.schemas.project_schemas import ProjectFile as OriginalProjectFileSchema

# Use fixed timestamps for predictability
FIXED_TIMESTAMP = int(datetime(2023, 1, 1, 0, 0, 0, tzinfo=timezone.utc).timestamp() * 1000)
MOCK_PROJECT_ID = 123
MOCK_FILE_ID = 456

@pytest.fixture
def mock_project_data_dict():
    return {
        "id": MOCK_PROJECT_ID, "name": "Test Project", "path": "/test",
        "created": FIXED_TIMESTAMP, "updated": FIXED_TIMESTAMP, "files": []
    }

@pytest.fixture
def mock_project_file_data_dict():
    return {
        "id": MOCK_FILE_ID, "project_id": MOCK_PROJECT_ID, "name": "test.py", "path": "test.py",
        "extension": ".py", "size": 100, "content": "print('hello')",
        "created": FIXED_TIMESTAMP, "updated": FIXED_TIMESTAMP,
        "summary_last_updated_at": None, "summary": None, "meta": "{}", "checksum": "abc"
    }

@pytest.fixture(autouse=True)
def mock_time():
    with patch('time.time', return_value=FIXED_TIMESTAMP / 1000): # time.time returns seconds
        with patch('app.utils.storage.project_storage.time.time', return_value=FIXED_TIMESTAMP / 1000):
            yield

@pytest.fixture(autouse=True)
def mock_datetime_now():
    mock_now = datetime.fromtimestamp(FIXED_TIMESTAMP / 1000, tz=timezone.utc)
    with patch('app.utils.storage.project_storage.datetime', wraps=datetime) as mock_dt:
        mock_dt.now.return_value = mock_now
        with patch('app.services.project_service.datetime', wraps=datetime) as mock_dt_service: # Also for service if it uses it directly
             mock_dt_service.now.return_value = mock_now
             yield mock_dt

@pytest.mark.asyncio
async def test_ensure_dir_exists():
    mock_path = MagicMock(spec=Path)
    await _ensure_dir_exists(mock_path)
    mock_path.mkdir.assert_called_once_with(parents=True, exist_ok=True)

    mock_path_error = MagicMock(spec=Path)
    mock_path_error.mkdir = MagicMock(side_effect=OSError("Test OS Error"))
    with pytest.raises(IOError, match="Failed to ensure directory exists"):
        await _ensure_dir_exists(mock_path_error)
    mock_path_error.mkdir.assert_called_once_with(parents=True, exist_ok=True)

@pytest.mark.asyncio
async def test_read_validated_json_file_not_found():
    mock_path = MagicMock(spec=Path)
    mock_path.exists.return_value = False
    mock_path.parent = MagicMock(spec=Path) # For _ensure_dir_exists
    with patch('app.utils.storage.project_storage._ensure_dir_exists', new_callable=AsyncMock):
        result = await _read_validated_json(mock_path, ProjectsStorageModel, {})
        assert result == {}

@pytest.mark.asyncio
async def test_read_validated_json_empty_file():
    mock_path = MagicMock(spec=Path)
    mock_path.exists.return_value = True
    mock_path.parent = MagicMock(spec=Path)
    with patch('app.utils.storage.project_storage._ensure_dir_exists', new_callable=AsyncMock):
        with patch('builtins.open', mock_open(read_data="")) as m_open:
            result = await _read_validated_json(mock_path, ProjectsStorageModel, {"default": True})
            assert result == {"default": True}
        m_open.assert_called_once_with(mock_path, "r", encoding="utf-8")

@pytest.mark.asyncio
async def test_read_validated_json_invalid_json():
    mock_path = MagicMock(spec=Path)
    mock_path.exists.return_value = True
    mock_path.parent = MagicMock(spec=Path)
    with patch('app.utils.storage.project_storage._ensure_dir_exists', new_callable=AsyncMock):
        with patch('builtins.open', mock_open(read_data="{invalid_json")) as m_open:
            result = await _read_validated_json(mock_path, ProjectsStorageModel, {"default": True})
            assert result == {"default": True} # Should return default on JSONDecodeError

@pytest.mark.asyncio
async def test_read_validated_json_pydantic_validation_error():
    mock_path = MagicMock(spec=Path)
    mock_path.exists.return_value = True
    mock_path.parent = MagicMock(spec=Path)
    # Data that will fail Project validation (e.g., missing 'name')
    invalid_project_data = json.dumps({"123": {"id": 123, "path": "/test"}}) # Missing 'name', 'created', 'updated'
    default_val = {"default": "test_value"} # Use a distinct default value for clarity
    with patch('app.utils.storage.project_storage._ensure_dir_exists', new_callable=AsyncMock):
        with patch('builtins.open', mock_open(read_data=invalid_project_data)) as m_open:
            # Test with a RootModel wrapping Dict[int, Project]
            result = await _read_validated_json(mock_path, ProjectsStorageModel, default_val)
            # The function should return the default_val on ValidationError
            assert result == default_val

@pytest.mark.asyncio
async def test_read_write_validated_json_dict_int_keys(mock_project_data_dict):
    mock_path = MagicMock(spec=Path)
    mock_path.exists.return_value = False # For initial read
    mock_path.parent = MagicMock(spec=Path)

    # Test data: Dict[int, Project]
    project_instance = Project(**mock_project_data_dict)
    data_to_write = {MOCK_PROJECT_ID: project_instance}

    # Mock open for write and subsequent read
    written_json_data = ""
    def capture_write_data(file_path, mode, encoding):
        nonlocal written_json_data
        m = mock_open()
        original_write = m.return_value.write
        def side_effect_write(content):
            nonlocal written_json_data
            written_json_data = content
            return original_write(content)
        m.return_value.write = MagicMock(side_effect=side_effect_write)
        return m()

    with patch('app.utils.storage.project_storage._ensure_dir_exists', new_callable=AsyncMock) as mock_ensure_dir:
        with patch('builtins.open', new_callable=lambda: MagicMock(side_effect=capture_write_data)) as m_open_write:
            # Write data
            written_data = await _write_validated_json(mock_path, data_to_write, ProjectsStorageModel)
            assert MOCK_PROJECT_ID in written_data
            assert isinstance(written_data[MOCK_PROJECT_ID], Project)
            m_open_write.assert_called_with(mock_path, "w", encoding="utf-8")
            # Check that JSON string has string keys
            assert f'"{MOCK_PROJECT_ID}"' in written_json_data

        # Now mock read using the written_json_data
        mock_path.exists.return_value = True # Simulate file now exists
        with patch('builtins.open', mock_open(read_data=written_json_data)) as m_open_read:
            # Read data
            read_data = await _read_validated_json(mock_path, ProjectsStorageModel, {})
            assert MOCK_PROJECT_ID in read_data
            assert isinstance(read_data[MOCK_PROJECT_ID], Project)
            assert read_data[MOCK_PROJECT_ID].name == "Test Project"
            m_open_read.assert_called_with(mock_path, "r", encoding="utf-8")

def test_project_storage_generate_id():
    # Relies on mocked time.time from fixture
    expected_id = FIXED_TIMESTAMP
    assert project_storage.generate_id() == expected_id

@pytest.mark.asyncio
@patch('app.utils.storage.project_storage._read_validated_json', new_callable=AsyncMock)
async def test_read_projects(mock_read_json, mock_project_data_dict):
    project_instance = Project(**mock_project_data_dict)
    mock_read_json.return_value = {MOCK_PROJECT_ID: project_instance}
    result = await project_storage.read_projects()
    assert result == {MOCK_PROJECT_ID: project_instance}
    mock_read_json.assert_called_once_with(get_projects_index_path(), ProjectsStorageModel, {})

@pytest.mark.asyncio
@patch('app.utils.storage.project_storage._write_validated_json', new_callable=AsyncMock)
async def test_write_projects(mock_write_json, mock_project_data_dict):
    project_instance = Project(**mock_project_data_dict)
    projects_to_write = {MOCK_PROJECT_ID: project_instance}
    mock_write_json.return_value = projects_to_write # Simulate successful write
    
    result = await project_storage.write_projects(projects_to_write)
    assert result == projects_to_write
    mock_write_json.assert_called_once_with(get_projects_index_path(), projects_to_write, ProjectsStorageModel)

@pytest.mark.asyncio
@patch('app.utils.storage.project_storage._read_validated_json', new_callable=AsyncMock)
async def test_read_project_files(mock_read_json, mock_project_file_data_dict):
    file_instance = ProjectFile(**mock_project_file_data_dict)
    mock_read_json.return_value = {MOCK_FILE_ID: file_instance}
    result = await project_storage.read_project_files(MOCK_PROJECT_ID)
    assert result == {MOCK_FILE_ID: file_instance}
    mock_read_json.assert_called_once_with(get_project_files_path(MOCK_PROJECT_ID), ProjectFilesStorageModel, {})

@pytest.mark.asyncio
@patch('app.utils.storage.project_storage.ProjectStorage.read_project_files', new_callable=AsyncMock)
@patch('app.utils.storage.project_storage.ProjectStorage.write_project_files', new_callable=AsyncMock)
async def test_update_project_file(mock_write_files, mock_read_files, mock_project_file_data_dict, mock_datetime_now):
    original_file = ProjectFile(**mock_project_file_data_dict)
    mock_read_files.return_value = {MOCK_FILE_ID: original_file}
    
    update_payload = {"content": "new content", "size": 11}
    
    # Simulate write_project_files returning the map for the next step
    # In reality, update_project_file constructs the updated model itself.
    # The important mock is that write_project_files is called correctly.

    expected_updated_timestamp = int(mock_datetime_now.now(timezone.utc).timestamp() * 1000)
    updated_file_model_data = original_file.model_dump()
    updated_file_model_data.update(update_payload)
    updated_file_model_data["updated"] = expected_updated_timestamp # Should be set by the method
    
    # The actual return value of update_project_file is the ProjectFile object
    expected_returned_file = ProjectFile(**updated_file_model_data)
    
    # Mock read_project_file which is called internally by update_project_file
    # This is a bit tricky as update_project_file calls self.read_project_file then self.read_project_files
    # Simpler: patch read_project_file directly
    with patch('app.utils.storage.project_storage.ProjectStorage.read_project_file', new_callable=AsyncMock, return_value=original_file) as mock_read_single_file:
        result = await project_storage.update_project_file(MOCK_PROJECT_ID, MOCK_FILE_ID, update_payload)

    mock_read_single_file.assert_called_once_with(MOCK_PROJECT_ID, MOCK_FILE_ID)
    
    # Check that the result has updated fields and new timestamp
    assert result.content == "new content"
    assert result.size == 11
    assert result.updated == expected_updated_timestamp
    assert result.id == MOCK_FILE_ID # Ensure other fields are preserved

    # Check that write_project_files was called with the correct data
    # The first argument to write_project_files is project_id
    # The second argument is a dictionary of files map
    # We need to check the file_id within that map
    
    # The call to write_project_files happens with the full map of files for that project.
    # Here, mock_read_files provides that initial map.
    # The update_project_file method modifies this map and writes it back.
    
    # Expected call to mock_write_files:
    # project_id = MOCK_PROJECT_ID
    # files_map = {MOCK_FILE_ID: result} (where result is the updated file model)
    mock_write_files.assert_called_once()
    call_args = mock_write_files.call_args[0]
    assert call_args[0] == MOCK_PROJECT_ID
    written_files_map = call_args[1]
    assert MOCK_FILE_ID in written_files_map
    assert written_files_map[MOCK_FILE_ID].content == "new content"
    assert written_files_map[MOCK_FILE_ID].updated == expected_updated_timestamp

@pytest.mark.asyncio
@patch('shutil.rmtree')
@patch('app.utils.storage.project_storage.get_project_data_dir')
async def test_delete_project_data(mock_get_dir, mock_rmtree):
    mock_dir_path = MagicMock(spec=Path)
    mock_dir_path.exists.return_value = True
    mock_get_dir.return_value = mock_dir_path

    await project_storage.delete_project_data(MOCK_PROJECT_ID)

    mock_get_dir.assert_called_once_with(MOCK_PROJECT_ID)
    mock_rmtree.assert_called_once_with(mock_dir_path)

@pytest.mark.asyncio
@patch('shutil.rmtree')
@patch('app.utils.storage.project_storage.get_project_data_dir')
async def test_delete_project_data_dir_not_found(mock_get_dir, mock_rmtree):
    mock_dir_path = MagicMock(spec=Path)
    mock_dir_path.exists.return_value = False # Directory doesn't exist
    mock_get_dir.return_value = mock_dir_path

    await project_storage.delete_project_data(MOCK_PROJECT_ID)

    mock_get_dir.assert_called_once_with(MOCK_PROJECT_ID)
    mock_rmtree.assert_not_called() # Should not be called if dir doesn't exist

# Schema tests for internal storage models (conversion of IDs/timestamps)
def test_project_model_validation(mock_project_data_dict):
    # Test with string IDs/timestamps that should be converted
    data_str_ids = mock_project_data_dict.copy()
    data_str_ids["id"] = str(MOCK_PROJECT_ID)
    data_str_ids["created"] = datetime.fromtimestamp(FIXED_TIMESTAMP / 1000, tz=timezone.utc).isoformat()
    data_str_ids["updated"] = datetime.fromtimestamp(FIXED_TIMESTAMP / 1000, tz=timezone.utc).isoformat()

    project = Project(**data_str_ids)
    assert project.id == MOCK_PROJECT_ID
    assert project.created == FIXED_TIMESTAMP
    assert project.updated == FIXED_TIMESTAMP

def test_project_file_model_validation(mock_project_file_data_dict):
    data_str_ids = mock_project_file_data_dict.copy()
    data_str_ids["id"] = str(MOCK_FILE_ID)
    data_str_ids["project_id"] = str(MOCK_PROJECT_ID)
    data_str_ids["created"] = datetime.fromtimestamp(FIXED_TIMESTAMP / 1000, tz=timezone.utc).isoformat()
    data_str_ids["updated"] = datetime.fromtimestamp(FIXED_TIMESTAMP / 1000, tz=timezone.utc).isoformat()
    data_str_ids["summary_last_updated_at"] = datetime.fromtimestamp(FIXED_TIMESTAMP / 1000, tz=timezone.utc).isoformat()

    pf = ProjectFile(**data_str_ids)
    assert pf.id == MOCK_FILE_ID
    assert pf.project_id == MOCK_PROJECT_ID
    assert pf.created == FIXED_TIMESTAMP
    assert pf.updated == FIXED_TIMESTAMP
    assert pf.summary_last_updated_at == FIXED_TIMESTAMP

    # Test with None for optional timestamp
    data_str_ids["summary_last_updated_at"] = None
    pf_none_summary_ts = ProjectFile(**data_str_ids)
    assert pf_none_summary_ts.summary_last_updated_at is None