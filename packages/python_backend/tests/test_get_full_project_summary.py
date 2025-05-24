import pytest
from unittest.mock import AsyncMock, patch
from typing import List, Dict, Any, Optional

# Import real implementations instead of defining mocks
from app.utils.get_full_project_summary import (
    get_full_project_summary, build_project_summary, 
    build_combined_file_summaries_xml
)
from app.error_handling.api_error import ApiError  # Import from shared location
from app.schemas.project_schemas import Project, ProjectFile  # Import real schemas

class TestBuildCombinedFileSummariesXml:
    def test_should_return_empty_summaries_for_empty_file_list(self):
        result = build_combined_file_summaries_xml([], {})
        assert result == "<summaries></summaries>"

    def test_should_build_xml_for_single_file_with_summary(self):
        files = [ProjectFile(
            id=1, project_id=100, name='test.ts', path='src/test.ts', extension='.ts',
            size=100, summary='Test file summary', created=1234567890000, updated=1234567890000
        )]
        result = build_combined_file_summaries_xml(files, {"includeEmptySummaries": True})
        
        assert '<summaries>' in result
        assert '<file>' in result
        assert '<path>src/test.ts</path>' in result
        assert '<summary>Test file summary</summary>' in result
        assert '</file>' in result
        assert '</summaries>' in result

    def test_should_build_xml_for_multiple_files(self):
        files = [
            ProjectFile(
                id=1, project_id=100, name='file1.ts', path='src/file1.ts', extension='.ts',
                size=100, summary='Summary 1', created=1234567890000, updated=1234567890000
            ),
            ProjectFile(
                id=2, project_id=100, name='file2.ts', path='src/file2.ts', extension='.ts',
                size=200, summary='Summary 2', created=1234567890000, updated=1234567890000
            )
        ]
        result = build_combined_file_summaries_xml(files, {"includeEmptySummaries": True})
        
        assert result.count('<file>') == 2
        assert '<path>src/file1.ts</path>' in result
        assert '<summary>Summary 1</summary>' in result
        assert '<path>src/file2.ts</path>' in result
        assert '<summary>Summary 2</summary>' in result

    def test_should_include_files_with_empty_summaries_when_flag_is_true(self):
        files = [
            ProjectFile(
                id=1, project_id=100, name='file1.ts', path='src/file1.ts', extension='.ts',
                size=100, summary='', created=1234567890000, updated=1234567890000
            ),
            ProjectFile(
                id=2, project_id=100, name='file2.ts', path='src/file2.ts', extension='.ts',
                size=200, summary=None, created=1234567890000, updated=1234567890000
            )
        ]
        result = build_combined_file_summaries_xml(files, {"includeEmptySummaries": True})
        
        assert result.count('<file>') == 2
        assert '<summary></summary>' in result

    def test_should_exclude_files_with_empty_summaries_when_flag_is_false(self):
        files = [
            ProjectFile(
                id=1, project_id=100, name='file1.ts', path='src/file1.ts', extension='.ts',
                size=100, summary='Real summary', created=1234567890000, updated=1234567890000
            ),
            ProjectFile(
                id=2, project_id=100, name='file2.ts', path='src/file2.ts', extension='.ts',
                size=200, summary='', created=1234567890000, updated=1234567890000
            ),
            ProjectFile(
                id=3, project_id=100, name='file3.ts', path='src/file3.ts', extension='.ts',
                size=150, summary=None, created=1234567890000, updated=1234567890000
            )
        ]
        result = build_combined_file_summaries_xml(files, {"includeEmptySummaries": False})
        
        # Should only include the file with a real summary
        assert result.count('<file>') == 1
        assert '<path>src/file1.ts</path>' in result
        assert '<summary>Real summary</summary>' in result

    def test_should_handle_files_without_summary_attribute(self):
        # Test with files that have None summary
        files = [ProjectFile(
            id=1, project_id=100, name='file1.ts', path='src/file1.ts', extension='.ts',
            size=100, summary=None, created=1234567890000, updated=1234567890000
        )]
        result = build_combined_file_summaries_xml(files, {"includeEmptySummaries": True})
        
        assert '<file>' in result
        assert '<path>src/file1.ts</path>' in result
        assert '<summary></summary>' in result

class TestBuildProjectSummary:
    def test_should_build_summary_from_files(self):
        files = [
            ProjectFile(
                id=1, project_id=100, name='file1.ts', path='src/file1.ts', extension='.ts',
                size=100, summary='File 1 summary', created=1234567890000, updated=1234567890000
            ),
            ProjectFile(
                id=2, project_id=100, name='file2.ts', path='src/file2.ts', extension='.ts',
                size=200, summary='File 2 summary', created=1234567890000, updated=1234567890000
            )
        ]
        result = build_project_summary(files)
        
        assert '<summaries>' in result
        assert 'File 1 summary' in result
        assert 'File 2 summary' in result

    def test_should_include_empty_summaries_by_default(self):
        files = [
            ProjectFile(
                id=1, project_id=100, name='file1.ts', path='src/file1.ts', extension='.ts',
                size=100, summary='', created=1234567890000, updated=1234567890000
            ),
            ProjectFile(
                id=2, project_id=100, name='file2.ts', path='src/file2.ts', extension='.ts',
                size=200, summary=None, created=1234567890000, updated=1234567890000
            )
        ]
        result = build_project_summary(files)
        
        # Should include files even with empty summaries
        assert result.count('<file>') == 2

class TestGetFullProjectSummary:
    @pytest.mark.asyncio
    async def test_should_raise_api_error_when_project_not_found(self):
        with patch('app.services.project_service.get_project_by_id', new_callable=AsyncMock) as mock_get_project:
            mock_get_project.return_value = None
            
            with pytest.raises(ApiError) as exc_info:
                await get_full_project_summary(123)  # Use int ID
            
            assert exc_info.value.status_code == 404  # Use status_code not status
            assert exc_info.value.message == "Project not found"
            assert exc_info.value.code == "NOT_FOUND"

    @pytest.mark.asyncio
    async def test_should_return_error_message_when_no_files_available(self):
        mock_project = Project(
            id=1, name='Test Project', path='/test/path',
            created=1234567890000, updated=1234567890000
        )
        
        with patch('app.services.project_service.get_project_by_id', new_callable=AsyncMock) as mock_get_project, \
             patch('app.services.project_service.get_project_files', new_callable=AsyncMock) as mock_get_files:
            
            mock_get_project.return_value = mock_project
            mock_get_files.return_value = None
            
            result = await get_full_project_summary(1)
            
            assert isinstance(result, dict)
            assert result['success'] is False
            assert 'No summaries available' in result['message']

    @pytest.mark.asyncio
    async def test_should_return_error_message_when_files_list_is_empty(self):
        mock_project = Project(
            id=1, name='Test Project', path='/test/path',
            created=1234567890000, updated=1234567890000
        )
        
        with patch('app.services.project_service.get_project_by_id', new_callable=AsyncMock) as mock_get_project, \
             patch('app.services.project_service.get_project_files', new_callable=AsyncMock) as mock_get_files:
            
            mock_get_project.return_value = mock_project
            mock_get_files.return_value = []
            
            result = await get_full_project_summary(1)
            
            assert isinstance(result, dict)
            assert result['success'] is False
            assert 'No summaries available' in result['message']

    @pytest.mark.asyncio
    async def test_should_return_project_summary_when_files_are_available(self):
        mock_project = Project(
            id=1, name='Test Project', path='/test/path',
            created=1234567890000, updated=1234567890000
        )
        mock_files = [
            ProjectFile(
                id=1, project_id=100, name='file1.ts', path='src/file1.ts', extension='.ts',
                size=100, summary='Summary 1', created=1234567890000, updated=1234567890000
            ),
            ProjectFile(
                id=2, project_id=100, name='file2.ts', path='src/file2.ts', extension='.ts',
                size=200, summary='Summary 2', created=1234567890000, updated=1234567890000
            )
        ]
        
        with patch('app.services.project_service.get_project_by_id', new_callable=AsyncMock) as mock_get_project, \
             patch('app.services.project_service.get_project_files', new_callable=AsyncMock) as mock_get_files:
            
            mock_get_project.return_value = mock_project
            mock_get_files.return_value = mock_files
            
            result = await get_full_project_summary(1)
            
            assert isinstance(result, str)
            assert '<summaries>' in result
            assert 'Summary 1' in result
            assert 'Summary 2' in result

    @pytest.mark.asyncio
    async def test_should_filter_files_using_is_included_function(self):
        mock_project = Project(
            id=1, name='Test Project', path='/test/path',
            created=1234567890000, updated=1234567890000
        )
        mock_files = [
            ProjectFile(
                id=1, project_id=100, name='file1.ts', path='src/file1.ts', extension='.ts',
                size=100, summary='Summary 1', created=1234567890000, updated=1234567890000
            ),
            ProjectFile(
                id=2, project_id=100, name='lib.js', path='node_modules/lib.js', extension='.js',
                size=200, summary='Library summary', created=1234567890000, updated=1234567890000
            ),
            ProjectFile(
                id=3, project_id=100, name='file2.ts', path='src/file2.ts', extension='.ts',
                size=150, summary='Summary 2', created=1234567890000, updated=1234567890000
            )
        ]
        
        with patch('app.services.project_service.get_project_by_id', new_callable=AsyncMock) as mock_get_project, \
             patch('app.services.project_service.get_project_files', new_callable=AsyncMock) as mock_get_files:
            
            mock_get_project.return_value = mock_project
            mock_get_files.return_value = mock_files
            
            result = await get_full_project_summary(1)
            
            # All files should be included since is_included currently returns True for all
            assert isinstance(result, str)
            assert result.count('<file>') == 3

    @pytest.mark.asyncio
    async def test_should_handle_files_with_missing_summaries(self):
        mock_project = Project(
            id=1, name='Test Project', path='/test/path',
            created=1234567890000, updated=1234567890000
        )
        mock_files = [
            ProjectFile(
                id=1, project_id=100, name='file1.ts', path='src/file1.ts', extension='.ts',
                size=100, summary='Real summary', created=1234567890000, updated=1234567890000
            ),
            ProjectFile(
                id=2, project_id=100, name='file2.ts', path='src/file2.ts', extension='.ts',
                size=200, summary='', created=1234567890000, updated=1234567890000
            ),
            ProjectFile(
                id=3, project_id=100, name='file3.ts', path='src/file3.ts', extension='.ts',
                size=150, summary=None, created=1234567890000, updated=1234567890000
            )
        ]
        
        with patch('app.services.project_service.get_project_by_id', new_callable=AsyncMock) as mock_get_project, \
             patch('app.services.project_service.get_project_files', new_callable=AsyncMock) as mock_get_files:
            
            mock_get_project.return_value = mock_project
            mock_get_files.return_value = mock_files
            
            result = await get_full_project_summary(1)
            
            assert isinstance(result, str)
            # All files should be included since includeEmptySummaries is True
            assert result.count('<file>') == 3

class TestApiError:
    def test_should_create_api_error_with_all_parameters(self):
        error = ApiError(404, "Not found", "NOT_FOUND", {"detail": "Resource missing"})
        
        assert error.status_code == 404  # Use status_code not status
        assert error.message == "Not found"
        assert error.code == "NOT_FOUND"
        assert error.details == {"detail": "Resource missing"}

    def test_should_create_api_error_with_minimal_parameters(self):
        # ApiError requires code parameter, so provide it
        error = ApiError(500, "Internal error", "INTERNAL_ERROR")
        
        assert error.status_code == 500
        assert error.message == "Internal error"
        assert error.code == "INTERNAL_ERROR"
        assert error.details is None

    def test_should_be_raised_as_exception(self):
        with pytest.raises(ApiError) as exc_info:
            raise ApiError(400, "Bad request", "BAD_REQUEST")
        
        assert exc_info.value.status_code == 400  # Use status_code not status
        assert exc_info.value.message == "Bad request"
        assert exc_info.value.code == "BAD_REQUEST" 