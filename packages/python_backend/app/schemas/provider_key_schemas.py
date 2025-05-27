from typing import Optional, List, Dict, Any, Literal
from pydantic import BaseModel, Field, ConfigDict, model_validator
from enum import Enum
from app.utils.storage_timestamp_utils import convert_timestamp_to_ms_int

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
    name: str = Field(..., min_length=1, example="My OpenAI Key", description="User-defined name for the key")
    provider: str = Field(..., min_length=1, example="openai", description="AI Provider identifier")
    key: str = Field(..., min_length=1, example="sk-xxxxxxxxxxxxxxxxxxxx", description="The actual API Key")
    is_default: bool = Field(default=False, alias="isDefault", description="Whether this key is the default for its provider")
    created: int = Field(..., example=1677657600000, description="Creation timestamp (Unix ms)")
    updated: int = Field(..., example=1677657900000, description="Last update timestamp (Unix ms)")
    model_config = ConfigDict(title="ProviderKey", populate_by_name=True)

class CreateProviderKeyBody(BaseModel):
    name: str = Field(..., min_length=1, example="My OpenAI Key")
    provider: str = Field(..., min_length=1, example="anthropic")
    key: str = Field(..., min_length=1, example="sk-ant-xxxxxxxx")
    is_default: Optional[bool] = Field(None, alias="isDefault", example=True)
    model_config = ConfigDict(title="CreateProviderKeyRequestBody", populate_by_name=True)

class UpdateProviderKeyBody(BaseModel):
    name: Optional[str] = Field(None, min_length=1, example="My Updated Key Name")
    provider: Optional[str] = Field(None, min_length=1, example="google")
    key: Optional[str] = Field(None, min_length=1, example="aizaxxxxxxxxxxxxx")
    is_default: Optional[bool] = Field(None, alias="isDefault", example=False)
    
    @model_validator(mode='before')
    @classmethod
    def check_at_least_one_field(cls, values):
        if isinstance(values, dict):
            name = values.get('name')
            provider = values.get('provider')
            key = values.get('key')
            is_default = values.get('isDefault') or values.get('is_default')
            
            if name is None and provider is None and key is None and is_default is None:
                raise ValueError("At least one of name, provider, key, or isDefault must be provided for update")
            
            if name == "" or provider == "" or key == "":
                raise ValueError("Fields cannot be empty strings")
                
        return values

    model_config = ConfigDict(title="UpdateProviderKeyRequestBody", populate_by_name=True)

class ProviderKeyResponse(BaseModel):
    success: Literal[True] = True
    data: ProviderKey
    model_config = ConfigDict(title="ProviderKeyResponse")

class ProviderKeyListResponse(BaseModel):
    success: Literal[True] = True
    
    class ProviderKeyListItem(BaseModel):
        id: int = Field(..., example=1677657600000, description="Provider Key ID (Unix ms)")
        name: str = Field(..., example="My OpenAI Key", description="User-defined name for the key")
        provider: str = Field(..., example="openai", description="AI Provider identifier")
        is_default: bool = Field(..., alias="isDefault", description="Whether this key is the default for its provider")
        created: int = Field(..., example=1677657600000, description="Creation timestamp (Unix ms)")
        updated: int = Field(..., example=1677657900000, description="Last update timestamp (Unix ms)")
        model_config = ConfigDict(title="ProviderKeyListItem", populate_by_name=True)
    
    data: List[ProviderKeyListItem]
    model_config = ConfigDict(title="ProviderKeyListResponse")