from typing import List, Optional, Dict, Any, Literal, Union
from pydantic import BaseModel, Field, HttpUrl
import httpx
from enum import Enum

from app.schemas.provider_key_schemas import AIProviderEnum

GEMINI_BASE_URL = "https://generativelanguage.googleapis.com/v1beta"
GROQ_BASE_URL = "https://api.groq.com/openai/v1"
TOGETHER_BASE_URL = "https://api.together.ai"
OPENAI_BASE_URL = "https://api.openai.com/v1"
ANTHROPIC_BASE_URL = "https://api.anthropic.com/v1"
OPENROUTER_BASE_URL = "https://openrouter.ai/api/v1"
XAI_BASE_URL = "https://api.xai.com/v1"
OLLAMA_BASE_URL = "http://localhost:11434"
LMSTUDIO_BASE_URL = "http://localhost:1234/v1"

class UnifiedModel(BaseModel):
    id: str
    name: str
    description: Optional[str] = None
    context_length: Optional[int] = None
    provider_slug: str

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
    context_length: Optional[int] = Field(None, alias="context_length")

class OpenRouterModelsResponse(BaseModel):
    data: List[OpenRouterModel]

class GeminiAPIModel(BaseModel):
    name: str
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

class AnthropicModel(BaseModel):
    type: Optional[str] = None
    id: str
    display_name: Optional[str] = None
    name: str
    created: Optional[str] = None

class AnthropicModelsResponse(BaseModel):
    data: List[AnthropicModel]

class OpenAIModelObject(BaseModel):
    id: str
    object: str
    created: int
    owned_by: str = Field(..., alias="owned_by")

class OpenAIModelsListResponse(BaseModel):
    object: str
    data: List[OpenAIModelObject]

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

class OllamaModelDetails(BaseModel):
    parent_model: Optional[str] = Field(None, alias="parent_model")
    format: Optional[str] = None
    family: Optional[str] = None
    families: Optional[List[str]] = None
    parameter_size: Optional[str] = Field(None, alias="parameter_size")
    quantization_level: Optional[str] = Field(None, alias="quantization_level")

class OllamaModel(BaseModel):
    name: str
    model: str
    modified_at: str
    size: int
    digest: str
    details: OllamaModelDetails

class OllamaModelsResponse(BaseModel):
    models: List[OllamaModel]

class LMStudioModel(BaseModel):
    id: str

class LMStudioModelsResponse(BaseModel):
    data: List[LMStudioModel]

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
        self.http_client = httpx.AsyncClient(timeout=20.0)

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
            data = OpenAIModelsListResponse.model_validate(response.json())
            return [
                UnifiedModel(
                    id=m.id,
                    name=m.id,
                    description=f"Groq model owned by {m.owned_by}, Context: N/A",
                    context_length=None,
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
            response = await self.http_client.get(f"{TOGETHER_BASE_URL}/models", headers=headers)
            response.raise_for_status()
            data = [TogetherModel.model_validate(item) for item in response.json()]
            return [
                UnifiedModel(
                    id=m.id,
                    name=m.display_name or m.id,
                    description=f"{m.organization or 'Together'} model: {m.display_name or m.id}",
                    context_length=m.context_length,
                    provider_slug=AIProviderEnum.TOGETHER.value
                )
                for m in data if m.type != "chat-hf"
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
                    context_length=None,
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
                    name=m.name or m.id,
                    description=f"Anthropic model: {m.id}",
                    context_length=None,
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
            data = OpenAIModelsListResponse.model_validate(response.json())
            return [
                UnifiedModel(
                    id=m.id,
                    name=m.id,
                    description=f"XAI model owned by {m.owned_by}",
                    context_length=None,
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
                    id=model.name,
                    name=model.name,
                    description=f"{model.details.family or 'Ollama'} family - {model.name} | Size: {model.details.parameter_size or 'N/A'} | Quant: {model.details.quantization_level or 'N/A'}",
                    context_length=None,
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
            response = await self.http_client.get(f"{url_to_use}/models")
            response.raise_for_status()
            data = OpenAIModelsListResponse.model_validate(response.json())
            return [
                UnifiedModel(
                    id=m.id,
                    name=m.id,
                    description=f"LM Studio model: {m.id} (Owner: {m.owned_by})",
                    context_length=None,
                    provider_slug=AIProviderEnum.LMSTUDIO.value
                )
                for m in data.data
            ]
        except httpx.HTTPStatusError as e:
            raise ConnectionError(f"LM Studio error: {e.response.status_code} - {e.response.text} from {url_to_use}")
        except Exception as e:
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
                # Removed print warning
                return []
        else:
            # Removed print warning
            return []