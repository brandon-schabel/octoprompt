# Recent changes:
# 1. Initial migration of gen-ai routes from TS to Python.
# 2. Added stream, text, structured, models, and duplicate text generation endpoints.
# 3. Mapped Hono concepts to FastAPI.
# 4. Integrated actual schemas from app.schemas.
# 5. Updated service calls to use (new) placeholders for app.services.

from fastapi import APIRouter, HTTPException, Query
from fastapi.responses import StreamingResponse
from typing import List, Dict, Any, AsyncGenerator # BaseModel for placeholder services

# Actual Schemas to be used
from app.schemas.common_schemas import ApiErrorResponse
from app.schemas.chat_schemas import ModelsQuery
from app.schemas.gen_ai_schemas import (
    AiGenerateTextRequest, AiGenerateTextResponse,
    AiGenerateStructuredRequest, AiGenerateStructuredResponse, ModelsListResponse,
    FilenameSuggestionOutput, BasicSummaryOutput, UnifiedModel as ApiUnifiedModel, AiSdkOptions # Renamed to ApiUnifiedModel
)
from app.core.config import OLLAMA_BASE_URL, LMSTUDIO_BASE_URL
# from app.schemas.provider_key_schemas import APIProviders # Keep for future use if provider type becomes strict

# Import actual services
from app.services.gen_ai_service import (
    generate_text_stream,
    generate_single_text,
    generate_structured_data
)
from app.services.provider_key_service import provider_key_service
from app.services.model_providers.model_fetcher_service import ModelFetcherService, ProviderKeysConfig, ListModelsOptions
from app.schemas.provider_key_schemas import AIProviderEnum # For validating provider string
from app.error_handling.api_error import ApiError # Added import
from app.services.agents.agent_logger import log as api_log # Added import for logging

# Removed temp_gen_text_stream, temp_generate_single_text, temp_generate_structured_data

# Removed TempProviderKey, TempProviderKeyService, TempModelFetcherService

# End of placeholder services

# Actual schemas from app.schemas.gen_ai_schemas are used below for config
STRUCTURED_DATA_SCHEMAS_CONFIG = {
    "filenameSuggestion": {
        "name": "Filename Suggestion",
        "description": "Suggests 5 suitable filenames based on a description of the file's content.",
        "prompt_template": "Based on the following file description, suggest 5 suitable and conventional filenames. File Description: {user_input}",
        "system_prompt": "You are an expert programmer specializing in clear code organization and naming conventions. Provide concise filename suggestions.",
        "model_settings": AiSdkOptions(model="gpt-4o", temperature=0.5),
        "schema": FilenameSuggestionOutput, # Using imported Pydantic model
    },
    "basicSummary": {
        "name": "Basic Summary",
        "description": "Generates a short summary of the input text.",
        "prompt_template": "Summarize the following text concisely: {user_input}",
        "system_prompt": "You are a summarization expert.",
        "model_settings": AiSdkOptions(model="gpt-4o", temperature=0.6, max_tokens=150),
        "schema": BasicSummaryOutput, # Using imported Pydantic model
    },
}

router = APIRouter(tags=["GenAI"])

@router.post(
    "/api/gen-ai/stream",
    summary="Generate text using a specified model and prompt (streaming)",
    response_description="Successfully initiated AI response stream (text/event-stream).",
)
async def stream_generate_text_endpoint(body: AiGenerateTextRequest):
    try:
        # Replace with actual service call: from app.services.gen_ai_service import gen_text_stream
        # stream_generator = gen_text_stream(prompt=body.prompt, options=body.options, system_message=body.system_message)
        stream_generator = generate_text_stream(
            prompt=body.prompt, options=body.options, system_message_content=body.system_message # Corrected param name
        )
        return StreamingResponse(stream_generator, media_type="text/event-stream")
    except ApiError as e:
        await api_log(f"[stream_generate_text_endpoint] ApiError: {e.message}", "error", {"error_code": e.code, "details": e.details})
        raise HTTPException(status_code=e.status_code, detail=e.to_dict())
    except HTTPException:
        raise
    except Exception as e:
        await api_log(f"[stream_generate_text_endpoint] Exception: {str(e)}", "error", {"error_type": type(e).__name__})
        raise HTTPException(status_code=500, detail=f"An unexpected error occurred: {str(e)}")

@router.post(
    "/api/gen-ai/text",
    summary="Generate text using a specified model and prompt",
    response_model=AiGenerateTextResponse,
    responses={
        422: {"model": ApiErrorResponse, "description": "Validation Error (invalid input)"},
        500: {"model": ApiErrorResponse, "description": "Internal Server Error or AI Provider Error"},
    },
)
async def generate_text_endpoint(body: AiGenerateTextRequest):
    try:
        # Replace with actual service call: from app.services.gen_ai_service import generate_single_text
        # generated_text = await generate_single_text(prompt=body.prompt, options=body.options, system_message=body.system_message)
        generated_text = await generate_single_text(
            prompt=body.prompt, options=body.options, system_message_content=body.system_message # Corrected param name
        )
        return AiGenerateTextResponse(data={"text": generated_text})
    except ApiError as e:
        await api_log(f"[generate_text_endpoint] ApiError: {e.message}", "error", {"error_code": e.code, "details": e.details})
        raise HTTPException(status_code=e.status_code, detail=e.to_dict())
    except HTTPException:
        raise
    except Exception as e:
        await api_log(f"[generate_text_endpoint] Exception: {str(e)}", "error", {"error_type": type(e).__name__})
        raise HTTPException(status_code=500, detail=f"Internal Server Error or AI Provider Error: {str(e)}")

@router.post(
    "/api/gen-ai/structured",
    summary="Generate structured data based on a predefined schema key and user input",
    response_model=AiGenerateStructuredResponse,
    responses={
        400: {"model": ApiErrorResponse, "description": "Bad Request: Invalid or unknown schemaKey provided."},
        422: {"model": ApiErrorResponse, "description": "Validation Error (invalid input)"},
        500: {"model": ApiErrorResponse, "description": "Internal Server Error or AI Provider Error"},
    },
)
async def generate_structured_endpoint(body: AiGenerateStructuredRequest):
    config_entry = STRUCTURED_DATA_SCHEMAS_CONFIG.get(body.schema_key)
    if not config_entry:
        valid_keys = ", ".join(STRUCTURED_DATA_SCHEMAS_CONFIG.keys())
        # No need for api_log here as it's a client error caught by FastAPI's default 400 handling for this.
        raise HTTPException(
            status_code=400,
            detail=f"Invalid schemaKey provided: {body.schema_key}. Valid keys are: {valid_keys}"
        )
    try:
        final_prompt = config_entry["prompt_template"].replace("{user_input}", body.user_input)
        
        # Combine model settings: request options override schema_config options
        merged_options_dict = {}
        if config_entry["model_settings"]:
            merged_options_dict.update(config_entry["model_settings"].model_dump(exclude_unset=True))
        if body.options:
            merged_options_dict.update(body.options.model_dump(exclude_unset=True))
        
        final_options = AiSdkOptions(**merged_options_dict) if merged_options_dict else None
        
        final_system_prompt = config_entry["system_prompt"]

        # Replace with actual service call: from app.services.gen_ai_service import generate_structured_data
        # result_obj = await generate_structured_data(
        # prompt=final_prompt, schema_model=config_entry["schema"], options=final_options, system_message=final_system_prompt
        # )
        # generate_structured_data returns a dict {"object": ..., "usage": ...}
        structured_response_dict = await generate_structured_data(
            prompt=final_prompt, output_schema=config_entry["schema"], options=final_options, system_message_content=final_system_prompt # Corrected param name
        )
        return AiGenerateStructuredResponse(data={"output": structured_response_dict["object"]}) # Extracting the object part
    except ApiError as e:
        await api_log(f"[generate_structured_endpoint] ApiError for schema {body.schema_key}: {e.message}", "error", {"schema_key": body.schema_key, "error_code": e.code, "details": e.details})
        raise HTTPException(status_code=e.status_code, detail=e.to_dict())
    except HTTPException:
        raise
    except Exception as e:
        await api_log(f"[generate_structured_endpoint] Exception for schema {body.schema_key}: {str(e)}", "error", {"schema_key": body.schema_key, "error_type": type(e).__name__})
        raise HTTPException(status_code=500, detail=f"Internal Server Error or AI Provider Error: {str(e)}")

@router.get(
    "/api/models",
    summary="List available AI models for a provider",
    response_model=ModelsListResponse, # Uses imported ModelsListResponse with List[UnifiedModel]
    responses={
        422: {"model": ApiErrorResponse, "description": "Validation error for query parameters"},
        400: {"model": ApiErrorResponse, "description": "Invalid provider or configuration error"},
        500: {"model": ApiErrorResponse, "description": "Internal Server Error"},
    },
)
async def get_models_endpoint(query_params: ModelsQuery = Query(...)): # Use ModelsQuery for validation
    provider_id_str = query_params.provider
    try:
        # Validate provider_id_str against AIProviderEnum
        try:
            provider_enum_member = AIProviderEnum(provider_id_str)
        except ValueError:
            valid_providers = ", ".join([p.value for p in AIProviderEnum])
            # No need for api_log here as it's a client error.
            raise HTTPException(status_code=400, detail=f"Invalid provider ID: '{provider_id_str}'. Valid providers are: {valid_providers}")

        # Fetch all API keys from storage
        all_keys_list_items = await provider_key_service.list_all_key_details() 

        print(f"[get_models_endpoint] all_keys_list_items: {all_keys_list_items}")
        
        # To get actual keys, we need to iterate and fetch full key details or have a method to get all full keys.
        # For now, let's assume we can get them or provider_key_service needs enhancement.
        # As a placeholder for ProviderKeysConfig, we will construct it based on what we *can* get.
        # This part needs careful review based on actual key storage and retrieval for ModelFetcherService.
        # The ModelFetcherService expects actual keys in its ProviderKeysConfig.
        # The current provider_key_service.list_keys() only returns metadata (id, provider, created, updated).
        # We would need a method like `provider_key_service.get_all_full_keys()` or iterate `get_key_by_id` (less efficient).
        # For this example, let's assume a function `get_all_provider_keys_with_secrets()` exists or is added to provider_key_service.
        # **********************************************************************************************************
        # ** TEMPORARY WORKAROUND / TODO for ProviderKeysConfig construction:
        # ** This simulates fetching full keys. Replace with actual secure key retrieval logic.
        # **********************************************************************************************************
        provider_keys_from_db = await provider_key_service.get_keys_by_provider(provider_enum_member.value)
        # This only gets keys for the *requested* provider. ModelFetcherService expects a config with *all* potential keys.
        # A more robust approach: iterate all_keys_list_items, fetch each full key by ID, then build ProviderKeysConfig.
        # This is inefficient. provider_key_service should offer a better way to get all keys for config.

        # For now, we will proceed with a partially filled config, or an empty one if no keys for the current provider.
        # The ModelFetcherService will then only be able_to_fetch models for providers it has keys for.
        # This is a limitation of the current example construction of provider_keys_config_dict.

        # Let's simulate having a way to get all keys for ProviderKeysConfig construction:
        # This is a conceptual placeholder for how one *might* get all keys securely.
        # In a real app, this would come from a secure config or a dedicated service method.
        # For now, we'll pass an empty config, which means ModelFetcherService will mostly rely on defaults/env vars if any.
        # Or, it will fail if a key is strictly required by a fetcher method and not found.
        # The ModelFetcherService internally tries to get keys from this config.

        # Create ProviderKeysConfig (ideally populated from a secure source or all keys from DB)
        # For this example, we'll build it based on keys for the *specific requested provider* if found.
        # This is NOT ideal for ModelFetcherService which might need keys for other providers it supports if it were to list all.
        # However, for listing for a *single* provider, it only needs that provider's key.

        keys_for_provider = await provider_key_service.get_keys_by_provider(provider_enum_member.value)
        print(f"[get_models_endpoint] keys_for_provider: {keys_for_provider}")
        key_value = keys_for_provider[0].key if keys_for_provider else None

        provider_keys_config_dict = {}
        if key_value: # Populate the key for the current provider if available
            if provider_enum_member == AIProviderEnum.OPENAI: provider_keys_config_dict["openaiKey"] = key_value
            elif provider_enum_member == AIProviderEnum.ANTHROPIC: provider_keys_config_dict["anthropicKey"] = key_value
            elif provider_enum_member == AIProviderEnum.GOOGLE_GEMINI: provider_keys_config_dict["googleGeminiKey"] = key_value
            elif provider_enum_member == AIProviderEnum.GROQ: provider_keys_config_dict["groqKey"] = key_value
            elif provider_enum_member == AIProviderEnum.TOGETHER: provider_keys_config_dict["togetherKey"] = key_value
            elif provider_enum_member == AIProviderEnum.XAI: provider_keys_config_dict["xaiKey"] = key_value
            elif provider_enum_member == AIProviderEnum.OPENROUTER: provider_keys_config_dict["openrouterKey"] = key_value
            # LMStudio and Ollama typically don't use API keys in the same way for listing.
        
        keys_config = ProviderKeysConfig(**provider_keys_config_dict)
        model_fetcher = ModelFetcherService(config=keys_config)
        
        list_options = ListModelsOptions(
            ollama_base_url=OLLAMA_BASE_URL, 
            lmstudio_base_url=LMSTUDIO_BASE_URL
        )

        fetched_models_from_service = []
        try:
            fetched_models_from_service = await model_fetcher.list_models(provider=provider_enum_member, options=list_options)
        finally:
            await model_fetcher.close() # Ensure client is closed

        # Map service models to API response models (ApiUnifiedModel from gen_ai_schemas)
        # ApiUnifiedModel expects an integer ID.
        api_models_response: List[ApiUnifiedModel] = []
        for idx, service_model in enumerate(fetched_models_from_service):
            api_models_response.append(
                ApiUnifiedModel(
                    id=idx + 1, # Sequential integer ID for the API response
                    name=service_model.name,
                    provider=service_model.provider_slug,
                    context_length=service_model.context_length
                )
            )
        
        return ModelsListResponse(data=api_models_response)
    except ApiError as e:
        await api_log(f"[get_models_endpoint] ApiError for provider {provider_id_str}: {e.message}", "error", {"provider": provider_id_str, "error_code": e.code, "details": e.details})
        raise HTTPException(status_code=e.status_code, detail=e.to_dict())
    except HTTPException: # Re-raise HTTPExceptions directly
        raise
    except Exception as e:
        await api_log(f"[get_models_endpoint] Exception for provider {provider_id_str}: {str(e)}", "error", {"provider": provider_id_str, "error_type": type(e).__name__})
        raise HTTPException(status_code=500, detail=f"Internal Server Error: {str(e)}")

@router.post(
    "/api//ai/generate/text", # Note: double slash preserved
    summary="Generate text (one-off, non-streaming) - Alternative Path",
    description="Generates text based on a prompt. This path includes a double slash, preserved from the original TypeScript version.",
    response_model=AiGenerateTextResponse,
    responses={
        422: {"model": ApiErrorResponse, "description": "Validation error (invalid request body)"},
        400: {"model": ApiErrorResponse, "description": "Bad Request (e.g., missing API key, invalid provider/model)"},
        500: {"model": ApiErrorResponse, "description": "Internal Server Error or AI provider communication error"},
    },
    tags=["AI"], 
)
async def post_ai_generate_text_endpoint(body: AiGenerateTextRequest):
    try:
        # print(f"[FastAPI AI Generate] /api//ai/generate/text request: Provider={body.options.provider if body.options else None}, Model={body.options.model if body.options else None}")
        # Replace with actual service call: from app.services.gen_ai_service import generate_single_text
        # generated_text = await generate_single_text(prompt=body.prompt, options=body.options, system_message=body.system_message)
        generated_text = await generate_single_text(
            prompt=body.prompt, options=body.options, system_message_content=body.system_message # Corrected param name
        )
        return AiGenerateTextResponse(data={"text": generated_text})
    except ApiError as e:
        await api_log(f"[post_ai_generate_text_endpoint] ApiError: {e.message}", "error", {"error_code": e.code, "details": e.details})
        raise HTTPException(status_code=e.status_code, detail=e.to_dict())
    except HTTPException:
        raise
    except Exception as e:
        await api_log(f"[post_ai_generate_text_endpoint] Exception: {str(e)}", "error", {"error_type": type(e).__name__})
        raise HTTPException(status_code=500, detail=f"Internal Server Error or AI Provider Error: {str(e)}")

# Note: To make this fully operational:
# 1. Implement the actual service functions in app.services.gen_ai_service.py,
#    app.services.provider_key_service.py, and potentially a dedicated
#    app.services.model_providers.model_fetcher_service.py.
# 2. The _fetch_available_models function is a placeholder and should be replaced
#    with a robust solution for dynamic model discovery, potentially using a new service.
#    --> This is now addressed by using ModelFetcherService, though ProviderKeysConfig construction needs robust key handling.
# 3. Ensure app.core.config provides OLLAMA_BASE_URL, LMSTUDIO_BASE_URL, etc.
# 4. Set up FastAPI application in main.py to include this router.
# 5. Define proper error handling (e.g. ApiError class and exception handlers).
