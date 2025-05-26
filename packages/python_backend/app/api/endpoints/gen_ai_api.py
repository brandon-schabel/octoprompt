from fastapi import APIRouter, HTTPException, Query
from fastapi.responses import StreamingResponse
from typing import List, Dict, Any, AsyncGenerator

from app.schemas.common_schemas import ApiErrorResponse
from app.schemas.chat_schemas import ModelsQuery
from app.schemas.gen_ai_schemas import (
    AiGenerateTextRequest, AiGenerateTextResponse,
    AiGenerateStructuredRequest, AiGenerateStructuredResponse, ModelsListResponse,
    FilenameSuggestionOutput, BasicSummaryOutput, UnifiedModel as ApiUnifiedModel, AiSdkOptions
)
from app.core.config import OLLAMA_BASE_URL, LMSTUDIO_BASE_URL

from app.services.gen_ai_service import (
    generate_text_stream,
    generate_single_text,
    generate_structured_data
)
from app.services.provider_key_service import provider_key_service
from app.services.model_providers.model_fetcher_service import ModelFetcherService, ProviderKeysConfig, ListModelsOptions
from app.schemas.provider_key_schemas import AIProviderEnum
from app.error_handling.api_error import ApiError
from app.services.agents.agent_logger import log as api_log

STRUCTURED_DATA_SCHEMAS_CONFIG = {
    "filenameSuggestion": {
        "name": "Filename Suggestion",
        "description": "Suggests 5 suitable filenames based on a description of the file's content.",
        "prompt_template": "Based on the following file description, suggest 5 suitable and conventional filenames. File Description: {user_input}",
        "system_prompt": "You are an expert programmer specializing in clear code organization and naming conventions. Provide concise filename suggestions.",
        "model_settings": AiSdkOptions(model="gpt-4o", temperature=0.5),
        "schema": FilenameSuggestionOutput,
    },
    "basicSummary": {
        "name": "Basic Summary",
        "description": "Generates a short summary of the input text.",
        "prompt_template": "Summarize the following text concisely: {user_input}",
        "system_prompt": "You are a summarization expert.",
        "model_settings": AiSdkOptions(model="gpt-4o", temperature=0.6, max_tokens=150),
        "schema": BasicSummaryOutput,
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
        stream_generator = generate_text_stream(
            prompt=body.prompt, options=body.options, system_message_content=body.system_message
        )
        return StreamingResponse(stream_generator, media_type="text/event-stream")
    except ApiError as e:
        # await api_log(f"[stream_generate_text_endpoint] ApiError: {e.message}", "error", {"error_code": e.code, "details": e.details})
        raise HTTPException(status_code=e.status_code, detail=e.to_dict())
    except HTTPException:
        raise
    except Exception as e:
        # await api_log(f"[stream_generate_text_endpoint] Exception: {str(e)}", "error", {"error_type": type(e).__name__})
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
        generated_text = await generate_single_text(
            prompt=body.prompt, options=body.options, system_message_content=body.system_message
        )
        return AiGenerateTextResponse(data={"text": generated_text})
    except ApiError as e:
        # await api_log(f"[generate_text_endpoint] ApiError: {e.message}", "error", {"error_code": e.code, "details": e.details})
        raise HTTPException(status_code=e.status_code, detail=e.to_dict())
    except HTTPException:
        raise
    except Exception as e:
        # await api_log(f"[generate_text_endpoint] Exception: {str(e)}", "error", {"error_type": type(e).__name__})
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
        raise HTTPException(
            status_code=400,
            detail=f"Invalid schemaKey provided: {body.schema_key}. Valid keys are: {valid_keys}"
        )
    try:
        final_prompt = config_entry["prompt_template"].replace("{user_input}", body.user_input)
        
        merged_options_dict = {}
        if config_entry["model_settings"]:
            merged_options_dict.update(config_entry["model_settings"].model_dump(exclude_unset=True))
        if body.options:
            merged_options_dict.update(body.options.model_dump(exclude_unset=True))
        
        final_options = AiSdkOptions(**merged_options_dict) if merged_options_dict else None
        
        final_system_prompt = config_entry["system_prompt"]

        structured_response_dict = await generate_structured_data(
            prompt=final_prompt, output_schema=config_entry["schema"], options=final_options, system_message_content=final_system_prompt
        )
        return AiGenerateStructuredResponse(data={"output": structured_response_dict["object"]})
    except ApiError as e:
        # await api_log(f"[generate_structured_endpoint] ApiError for schema {body.schema_key}: {e.message}", "error", {"schema_key": body.schema_key, "error_code": e.code, "details": e.details})
        raise HTTPException(status_code=e.status_code, detail=e.to_dict())
    except HTTPException:
        raise
    except Exception as e:
        # await api_log(f"[generate_structured_endpoint] Exception for schema {body.schema_key}: {str(e)}", "error", {"schema_key": body.schema_key, "error_type": type(e).__name__})
        raise HTTPException(status_code=500, detail=f"Internal Server Error or AI Provider Error: {str(e)}")

@router.get(
    "/api/models",
    summary="List available AI models for a provider",
    response_model=ModelsListResponse,
    responses={
        422: {"model": ApiErrorResponse, "description": "Validation error for query parameters"},
        400: {"model": ApiErrorResponse, "description": "Invalid provider or configuration error"},
        500: {"model": ApiErrorResponse, "description": "Internal Server Error"},
    },
)
async def get_models_endpoint(query_params: ModelsQuery = Query(...)):
    provider_id_str = query_params.provider
    try:
        try:
            provider_enum_member = AIProviderEnum(provider_id_str)
        except ValueError:
            valid_providers = ", ".join([p.value for p in AIProviderEnum])
            raise HTTPException(status_code=400, detail=f"Invalid provider ID: '{provider_id_str}'. Valid providers are: {valid_providers}")

        all_keys_list_items = await provider_key_service.list_all_key_details()
        # print(f"[get_models_endpoint] all_keys_list_items: {all_keys_list_items}") # Removed log

        keys_for_provider = await provider_key_service.get_keys_by_provider(provider_enum_member.value)
        # print(f"[get_models_endpoint] keys_for_provider: {keys_for_provider}") # Removed log
        key_value = keys_for_provider[0].key if keys_for_provider else None

        provider_keys_config_dict = {}
        if key_value:
            if provider_enum_member == AIProviderEnum.OPENAI: provider_keys_config_dict["openaiKey"] = key_value
            elif provider_enum_member == AIProviderEnum.ANTHROPIC: provider_keys_config_dict["anthropicKey"] = key_value
            elif provider_enum_member == AIProviderEnum.GOOGLE_GEMINI: provider_keys_config_dict["googleGeminiKey"] = key_value
            elif provider_enum_member == AIProviderEnum.GROQ: provider_keys_config_dict["groqKey"] = key_value
            elif provider_enum_member == AIProviderEnum.TOGETHER: provider_keys_config_dict["togetherKey"] = key_value
            elif provider_enum_member == AIProviderEnum.XAI: provider_keys_config_dict["xaiKey"] = key_value
            elif provider_enum_member == AIProviderEnum.OPENROUTER: provider_keys_config_dict["openrouterKey"] = key_value
        
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
            await model_fetcher.close()

        api_models_response: List[ApiUnifiedModel] = []
        for idx, service_model in enumerate(fetched_models_from_service):
            api_models_response.append(
                ApiUnifiedModel(
                    id=idx + 1,
                    name=service_model.name,
                    provider=service_model.provider_slug,
                    context_length=service_model.context_length
                )
            )
        
        return ModelsListResponse(data=api_models_response)
    except ApiError as e:
        # await api_log(f"[get_models_endpoint] ApiError for provider {provider_id_str}: {e.message}", "error", {"provider": provider_id_str, "error_code": e.code, "details": e.details})
        raise HTTPException(status_code=e.status_code, detail=e.to_dict())
    except HTTPException:
        raise
    except Exception as e:
        # await api_log(f"[get_models_endpoint] Exception for provider {provider_id_str}: {str(e)}", "error", {"provider": provider_id_str, "error_type": type(e).__name__})
        raise HTTPException(status_code=500, detail=f"Internal Server Error: {str(e)}")

@router.post(
    "/api//ai/generate/text",
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
        generated_text = await generate_single_text(
            prompt=body.prompt, options=body.options, system_message_content=body.system_message
        )
        return AiGenerateTextResponse(data={"text": generated_text})
    except ApiError as e:
        # await api_log(f"[post_ai_generate_text_endpoint] ApiError: {e.message}", "error", {"error_code": e.code, "details": e.details})
        raise HTTPException(status_code=e.status_code, detail=e.to_dict())
    except HTTPException:
        raise
    except Exception as e:
        # await api_log(f"[post_ai_generate_text_endpoint] Exception: {str(e)}", "error", {"error_type": type(e).__name__})
        raise HTTPException(status_code=500, detail=f"Internal Server Error or AI Provider Error: {str(e)}")