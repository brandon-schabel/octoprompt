from typing import List, Dict, Optional, Any
from app.schemas.project_schemas import ProjectFile
from app.schemas.prompt_schemas import Prompt, PromptListResponse
from app.utils.file_node_tree_utils import FileNode, estimate_token_count

ProjectFileMap = Dict[int, ProjectFile]

def build_prompt_content(
    file_map: ProjectFileMap,
    prompt_data: Optional[PromptListResponse],
    selected_prompts: List[int],
    selected_files: List[int],
    user_prompt: str
) -> str:
    content_to_copy = ""
    prompt_count = 1
    if prompt_data and prompt_data.data:
        for prompt in prompt_data.data:
            if prompt.id in selected_prompts:
                content_to_copy += f'<system_prompt index="{prompt_count}" name="{prompt.name}">\n<![CDATA[\n{prompt.content}\n]]>\n</system_prompt>\n\n'
                prompt_count += 1

    files_with_content = [file_map[file_id] for file_id in selected_files if file_id in file_map and file_map[file_id].content is not None]

    if files_with_content:
        content_to_copy += "<file_context>\n"
        for file_obj in files_with_content:
            if file_obj:
                content_to_copy += f"  <file>\n    <path>{file_obj.path}</path>\n    <content><![CDATA[\n{file_obj.content}\n]]></content>\n  </file>\n\n"
        content_to_copy += "</file_context>\n"

    trimmed_user_prompt = user_prompt.strip()
    if trimmed_user_prompt:
        content_to_copy += f"<user_instructions>\n<![CDATA[\n{trimmed_user_prompt}\n]]>\n</user_instructions>\n\n"

    return content_to_copy.rstrip()

def calculate_total_tokens(
    prompt_data: Optional[PromptListResponse],
    selected_prompts: List[int],
    user_prompt: str,
    selected_files: List[int],
    file_map: ProjectFileMap
) -> int:
    total = 0
    if prompt_data and prompt_data.data:
        for prompt in prompt_data.data:
            if prompt.id in selected_prompts:
                total += estimate_token_count(prompt.content)

    if user_prompt.strip():
        total += estimate_token_count(user_prompt)

    for file_id in selected_files:
        file_obj = file_map.get(file_id)
        if file_obj and file_obj.content:
            total += estimate_token_count(file_obj.content)
    return total

def build_file_tree(files: List[ProjectFile]) -> Dict[str, Any]:
    root: Dict[str, Any] = {}
    for f in files:
        parts = f.path.split('/')
        current = root
        for i, part in enumerate(parts):
            if part not in current:
                current[part] = {}
            if i == len(parts) - 1:
                current[part]['_folder'] = False
                current[part]['file'] = f
            else:
                current[part]['_folder'] = True
                if 'children' not in current[part]:
                    current[part]['children'] = {}
                current = current[part]['children']
    return root

def build_node_content(node: FileNode, is_folder: bool) -> str:
    content_to_copy = ""
    if is_folder:
        folder_path = node.file.path if node.file and node.file.path else "unknown_folder_path"
        content_to_copy += f'<folder_context path="{folder_path}">\n'
        
        def process_node(current_node: FileNode):
            nonlocal content_to_copy
            if not current_node.is_folder and current_node.file and current_node.file.content:
                content_to_copy += f"  <file>\n    <path>{current_node.file.path}</path>\n    <content><![CDATA[\n{current_node.file.content}\n]]></content>\n  </file>\n"
            if current_node.children:
                for child_node in current_node.children.values():
                    process_node(child_node)
        process_node(node)
        content_to_copy += "</folder_context>\n"
    elif node.file and node.file.content:
        content_to_copy += "<file_context>\n"
        content_to_copy += f"  <file>\n    <path>{node.file.path}</path>\n    <content><![CDATA[\n{node.file.content}\n]]></content>\n  </file>\n"
        content_to_copy += "</file_context>\n"
    return content_to_copy.rstrip()

def build_node_summaries(node: FileNode, is_folder: bool) -> str:
    summaries_to_copy = ""
    if is_folder:
        def process_node(current_node: FileNode, indent=""):
            nonlocal summaries_to_copy
            if not current_node.is_folder and current_node.file and current_node.file.summary:
                summaries_to_copy += f"{indent}File: {current_node.file.path}\n{indent}Summary: {current_node.file.summary}\n\n"
            if current_node.children:
                sorted_children_items = sorted(current_node.children.items(), key=lambda item: item[0])
                for _, child_node in sorted_children_items:
                    process_node(child_node, indent)
        process_node(node)
    elif node.file and node.file.summary:
        summaries_to_copy += f"File: {node.file.path}\nSummary: {node.file.summary}\n"
    
    return summaries_to_copy.strip()

def build_project_file_map(files: List[ProjectFile]) -> ProjectFileMap:
    return {file.id: file for file in files}