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
    FilenameSuggestionOutput, BasicSummaryOutput, UnifiedModel, AiSdkOptions # Added UnifiedModel, AiSdkOptions
)
# from app.schemas.provider_key_schemas import APIProviders # Keep for future use if provider type becomes strict

# Placeholder for actual services - to be implemented in app.services.*
# These functions are temporary and should be replaced with imports from your service modules.
async def temp_gen_text_stream(prompt: str, options: AiSdkOptions | None, system_message: str | None) -> AsyncGenerator[str, None]:
    # TODO: Implement in app.services.gen_ai_service.py
    # Example Vercel AI SDK stream format:
    # yield '0:"Hello"\n'
    # yield '0:","\n'
    # yield '0:" world"\n'
    # yield '0:"."\n'
    # For SSE:
    for chunk in ["Hello, ", "world! ", "This ", "is ", "a ", "stream."]:
        yield f"data: {{\"text\": \"{chunk}\"}}\\n\\n" # Example SSE format sending JSON chunks for Vercel AI SDK
        await asyncio.sleep(0.1)

async def temp_generate_single_text(prompt: str, options: AiSdkOptions | None, system_message: str | None) -> str:
    # TODO: Implement in app.services.gen_ai_service.py
    return f"Generated text for prompt: '{prompt}' with options: {options}"

async def temp_generate_structured_data(prompt: str, schema_model: Any, options: AiSdkOptions | None, system_message: str | None) -> Dict[str, Any]:
    # TODO: Implement in app.services.gen_ai_service.py
    # This service should use the schema_model to validate/guide generation
    if schema_model == FilenameSuggestionOutput:
        return FilenameSuggestionOutput(suggestions=["file1.py", "file2.py", "file3.py", "file4.py", "file5.py"], reasoning="placeholder reasoning").model_dump()
    elif schema_model == BasicSummaryOutput:
        return BasicSummaryOutput(summary="This is a placeholder summary from temp_generate_structured_data.").model_dump()
    return {"placeholder_output": "Structured data based on " + str(schema_model)}

class TempProviderKey: # TODO: Replace with import from app.schemas.provider_key_schemas
    def __init__(self, provider: str, key: str):
        self.provider = provider
        self.key = key

class TempProviderKeyService:
    # TODO: Implement in app.services.model_providers.provider_key_service.py
    async def list_keys(self) -> List[TempProviderKey]:
        return [TempProviderKey(provider="openai", key="sk-placeholder-openai"), TempProviderKey(provider="ollama", key="ollama_key_placeholder")]

temp_provider_key_service = TempProviderKeyService()

class TempModelFetcherService:
    # TODO: Implement in app.services.model_providers.model_fetcher_service.py
    def __init__(self, provider_keys_config: Dict[str, str]):
        self.provider_keys_config = provider_keys_config

    async def list_models(self, provider_id: str, list_options: Dict) -> List[UnifiedModel]:
        # This should call the actual model provider API
        if provider_id == "openai":
            return [
                UnifiedModel(id="gpt-4o", name="GPT-4o", provider="openai", context_length=128000),
                UnifiedModel(id="gpt-3.5-turbo", name="GPT-3.5 Turbo", provider="openai", context_length=16385)
            ]
        elif provider_id == "ollama":
             return [
                UnifiedModel(id="llama3:latest", name="Llama 3 (latest)", provider="ollama"),
                UnifiedModel(id="mistral:latest", name="Mistral (latest)", provider="ollama")
            ]
        return []

# TODO: These base URLs should ideally come from app.core.config or provider defaults
OLLAMA_BASE_URL = "http://localhost:11434"
LMSTUDIO_BASE_URL = "http://localhost:1234"
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
        stream_generator = temp_gen_text_stream(
            prompt=body.prompt, options=body.options, system_message=body.system_message
        )
        return StreamingResponse(stream_generator, media_type="text/event-stream")
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

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
        generated_text = await temp_generate_single_text(
            prompt=body.prompt, options=body.options, system_message=body.system_message
        )
        return AiGenerateTextResponse(data={"text": generated_text})
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail="Internal Server Error or AI Provider Error")

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
        result_obj = await temp_generate_structured_data(
            prompt=final_prompt, schema_model=config_entry["schema"], options=final_options, system_message=final_system_prompt
        )
        return AiGenerateStructuredResponse(data={"output": result_obj})
    except HTTPException:
        raise
    except Exception as e:
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
    provider_id = query_params.provider
    try:
        # Replace with actual service calls:
        # from app.services.model_providers.provider_key_service import provider_key_service
        # from app.services.model_providers.model_fetcher_service import ModelFetcherService
        # keys_list = await provider_key_service.list_keys()
        # provider_keys_config = {f"{key.provider}Key": key.key for key in keys_list}
        # model_fetcher = ModelFetcherService(provider_keys_config)
        # list_options_dict = {"ollama_base_url": OLLAMA_BASE_URL, "lmstudio_base_url": LMSTUDIO_BASE_URL}
        # models_list = await model_fetcher.list_models(provider_id=provider_id, list_options=list_options_dict)
        
        # Using temporary service for now:
        temp_keys_list = await temp_provider_key_service.list_keys()
        temp_provider_keys_config = {f"{key.provider}Key": key.key for key in temp_keys_list}
        temp_model_fetcher = TempModelFetcherService(temp_provider_keys_config)
        list_options_dict = {"ollama_base_url": OLLAMA_BASE_URL, "lmstudio_base_url": LMSTUDIO_BASE_URL}

        models_list = await temp_model_fetcher.list_models(provider_id=provider_id, list_options=list_options_dict)
        
        return ModelsListResponse(data=models_list)
    except HTTPException:
        raise
    except Exception as e:
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
        generated_text = await temp_generate_single_text(
            prompt=body.prompt, options=body.options, system_message=body.system_message
        )
        return AiGenerateTextResponse(data={"text": generated_text})
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail="Internal Server Error or AI Provider Error")

import asyncio # Required for placeholder stream function
# Note: To make this fully operational:
# 1. Implement the actual service functions in app.services.gen_ai_service.py,
#    app.services.model_providers.provider_key_service.py, and
#    app.services.model_providers.model_fetcher_service.py.
# 2. Replace the 'temp_*' function calls and class instantiations with actual imports and calls.
# 3. Ensure app.core.config provides OLLAMA_BASE_URL, LMSTUDIO_BASE_URL, etc.
# 4. Set up FastAPI application in main.py to include this router.
# 5. Define proper error handling (e.g. ApiError class and exception handlers).
