from typing import Optional, List, Dict, Any, Literal
from pydantic import BaseModel, Field, ConfigDict, field_validator, model_validator
from enum import Enum
from app.utils.storage_timestap_utils import convert_timestamp_to_ms_int, convert_id_to_int

# --- Provider Key Schemas ---
# Last 5 changes:
# 1. Updated to match chat and project schema patterns
# 2. Simplified field definitions and removed unnecessary aliases
# 3. Ensured consistent integer handling for IDs and timestamps
# 4. Used same validation pattern as other schemas
# 5. Maintained consistency with existing storage structure

class AIProviderEnum(str, Enum):
    OPENAI = "openai"
    OPENROUTER = "openrouter"
    LMSTUDIO = "lmstudio"
    OLLAMA = "ollama"
    XAI = "xai"
    GOOGLE_GEMINI = "google_gemini"
    ANTHROPIC = "anthropic"
    GROQ = "groq"
    TOGETHER = "together"

class ProviderKey(BaseModel):
    id: int = Field(..., example=1677657600000, description="Provider Key ID (Unix ms)")
    provider: str = Field(..., min_length=1, example="openai", description="AI Provider identifier")
    key: str = Field(..., min_length=1, example="sk-xxxxxxxxxxxxxxxxxxxx", description="The actual API Key")
    created: int = Field(..., example=1677657600000, description="Creation timestamp (Unix ms)")
    updated: int = Field(..., example=1677657900000, description="Last update timestamp (Unix ms)")
    model_config = ConfigDict(title="ProviderKey")

    _validate_id = field_validator('id', mode='before')(convert_id_to_int)
    _validate_timestamps = field_validator('created', 'updated', mode='before')(convert_timestamp_to_ms_int)

class CreateProviderKeyBody(BaseModel):
    provider: str = Field(..., min_length=1, example="anthropic")
    key: str = Field(..., min_length=1, example="sk-ant-xxxxxxxx")
    model_config = ConfigDict(title="CreateProviderKeyRequestBody")

class UpdateProviderKeyBody(BaseModel):
    provider: Optional[str] = Field(None, min_length=1, example="google")
    key: Optional[str] = Field(None, min_length=1, example="aizaxxxxxxxxxxxxx")
    
    @model_validator(mode='before')
    @classmethod
    def check_at_least_one_field(cls, values):
        if isinstance(values, dict):
            provider = values.get('provider')
            key = values.get('key')
            
            # Check if both are None or missing
            if provider is None and key is None:
                raise ValueError("At least one of provider or key must be provided for update")
            
            # Check for empty strings
            if provider == "" or key == "":
                raise ValueError("Fields cannot be empty strings")
                
        return values

    model_config = ConfigDict(title="UpdateProviderKeyRequestBody")

class ProviderKeyResponse(BaseModel):
    success: Literal[True] = True
    data: ProviderKey
    model_config = ConfigDict(title="ProviderKeyResponse")

class ProviderKeyListResponse(BaseModel):
    success: Literal[True] = True
    
    class ProviderKeyListItem(BaseModel):
        id: int = Field(..., example=1677657600000, description="Provider Key ID (Unix ms)")
        provider: str = Field(..., example="openai", description="AI Provider identifier")
        created: int = Field(..., example=1677657600000, description="Creation timestamp (Unix ms)")
        updated: int = Field(..., example=1677657900000, description="Last update timestamp (Unix ms)")
        model_config = ConfigDict(title="ProviderKeyListItem")
        
        _validate_id = field_validator('id', mode='before')(convert_id_to_int)
        _validate_timestamps = field_validator('created', 'updated', mode='before')(convert_timestamp_to_ms_int)
    
    data: List[ProviderKeyListItem]
    model_config = ConfigDict(title="ProviderKeyListResponse")