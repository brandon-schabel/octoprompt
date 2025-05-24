# tests/test_project_service.py
# 1. Mock project_storage extensively.
# 2. Mock AI service calls (generate_single_text, generate_structured_data).
# 3. Test project and file CRUD operations, including bulk ops.
# 4. Test summarization logic and input optimization.
# 5. Verify ApiError is raised appropriately.
# 6. Ensure IDs and timestamps are handled as int.

import pytest
from unittest.mock import AsyncMock, MagicMock, patch, call
from pathlib import Path
from datetime import datetime, timezone
import time
from typing import List, Dict, Any
import os # Added for patching os.path.expanduser

from app.services.project_service import (
    create_project, get_project_by_id, list_projects, update_project, delete_project,
    get_project_files, update_file_content, create_project_file_record,
    bulk_create_project_files, bulk_update_project_files, bulk_delete_project_files,
    get_project_files_by_ids,
    summarize_single_file, summarize_files, resummarize_all_files, remove_summaries_from_files,
    optimize_user_input,
    ApiError, resolve_path, BulkUpdateItem, SummarySchema
)
from app.schemas.project_schemas import (
    Project, CreateProjectBody, UpdateProjectBody, ProjectFile, FileSyncData
)
from app.schemas.gen_ai_schemas import AiSdkOptions

# Use fixed timestamps for predictability
FIXED_TIMESTAMP = int(datetime(2023, 1, 1, 12, 0, 0, tzinfo=timezone.utc).timestamp() * 1000)
MOCK_PROJECT_ID = 1234567890000
MOCK_FILE_ID_1 = 9876543210001
MOCK_FILE_ID_2 = 9876543210002

@pytest.fixture
def mock_project_storage():
    with patch('app.services.project_service.project_storage', new_callable=AsyncMock) as mock_ps:
        # Configure generate_id as a MagicMock for synchronous return values
        mock_ps.generate_id = MagicMock(side_effect=[
            MOCK_PROJECT_ID, MOCK_FILE_ID_1, MOCK_FILE_ID_2,
            int(time.time()*1000)+3, int(time.time()*1000)+4,
            # Add more IDs if more calls are expected across tests using this fixture instance
            int(time.time()*1000)+5, int(time.time()*1000)+6, # Added two more as an example
            int(time.time()*1000)+7, int(time.time()*1000)+8  # Added even more for safety
        ])
        yield mock_ps

@pytest.fixture
def mock_gen_ai_service():
    with patch('app.services.project_service.generate_structured_data', new_callable=AsyncMock) as mock_gsd, \
         patch('app.services.project_service.generate_single_text', new_callable=AsyncMock) as mock_gst:
        yield {"structured": mock_gsd, "single": mock_gst}

@pytest.fixture(autouse=True)
def mock_datetime_now_service():
    mock_now = datetime.fromtimestamp(FIXED_TIMESTAMP / 1000, tz=timezone.utc)
    # Patch datetime specifically where it's imported and used in project_service.py
    with patch('app.services.project_service.datetime', wraps=datetime) as mock_dt:
        mock_dt.now.return_value = mock_now
        # If project_storage also uses its own datetime.now, it needs separate mocking (done in its test file)
        yield mock_dt


@pytest.fixture
def sample_project_data():
    return {
        "id": MOCK_PROJECT_ID, "name": "Test Project", "path": "/sample/path",
        "description": "A test project", "created": FIXED_TIMESTAMP, "updated": FIXED_TIMESTAMP
    }

@pytest.fixture
def sample_project_file_data():
    return {
        "id": MOCK_FILE_ID_1, "project_id": MOCK_PROJECT_ID, "name": "file1.py", "path": "file1.py",
        "extension": ".py", "size": 150, "content": "print('hello world')", "summary": None,
        "summary_last_updated_at": None, "meta": "{}", "checksum": "xyz123",
        "created": FIXED_TIMESTAMP, "updated": FIXED_TIMESTAMP
    }

# --- Test resolve_path ---
def test_resolve_path():
    base = "/project/base"
    assert resolve_path(base, "file.txt") == str(Path(base) / "file.txt")
    assert resolve_path(base, "/abs/path/file.txt") == str(Path("/abs/path/file.txt"))
    # Patch os.path.expanduser as Path.expanduser might delegate to it.
    with patch('os.path.expanduser', side_effect=lambda p: p.replace("~", "/mock/home")):
        assert resolve_path(base, "~/file.txt") == str(Path("/mock/home/file.txt").resolve())
    assert resolve_path(base) == str(Path(base).resolve())


# --- Test Project CRUD ---
@pytest.mark.asyncio
async def test_create_project(mock_project_storage, sample_project_data, mock_datetime_now_service):
    create_body = CreateProjectBody(name="Test Project", path="/sample/path", description="A test project")
    
    mock_project_storage.read_projects.return_value = {} # No existing projects
    # write_projects should return the dict of projects (it's for persistence, not the API response model)
    # The service function will return the validated Project model
    
    # Project model constructor will be called with this, ensure timestamps are from mock_datetime_now_service
    expected_project_dict = {
        "id": MOCK_PROJECT_ID, "name": create_body.name, "path": create_body.path,
        "description": create_body.description,
        "created": FIXED_TIMESTAMP, "updated": FIXED_TIMESTAMP # from mock_datetime_now_service
    }
    # This is what's passed to Project(**new_project_data)
    
    # Mock the write_projects to simulate successful persistence
    async def mock_write_projects(projects_map):
        # projects_map will be {MOCK_PROJECT_ID: validated_project.model_dump(mode='json')}
        # We don't need to assert its content deeply here, just that it's called.
        return projects_map # Or some success indicator if defined
    mock_project_storage.write_projects.side_effect = mock_write_projects


    result = await create_project(create_body)

    assert result.id == MOCK_PROJECT_ID
    assert result.name == create_body.name
    assert result.created == FIXED_TIMESTAMP
    assert result.updated == FIXED_TIMESTAMP
    
    mock_project_storage.generate_id.assert_called_once()
    mock_project_storage.read_projects.assert_called_once()
    mock_project_storage.write_projects.assert_called_once()
    # Check that the data written matches the structure
    written_project_map_arg = mock_project_storage.write_projects.call_args[0][0]
    assert MOCK_PROJECT_ID in written_project_map_arg
    assert written_project_map_arg[MOCK_PROJECT_ID]["name"] == create_body.name
    
    mock_project_storage.write_project_files.assert_called_once_with(MOCK_PROJECT_ID, {})

@pytest.mark.asyncio
async def test_create_project_id_conflict(mock_project_storage):
    create_body = CreateProjectBody(name="Test Project", path="/path")
    mock_project_storage.read_projects.return_value = {MOCK_PROJECT_ID: MagicMock()} # Project with this ID exists
    
    with pytest.raises(ApiError) as excinfo:
        await create_project(create_body)
    assert excinfo.value.status_code == 409
    assert excinfo.value.code == "PROJECT_ID_CONFLICT"

@pytest.mark.asyncio
async def test_get_project_by_id(mock_project_storage, sample_project_data):
    project_model = Project(**sample_project_data)
    mock_project_storage.read_projects.return_value = {MOCK_PROJECT_ID: project_model} # Stored as model instance
    
    result = await get_project_by_id(MOCK_PROJECT_ID)
    assert result is not None
    assert result.id == MOCK_PROJECT_ID

    mock_project_storage.read_projects.return_value = {} # Project not found
    result_none = await get_project_by_id(MOCK_PROJECT_ID + 1)
    assert result_none is None

@pytest.mark.asyncio
async def test_list_projects(mock_project_storage, sample_project_data):
    project1_data = sample_project_data
    project2_data = {**sample_project_data, "id": MOCK_PROJECT_ID + 1, "name": "Project Alpha", "updated": FIXED_TIMESTAMP - 1000}
    project1 = Project(**project1_data)
    project2 = Project(**project2_data)

    mock_project_storage.read_projects.return_value = {MOCK_PROJECT_ID: project1, MOCK_PROJECT_ID + 1: project2}
    
    result = await list_projects()
    assert len(result) == 2
    assert result[0].id == MOCK_PROJECT_ID # Sorted by updated desc
    assert result[1].id == MOCK_PROJECT_ID + 1

@pytest.mark.asyncio
async def test_update_project(mock_project_storage, sample_project_data, mock_datetime_now_service):
    original_project = Project(**sample_project_data)
    mock_project_storage.read_projects.return_value = {MOCK_PROJECT_ID: original_project}
    
    update_body = UpdateProjectBody(name="Updated Name", description="New Description")
    
    # Simulate successful write, the method expects the projects map
    async def mock_write_projects_update(projects_map):
        return projects_map
    mock_project_storage.write_projects.side_effect = mock_write_projects_update

    result = await update_project(MOCK_PROJECT_ID, update_body)

    assert result is not None
    assert result.name == "Updated Name"
    assert result.description == "New Description"
    assert result.path == original_project.path # Path not updated, should remain same
    assert result.updated == FIXED_TIMESTAMP # Should be updated to 'now'
    
    mock_project_storage.write_projects.assert_called_once()
    written_map = mock_project_storage.write_projects.call_args[0][0]
    assert written_map[MOCK_PROJECT_ID]["name"] == "Updated Name"
    assert written_map[MOCK_PROJECT_ID]["updated"] == FIXED_TIMESTAMP

@pytest.mark.asyncio
async def test_delete_project(mock_project_storage):
    mock_project_storage.read_projects.return_value = {MOCK_PROJECT_ID: MagicMock(spec=Project)}
    
    result = await delete_project(MOCK_PROJECT_ID)
    assert result is True
    
    mock_project_storage.write_projects.assert_called_once()
    # Ensure the project ID is removed from the written data
    written_map_after_delete = mock_project_storage.write_projects.call_args[0][0]
    assert MOCK_PROJECT_ID not in written_map_after_delete

    mock_project_storage.delete_project_data.assert_called_once_with(MOCK_PROJECT_ID)

# --- Test File Operations ---
@pytest.mark.asyncio
async def test_create_project_file_record(mock_project_storage, sample_project_data, sample_project_file_data, mock_datetime_now_service):
    # Override generate_id for this test to return file-specific IDs first
    # Ensure the side_effect list is long enough if other generate_id calls happen in this test setup or SUT
    mock_project_storage.generate_id.side_effect = [MOCK_FILE_ID_1, MOCK_FILE_ID_2, int(time.time()*1000)+5, int(time.time()*1000)+6, int(time.time()*1000)+7]

    # Mock get_project_by_id (which itself uses project_storage.read_projects)
    # For simplicity in this unit test, we mock the higher level get_project_by_id used by create_project_file_record
    project_instance = Project(**sample_project_data)

    with patch('app.services.project_service.get_project_by_id', AsyncMock(return_value=project_instance)) as mock_get_proj:
        mock_project_storage.read_project_files.return_value = {} # No existing files

        file_path_relative = "new_file.py"
        initial_content = "pass"

        result = await create_project_file_record(MOCK_PROJECT_ID, file_path_relative, initial_content)

        mock_get_proj.assert_called_once_with(MOCK_PROJECT_ID)
        assert result.id == MOCK_FILE_ID_1 # From generate_id side_effect
        assert result.project_id == MOCK_PROJECT_ID
        assert result.name == "new_file.py"
        assert result.path == file_path_relative # Normalized relative path
        assert result.content == initial_content
        assert result.size == len(initial_content.encode('utf-8'))
        assert result.created == FIXED_TIMESTAMP
        assert result.updated == FIXED_TIMESTAMP

        mock_project_storage.write_project_files.assert_called_once()
        args, _ = mock_project_storage.write_project_files.call_args
        assert args[0] == MOCK_PROJECT_ID
        written_files_map = args[1]
        assert MOCK_FILE_ID_1 in written_files_map
        assert written_files_map[MOCK_FILE_ID_1]["name"] == "new_file.py"

@pytest.mark.asyncio
async def test_bulk_create_project_files(mock_project_storage, sample_project_data, mock_datetime_now_service):
    # Override generate_id for this test to return file-specific IDs
    # This test will call generate_id twice for the two files being created.
    mock_project_storage.generate_id.side_effect = [MOCK_FILE_ID_1, MOCK_FILE_ID_2, int(time.time()*1000)+5, int(time.time()*1000)+6, int(time.time()*1000)+7]
    
    project_instance = Project(**sample_project_data)
    with patch('app.services.project_service.get_project_by_id', AsyncMock(return_value=project_instance)):
        mock_project_storage.read_project_files.return_value = {} # No existing files initially

        files_to_create_data = [
            FileSyncData(path="file1.txt", name="file1.txt", extension=".txt", content="c1", size=2, checksum="cs1"),
            FileSyncData(path="file2.log", name="file2.log", extension=".log", content="c2c2", size=4, checksum="cs2"),
        ]
        
        # generate_id will be called for each file
        # MOCK_FILE_ID_1, MOCK_FILE_ID_2 are from fixture side_effect

        results = await bulk_create_project_files(MOCK_PROJECT_ID, files_to_create_data)

        assert len(results) == 2
        assert results[0].id == MOCK_FILE_ID_1
        assert results[0].name == "file1.txt"
        assert results[0].created == FIXED_TIMESTAMP
        assert results[1].id == MOCK_FILE_ID_2
        assert results[1].name == "file2.log"
        assert results[1].created == FIXED_TIMESTAMP

        mock_project_storage.write_project_files.assert_called_once()
        args_write, _ = mock_project_storage.write_project_files.call_args
        assert args_write[0] == MOCK_PROJECT_ID
        written_files_map_bulk = args_write[1]
        assert MOCK_FILE_ID_1 in written_files_map_bulk
        assert MOCK_FILE_ID_2 in written_files_map_bulk
        assert written_files_map_bulk[MOCK_FILE_ID_1]["path"] == "file1.txt"

@pytest.mark.asyncio
async def test_bulk_delete_project_files(mock_project_storage, sample_project_data, sample_project_file_data):
    project_instance = Project(**sample_project_data)
    file1 = ProjectFile(**sample_project_file_data)
    file2_data = {**sample_project_file_data, "id": MOCK_FILE_ID_2, "path": "file2.py", "name": "file2.py"}
    file2 = ProjectFile(**file2_data)

    with patch('app.services.project_service.get_project_by_id', AsyncMock(return_value=project_instance)):
        mock_project_storage.read_project_files.return_value = {
            MOCK_FILE_ID_1: file1,
            MOCK_FILE_ID_2: file2
        }
        
        result = await bulk_delete_project_files(MOCK_PROJECT_ID, [MOCK_FILE_ID_1])
        assert result == {"deleted_count": 1}

        mock_project_storage.write_project_files.assert_called_once()
        args_write_del, _ = mock_project_storage.write_project_files.call_args
        written_map_after_delete = args_write_del[1]
        assert MOCK_FILE_ID_1 not in written_map_after_delete
        assert MOCK_FILE_ID_2 in written_map_after_delete # file2 should remain

# --- Test Summarization ---
@pytest.mark.asyncio
async def test_summarize_single_file(mock_project_storage, mock_gen_ai_service, sample_project_file_data, mock_datetime_now_service):
    file_to_summarize = ProjectFile(**sample_project_file_data) # content is "print('hello world')"
    
    ai_summary_text = "This is a summary."
    mock_gen_ai_service["structured"].return_value = {"object": SummarySchema(summary=ai_summary_text)}

    # Mock the update_project_file method of project_storage
    # It should return the updated ProjectFile model
    updated_file_data = file_to_summarize.model_dump()
    updated_file_data["summary"] = ai_summary_text
    updated_file_data["summary_last_updated_at"] = FIXED_TIMESTAMP
    expected_updated_file = ProjectFile(**updated_file_data)
    mock_project_storage.update_project_file.return_value = expected_updated_file
    
    result = await summarize_single_file(file_to_summarize)

    assert result is not None
    assert result.summary == ai_summary_text
    assert result.summary_last_updated_at == FIXED_TIMESTAMP
    
    mock_gen_ai_service["structured"].assert_called_once()
    call_args_ai = mock_gen_ai_service["structured"].call_args[1] # kwargs
    assert call_args_ai['prompt'] == file_to_summarize.content
    assert call_args_ai['output_schema'] == SummarySchema
    
    mock_project_storage.update_project_file.assert_called_once_with(
        file_to_summarize.project_id,
        file_to_summarize.id,
        {"summary": ai_summary_text, "summary_last_updated_at": FIXED_TIMESTAMP}
    )

@pytest.mark.asyncio
async def test_summarize_single_file_empty_content(mock_project_storage, mock_gen_ai_service, sample_project_file_data):
    file_empty_content_data = {**sample_project_file_data, "content": "  "}
    file_empty = ProjectFile(**file_empty_content_data)
    
    result = await summarize_single_file(file_empty)
    assert result is None
    mock_gen_ai_service["structured"].assert_not_called()
    mock_project_storage.update_project_file.assert_not_called()

@pytest.mark.asyncio
async def test_summarize_files(mock_project_storage, sample_project_file_data, mock_datetime_now_service):
    file1_data = sample_project_file_data
    file2_data = {**sample_project_file_data, "id": MOCK_FILE_ID_2, "path":"f2.py", "content":"content2"}
    
    file1 = ProjectFile(**file1_data)
    file2 = ProjectFile(**file2_data)

    # Mock project_storage.read_project_files to return these files
    mock_project_storage.read_project_files.return_value = {
        MOCK_FILE_ID_1: file1,
        MOCK_FILE_ID_2: file2
    }

    # Mock summarize_single_file behavior
    # Let's say file1 is summarized, file2 summarization returns None (e.g. empty or error)
    updated_file1_data = file1.model_dump()
    updated_file1_data["summary"] = "Summary for file1"
    updated_file1_data["summary_last_updated_at"] = FIXED_TIMESTAMP
    summarized_file1 = ProjectFile(**updated_file1_data)

    async def mock_summarize_single(file_obj):
        if file_obj.id == MOCK_FILE_ID_1:
            return summarized_file1
        if file_obj.id == MOCK_FILE_ID_2: # Simulate a skip or error for file2
            raise Exception("Simulated summarization error for file2") # Or return None
        return None

    with patch('app.services.project_service.summarize_single_file', side_effect=mock_summarize_single) as mock_ssf:
        result = await summarize_files(MOCK_PROJECT_ID, [MOCK_FILE_ID_1, MOCK_FILE_ID_2])

    assert result["included"] == 1
    assert result["skipped"] == 1 # Due to the exception for file2
    assert len(result["updated_files"]) == 1
    assert result["updated_files"][0].id == MOCK_FILE_ID_1
    assert result["updated_files"][0].summary == "Summary for file1"

    assert mock_ssf.call_count == 2
    mock_ssf.assert_any_call(file1)
    mock_ssf.assert_any_call(file2)

@pytest.mark.asyncio
async def test_remove_summaries_from_files(mock_project_storage, sample_project_data, sample_project_file_data, mock_datetime_now_service):
    project_instance = Project(**sample_project_data)
    file_with_summary_data = {
        **sample_project_file_data,
        "summary": "Existing summary",
        "summary_last_updated_at": FIXED_TIMESTAMP - 1000,
        "updated": FIXED_TIMESTAMP - 2000 # Original updated time
    }
    file_with_summary = ProjectFile(**file_with_summary_data)

    with patch('app.services.project_service.get_project_by_id', AsyncMock(return_value=project_instance)):
        mock_project_storage.read_project_files.return_value = {MOCK_FILE_ID_1: file_with_summary}

        result = await remove_summaries_from_files(MOCK_PROJECT_ID, [MOCK_FILE_ID_1])

        assert result["removed_count"] == 1
        
        mock_project_storage.write_project_files.assert_called_once()
        args_write_remove, _ = mock_project_storage.write_project_files.call_args
        written_map_after_remove = args_write_remove[1]
        
        # Check the file in the written map
        removed_summary_file = written_map_after_remove[MOCK_FILE_ID_1]
        assert removed_summary_file["summary"] is None
        assert removed_summary_file["summary_last_updated_at"] is None
        assert removed_summary_file["updated"] == FIXED_TIMESTAMP # File's 'updated' field is also touched

# --- Test Input Optimization ---
@pytest.mark.asyncio
async def test_optimize_user_input(mock_gen_ai_service):
    user_context = "Optimize this prompt for me."
    project_summary_text = "This is a project summary."
    optimized_prompt_text = "This is the optimized prompt."

    # Define the dictionary to be used as the mock for prompts_map
    mocked_prompts_map_instance = {"contemplativePrompt": "Contemplative prompt style guide."}

    with patch('app.services.project_service.get_full_project_summary', AsyncMock(return_value=project_summary_text)) as mock_get_summary, \
         patch('app.services.project_service.prompts_map', mocked_prompts_map_instance) as mock_prompts_map_obj: # Patch the object itself
        
        mock_gen_ai_service["single"].return_value = optimized_prompt_text
        
        result = await optimize_user_input(MOCK_PROJECT_ID, user_context)

        assert result == optimized_prompt_text
        mock_get_summary.assert_called_once_with(MOCK_PROJECT_ID)
        # No need to assert mock_prompts_map_obj.get, its behavior is fixed.
        
        mock_gen_ai_service["single"].assert_called_once()
        call_args_ai_opt = mock_gen_ai_service["single"].call_args[1]
        assert user_context in call_args_ai_opt['prompt']
        assert project_summary_text in call_args_ai_opt['system_message_content']
        assert "Contemplative prompt style guide." in call_args_ai_opt['system_message_content']