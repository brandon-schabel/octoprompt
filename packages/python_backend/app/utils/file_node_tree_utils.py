from typing import Dict, List, Optional, Union, Any
from pydantic import BaseModel, Field
import math

from app.schemas.project_schemas import ProjectFile

class FileNode(BaseModel):
    is_folder: bool = Field(..., alias='_folder')
    file: Optional[ProjectFile] = None
    children: Optional[Dict[str, 'FileNode']] = None

    model_config = {
        "populate_by_name": True
    }

FileNode.model_rebuild()


def format_token_count(content: Union[str, int]) -> str:
    count = estimate_token_count(content) if isinstance(content, str) else content
    if count >= 1000:
        return f"{(count / 1000):.2f}".rstrip('0').rstrip('.') + 'k'
    return str(count)

def estimate_token_count(text: str, chars_per_token: int = 4) -> int:
    if not text:
        return 0
    length = len(text)
    if length == 0 or chars_per_token <= 0:
        return 0
    return math.ceil(length / chars_per_token)

def count_total_files(root: Dict[str, FileNode]) -> int:
    count = 0
    
    def recurse(node: FileNode):
        nonlocal count
        if node.is_folder and node.children:
            for child_node in node.children.values():
                recurse(child_node)
        elif node.file:
            count += 1
            
    for node_val in root.values():
        recurse(node_val)
    return count

def collect_files(node: FileNode) -> List[int]:
    ids: List[int] = []
    if node.is_folder and node.children:
        for child_node in node.children.values():
            ids.extend(collect_files(child_node))
    elif node.file and node.file.id is not None:
        ids.append(node.file.id)
    return ids

def calculate_folder_tokens(folder_node: FileNode, selected_files: List[int]) -> Dict[str, int]:
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
                if child.file.id is not None and child.file.id in selected_files:
                    selected_tokens += tokens
    return {"selected_tokens": selected_tokens, "total_tokens": total_tokens}

def are_all_folder_files_selected(folder_node: FileNode, selected_files: List[int]) -> bool:
    all_files_in_folder = collect_files(folder_node)
    if not all_files_in_folder:
        return False 
    return all(file_id in selected_files for file_id in all_files_in_folder)

def is_folder_partially_selected(folder_node: FileNode, selected_files: List[int]) -> bool:
    if not folder_node.is_folder:
        return False
    all_files_in_folder = collect_files(folder_node)
    if not all_files_in_folder:
        return False
    selected_count = sum(1 for file_id in all_files_in_folder if file_id in selected_files)
    return 0 < selected_count < len(all_files_in_folder)

def toggle_file(file_id: int, selected_files: List[int]) -> List[int]:
    if file_id in selected_files:
        return [id_ for id_ in selected_files if id_ != file_id]
    else:
        return selected_files + [file_id]

def toggle_folder(folder_node: FileNode, select: bool, selected_files: List[int]) -> List[int]:
    all_files_in_folder = collect_files(folder_node)
    current_selected_set = set(selected_files)
    if select:
        for file_id in all_files_in_folder:
            current_selected_set.add(file_id)
    else:
        for file_id in all_files_in_folder:
            current_selected_set.discard(file_id)
    return list(current_selected_set) 