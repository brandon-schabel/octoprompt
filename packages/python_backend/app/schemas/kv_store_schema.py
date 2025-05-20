from typing import Optional, List, Dict, Any, Literal, Union, TypeVar, Generic
from pydantic import BaseModel, Field, ConfigDict
from enum import Enum

# --- KV Store Schemas ---
# Last 5 changes:
# 1. Initial conversion from Zod to Pydantic.
# 2. Imported AppSettings, ProjectTabsStateRecord from .global_state_schema.
# 3. Added placeholder for OperationSuccessResponseSchema, ApiErrorResponseSchema from .common_schemas.
# 4. Defined KVKeyEnum and Pydantic models for KV operations.
# 5. Renamed KV_SCHEMAS_PYTHON_EQUIVALENT to KV_SCHEMAS, added KVValue type.

# Try to import from global_state_schema, use placeholders if not found (though it should exist)
try:
    from .global_state_schema import AppSettings, ProjectTabsStateRecord, GlobalState
except ImportError:
    class AppSettings(BaseModel):
        model_config = ConfigDict(extra='allow')
        pass
    class ProjectTabsStateRecordModel(BaseModel): # Cannot use Dict[str, Any] directly as a base for Pydantic model
        model_config = ConfigDict(extra='allow')
        pass 
    ProjectTabsStateRecord = Dict[str, Any] # More accurate to the Zod schema z.record(z.string(), projectTabStateSchema)
    
    class GlobalState(BaseModel):
        app_settings: AppSettings
        project_tabs: ProjectTabsStateRecord
        project_active_tab_id: str = "defaultTab"
        active_chat_id: str = ""
        model_config = ConfigDict(populate_by_name=True)

# Placeholders for common schemas
try:
    from .common_schemas import OperationSuccessResponse, ApiErrorResponse # Assuming these names
except ImportError:
    class OperationSuccessResponse(BaseModel):
        success: Literal[True] = True
        message: Optional[str] = None
        model_config = ConfigDict(title="OperationSuccessResponse")

    class ApiErrorResponse(BaseModel):
        success: Literal[False] = False
        error_code: str
        message: str
        details: Optional[Dict[str, Any]] = None
        model_config = ConfigDict(title="ApiErrorResponse")

class KVKeyEnum(str, Enum):
    APP_SETTINGS = "appSettings"
    PROJECT_TABS = "projectTabs"
    ACTIVE_PROJECT_TAB_ID = "activeProjectTabId"
    ACTIVE_CHAT_ID = "activeChatId"

# This mapping is useful for validation or dispatch in Python, similar to KvSchemas in TS.
# The actual Pydantic models are defined elsewhere or are basic types.
KV_SCHEMAS = {
    KVKeyEnum.APP_SETTINGS: AppSettings,
    KVKeyEnum.PROJECT_TABS: ProjectTabsStateRecord, # This is Dict[str, ProjectTabState]
    KVKeyEnum.ACTIVE_PROJECT_TAB_ID: str,
    KVKeyEnum.ACTIVE_CHAT_ID: str
}

# Generic type for KV values, similar to z.infer from Zod schemas.
# Used in service layer for type hinting. Response models use 'Any' for flexibility.
KVValue = Any

# KVDefaultValues equivalent in Python would typically involve a function
# or a dictionary of default instances, leveraging Pydantic model defaults.
# For example, to get default AppSettings, you'd just do AppSettings().
# The createInitialGlobalState function from global-state-schema.ts provides these.

# If we need to re-create something like createInitialGlobalState in Python:
def get_initial_global_state() -> GlobalState:
    return GlobalState(
        app_settings=AppSettings(), # Pydantic models handle their own defaults
        project_tabs={
            "defaultTab": { # Assuming ProjectTabState can be created from dict or has defaults
                "displayName": "Default Project Tab"
                # other ProjectTabState fields would take their defaults
            }
        },
        project_active_tab_id="defaultTab", # Default from GlobalState model
        active_chat_id="", # Default from GlobalState model
        # chat_link_settings is not in KVDefaultValues directly, but part of GlobalState with its own default
        chat_link_settings={} 
    )

initial_global_state_py = get_initial_global_state()

KV_DEFAULT_VALUES_PYTHON = {
    KVKeyEnum.ACTIVE_CHAT_ID: initial_global_state_py.active_chat_id,
    KVKeyEnum.ACTIVE_PROJECT_TAB_ID: initial_global_state_py.project_active_tab_id,
    KVKeyEnum.APP_SETTINGS: initial_global_state_py.app_settings,
    KVKeyEnum.PROJECT_TABS: initial_global_state_py.project_tabs
}


# --- OpenAPI Schemas for KV Store ---_PYTHON

class KvKeyQuery(BaseModel):
    key: KVKeyEnum = Field(..., description="The key to retrieve or delete.", example=KVKeyEnum.APP_SETTINGS, json_schema_extra={"param": {"name": "key", "in": "query"}})
    model_config = ConfigDict(title="KvKeyQuery")

class KvSetBody(BaseModel):
    value: Any = Field(..., description="The value to store for the key. Must conform to the key's specific schema.", example={"theme": "dark", "language": "en"})
    model_config = ConfigDict(title="KvSetBody")

class KvGetResponse(BaseModel):
    success: Literal[True] = True
    key: KVKeyEnum = Field(..., description="The key whose value was retrieved.", example=KVKeyEnum.APP_SETTINGS)
    value: Any = Field(..., description="The retrieved value associated with the key.", example={"name": "Alice", "age": 30})
    model_config = ConfigDict(title="KvGetResponse")

class KvSetResponse(BaseModel):
    success: Literal[True] = True
    key: KVKeyEnum = Field(..., description="The key that was set.", example=KVKeyEnum.APP_SETTINGS)
    value: Any = Field(..., description="The value that was stored.", example=["new-feature", "beta-test"])
    model_config = ConfigDict(title="KvSetResponse")

KvDeleteResponse = OperationSuccessResponse # .openapi('KvDeleteResponse') # Title can be set if this is a new distinct model
KvDeleteResponse.model_config = ConfigDict(title="KvDeleteResponse")

# Re-export common error schema for consistency if needed elsewhere
# (already imported with placeholder if not found)
__all__ = [
    "KVKeyEnum",
    "KvKeyQuery",
    "KvSetBody",
    "KvGetResponse",
    "KvSetResponse",
    "KvDeleteResponse",
    "ApiErrorResponse", # Exporting the imported/placeholder
    "OperationSuccessResponse", # Exporting the imported/placeholder
    "KV_SCHEMAS",
    "KVValue"
]
