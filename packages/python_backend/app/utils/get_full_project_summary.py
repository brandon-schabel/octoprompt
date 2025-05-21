# packages/python_backend/app/utils/get_full_project_summary.py
# - Converted from TypeScript
# - Depends on project_service and project_schemas
# - Needs ApiError and summary_formatter to be defined/converted
# - Initial conversion, may require adjustments for imports
# - Placeholder for build_combined_file_summaries_xml

from typing import List, Dict, Any, Coroutine, Union

# Assuming project_schemas.py is in app.schemas
from app.schemas.project_schemas import Project, ProjectFile 

# Placeholder for ApiError - this should be defined in a shared utility module
class ApiError(Exception):
    def __init__(self, status_code: int, message: str, code: str, details: Any = None):
        super().__init__(message)
        self.status_code = status_code
        self.message = message
        self.code = code
        self.details = details

# Placeholder for project_service functions - these will be imported from the actual service file
async def get_project_by_id(project_id: str) -> Union[Project, None]:
    # This is a placeholder. Actual implementation will be in project_service.py
    print(f"[get_full_project_summary.py] Placeholder: get_project_by_id({project_id}) called")
    # Example: return Project(id=project_id, name="Test Project", description="Desc", path="/path", createdAt="2023-01-01T00:00:00Z", updatedAt="2023-01-01T00:00:00Z")
    return None

async def get_project_files(project_id: str) -> Union[List[ProjectFile], None]:
    # This is a placeholder. Actual implementation will be in project_service.py
    print(f"[get_full_project_summary.py] Placeholder: get_project_files({project_id}) called")
    return []

# Placeholder for buildCombinedFileSummariesXml from shared/src/utils/summary-formatter
# This function needs to be converted or implemented in Python.
def build_combined_file_summaries_xml(files: List[ProjectFile], options: Dict[str, Any]) -> str:
    print(f"[get_full_project_summary.py] Placeholder: build_combined_file_summaries_xml called with {len(files)} files")
    if not files:
        return "<summaries></summaries>"
    
    xml_parts = ["<summaries>"]
    for file_item in files:
        xml_parts.append("  <file>")
        xml_parts.append(f"    <path>{file_item.path}</path>")
        # Pydantic models use .model_dump() to get dict, then access summary
        # summary = file_item.model_dump().get('summary')
        summary_content = file_item.summary if file_item.summary else ""
        if options.get("includeEmptySummaries") or summary_content:
            xml_parts.append(f"    <summary>{summary_content}</summary>")
        xml_parts.append("  </file>")
    xml_parts.append("</summaries>")
    return "\n".join(xml_parts)

def build_project_summary(included_files: List[ProjectFile]) -> str:
    # Build the combined summaries using your summary-formatter
    return build_combined_file_summaries_xml(included_files, {
        "includeEmptySummaries": True
    })

async def get_full_project_summary(project_id: str) -> Union[str, Dict[str, Any]]:
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
        # const matchesIgnore = matchesAnyPattern(file.path, ignorePatterns);
        # if (matchesIgnore && !matchesAnyPattern(file.path, allowPatterns)) {
        #     return false;
        # }
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
