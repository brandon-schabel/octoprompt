import pytest
from typing import Dict, List, Optional
from datetime import datetime

# Import actual Pydantic models instead of creating mocks
from app.schemas.project_schemas import ProjectFile
from app.schemas.prompt_schemas import Prompt, PromptListResponse

# Import functions to test
from app.utils.project_utils import (
    build_prompt_content, calculate_total_tokens, build_file_tree,
    build_node_content, build_node_summaries, build_project_file_map,
    ProjectFileMap
)

class TestBuildPromptContent:
    @pytest.fixture
    def mock_prompts(self):
        # Use integer IDs to match the schema
        return PromptListResponse(data=[
            Prompt(
                id=1,  # Changed to int
                name='Prompt One',
                content='This is prompt one content.',
                created=1234567890000,
                updated=1234567890000
            ),
            Prompt(
                id=2,  # Changed to int
                name='Prompt Two',
                content='Prompt two: Some instructions here.',
                created=1234567890000,
                updated=1234567890000
            )
        ])

    @pytest.fixture
    def mock_project_files(self):
        return [
            ProjectFile(
                id=1,
                project_id=100,
                name='App.tsx',
                path='src/components/App.tsx',
                extension='.tsx',
                size=100,
                content='console.log("App");',
                summary='Summary of App.tsx',
                created=1234567890000,
                updated=1234567890000
            ),
            ProjectFile(
                id=2,
                project_id=100,
                name='helper.ts',
                path='src/utils/helper.ts',
                extension='.ts',
                size=200,
                content='export function helper() { return "helped"; }',
                summary='Summary of helper.ts',
                created=1234567890000,
                updated=1234567890000
            ),
            ProjectFile(
                id=3,
                project_id=100,
                name='index.ts',
                path='src/index.ts',
                extension='.ts',
                size=50,
                content='import "./components/App";',
                summary='Summary of index.ts',
                created=1234567890000,
                updated=1234567890000
            )
        ]

    @pytest.fixture
    def file_map(self, mock_project_files):
        return {f.id: f for f in mock_project_files}

    def test_should_return_empty_string_if_no_content_is_provided(self, file_map):
        result = build_prompt_content(file_map, None, [], [], '')
        assert result == ''

    def test_should_not_include_file_context_tags_when_no_files_are_selected(self, file_map):
        result = build_prompt_content(file_map, None, [], [], 'test')
        assert '<file_context>' not in result
        assert '<user_instructions>' in result

    def test_should_not_include_user_instructions_when_user_prompt_is_empty_or_whitespace(self, mock_prompts, file_map):
        result = build_prompt_content(file_map, mock_prompts, [1], [], '   ')  # Changed to int
        assert '<user_instructions>' not in result
        assert '<system_prompt index="1" name="Prompt One">' in result

    def test_should_include_selected_prompts(self, mock_prompts, file_map):
        result = build_prompt_content(file_map, mock_prompts, [1], [], '')  # Changed to int
        assert '<system_prompt index="1" name="Prompt One">' in result
        assert 'This is prompt one content.' in result

    def test_should_include_multiple_selected_prompts_in_order(self, mock_prompts, file_map):
        result = build_prompt_content(file_map, mock_prompts, [1, 2], [], '')  # Changed to int
        assert '<system_prompt index="1" name="Prompt One">' in result
        assert '<system_prompt index="2" name="Prompt Two">' in result

    def test_should_include_user_instructions_if_provided(self, mock_prompts, file_map):
        result = build_prompt_content(file_map, mock_prompts, [], [], 'User wants something')
        assert '<user_instructions>' in result
        assert 'User wants something' in result

    def test_should_include_selected_files_with_file_context_tags(self, mock_prompts, file_map):
        result = build_prompt_content(file_map, mock_prompts, [], [1, 2], '')
        assert '<file_context>' in result
        assert '<path>src/components/App.tsx</path>' in result
        assert 'console.log("App");' in result
        assert '<path>src/utils/helper.ts</path>' in result
        assert 'return "helped";' in result

    def test_should_combine_prompts_user_instructions_and_files_correctly(self, mock_prompts, file_map):
        result = build_prompt_content(file_map, mock_prompts, [1], [2], 'Do something special')  # Changed to int
        assert '<system_prompt index="1" name="Prompt One">' in result
        assert '<user_instructions>' in result
        assert 'Do something special' in result
        assert '<file_context>' in result
        assert '<path>src/utils/helper.ts</path>' in result

class TestCalculateTotalTokens:
    @pytest.fixture
    def mock_prompts(self):
        return PromptListResponse(data=[
            Prompt(id=1, name='Prompt One', content='This is prompt one content.', created=1234567890000, updated=1234567890000),  # Changed to int
            Prompt(id=2, name='Prompt Two', content='Prompt two: Some instructions here.', created=1234567890000, updated=1234567890000)  # Changed to int
        ])

    @pytest.fixture
    def file_map(self):
        return {
            1: ProjectFile(id=1, project_id=100, name='file1.ts', path='file1.ts', extension='.ts', size=100, content='console.log("App");', created=1234567890000, updated=1234567890000),
            2: ProjectFile(id=2, project_id=100, name='file2.ts', path='file2.ts', extension='.ts', size=200, content='export function helper() { return "helped"; }', created=1234567890000, updated=1234567890000)
        }

    def test_should_count_tokens_from_selected_prompts(self, mock_prompts, file_map):
        result = calculate_total_tokens(mock_prompts, [1], '', [], file_map)  # Changed to int
        # 'This is prompt one content.' is ~30 chars, 30/4=7.5 -> 8 tokens
        assert result > 0

    def test_should_count_tokens_from_user_prompt(self, file_map):
        result = calculate_total_tokens(None, [], 'A user prompt', [], file_map)
        # 'A user prompt' ~13 chars/4=3.25 -> 4 tokens
        assert result == 4

    def test_should_count_tokens_from_selected_files(self, file_map):
        result = calculate_total_tokens(None, [], '', [1, 2], file_map)
        # f1: 'console.log("App");' ~20 chars/4=5 tokens
        # f2: 'export function helper() { return "helped"; }' ~46 chars/4=11.5 -> 12 tokens
        # total ~17 tokens
        assert result > 10

    def test_should_combine_tokens_from_prompts_user_prompt_and_files(self, mock_prompts, file_map):
        result = calculate_total_tokens(mock_prompts, [1, 2], 'Some user instructions', [1], file_map)  # Changed to int
        # Should be greater than 20 tokens combined
        assert result > 20

    def test_should_return_0_if_nothing_is_selected(self, file_map):
        result = calculate_total_tokens(None, [], '', [], file_map)
        assert result == 0

class TestBuildFileTree:
    @pytest.fixture
    def mock_project_files(self):
        return [
            ProjectFile(id=1, project_id=100, name='App.tsx', path='src/components/App.tsx', extension='.tsx', size=100, created=1234567890000, updated=1234567890000),
            ProjectFile(id=2, project_id=100, name='helper.ts', path='src/utils/helper.ts', extension='.ts', size=200, created=1234567890000, updated=1234567890000),
            ProjectFile(id=3, project_id=100, name='index.ts', path='src/index.ts', extension='.ts', size=50, created=1234567890000, updated=1234567890000)
        ]

    def test_should_build_a_nested_file_tree_structure(self, mock_project_files):
        result = build_file_tree(mock_project_files)
        
        # Expected structure:
        # {
        #   'src': {
        #     '_folder': True,
        #     'children': {
        #       'components': {
        #         '_folder': True,
        #         'children': {
        #           'App.tsx': { '_folder': False, 'file': ... }
        #         }
        #       },
        #       'utils': {
        #         '_folder': True,
        #         'children': {
        #           'helper.ts': { '_folder': False, 'file': ... }
        #         }
        #       },
        #       'index.ts': { '_folder': False, 'file': ... }
        #     }
        #   }
        # }
        assert result['src']['_folder'] is True
        assert result['src']['children']['components']['_folder'] is True
        assert result['src']['children']['components']['children']['App.tsx']['file'].id == 1
        assert result['src']['children']['utils']['_folder'] is True
        assert result['src']['children']['utils']['children']['helper.ts']['file'].id == 2
        assert result['src']['children']['index.ts']['file'].id == 3

    def test_should_handle_empty_file_list(self):
        result = build_file_tree([])
        assert result == {}

    def test_should_handle_files_without_nested_directories(self):
        single_file = [ProjectFile(id=1, project_id=100, name='file.ts', path='file.ts', extension='.ts', size=100, created=1234567890000, updated=1234567890000)]
        result = build_file_tree(single_file)
        assert result['file.ts']['file'].id == 1

class TestBuildProjectFileMap:
    def test_should_build_file_map_correctly(self):
        files = [
            ProjectFile(id=1, project_id=100, name='file1.ts', path='file1.ts', extension='.ts', size=100, created=1234567890000, updated=1234567890000),
            ProjectFile(id=2, project_id=100, name='file2.ts', path='file2.ts', extension='.ts', size=200, created=1234567890000, updated=1234567890000)
        ]
        result = build_project_file_map(files)
        assert result == {1: files[0], 2: files[1]}

    def test_should_handle_empty_list(self):
        result = build_project_file_map([])
        assert result == {}

class TestBuildNodeContent:
    def test_should_build_file_content_correctly(self):
        from app.utils.file_node_tree_utils import FileNode
        
        project_file = ProjectFile(
            id=1, project_id=100, name='test.ts', path='test.ts', extension='.ts', 
            size=100, content='console.log("test");', created=1234567890000, updated=1234567890000
        )
        # Convert integer IDs to strings for FileNode compatibility
        file_dict = project_file.model_dump()
        file_dict['id'] = str(file_dict['id'])  # Convert to string
        file_dict['project_id'] = str(file_dict['project_id'])  # Convert to string
        
        file_node = FileNode(
            is_folder=False,
            file=file_dict
        )
        result = build_node_content(file_node, False)
        
        assert '<file_context>' in result
        assert '<path>test.ts</path>' in result
        assert 'console.log("test");' in result

    def test_should_build_folder_content_correctly(self):
        from app.utils.file_node_tree_utils import FileNode
        
        folder_file = ProjectFile(id=1, project_id=100, name='src', path='src', extension=None, size=0, created=1234567890000, updated=1234567890000)
        child_file = ProjectFile(
            id=2, project_id=100, name='file1.ts', path='src/file1.ts', extension='.ts',
            size=100, content='test content', created=1234567890000, updated=1234567890000
        )
        
        # Convert integer IDs to strings for FileNode compatibility
        folder_dict = folder_file.model_dump()
        folder_dict['id'] = str(folder_dict['id'])
        folder_dict['project_id'] = str(folder_dict['project_id'])
        
        child_dict = child_file.model_dump()
        child_dict['id'] = str(child_dict['id'])
        child_dict['project_id'] = str(child_dict['project_id'])
        
        folder_node = FileNode(
            is_folder=True,
            file=folder_dict,
            children={
                'file1.ts': FileNode(
                    is_folder=False,
                    file=child_dict
                )
            }
        )
        result = build_node_content(folder_node, True)
        
        assert '<folder_context path="src">' in result
        assert '<path>src/file1.ts</path>' in result
        assert 'test content' in result

class TestBuildNodeSummaries:
    def test_should_build_file_summary_correctly(self):
        from app.utils.file_node_tree_utils import FileNode
        
        project_file = ProjectFile(
            id=1, project_id=100, name='test.ts', path='test.ts', extension='.ts',
            size=100, summary='This is a test file', created=1234567890000, updated=1234567890000
        )
        # Convert integer IDs to strings for FileNode compatibility
        file_dict = project_file.model_dump()
        file_dict['id'] = str(file_dict['id'])
        file_dict['project_id'] = str(file_dict['project_id'])
        
        file_node = FileNode(
            is_folder=False,
            file=file_dict
        )
        result = build_node_summaries(file_node, False)
        
        assert 'File: test.ts' in result
        assert 'Summary: This is a test file' in result

    def test_should_build_folder_summaries_correctly(self):
        from app.utils.file_node_tree_utils import FileNode
        
        file1 = ProjectFile(id=1, project_id=100, name='file1.ts', path='src/file1.ts', extension='.ts', size=100, summary='File 1 summary', created=1234567890000, updated=1234567890000)
        file2 = ProjectFile(id=2, project_id=100, name='file2.ts', path='src/file2.ts', extension='.ts', size=200, summary='File 2 summary', created=1234567890000, updated=1234567890000)
        
        # Convert integer IDs to strings for FileNode compatibility
        file1_dict = file1.model_dump()
        file1_dict['id'] = str(file1_dict['id'])
        file1_dict['project_id'] = str(file1_dict['project_id'])
        
        file2_dict = file2.model_dump()
        file2_dict['id'] = str(file2_dict['id'])
        file2_dict['project_id'] = str(file2_dict['project_id'])
        
        folder_node = FileNode(
            is_folder=True,
            children={
                'file1.ts': FileNode(
                    is_folder=False,
                    file=file1_dict
                ),
                'file2.ts': FileNode(
                    is_folder=False,
                    file=file2_dict
                )
            }
        )
        result = build_node_summaries(folder_node, True)
        
        assert 'File: src/file1.ts' in result
        assert 'Summary: File 1 summary' in result
        assert 'File: src/file2.ts' in result
        assert 'Summary: File 2 summary' in result 