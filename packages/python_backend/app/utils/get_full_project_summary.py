from typing import List, Dict, Any, Union
from app.error_handling.api_error import ApiError
from app.schemas.project_schemas import Project, ProjectFile

def build_combined_file_summaries_xml(files: List[ProjectFile], options: Dict[str, Any]) -> str:
    if not files:
        return "<summaries></summaries>"
    
    include_empty = options.get("includeEmptySummaries", True)
    xml_parts = ["<summaries>"]
    
    for file_item in files:
        summary_content = file_item.summary if file_item.summary else ""
        
        if not include_empty and not summary_content:
            continue
            
        xml_parts.append("  <file>")
        xml_parts.append(f"    <path>{file_item.path}</path>")
        if include_empty or summary_content:
            xml_parts.append(f"    <summary>{summary_content}</summary>")
        xml_parts.append("  </file>")
    
    xml_parts.append("</summaries>")
    return "\n".join(xml_parts)

def build_project_summary(included_files: List[ProjectFile]) -> str:
    return build_combined_file_summaries_xml(included_files, {
        "includeEmptySummaries": True
    })

async def get_full_project_summary(project_id: int) -> Union[str, Dict[str, Any]]:
    from app.services.project_service import get_project_by_id, get_project_files
    
    project = await get_project_by_id(project_id)
    if not project:
        raise ApiError(404, "Project not found", "NOT_FOUND")

    all_files = await get_project_files(project_id)
    if not all_files:
        return {
            "success": False,
            "message": "No summaries available. Please summarize files first."
        }

    def is_included(file: ProjectFile) -> bool:
        return True

    included_files = [f for f in all_files if is_included(f)]

    return build_project_summary(included_files)