from typing import Dict, List, Optional, Union, Any
from pydantic import BaseModel, Field
import math

# Assuming ProjectFile is defined in project_schemas.py
# from app.schemas.project_schemas import ProjectFile
# For now, using Any as a placeholder if ProjectFile is not directly available or needed for basic structure
class ProjectFile(BaseModel): # Basic placeholder, replace with actual import
    id: str
    path: str
    content: Optional[str] = None
    summary: Optional[str] = None # Added summary based on buildNodeSummaries
    # Add other fields if they are accessed by functions in this file

class FileNode(BaseModel):
    is_folder: bool = Field(..., alias='_folder') # Alias for _folder
    file: Optional[ProjectFile] = None
    children: Optional[Dict[str, 'FileNode']] = None # Self-referencing

    model_config = {
        "populate_by_name": True # Allow using '_folder' in input data
    }

# Rebuild model to handle forward reference
FileNode.model_rebuild()


def format_token_count(content: Union[str, int]) -> str:
    """Formats a token count, displaying in 'k' for thousands."""
    count = estimate_token_count(content) if isinstance(content, str) else content
    if count >= 1000:
        return f"{(count / 1000):.2f}".rstrip('0').rstrip('.') + 'k'
    return str(count)

def estimate_token_count(text: str, chars_per_token: int = 4) -> int:
    """Estimates token count based on character length."""
    if not text: # Handle empty string explicitly
        return 0
    length = len(text)
    if length == 0 or chars_per_token <= 0:
        return 0
    return math.ceil(length / chars_per_token)

def count_total_files(root: Dict[str, FileNode]) -> int:
    """Counts the total number of files in a file tree."""
    count = 0
    
    def recurse(node: FileNode):
        nonlocal count
        if node.is_folder and node.children:
            for child_node in node.children.values():
                recurse(child_node)
        elif node.file:
            count += 1
            
    for node_val in root.values(): # Corrected variable name
        recurse(node_val)
    return count

def collect_files(node: FileNode) -> List[str]:
    """Collects all file IDs from a FileNode tree."""
    ids: List[str] = []
    if node.is_folder and node.children:
        for child_node in node.children.values():
            ids.extend(collect_files(child_node))
    elif node.file and node.file.id:
        ids.append(node.file.id)
    return ids

def calculate_folder_tokens(folder_node: FileNode, selected_files: List[str]) -> Dict[str, int]:
    """Calculates selected and total tokens for a folder."""
    total_tokens = 0
    selected_tokens = 0

    if folder_node.is_folder and folder_node.children:
        for child in folder_node.children.values():
            if child.is_folder:
                child_folder_tokens = calculate_folder_tokens(child, selected_files)
                total_tokens += child_folder_tokens['total_tokens']
                selected_tokens += child_folder_tokens['selected_tokens']
            elif child.file and child.file.content:
                tokens = estimate_token_count(child.file.content)
                total_tokens += tokens
                if child.file.id and child.file.id in selected_files:
                    selected_tokens += tokens
    return {"selected_tokens": selected_tokens, "total_tokens": total_tokens}

def are_all_folder_files_selected(folder_node: FileNode, selected_files: List[str]) -> bool:
    """Checks if all files in a folder are selected."""
    all_files_in_folder = collect_files(folder_node)
    if not all_files_in_folder: # Empty folder
        return False 
    return all(file_id in selected_files for file_id in all_files_in_folder)

def is_folder_partially_selected(folder_node: FileNode, selected_files: List[str]) -> bool:
    """Checks if a folder is partially selected."""
    if not folder_node.is_folder:
        return False
    all_files_in_folder = collect_files(folder_node)
    if not all_files_in_folder:
        return False
    selected_count = sum(1 for file_id in all_files_in_folder if file_id in selected_files)
    return 0 < selected_count < len(all_files_in_folder)

def toggle_file(file_id: str, selected_files: List[str]) -> List[str]:
    """Toggles a file's selection status. Simplified: no import resolution."""
    if file_id in selected_files:
        return [id_ for id_ in selected_files if id_ != file_id]
    else:
        # Make sure to return a new list to avoid modifying the original list in place if it's passed around.
        return selected_files + [file_id]

def toggle_folder(folder_node: FileNode, select: bool, selected_files: List[str]) -> List[str]:
    """Toggles selection for all files in a folder."""
    all_files_in_folder = collect_files(folder_node)
    # Operate on a copy to avoid modifying the original list if it's being iterated elsewhere or is a shared reference.
    current_selected_set = set(selected_files)
    if select:
        for file_id in all_files_in_folder:
            current_selected_set.add(file_id)
    else:
        for file_id in all_files_in_folder:
            current_selected_set.discard(file_id)
    return list(current_selected_set) 