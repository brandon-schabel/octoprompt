import pytest
from typing import Dict, List
from app.utils.file_node_tree_utils import (
    FileNode, ProjectFile, estimate_token_count, format_token_count,
    count_total_files, collect_files, calculate_folder_tokens,
    are_all_folder_files_selected, is_folder_partially_selected,
    toggle_file, toggle_folder
)

class TestEstimateTokenCount:
    def test_should_correctly_estimate_tokens_for_normal_text(self):
        assert estimate_token_count('hello world') == 3  # 11 chars / 4 = 2.75, ceil to 3

    def test_should_return_0_for_empty_text(self):
        assert estimate_token_count('') == 0

    def test_should_handle_custom_chars_per_token(self):
        assert estimate_token_count('hello world', 3) == 4  # 11 chars / 3 = 3.67, ceil to 4

class TestFormatTokenCount:
    def test_should_format_large_numbers_with_k_suffix(self):
        assert format_token_count(1500) == '1.5k'
        assert format_token_count(2000) == '2k'
        
    def test_should_format_small_numbers_without_suffix(self):
        assert format_token_count(500) == '500'
        assert format_token_count(99) == '99'
        
    def test_should_handle_string_input(self):
        result = format_token_count('hello world')  # Should estimate first, then format
        assert result == '3'

class TestCountTotalFiles:
    def test_should_count_total_files_correctly(self):
        mock_file_tree = {
            'src': FileNode(
                is_folder=True,
                children={
                    'components': FileNode(
                        is_folder=True,
                        children={
                            'file1.ts': FileNode(
                                is_folder=False,
                                file=ProjectFile(
                                    id=1,  # Changed to int
                                    project_id=1,  # Added required field
                                    name='file1.ts',  # Added required field
                                    path='src/components/file1.ts',
                                    size=100,  # Added required field
                                    created=1234567890,  # Added required field
                                    updated=1234567890  # Added required field
                                )
                            ),
                            'file2.ts': FileNode(
                                is_folder=False,
                                file=ProjectFile(
                                    id=2,  # Changed to int
                                    project_id=1,  # Added required field
                                    name='file2.ts',  # Added required field
                                    path='src/components/file2.ts',
                                    size=200,  # Added required field
                                    created=1234567890,  # Added required field
                                    updated=1234567890  # Added required field
                                )
                            )
                        }
                    ),
                    'utils': FileNode(
                        is_folder=True,
                        children={
                            'file3.ts': FileNode(
                                is_folder=False,
                                file=ProjectFile(
                                    id=3,  # Changed to int
                                    project_id=1,  # Added required field
                                    name='file3.ts',  # Added required field
                                    path='src/utils/file3.ts',
                                    size=300,  # Added required field
                                    created=1234567890,  # Added required field
                                    updated=1234567890  # Added required field
                                )
                            )
                        }
                    )
                }
            )
        }
        assert count_total_files(mock_file_tree) == 3

class TestCollectFiles:
    def test_should_collect_all_file_ids_recursively(self):
        mock_node = FileNode(
            is_folder=True,
            children={
                'file1.ts': FileNode(
                    is_folder=False,
                    file=ProjectFile(
                        id=1,  # Changed to int
                        project_id=1,  # Added required field
                        name='file1.ts',  # Added required field
                        path='file1.ts',
                        size=100,  # Added required field
                        created=1234567890,  # Added required field
                        updated=1234567890  # Added required field
                    )
                ),
                'nested': FileNode(
                    is_folder=True,
                    children={
                        'file2.ts': FileNode(
                            is_folder=False,
                            file=ProjectFile(
                                id=2,  # Changed to int
                                project_id=1,  # Added required field
                                name='file2.ts',  # Added required field
                                path='nested/file2.ts',
                                size=200,  # Added required field
                                created=1234567890,  # Added required field
                                updated=1234567890  # Added required field
                            )
                        )
                    }
                )
            }
        )
        file_ids = collect_files(mock_node)
        # Note: collect_files returns integers (file IDs)
        assert file_ids == [1, 2]

class TestCalculateFolderTokens:
    def test_should_calculate_tokens_correctly(self):
        mock_folder = FileNode(
            is_folder=True,
            children={
                'file1.ts': FileNode(
                    is_folder=False,
                    file=ProjectFile(
                        id=1,  # Changed to int
                        project_id=1,  # Added required field
                        name='file1.ts',  # Added required field
                        path='file1.ts',
                        size=100,  # Added required field
                        content='hello world',
                        created=1234567890,  # Added required field
                        updated=1234567890  # Added required field
                    )
                ),
                'nested': FileNode(
                    is_folder=True,
                    children={
                        'file2.ts': FileNode(
                            is_folder=False,
                            file=ProjectFile(
                                id=2,  # Changed to int
                                project_id=1,  # Added required field
                                name='file2.ts',  # Added required field
                                path='nested/file2.ts',
                                size=200,  # Added required field
                                content='test content',
                                created=1234567890,  # Added required field
                                updated=1234567890  # Added required field
                            )
                        )
                    }
                )
            }
        )
        selected_files = [1]  # Changed to int
        result = calculate_folder_tokens(mock_folder, selected_files)
        assert result['selected_tokens'] == 3  # tokens for 'hello world'
        assert result['total_tokens'] == 6  # total tokens for both files

class TestFolderSelection:
    @pytest.fixture
    def mock_folder(self):
        return FileNode(
            is_folder=True,
            children={
                'file1.ts': FileNode(
                    is_folder=False,
                    file=ProjectFile(
                        id=1,  # Changed to int
                        project_id=1,  # Added required field
                        name='file1.ts',  # Added required field
                        path='file1.ts',
                        size=100,  # Added required field
                        created=1234567890,  # Added required field
                        updated=1234567890  # Added required field
                    )
                ),
                'file2.ts': FileNode(
                    is_folder=False,
                    file=ProjectFile(
                        id=2,  # Changed to int
                        project_id=1,  # Added required field
                        name='file2.ts',  # Added required field
                        path='file2.ts',
                        size=200,  # Added required field
                        created=1234567890,  # Added required field
                        updated=1234567890  # Added required field
                    )
                )
            }
        )

    def test_should_correctly_identify_when_all_files_are_selected(self, mock_folder):
        selected_files = [1, 2]  # Changed to int
        assert are_all_folder_files_selected(mock_folder, selected_files) is True

    def test_should_correctly_identify_partial_selection(self, mock_folder):
        selected_files = [1]  # Changed to int
        assert is_folder_partially_selected(mock_folder, selected_files) is True

    def test_should_return_false_for_no_selection(self, mock_folder):
        selected_files = []
        assert are_all_folder_files_selected(mock_folder, selected_files) is False
        assert is_folder_partially_selected(mock_folder, selected_files) is False

class TestToggleFile:
    def test_should_toggle_file_selection(self):
        selected_files = []
        result = toggle_file('1', selected_files)
        assert result == ['1']

    def test_should_remove_file_from_selection(self):
        selected_files = ['1', '2']
        result = toggle_file('1', selected_files)
        assert result == ['2']

class TestToggleFolder:
    @pytest.fixture
    def mock_folder(self):
        return FileNode(
            is_folder=True,
            children={
                'file1.ts': FileNode(
                    is_folder=False,
                    file=ProjectFile(
                        id=1,  # Changed to int
                        project_id=1,  # Added required field
                        name='file1.ts',  # Added required field
                        path='file1.ts',
                        size=100,  # Added required field
                        created=1234567890,  # Added required field
                        updated=1234567890  # Added required field
                    )
                ),
                'file2.ts': FileNode(
                    is_folder=False,
                    file=ProjectFile(
                        id=2,  # Changed to int
                        project_id=1,  # Added required field
                        name='file2.ts',  # Added required field
                        path='file2.ts',
                        size=200,  # Added required field
                        created=1234567890,  # Added required field
                        updated=1234567890  # Added required field
                    )
                )
            }
        )

    def test_should_select_all_files_in_folder(self, mock_folder):
        result = toggle_folder(mock_folder, True, [])
        # toggle_folder calls collect_files which returns integers
        assert set(result) == {1, 2}

    def test_should_deselect_all_files_in_folder(self, mock_folder):
        result = toggle_folder(mock_folder, False, [1, 2])
        assert result == []