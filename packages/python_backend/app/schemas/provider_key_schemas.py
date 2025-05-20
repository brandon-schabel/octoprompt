from typing import Optional, List, Dict, Any, Literal
from pydantic import BaseModel, Field, ConfigDict, field_validator
from enum import Enum
from datetime import datetime

# --- Provider Key Schemas ---
# Last 5 changes:
# 1. Initial conversion from Zod to Pydantic.
# 2. Created AIProviderEnum from AI_API_PROVIDERS list.
# 3. Handled .omit and .extend for schema variations.
# 4. Implemented .refine logic with Pydantic's @field_validator.
# 5. Mapped .openapi() metadata.

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
    id: str = Field(..., min_length=1, example="key-1a2b3c4d", description="Provider Key ID")
    provider: str = Field(..., example="openai", description="AI Provider identifier (e.g., openai, anthropic)")
    key: str = Field(..., example="sk-xxxxxxxxxxxxxxxxxxxx", description="The actual API Key (handle with care)")
    created_at: datetime = Field(..., validation_alias="createdAt", serialization_alias="createdAt", example="2024-03-01T11:00:00.000Z", description="Creation timestamp (ISO 8601)")
    updated_at: datetime = Field(..., validation_alias="updatedAt", serialization_alias="updatedAt", example="2024-03-01T11:05:00.000Z", description="Last update timestamp (ISO 8601)")
    model_config = ConfigDict(title="ProviderKey", populate_by_name=True)

class CreateProviderKeyInput(ProviderKey):
    # Omit id, createdAt, updatedAt by not including them and they are not required in Pydantic by default
    # However, Pydantic models expect all fields of their base if not explicitly overridden.
    # For a true "omit" behavior for input, it's better to define a separate model for input.
    id: Optional[str] = Field(None, exclude=True) # Exclude from serialization if it exists
    created_at: Optional[datetime] = Field(None, validation_alias="createdAt", serialization_alias="createdAt", exclude=True)
    updated_at: Optional[datetime] = Field(None, validation_alias="updatedAt", serialization_alias="updatedAt", exclude=True)
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
    from pydantic import model_validator
    @model_validator(mode='after')
    def check_at_least_one_field(self):
        if not self.provider and not self.key:
            raise ValueError("At least one of provider or key must be provided for update")
        return self

    model_config = ConfigDict(title="UpdateProviderKeyRequestBody")

class ProviderKeyIdParams(BaseModel):
    key_id: str = Field(..., min_length=1, validation_alias="keyId", serialization_alias="keyId", json_schema_extra={"param": {"name": "keyId", "in": "path"}}, example="key-1a2b3c4d", description="The ID of the provider key")
    model_config = ConfigDict(title="ProviderKeyIdParams", populate_by_name=True)

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
