# packages/python_backend/app/utils/get_full_project_summary.py
# - Fixed circular import by using local imports and shared ApiError
# - Import ApiError from shared location to avoid circular dependency
# - Converted from TypeScript
# - Depends on project_service and project_schemas
# - Needs ApiError and summary_formatter to be defined/converted
# - Initial conversion, may require adjustments for imports
# - Placeholder for build_combined_file_summaries_xml

from typing import List, Dict, Any, Coroutine, Union

# Import shared ApiError to avoid circular dependency
from app.error_handling.api_error import ApiError
from app.schemas.project_schemas import Project, ProjectFile 

# Fixed build_combined_file_summaries_xml to respect includeEmptySummaries flag
def build_combined_file_summaries_xml(files: List[ProjectFile], options: Dict[str, Any]) -> str:
    if not files:
        return "<summaries></summaries>"
    
    include_empty = options.get("includeEmptySummaries", True)
    xml_parts = ["<summaries>"]
    
    for file_item in files:
        summary_content = file_item.summary if file_item.summary else ""
        
        # Filter based on includeEmptySummaries flag
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
    # Build the combined summaries using your summary-formatter
    return build_combined_file_summaries_xml(included_files, {
        "includeEmptySummaries": True
    })

async def get_full_project_summary(project_id: int) -> Union[str, Dict[str, Any]]:
    # Use local imports to avoid circular dependency
    from app.services.project_service import get_project_by_id, get_project_files
    
    project = await get_project_by_id(project_id)
    if not project:
        raise ApiError(404, "Project not found", "NOT_FOUND")

    # Fetch all file summaries from the database
    all_files = await get_project_files(project_id)
    if not all_files:
        # Original TS returns an object, Python can return a dict or raise an error
        return {
            "success": False,
            "message": "No summaries available. Please summarize files first."
        }

    # Filter out files that match ignore patterns (unless a file also matches an allow pattern, if applicable)
    # The logic for is_included needs to be implemented if ignore/allow patterns are used.
    # For now, assuming all files are included.
    def is_included(file: ProjectFile) -> bool:
        # Placeholder for filtering logic
        return True

    # Filter down to the "included" files
    included_files = [f for f in all_files if is_included(f)]

    return build_project_summary(included_files)

# Example usage:
# async def main():
#     try:
#         # You'll need to mock or set up data for get_project_by_id and get_project_files
#         summary = await get_full_project_summary("proj_123")
#         print(summary)
#     except ApiError as e:
#         print(f"API Error: {e.message} (Code: {e.code}, Status: {e.status_code})")

# if __name__ == "__main__":
#     import asyncio
#     asyncio.run(main())
