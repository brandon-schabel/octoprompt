# packages/python_backend/app/services/gen_ai_service.py
# Last 5 changes:
# 1. Initial conversion from TypeScript gen-ai-services.ts.
# 2. Integrated Pydantic-AI for LLM interactions (Agent, Models, Providers).
# 3. Implemented API key and model configuration logic for various providers.
# 4. Added functions for streaming, single text, and structured data generation.
# 5. Mapped Vercel AI SDK concepts (CoreMessage, streamText, generateObject) to Pydantic-AI.

import asyncio
import os
import json
from typing import List, Optional, Dict, Any, Union, AsyncGenerator, Type

from pydantic import BaseModel, ValidationError
from openai import AsyncOpenAI # For custom clients with OpenAIProvider

from pydantic_ai import Agent
from pydantic_ai.models.openai import OpenAIModel
from pydantic_ai.models.anthropic import AnthropicModel
from pydantic_ai.models.gemini import GeminiModel
from pydantic_ai.models.groq import GroqModel
# from pydantic_ai.models.ollama import OllamaModel
from pydantic_ai.models.mistral import MistralModel
from pydantic_ai.models import Model # Base Model for type hinting
from pydantic_ai.providers.openai import OpenAIProvider
from pydantic_ai.messages import (
    UserPromptPart, SystemPromptPart, ModelMessage, TextPart, ModelRequest, ModelResponse
)
from pydantic_ai.exceptions import ModelHTTPError

# Local imports from the python_backend/app structure
from app.schemas.gen_ai_schemas import AiSdkOptions, AiMessage
# Assuming relevant Pydantic models for structured output are defined here or imported by gen_ai_schemas
# e.g., from app.schemas.gen_ai_schemas import FilenameSuggestionOutput 
from app.schemas.chat_schemas import MessageRoleEnum, ChatMessage as AppChatMessage, ExtendedChatMessage
from app.services.provider_key_service import provider_key_service # Assumed Python version
from app.services.chat_service import ChatService # Assumed Python version
from app.error_handling.api_error import ApiError

from app.core.config import OLLAMA_BASE_URL, LMSTUDIO_BASE_URL, LOW_MODEL_CONFIG


PROVIDER_MODEL_PREFIX_MAP = {
    "openai": "openai", "anthropic": "anthropic", "google_gemini": "google-gla",
    "groq": "groq", "mistral": "mistralai", "ollama": "ollama",
    "openrouter": "openai_compatible", "lmstudio": "openai_compatible",
    "xai": "openai_compatible", "together": "openai_compatible",
}

chat_service_instance = ChatService() # Global or from DI

async def _get_api_key(provider_slug: str, debug: bool = False) -> Optional[str]:
    # TODO: make sure user can only save one key per provider for now, but support multiple keys per provider in the future
    keys = await provider_key_service.list_all_key_details()
    print(f"[GenAIService] keys: {keys}")
    print(f"[GenAIService] provider_slug: {provider_slug}")

    provider_keys_configs = [key for key in keys if key.provider == provider_slug]
    print(f"[GenAIService] provider_keys_configs: {provider_keys_configs}")
    provider_key_obj = provider_keys_configs[0] if provider_keys_configs else None # Renamed to avoid confusion
    print(f"[GenAIService] provider_key_obj: {provider_key_obj}")

    if provider_key_obj:
        if debug: print(f"[GenAIService] Using API key from DB for {provider_slug}")
        return provider_key_obj.key # Return the actual key string
    
    env_var_map = { # Maps TS provider slug to common ENV var names
        "openai": "OPENAI_API_KEY", "anthropic": "ANTHROPIC_API_KEY",
        "google_gemini": "GOOGLE_API_KEY", "groq": "GROQ_API_KEY",
        "openrouter": "OPENROUTER_API_KEY", "xai": "XAI_API_KEY",
        "together": "TOGETHER_AI_API_KEY", # Note: Often TOGETHER_API_KEY
        "mistral": "MISTRAL_API_KEY" 
    }
    if provider_slug in env_var_map:
        env_key = os.getenv(env_var_map[provider_slug])
        if env_key:
            if debug: print(f"[GenAIService] Using API key from env var {env_var_map[provider_slug]} for {provider_slug}")
            return env_key
            
    if debug: print(f"[GenAIService] API key for {provider_slug} not in DB or common env vars.")
    return None

def _prepare_model_settings(options: Optional[AiSdkOptions] = None, debug: bool = False) -> Dict[str, Any]:
    merged_settings = { # Start with relevant LOW_MODEL_CONFIG defaults
        k: v for k, v in LOW_MODEL_CONFIG.items()
        if k in ["temperature", "max_tokens", "top_p", "frequency_penalty", "presence_penalty", "top_k", "stop"]
    }
    if options:
        options_dict = options.model_dump(exclude_none=True)
        if "response_format" in options_dict and isinstance(options_dict["response_format"], str):
            try: # Try to parse stringified JSON response_format
                options_dict["response_format"] = json.loads(options_dict["response_format"])
            except json.JSONDecodeError:
                if debug: print(f"Warning: response_format string '{options_dict['response_format']}' is not valid JSON.")
        merged_settings.update(options_dict)
    return merged_settings

async def _get_pydantic_ai_model(model_id: str) -> Model:
    provider_keys = await provider_key_service.list_all_key_details()
    openRouterKey = provider_keys[0].key
    return OpenAIModel(model_id, provider=OpenAIProvider(api_key=openRouterKey, base_url="https://openrouter.ai/api/v1"))

# async def _get_pydantic_ai_model(
#     options: Optional[Union[AiSdkOptions, Dict[str, Any]]] = None, debug: bool = False
# ) -> Model:

#     final_opts_obj: AiSdkOptions
#     if isinstance(options, dict):
#         if debug: print(f"[GenAIService] WARNING: _get_pydantic_ai_model received options as dict, converting. Caller should pass AiSdkOptions instance. Options: {options}")
#         final_opts_obj = AiSdkOptions(**options)
#     elif isinstance(options, AiSdkOptions):
#         final_opts_obj = options
#     else: # options is None or an unexpected type
#         final_opts_obj = AiSdkOptions(**LOW_MODEL_CONFIG)

#     provider = final_opts_obj.provider or LOW_MODEL_CONFIG.get("provider")
#     model_id = final_opts_obj.model if final_opts_obj.model is not None else LOW_MODEL_CONFIG.get("model")
    
#     if not provider: raise ApiError(400, "Provider missing in options or LOW_MODEL_CONFIG", "PROVIDER_MISSING")
#     if not model_id: raise ApiError(400, f"Model ID missing for {provider} in options or LOW_MODEL_CONFIG", "MODEL_ID_MISSING")
#     if debug: print(f"[GenAIService] Initializing: Provider(TS)={provider}, ModelID={model_id}")

#     api_key = await _get_api_key(provider, debug)
#     pydantic_ai_provider_slug = PROVIDER_MODEL_PREFIX_MAP.get(provider)

#     clean_model_id = model_id.split(":")[-1] if ":" in model_id else model_id

#     if pydantic_ai_provider_slug == "openai":
#         openai_provider = OpenAIProvider(api_key=api_key)
#         return OpenAIModel(clean_model_id, provider=openai_provider)
#     if pydantic_ai_provider_slug == "anthropic":
#         return AnthropicModel(model_identifier=f"anthropic:{clean_model_id}", api_key=api_key)
#     if pydantic_ai_provider_slug == "google-gla":
#         return GeminiModel(model_identifier=f"google-gla:{clean_model_id}", api_key=api_key)
#     if pydantic_ai_provider_slug == "groq":
#         return GroqModel(model_identifier=f"groq:{clean_model_id}", api_key=api_key)
#     if pydantic_ai_provider_slug == "mistralai":
#         effective_model_id = model_id if "/" in model_id or "mistralai/" in model_id else f"mistralai/{clean_model_id}"
#         return MistralModel(model_identifier=effective_model_id, api_key=api_key)
#     if pydantic_ai_provider_slug == "ollama":
#         ollama_provider = OpenAIProvider(api_key="ollama", base_url=OLLAMA_BASE_URL)
#         return OpenAIModel(clean_model_id, provider=ollama_provider)
    
#     if pydantic_ai_provider_slug == "openai_compatible":
#         base_url_map = {
#             "openrouter": "https://openrouter.ai/api/v1",
#             "lmstudio": LMSTUDIO_BASE_URL,
#             "xai": "https://api.x.ai/v1",
#             "together": "https://api.together.xyz/v1",
#         }
#         base_url = base_url_map.get(provider)
#         if not base_url: raise ApiError(500, f"Base URL for {provider} not configured.", "BASE_URL_MISSING")
        
#         effective_api_key = "ignored" if provider == "lmstudio" else api_key
#         if not effective_api_key and provider != "lmstudio":
#             raise ApiError(400, f"{provider} API Key not found.", f"{provider.upper()}_KEY_MISSING")


#         print(f"[GenAIService] effective_api_key: {effective_api_key}")
#         print(f"[GenAIService] base_url: {base_url}")     
#         print(f"[GenAIService] clean_model_id: {clean_model_id}")
#         custom_provider = OpenAIProvider(api_key=effective_api_key, base_url=base_url)
#         return OpenAIModel(clean_model_id, provider=custom_provider)

#     if debug: print(f"[GenAIService] Provider '{provider}' not directly supported or configured. Attempting fallback using OpenRouter configuration.")
    
#     fallback_api_key = await _get_api_key("openrouter", debug) # Attempt to get OpenRouter key for fallback

#     if not fallback_api_key:
#         error_message = (
#             f"Fallback mechanism failed for provider '{provider}'. OpenRouter API key (used for fallback) not found. "
#             "Ensure an API key for 'openrouter' is in the DB or OPENROUTER_API_KEY env var is set. "
#             "Alternatively, if direct OpenAI usage is intended as a last resort and no OpenRouter key is available, "
#             "ensure OPENAI_API_KEY is set, though this fallback path currently prioritizes OpenRouter."
#         )
#         if debug: print(f"[GenAIService] CRITICAL ERROR: {error_message}")
#         raise ApiError(
#             500, 
#             error_message,
#             "FALLBACK_KEY_MISSING_OPENROUTER" 
#         )

#     default_fallback_model_name = "google/gemini-2.5-flash-preview" # A common OpenRouter model
#     config_model_identifier = LOW_MODEL_CONFIG.get('model', default_fallback_model_name)
#     fallback_model_name = config_model_identifier.split(":")[-1]
    
#     openrouter_base_url = "https://openrouter.ai/api/v1"
    
#     fallback_provider = OpenAIProvider(api_key=fallback_api_key, base_url=openrouter_base_url)

#     if debug: print(f"[GenAIService] Fallback: Using OpenRouter. Model: {fallback_model_name}. Provider configured with OpenRouter key and base URL.")
    
#     return OpenAIModel(fallback_model_name, provider=fallback_provider)
    
def _convert_app_messages_to_history(messages: List[Union[AppChatMessage, AiMessage]]) -> List[ModelMessage]:
    history: List[ModelMessage] = []
    for msg in messages:
        content = msg.content
        if msg.role == MessageRoleEnum.USER:
            history.append(ModelRequest(parts=[UserPromptPart(content=content)]))
        elif msg.role == MessageRoleEnum.ASSISTANT:
            history.append(ModelResponse(parts=[TextPart(content=content)]))
        elif msg.role == MessageRoleEnum.SYSTEM:
            history.append(ModelRequest(parts=[SystemPromptPart(content=content)]))
    return history

async def handle_chat_message_stream(
    chat_id: str, user_message_content: str, options: Optional[AiSdkOptions] = None,
    system_message_content: Optional[str] = None, temp_id: Optional[str] = None, debug: bool = False
) -> AsyncGenerator[str, None]:
    final_options_obj = options or AiSdkOptions(**LOW_MODEL_CONFIG)
    provider = final_options_obj.provider or LOW_MODEL_CONFIG["provider"]
    
    pydantic_ai_model = await _get_pydantic_ai_model(final_options_obj.model, debug)
    model_settings = _prepare_model_settings(final_options_obj, debug)

    db_messages = await chat_service_instance.get_chat_messages(chat_id)
    message_history = _convert_app_messages_to_history(db_messages)

    await chat_service_instance.save_message(ExtendedChatMessage(
        chat_id=chat_id, role=MessageRoleEnum.USER, content=user_message_content,
        temp_id=f"{temp_id}-user" if temp_id else None
    ))
    await chat_service_instance.update_chat_timestamp(chat_id)
    
    assistant_msg = await chat_service_instance.save_message(ExtendedChatMessage(
        chat_id=chat_id, role=MessageRoleEnum.ASSISTANT, content="...", temp_id=temp_id
    ))
    final_assistant_message_id = assistant_msg.id
    accumulated_text = ""

    try:
        agent = Agent(model=pydantic_ai_model, system_prompt=system_message_content)
        async with agent.run_stream(prompt=user_message_content, message_history=message_history, model_settings=model_settings) as stream_result:
            async for delta in stream_result.stream_text(delta=True):
                yield delta
                accumulated_text += delta
            
            usage = stream_result.usage()
            if debug: print(f"[GenAIService] Stream finished. Usage: {usage.model_dump_json() if usage else 'N/A'}")
            await chat_service_instance.save_message(ExtendedChatMessage( # save_message should update by id
                id=final_assistant_message_id, chat_id=chat_id, role=MessageRoleEnum.ASSISTANT, 
                content=accumulated_text or " "
            ))
    except Exception as e:
        err_msg = f"Error: Streaming failed. {str(e)}"
        if debug: print(f"[GenAIService] Stream error for {provider}: {err_msg}")
        yield f"\nSTREAM_ERROR: {err_msg}"
        if final_assistant_message_id:
            try:
                await chat_service_instance.save_message(ExtendedChatMessage(
                    id=final_assistant_message_id, chat_id=chat_id, role=MessageRoleEnum.ASSISTANT, content=err_msg
                ))
            except Exception as db_err:
                if debug: print(f"[GenAIService] DB update error on stream error: {db_err}")
        if isinstance(e, ModelHTTPError): raise ApiError(e.status_code or 500, str(e), "MODEL_STREAM_ERROR")
        raise ApiError(500, str(e), "STREAMING_ERROR")

async def generate_text_stream(
    prompt: Optional[str] = None, messages: Optional[List[AiMessage]] = None, options: Optional[AiSdkOptions] = None,
    system_message_content: Optional[str] = None, debug: bool = False
) -> AsyncGenerator[str, None]:
    if not prompt and not messages: raise ApiError(400, "Prompt or messages required.", "MISSING_INPUT")

    final_options_obj = options or AiSdkOptions(**LOW_MODEL_CONFIG)
    provider = final_options_obj.provider 

    pydantic_ai_model = await _get_pydantic_ai_model_openrouter(final_options_obj.model)
    model_settings = _prepare_model_settings(final_options_obj, debug)
    
    message_history: List[ModelMessage] = []
    current_user_prompt = prompt
    if messages:
        message_history = _convert_app_messages_to_history(messages)
        if not current_user_prompt and message_history: 
            last_msg = message_history[-1]
            if isinstance(last_msg, ModelRequest) and isinstance(last_msg.parts[0], UserPromptPart):
                current_user_prompt = last_msg.parts[0].content
                message_history = message_history[:-1]
    
    if not current_user_prompt: raise ApiError(400, "No user prompt to process.", "NO_USER_PROMPT")

    if debug: print(f"[GenAIService] Starting genTextStream for {provider}. Prompt: {current_user_prompt[:100]}...")
    try:
        agent = Agent(model=pydantic_ai_model, system_prompt=system_message_content)
        async with agent.run_stream(prompt=current_user_prompt, message_history=message_history, model_settings=model_settings) as stream_result:
            async for delta in stream_result.stream_text(delta=True): yield delta
            if debug: print(f"[GenAIService] genTextStream finished. Usage: {stream_result.usage().model_dump_json() if stream_result.usage() else 'N/A'}")
    except Exception as e:
        if debug: print(f"[GenAIService] genTextStream error: {e}")
        yield f"\nSTREAM_ERROR: {str(e)}"
        if isinstance(e, ModelHTTPError): raise ApiError(e.status_code or 500, str(e), "MODEL_GENERIC_STREAM_ERROR")
        raise ApiError(500, str(e), "GENERIC_STREAM_ERROR")

async def generate_single_text(
    prompt: str, messages: Optional[List[AiMessage]] = None, options: Optional[AiSdkOptions] = None,
    system_message_content: Optional[str] = None, debug: bool = False
) -> str:
    final_options_obj = options or AiSdkOptions(**LOW_MODEL_CONFIG)
    provider_ts = final_options_obj.provider or LOW_MODEL_CONFIG.get("provider")
    if not prompt and not messages: raise ApiError(400, "Prompt or messages required.", "MISSING_INPUT_SINGLE_TEXT")

    pydantic_ai_model = await _get_pydantic_ai_model_openrouter(final_options_obj.model)
    model_settings = _prepare_model_settings(final_options_obj, debug)
    
    message_history: List[ModelMessage] = []
    current_user_prompt = prompt
    if messages: 
        message_history = _convert_app_messages_to_history(messages)
        if not current_user_prompt and message_history:
            last_msg = message_history[-1]
            if isinstance(last_msg, ModelRequest) and isinstance(last_msg.parts[0], UserPromptPart):
                current_user_prompt = last_msg.parts[0].content
                message_history = message_history[:-1]

    if not current_user_prompt: raise ApiError(400, "No user prompt to process.", "NO_USER_PROMPT_SINGLE")
    
    try:
        agent = Agent(model=pydantic_ai_model, system_prompt=system_message_content)
        result = await agent.run(prompt=current_user_prompt, message_history=message_history, model_settings=model_settings)
        if debug: print(f"[GenAIService] generateSingleText finished. Usage: {result.usage().model_dump_json()}")
        return result.output
    except Exception as e:
        if debug: print(f"[GenAIService] generateSingleText error: {e}")
        if isinstance(e, ModelHTTPError): raise ApiError(e.status_code or 500, str(e), "MODEL_SINGLE_TEXT_ERROR")
        raise ApiError(500, f"Generate single text failed: {str(e)}", "GENERATE_SINGLE_TEXT_FAILED", {"original_error": str(e)})

async def generate_structured_data(
    prompt: str, output_schema: Type[BaseModel], options: Optional[AiSdkOptions] = None,
    system_message_content: Optional[str] = None, debug: bool = False
) -> Dict[str, Any]: 
    if not prompt: raise ApiError(400, "Prompt required for structured data.", "MISSING_PROMPT_STRUCTURED")

    final_options_obj = options or AiSdkOptions(**LOW_MODEL_CONFIG)
    provider_ts = final_options_obj.provider or LOW_MODEL_CONFIG.get("provider")

    pydantic_ai_model = await _get_pydantic_ai_model(final_options_obj.model)
    print(f"[GenAIService] pydantic_ai_model: {pydantic_ai_model}")
    model_settings = _prepare_model_settings(final_options_obj, debug)
    if debug: print(f"[GenAIService] Generating structured data for {provider_ts}, Schema={output_schema.__name__}")

    try:
        agent = Agent(model=pydantic_ai_model, system_prompt=system_message_content, output_type=output_schema)
        result = await agent.run(prompt=prompt, model_settings=model_settings)
        
        usage_data = {}
        current_usage = result.usage()
        if current_usage:
            if debug: print(f"[GenAIService] Raw Usage Object: {current_usage}")
            usage_data = {
                "requests": current_usage.requests,
                "request_tokens": current_usage.request_tokens,
                "response_tokens": current_usage.response_tokens,
                "total_tokens": current_usage.total_tokens,
                "details": current_usage.details,
            }
            if debug: print(f"[GenAIService] Constructed Usage Data: {usage_data}")
        else:
            if debug: print("[GenAIService] No usage data returned from agent.run()")

        return {"object": result.output.model_dump(), "usage": usage_data}
    except ValidationError as e:
        if debug: print(f"[GenAIService] Structured data validation error: {e.errors()}")
        raise ApiError(500, f"LLM output failed Pydantic validation: {e.errors()}", "LLM_OUTPUT_VALIDATION_ERROR", {"raw_output": str(e)})
    except Exception as e:
        if debug: print(f"[GenAIService] generateStructuredData error: {e}")
        if isinstance(e, ModelHTTPError): raise ApiError(e.status_code or 500, str(e), "MODEL_STRUCTURED_ERROR")
        raise ApiError(500, f"Generate structured data failed: {str(e)}", "GENERATE_STRUCTURED_DATA_FAILED", {"original_error": str(e)})