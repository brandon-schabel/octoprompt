from typing import Optional, List, Dict, Any, Literal
from pydantic import BaseModel, Field, ConfigDict, field_validator, model_validator
from enum import Enum
from app.utils.storage_timestap_utils import convert_timestamp_to_ms_int, convert_id_to_int

# --- Provider Key Schemas ---
# Last 5 changes:
# 1. Initial conversion from Zod to Pydantic.
# 2. Created AIProviderEnum from AI_API_PROVIDERS list.
# 3. Handled .omit and .extend for schema variations.
# 4. Implemented .refine logic with Pydantic's @field_validator.
# 5. Mapped .openapi() metadata.
# 6. Changed ID and timestamp fields to int (Unix ms) and added validators.

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
    id: int = Field(..., min_length=1, example=1677657600000, description="Provider Key ID (Unix ms)")
    provider: str = Field(..., example="openai", description="AI Provider identifier (e.g., openai, anthropic)")
    key: str = Field(..., example="sk-xxxxxxxxxxxxxxxxxxxx", description="The actual API Key (handle with care)")
    created: int = Field(..., validation_alias="created", serialization_alias="created", example=1677657600000, description="Creation timestamp (Unix ms)")
    updated: int = Field(..., validation_alias="updated", serialization_alias="updated", example=1677657900000, description="Last update timestamp (Unix ms)")
    model_config = ConfigDict(title="ProviderKey", populate_by_name=True)

    _validate_id = field_validator('id', mode='before')(convert_id_to_int)
    _validate_timestamps = field_validator('created', 'updated', mode='before')(convert_timestamp_to_ms_int)

class CreateProviderKeyInput(ProviderKey):
    # Omit id, createdAt, updatedAt by not including them and they are not required in Pydantic by default
    # However, Pydantic models expect all fields of their base if not explicitly overridden.
    # For a true "omit" behavior for input, it's better to define a separate model for input.
    id: Optional[int] = Field(None, exclude=True) # Exclude from serialization if it exists
    created: Optional[int] = Field(None, validation_alias="created", serialization_alias="created", exclude=True)
    updated: Optional[int] = Field(None, validation_alias="updated", serialization_alias="updated", exclude=True)
    model_config = ConfigDict(title="CreateProviderKeyInput", populate_by_name=True)
    # Re-declare for clarity on input schema if needed, or use a distinct model:
    # provider: str = Field(..., example="openai") 
    # key: str = Field(..., example="sk-xxxx")

class CreateProviderKeyBody(BaseModel):
    provider: str = Field(..., min_length=1, example="anthropic")
    key: str = Field(..., min_length=1, example="sk-ant-xxxxxxxx")
    model_config = ConfigDict(title="CreateProviderKeyRequestBody")

class UpdateProviderKeyBody(BaseModel):
    provider: Optional[str] = Field(None, min_length=1, example="google")
    key: Optional[str] = Field(None, min_length=1, example="aizaxxxxxxxxxxxxx")

    @field_validator("provider", "key")
    @classmethod
    def check_at_least_one_provided(cls, v, values):
        # This is a common way to validate interdependent fields in Pydantic v2.
        # This specific validator logic is tricky because it runs per field.
        # A model-level validator is better for checking combinations.
        pass # Placeholder for actual validation logic, best done with model_validator
    
    # Pydantic v2 model_validator for refine logic
    @model_validator(mode='after')
    def check_at_least_one_field(self):
        if not self.provider and not self.key:
            raise ValueError("At least one of provider or key must be provided for update")
        return self

    model_config = ConfigDict(title="UpdateProviderKeyRequestBody")

class ProviderKeyIdParams(BaseModel):
    key_id: int = Field(..., validation_alias="keyId", serialization_alias="keyId", json_schema_extra={"param": {"name": "keyId", "in": "path"}}, example=1677657600000, description="The ID of the provider key (Unix ms)")
    model_config = ConfigDict(title="ProviderKeyIdParams", populate_by_name=True)
    _validate_key_id = field_validator('key_id', mode='before')(convert_id_to_int)

# ProviderKeyWithSecret is effectively the same as ProviderKey in this Pydantic conversion as key is already included.
ProviderKeyWithSecret = ProviderKey 
ProviderKeyWithSecret.model_config = ConfigDict(title="ProviderKeyWithSecret", populate_by_name=True)

class ProviderKeyResponse(BaseModel):
    success: Literal[True] = True
    data: ProviderKeyWithSecret # In Pydantic, ProviderKey already includes the key.
    model_config = ConfigDict(title="ProviderKeyResponse")

class ProviderKeyListResponse(BaseModel):
    success: Literal[True] = True
    # For list responses, if we truly wanted to omit the key, we would define a new Pydantic model.
    # data: List[ProviderKey] # This would include the key.
    # If ProviderKeySchema in Zod was intended to hide the key, then a new model is needed here.
    # Let's assume ProviderKey in Zod means the key is *not* sent in lists.
    class ProviderKeyListItem(ProviderKey):
        key: Optional[str] = Field(None, exclude=True) # Exclude from response
        model_config = ConfigDict(title="ProviderKeyListItem", populate_by_name=True)
    data: List[ProviderKeyListItem]
    model_config = ConfigDict(title="ProviderKeyListResponse")
