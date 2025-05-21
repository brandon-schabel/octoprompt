from typing import Optional, List, Dict, Any, Literal, Union
from pydantic import BaseModel, Field, ConfigDict, AnyUrl
from enum import Enum

# --- Global State Schemas ---
# Last 5 changes:
# 1. Initial conversion from Zod to Pydantic.
# 2. Added placeholders for APIProviders and defaultModelConfigs.
# 3. Handled z.record as Dict.
# 4. Mapped z.enum to Python Enum and .openapi() metadata.
# 5. Used AnyUrl for URL validation.

# Placeholder for APIProviders, assuming it's an Enum or a Literal type
# In a real scenario, this would be imported or defined based on provider-key.schemas.ts
class APIProvidersEnum(str, Enum):
    OPENROUTER = "openrouter"
    OPENAI = "openai"
    AZURE_OPENAI = "azure_openai"
    ANTHROPIC = "anthropic"
    # Add other providers as defined in providerSchema.options

# Placeholder for default model configurations from LOW_MODEL_CONFIG
class DefaultModelConfigs:
    temperature: float = 0.7
    max_tokens: int = 4096
    top_p: float = 1.0
    frequency_penalty: float = 0.0
    presence_penalty: float = 0.0
    provider: APIProvidersEnum = APIProvidersEnum.OPENROUTER
    model: str = "gpt-4o"

default_model_configs = DefaultModelConfigs()

class EditorTypeEnum(str, Enum):
    VSCODE = "vscode"
    CURSOR = "cursor"
    WEBSTORM = "webstorm"

class TicketSortEnum(str, Enum):
    CREATED_DESC = "created_desc"
    CREATED_ASC = "created_asc"
    STATUS = "status"
    PRIORITY = "priority"

class TicketStatusFilterEnum(str, Enum):
    ALL = "all"
    OPEN = "open"
    IN_PROGRESS = "in_progress"
    CLOSED = "closed"

class ProjectTabState(BaseModel):
    selected_project_id: Optional[str] = Field(default=None, validation_alias="selectedProjectId", serialization_alias="selectedProjectId", description="ID of the currently selected project within this tab, or null.", example="proj_123abc")
    edit_project_id: Optional[str] = Field(default=None, validation_alias="editProjectId", serialization_alias="editProjectId", description="ID of the project whose settings are being edited within this tab, or null.", example=None)
    prompt_dialog_open: bool = Field(default=False, validation_alias="promptDialogOpen", serialization_alias="promptDialogOpen", description="Whether the prompt selection/creation dialog is open in this tab.")
    edit_prompt_id: Optional[str] = Field(default=None, validation_alias="editPromptId", serialization_alias="editPromptId", description="ID of the prompt being edited in this tab, or null.", example="prompt_xyz789")
    file_search: str = Field(default="", validation_alias="fileSearch", serialization_alias="fileSearch", description="Current search query for files within this project tab.", example="userService")
    selected_files: Optional[List[str]] = Field(default=[], validation_alias="selectedFiles", serialization_alias="selectedFiles", description="Array of file IDs currently selected in this tab.", example=["file_abc", "file_def"])
    selected_prompts: List[str] = Field(default=[], validation_alias="selectedPrompts", serialization_alias="selectedPrompts", description="Array of prompt IDs currently selected in this tab.", example=["prompt_ghi"])
    user_prompt: str = Field(default="", validation_alias="userPrompt", serialization_alias="userPrompt", description="The current user-entered text in the main prompt input for this tab.", example="Refactor this component to use hooks.")
    search_by_content: bool = Field(default=False, validation_alias="searchByContent", serialization_alias="searchByContent", description="Flag indicating if file search should search within file content.")
    display_name: Optional[str] = Field(None, validation_alias="displayName", serialization_alias="displayName", description="User-defined display name for this project tab.", example="Backend Services")
    context_limit: int = Field(default=128000, validation_alias="contextLimit", serialization_alias="contextLimit", description="Context limit (in tokens) specifically configured for this project tab, overriding global settings if set.", example=16000)
    resolve_imports: bool = Field(default=False, validation_alias="resolveImports", serialization_alias="resolveImports", description="Whether to attempt resolving imports to include related file context.")
    preferred_editor: EditorTypeEnum = Field(default=EditorTypeEnum.VSCODE, validation_alias="preferredEditor", serialization_alias="preferredEditor", description="The preferred editor to open files with from this tab.", example="cursor")
    suggested_file_ids: List[str] = Field(default=[], validation_alias="suggestedFileIds", serialization_alias="suggestedFileIds", description="Array of file IDs suggested by the AI for the current context.", example=["file_sug1", "file_sug2"])
    bookmarked_file_groups: Dict[str, List[str]] = Field(default={}, validation_alias="bookmarkedFileGroups", serialization_alias="bookmarkedFileGroups", description="A record of user-defined file groups (bookmarks), mapping group names to arrays of file IDs.", example={"Auth Files": ["file_auth1", "file_auth2"]})
    ticket_search: str = Field(default="", validation_alias="ticketSearch", serialization_alias="ticketSearch", description="Current search query for tickets.", example="UI bug")
    ticket_sort: TicketSortEnum = Field(default=TicketSortEnum.CREATED_DESC, validation_alias="ticketSort", serialization_alias="ticketSort", description="Sorting criteria for the ticket list.")
    ticket_status_filter: TicketStatusFilterEnum = Field(default=TicketStatusFilterEnum.ALL, validation_alias="ticketStatusFilter", serialization_alias="ticketStatusFilter", description="Filter criteria for ticket status.")
    ticket_id: Optional[str] = Field(default=None, validation_alias="ticketId", serialization_alias="ticketId", description="ID of the currently selected ticket, or null.", example="ticket_999")
    sort_order: int = Field(default=0, validation_alias="sortOrder", serialization_alias="sortOrder", description="Numerical sort order for arranging project tabs.")
    model_config = ConfigDict(title="ProjectTabState", populate_by_name=True)

class ChatModelSettings(BaseModel):
    temperature: float = Field(default=default_model_configs.temperature, ge=0, le=2, description="Controls randomness. Lower values make the model more deterministic.", example=0.7)
    max_tokens: int = Field(default=default_model_configs.max_tokens, ge=100, validation_alias="maxTokens", serialization_alias="maxTokens", description="Maximum number of tokens to generate in the chat completion.", example=4096)
    top_p: float = Field(default=default_model_configs.top_p, ge=0, le=1, validation_alias="topP", serialization_alias="topP", description="Nucleus sampling parameter. Considers tokens with top_p probability mass.", example=1.0)
    frequency_penalty: float = Field(default=default_model_configs.frequency_penalty, ge=-2, le=2, validation_alias="frequencyPenalty", serialization_alias="frequencyPenalty", description="Penalizes new tokens based on their frequency in the text so far.", example=0.0)
    presence_penalty: float = Field(default=default_model_configs.presence_penalty, ge=-2, le=2, validation_alias="presencePenalty", serialization_alias="presencePenalty", description="Penalizes new tokens based on whether they appear in the text so far.", example=0.0)
    model_config = ConfigDict(title="ChatModelSettings", populate_by_name=True)

class ThemeEnum(str, Enum):
    LIGHT = "light"
    DARK = "dark"

class AppSettings(BaseModel):
    language: str = Field(default="en", description="Application display language code.", example="en")
    theme: ThemeEnum = Field(default=ThemeEnum.LIGHT, description="Selected application color theme.", example="dark")
    code_theme_light: str = Field(default="atomOneLight", validation_alias="codeThemeLight", serialization_alias="codeThemeLight", description="Name of the code syntax highlighting theme used in light mode.", example="githubLight")
    code_theme_dark: str = Field(default="atomOneDark", validation_alias="codeThemeDark", serialization_alias="codeThemeDark", description="Name of the code syntax highlighting theme used in dark mode.", example="monokai")
    ollama_global_url: AnyUrl = Field(default="http://localhost:11434", validation_alias="ollamaGlobalUrl", serialization_alias="ollamaGlobalUrl", description="Base URL for the Ollama server instance.", example="http://192.168.1.100:11434")
    lm_studio_global_url: AnyUrl = Field(default="http://localhost:1234", validation_alias="lmStudioGlobalUrl", serialization_alias="lmStudioGlobalUrl", description="Base URL for the LM Studio local inference server.", example="http://localhost:1234")
    summarization_ignore_patterns: List[str] = Field(default=[], validation_alias="summarizationIgnorePatterns", serialization_alias="summarizationIgnorePatterns", description="Glob patterns for files/folders to ignore during automatic summarization.", example=["**/node_modules/**", "**/*.log"])
    summarization_allow_patterns: List[str] = Field(default=[], validation_alias="summarizationAllowPatterns", serialization_alias="summarizationAllowPatterns", description="Glob patterns for files/folders to explicitly include in summarization (if ignore patterns also match).", example=["src/**/*.ts"])
    summarization_enabled_project_ids: List[str] = Field(default=[], validation_alias="summarizationEnabledProjectIds", serialization_alias="summarizationEnabledProjectIds", description="List of project IDs for which automatic summarization is enabled.", example=["proj_123", "proj_456"])
    use_spacebar_to_select_autocomplete: bool = Field(default=True, validation_alias="useSpacebarToSelectAutocomplete", serialization_alias="useSpacebarToSelectAutocomplete", description="Whether pressing Spacebar accepts the current autocomplete suggestion.")
    hide_informational_tooltips: bool = Field(default=False, validation_alias="hideInformationalTooltips", serialization_alias="hideInformationalTooltips", description="Whether to hide tooltips that provide general information or tips.")
    auto_scroll_enabled: bool = Field(default=True, validation_alias="autoScrollEnabled", serialization_alias="autoScrollEnabled", description="Whether the chat view should automatically scroll to the bottom on new messages.")
    provider: APIProvidersEnum = Field(default=default_model_configs.provider, description="Default AI provider to use for chat.", example="openrouter")
    model: str = Field(default=default_model_configs.model, description="Default AI model name to use for chat.", example="gpt-4o")
    temperature: float = Field(default=default_model_configs.temperature, ge=0, le=2, description="Controls randomness. Lower values make the model more deterministic.", example=0.7) # from ChatModelSettings
    max_tokens: int = Field(default=default_model_configs.max_tokens, ge=100, validation_alias="maxTokens", serialization_alias="maxTokens", description="Maximum number of tokens to generate in the chat completion.", example=4096) # from ChatModelSettings
    top_p: float = Field(default=default_model_configs.top_p, ge=0, le=1, validation_alias="topP", serialization_alias="topP", description="Nucleus sampling parameter. Considers tokens with top_p probability mass.", example=1.0) # from ChatModelSettings
    frequency_penalty: float = Field(default=default_model_configs.frequency_penalty, ge=-2, le=2, validation_alias="frequencyPenalty", serialization_alias="frequencyPenalty", description="Penalizes new tokens based on their frequency in the text so far.", example=0.0) # from ChatModelSettings
    presence_penalty: float = Field(default=default_model_configs.presence_penalty, ge=-2, le=2, validation_alias="presencePenalty", serialization_alias="presencePenalty", description="Penalizes new tokens based on whether they appear in the text so far.", example=0.0) # from ChatModelSettings
    model_config = ConfigDict(title="AppSettings", populate_by_name=True)

ProjectTabsStateRecord = Dict[str, ProjectTabState]

class ChatLinkSetting(BaseModel):
    include_selected_files: bool = Field(default=False, validation_alias="includeSelectedFiles", serialization_alias="includeSelectedFiles", description="Whether currently selected files from the linked project tab should be included as context.")
    include_prompts: bool = Field(default=False, validation_alias="includePrompts", serialization_alias="includePrompts", description="Whether selected prompts from the linked project tab should be included.")
    include_user_prompt: bool = Field(default=False, validation_alias="includeUserPrompt", serialization_alias="includeUserPrompt", description="Whether the user prompt input from the linked project tab should be included.")
    linked_project_tab_id: Optional[str] = Field(None, validation_alias="linkedProjectTabId", serialization_alias="linkedProjectTabId", description="The ID of the project tab this chat is linked to, or null if not linked.")
    model_config = ConfigDict(title="ChatLinkSetting", populate_by_name=True)

ChatLinkSettingsMap = Dict[str, ChatLinkSetting]

class GlobalState(BaseModel):
    app_settings: AppSettings = Field(..., validation_alias="appSettings", serialization_alias="appSettings", description="Application-wide settings.")
    project_tabs: ProjectTabsStateRecord = Field(..., validation_alias="projectTabs", serialization_alias="projectTabs", description="State of all open project tabs, keyed by tab ID.")
    project_active_tab_id: str = Field(default="defaultTab", validation_alias="projectActiveTabId", serialization_alias="projectActiveTabId", description="The ID of the currently active project tab, or null if none is active.", example="tab_abc123")
    active_chat_id: str = Field(default="", validation_alias="activeChatId", serialization_alias="activeChatId", description="The ID of the currently active chat session, or null.", example="chat_xyz789")
    chat_link_settings: ChatLinkSettingsMap = Field(default={}, validation_alias="chatLinkSettings", serialization_alias="chatLinkSettings", description="Link settings specific to each chat session.")
    model_config = ConfigDict(title="GlobalState", populate_by_name=True)

# Helper functions like createInitialGlobalState, getDefaultAppSettings, getDefaultProjectTabState
# are TypeScript specific for object creation with defaults.
# In Pydantic, defaults are part of the model definition.
# Instantiating the model (e.g., AppSettings()) will apply these defaults.

# Example of creating default AppSettings:
# default_app_settings = AppSettings()

# Example of creating default ProjectTabState:
# default_project_tab_state = ProjectTabState(displayName="My Default Tab")

# Example of creating initial GlobalState:
# initial_global_state = GlobalState(
#     app_settings=AppSettings(),
#     project_tabs={
#         "defaultTab": ProjectTabState(display_name="Default Project Tab")
#     }
#     # active_chat_id and chat_link_settings will use their defaults
# )
