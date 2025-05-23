from typing import List, Optional, Dict, Any, Literal, Union
from pydantic import BaseModel, Field, HttpUrl
import httpx
from enum import Enum

from app.schemas.provider_key_schemas import AIProviderEnum # Assuming this exists

# --- Provider Default URLs ---
GEMINI_BASE_URL = "https://generativelanguage.googleapis.com/v1beta"
GROQ_BASE_URL = "https://api.groq.com/openai/v1"
TOGETHER_BASE_URL = "https://api.together.ai" # Often /v1 is appended for specific endpoints
OPENAI_BASE_URL = "https://api.openai.com/v1"
ANTHROPIC_BASE_URL = "https://api.anthropic.com/v1" # Base, specific endpoints like /models
OPENROUTER_BASE_URL = "https://openrouter.ai/api/v1"
XAI_BASE_URL = "https://api.xai.com/v1" # Placeholder, actual URL might differ
OLLAMA_BASE_URL = "http://localhost:11434" # Default, user configurable
LMSTUDIO_BASE_URL = "http://localhost:1234/v1" # Default, user configurable

# --- Unified Model Structure ---
class UnifiedModel(BaseModel):
    id: str # Original model ID from provider
    name: str
    description: Optional[str] = None
    context_length: Optional[int] = None
    provider_slug: str # e.g., "openai", "anthropic"

# --- Provider Specific Pydantic Models ---

# OpenRouter
class OpenRouterModelContext(BaseModel):
    description: Optional[str] = None
    tokens: Optional[int] = None
    mode: Optional[str] = None
    formats: Optional[List[str]] = None

class OpenRouterModelPricing(BaseModel):
    prompt: Optional[str] = None
    completion: Optional[str] = None
    rate_limit: Optional[int] = Field(None, alias="rateLimit")

class OpenRouterModel(BaseModel):
    id: str
    name: str
    description: Optional[str] = None
    context_length: Optional[int] = Field(None, alias="context_length") # from docs, not in original TS
    # The original TS had 'context: OpenRouterModelContext'. Let's check OpenRouter docs.
    # Docs show context_length directly on the model. Pricing object seems correct.
    # For simplicity, let's stick to id, name, description directly on the model.
    # If detailed context and pricing are needed, we can expand.
    # Let's assume the UnifiedModel structure is sufficient for now from OpenRouter.
    # If not, this model needs to be more detailed like the TS version.
    # For now, we'll map OpenRouter's output to UnifiedModel. The fields below are if we need more detail.
    # context: Optional[OpenRouterModelContext] = None # Keep if detailed context is needed
    # pricing: Optional[OpenRouterModelPricing] = None # Keep if detailed pricing is needed
    # top_provider: Optional[str] = None
    # architecture: Optional[str] = None
    # per_request_limits: Optional[Dict[str, int]] = None

class OpenRouterModelsResponse(BaseModel):
    data: List[OpenRouterModel]


# Gemini
class GeminiAPIModel(BaseModel):
    name: str # format: "models/gemini-pro"
    base_model_id: Optional[str] = Field(None, alias="baseModelId")
    version: str
    display_name: str = Field(..., alias="displayName")
    description: str
    input_token_limit: int = Field(..., alias="inputTokenLimit")
    output_token_limit: int = Field(..., alias="outputTokenLimit")
    supported_generation_methods: List[str] = Field(..., alias="supportedGenerationMethods")
    temperature: Optional[float] = None
    max_temperature: Optional[float] = Field(None, alias="maxTemperature")
    top_p: Optional[float] = Field(None, alias="topP")
    top_k: Optional[float] = Field(None, alias="topK")

class GeminiListModelsResponse(BaseModel):
    models: List[GeminiAPIModel]

# Anthropic
class AnthropicModel(BaseModel):
    type: Optional[str] = None # e.g. "model"
    id: str
    display_name: Optional[str] = None # Anthropic's API might not have this; typically ID is the name.
                                # The TS version has this, but their actual API might not for all models.
                                # Let's use ID as name if display_name isn't present.
    name: str # Often the same as ID
    created: Optional[str] = None # datetime string

class AnthropicModelsResponse(BaseModel):
    data: List[AnthropicModel]
    # has_more: bool # Not essential for mapping to UnifiedModel
    # first_id: Optional[str] = None
    # last_id: Optional[str] = None


# OpenAI / XAI (similar structure for listing)
class OpenAIModelObject(BaseModel):
    id: str
    object: str # e.g. "model"
    created: int # Unix timestamp
    owned_by: str = Field(..., alias="owned_by")

class OpenAIModelsListResponse(BaseModel):
    object: str # e.g. "list"
    data: List[OpenAIModelObject]

# Together
class TogetherModel(BaseModel):
    id: str
    object: Optional[str] = None
    created: Optional[int] = None
    type: Optional[str] = None
    running: Optional[bool] = None
    display_name: Optional[str] = Field(None, alias="display_name")
    organization: Optional[str] = None
    link: Optional[HttpUrl] = None
    license: Optional[str] = None
    context_length: Optional[int] = Field(None, alias="context_length")
    # config: Optional[Dict] = None # Can be added if needed
    # pricing: Optional[Dict] = None # Can be added if needed

# Ollama
class OllamaModelDetails(BaseModel):
    parent_model: Optional[str] = Field(None, alias="parent_model")
    format: Optional[str] = None
    family: Optional[str] = None
    families: Optional[List[str]] = None
    parameter_size: Optional[str] = Field(None, alias="parameter_size")
    quantization_level: Optional[str] = Field(None, alias="quantization_level")

class OllamaModel(BaseModel):
    name: str # This is the model ID like "llama2:latest"
    model: str # This is the base model name like "llama2:latest"
    modified_at: str # datetime string
    size: int
    digest: str
    details: OllamaModelDetails

class OllamaModelsResponse(BaseModel):
    models: List[OllamaModel]

# LMStudio (Often mimics OpenAI API for /models)
# We'll assume it returns something like OpenAIModelsListResponse or a simple list of IDs.
# For now, using OpenAIModelObject as a common structure if it's OpenAI compatible.
class LMStudioModel(BaseModel): # Simplified for now
    id: str
    # Add other fields if known and different from OpenAI's listing

class LMStudioModelsResponse(BaseModel):
    data: List[LMStudioModel] # Assuming a 'data' key like OpenAI

# --- Configuration ---
class ProviderKeysConfig(BaseModel):
    openai_key: Optional[str] = Field(None, alias="openaiKey")
    anthropic_key: Optional[str] = Field(None, alias="anthropicKey")
    google_gemini_key: Optional[str] = Field(None, alias="googleGeminiKey")
    groq_key: Optional[str] = Field(None, alias="groqKey")
    together_key: Optional[str] = Field(None, alias="togetherKey")
    xai_key: Optional[str] = Field(None, alias="xaiKey")
    openrouter_key: Optional[str] = Field(None, alias="openrouterKey")
    model_config = {"populate_by_name": True}


class ListModelsOptions(BaseModel):
    ollama_base_url: Optional[HttpUrl] = Field(None, alias="ollamaBaseUrl")
    lmstudio_base_url: Optional[HttpUrl] = Field(None, alias="lmstudioBaseUrl")
    model_config = {"populate_by_name": True}


class ModelFetcherService:
    def __init__(self, config: ProviderKeysConfig):
        self.config = config
        self.http_client = httpx.AsyncClient(timeout=20.0) # 20 seconds timeout

    def _ensure_key(self, key: Optional[str], provider_name: str) -> str:
        if not key:
            raise ValueError(f"{provider_name} API key not found in config")
        return key

    async def close(self):
        await self.http_client.aclose()

    async def list_gemini_models(self) -> List[UnifiedModel]:
        api_key = self._ensure_key(self.config.google_gemini_key, "Google Gemini")
        try:
            response = await self.http_client.get(f"{GEMINI_BASE_URL}/models?key={api_key}")
            response.raise_for_status()
            data = GeminiListModelsResponse.model_validate(response.json())
            return [
                UnifiedModel(
                    id=m.name,
                    name=m.display_name,
                    description=m.description,
                    context_length=m.input_token_limit,
                    provider_slug=AIProviderEnum.GOOGLE_GEMINI.value
                )
                for m in data.models
            ]
        except httpx.HTTPStatusError as e:
            raise ConnectionError(f"Failed to fetch Gemini models: {e.response.status_code} - {e.response.text}")
        except Exception as e:
            raise ConnectionError(f"An error occurred while fetching Gemini models: {str(e)}")

    async def list_groq_models(self) -> List[UnifiedModel]:
        api_key = self._ensure_key(self.config.groq_key, "Groq")
        headers = {"Authorization": f"Bearer {api_key}", "Content-Type": "application/json"}
        try:
            response = await self.http_client.get(f"{GROQ_BASE_URL}/models", headers=headers)
            response.raise_for_status()
            # Groq's /models is OpenAI compatible
            data = OpenAIModelsListResponse.model_validate(response.json())
            return [
                UnifiedModel(
                    id=m.id,
                    name=m.id,
                    description=f"Groq model owned by {m.owned_by}, Context: N/A", # Context not directly available
                    context_length=None, # OpenAI list format does not provide context_length easily
                    provider_slug=AIProviderEnum.GROQ.value
                )
                for m in data.data
            ]
        except httpx.HTTPStatusError as e:
            raise ConnectionError(f"Groq models API error: {e.response.status_code} - {e.response.text}")
        except Exception as e:
            raise ConnectionError(f"An error occurred while fetching Groq models: {str(e)}")

    async def list_together_models(self) -> List[UnifiedModel]:
        api_key = self._ensure_key(self.config.together_key, "Together")
        headers = {"Authorization": f"Bearer {api_key}", "Content-Type": "application/json"}
        try:
            # Together API for listing models is usually at /models or /models/info, check their docs.
            # The TS code uses /models.
            response = await self.http_client.get(f"{TOGETHER_BASE_URL}/models", headers=headers) # Or TOGETHER_BASE_URL/models/info
            response.raise_for_status()
            # The TS version maps this to TogetherModel[] then to UnifiedModel[].
            # The actual JSON response for /models needs to be verified from Together docs.
            # Assuming it's a list of TogetherModel objects directly.
            data = [TogetherModel.model_validate(item) for item in response.json()]
            return [
                UnifiedModel(
                    id=m.id,
                    name=m.display_name or m.id,
                    description=f"{m.organization or 'Together'} model: {m.display_name or m.id}", # Simplified description
                    context_length=m.context_length,
                    provider_slug=AIProviderEnum.TOGETHER.value
                )
                for m in data if m.type != "chat-hf" # Filter out some internal/non-standard types if necessary
            ]
        except httpx.HTTPStatusError as e:
            raise ConnectionError(f"Together models API error: {e.response.status_code} - {e.response.text}")
        except Exception as e:
            raise ConnectionError(f"An error occurred while fetching Together models: {str(e)}")


    async def list_openai_models(self) -> List[UnifiedModel]:
        api_key = self._ensure_key(self.config.openai_key, "OpenAI")
        headers = {"Authorization": f"Bearer {api_key}", "Content-Type": "application/json"}
        try:
            response = await self.http_client.get(f"{OPENAI_BASE_URL}/models", headers=headers)
            response.raise_for_status()
            data = OpenAIModelsListResponse.model_validate(response.json())
            return [
                UnifiedModel(
                    id=m.id,
                    name=m.id,
                    description=f"OpenAI model owned by {m.owned_by}",
                    context_length=None, # Context not standard in this list
                    provider_slug=AIProviderEnum.OPENAI.value
                )
                for m in data.data
            ]
        except httpx.HTTPStatusError as e:
            raise ConnectionError(f"OpenAI list models error: {e.response.status_code} - {e.response.text}")
        except Exception as e:
            raise ConnectionError(f"An error occurred while fetching OpenAI models: {str(e)}")

    async def list_anthropic_models(self) -> List[UnifiedModel]:
        api_key = self._ensure_key(self.config.anthropic_key, "Anthropic")
        headers = {"x-api-key": api_key, "anthropic-version": "2023-06-01"}
        try:
            response = await self.http_client.get(f"{ANTHROPIC_BASE_URL}/models", headers=headers)
            response.raise_for_status()
            data = AnthropicModelsResponse.model_validate(response.json())
            return [
                UnifiedModel(
                    id=m.id,
                    name=m.name or m.id, # Use m.name if available, fallback to m.id
                    description=f"Anthropic model: {m.id}",
                    context_length=None, # Anthropic /models doesn't list context_length easily
                    provider_slug=AIProviderEnum.ANTHROPIC.value
                )
                for m in data.data
            ]
        except httpx.HTTPStatusError as e:
            raise ConnectionError(f"Anthropic Models API error: {e.response.status_code} - {e.response.text}")
        except Exception as e:
            raise ConnectionError(f"An error occurred while fetching Anthropic models: {str(e)}")

    async def list_openrouter_models(self) -> List[UnifiedModel]:
        api_key = self._ensure_key(self.config.openrouter_key, "OpenRouter")
        headers = {"Authorization": f"Bearer {api_key}"}
        try:
            response = await self.http_client.get(f"{OPENROUTER_BASE_URL}/models", headers=headers)
            response.raise_for_status()
            data = OpenRouterModelsResponse.model_validate(response.json())
            return [
                UnifiedModel(
                    id=m.id,
                    name=m.name,
                    description=m.description or f"OpenRouter hosted model: {m.name}",
                    context_length=m.context_length,
                    provider_slug=AIProviderEnum.OPENROUTER.value
                )
                for m in data.data
            ]
        except httpx.HTTPStatusError as e:
            raise ConnectionError(f"OpenRouter API error: {e.response.status_code} - {e.response.text}")
        except Exception as e:
            raise ConnectionError(f"An error occurred while fetching OpenRouter models: {str(e)}")

    async def list_xai_models(self) -> List[UnifiedModel]:
        api_key = self._ensure_key(self.config.xai_key, "XAI")
        headers = {"Authorization": f"Bearer {api_key}", "Content-Type": "application/json"}
        try:
            response = await self.http_client.get(f"{XAI_BASE_URL}/models", headers=headers)
            response.raise_for_status()
            data = OpenAIModelsListResponse.model_validate(response.json()) # Assuming XAI is OpenAI compatible
            return [
                UnifiedModel(
                    id=m.id,
                    name=m.id,
                    description=f"XAI model owned by {m.owned_by}",
                    context_length=None, # Assuming no context_length from this OpenAI-like endpoint
                    provider_slug=AIProviderEnum.XAI.value
                )
                for m in data.data
            ]
        except httpx.HTTPStatusError as e:
            raise ConnectionError(f"XAI API error: {e.response.status_code} - {e.response.text}")
        except Exception as e:
            raise ConnectionError(f"An error occurred while fetching XAI models: {str(e)}")

    async def list_ollama_models(self, base_url: Optional[Union[HttpUrl, str]] = None) -> List[UnifiedModel]:
        url_to_use = str(base_url) if base_url else OLLAMA_BASE_URL
        try:
            response = await self.http_client.get(f"{url_to_use}/api/tags")
            response.raise_for_status()
            data = OllamaModelsResponse.model_validate(response.json())
            return [
                UnifiedModel(
                    id=model.name, # e.g. "llama2:latest"
                    name=model.name,
                    description=f"{model.details.family or 'Ollama'} family - {model.name} | Size: {model.details.parameter_size or 'N/A'} | Quant: {model.details.quantization_level or 'N/A'}",
                    context_length=None, # Ollama /api/tags doesn't provide standard context_length
                    provider_slug=AIProviderEnum.OLLAMA.value
                )
                for model in data.models
            ]
        except httpx.HTTPStatusError as e:
            raise ConnectionError(f"Ollama error: {e.response.status_code} - {e.response.text} from {url_to_use}")
        except Exception as e:
            raise ConnectionError(f"An error occurred while fetching Ollama models from {url_to_use}: {str(e)}")


    async def list_lmstudio_models(self, base_url: Optional[Union[HttpUrl, str]] = None) -> List[UnifiedModel]:
        url_to_use = str(base_url) if base_url else LMSTUDIO_BASE_URL
        try:
            # LMStudio /models endpoint usually mirrors OpenAI's /v1/models
            response = await self.http_client.get(f"{url_to_use}/models") # Corrected, TS had just /models
            response.raise_for_status()
            # Assuming OpenAI compatible list response
            data = OpenAIModelsListResponse.model_validate(response.json())
            return [
                UnifiedModel(
                    id=m.id,
                    name=m.id,
                    description=f"LM Studio model: {m.id} (Owner: {m.owned_by})",
                    context_length=None, # Assuming no context_length from this OpenAI-like endpoint
                    provider_slug=AIProviderEnum.LMSTUDIO.value
                )
                for m in data.data
            ]
        except httpx.HTTPStatusError as e:
            raise ConnectionError(f"LM Studio error: {e.response.status_code} - {e.response.text} from {url_to_use}")
        except Exception as e: # Broad exception for JSON parsing, validation etc.
            raise ConnectionError(f"An error occurred while fetching LMStudio models from {url_to_use}: {str(e)}")

    async def list_models(
        self,
        provider: AIProviderEnum,
        options: Optional[ListModelsOptions] = None,
    ) -> List[UnifiedModel]:
        effective_options = options or ListModelsOptions()

        if provider == AIProviderEnum.OPENROUTER:
            return await self.list_openrouter_models()
        elif provider == AIProviderEnum.LMSTUDIO:
            return await self.list_lmstudio_models(base_url=effective_options.lmstudio_base_url)
        elif provider == AIProviderEnum.OLLAMA:
            return await self.list_ollama_models(base_url=effective_options.ollama_base_url)
        elif provider == AIProviderEnum.XAI:
            return await self.list_xai_models()
        elif provider == AIProviderEnum.GOOGLE_GEMINI:
            return await self.list_gemini_models()
        elif provider == AIProviderEnum.ANTHROPIC:
            return await self.list_anthropic_models()
        elif provider == AIProviderEnum.GROQ:
            return await self.list_groq_models()
        elif provider == AIProviderEnum.TOGETHER:
            return await self.list_together_models()
        elif provider == AIProviderEnum.OPENAI:
            try:
                return await self.list_openai_models()
            except Exception as e:
                print(f"Warning: Failed to fetch OpenAI models: {str(e)}")
                return []
        else:
            # Fallback or raise error for unknown provider
            print(f"Warning: Model fetching for provider '{provider.value}' is not implemented.")
            return []

# Example Usage (Optional, for testing)
# async def main():
#     config = ProviderKeysConfig(
#         openaiKey="sk-...",
#         # anthropicKey="...",
#         # googleGeminiKey="...",
#         # etc.
#     )
#     service = ModelFetcherService(config)
#     try:
#         # models = await service.list_models(AIProviderEnum.OPENAI)
#         # print("OpenAI Models:", models)
#
#         ollama_models = await service.list_models(AIProviderEnum.OLLAMA)
#         print("Ollama Models:", ollama_models)
#
#     except Exception as e:
#         print(f"Error: {e}")
#     finally:
#         await service.close()

# if __name__ == "__main__":
#     import asyncio
#     asyncio.run(main())
