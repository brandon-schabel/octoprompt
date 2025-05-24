OLLAMA_BASE_URL = "http://localhost:11434"
LMSTUDIO_BASE_URL = "http://localhost:1234"


from typing import TypedDict, Literal

APIProviders = Literal["openrouter", "openai", "groq", "ollama", "lmstudio"]

class ModelOptions(TypedDict, total=False):
    frequencyPenalty: float
    presencePenalty: float
    maxTokens: int
    temperature: float
    topP: float
    topK: int
    model: str
    provider: APIProviders

LOW_MODEL_CONFIG: ModelOptions = {
    "frequencyPenalty": 0,
    "presencePenalty": 0,
    "maxTokens": 10000,
    "temperature": 0.7,
    "topP": 0,
    "topK": 0,
    "provider": "openrouter",
    "model": "google/gemini-2.5-flash-preview"
}

MEDIUM_MODEL_CONFIG: ModelOptions = {
    "frequencyPenalty": 0,
    "presencePenalty": 0,
    "maxTokens": 25000,
    "temperature": 0.7,
    "topP": 0,
    "topK": 0,
    "provider": "openrouter",
    "model": "google/gemini-2.5-flash-preview"
}

HIGH_MODEL_CONFIG: ModelOptions = {
    "frequencyPenalty": 0,
    "presencePenalty": 0,
    "maxTokens": 50000,
    "temperature": 0.7,
    "topP": 0,
    "topK": 0,
    "provider": "openrouter",
    "model": "google/gemini-2.5-pro-preview"
}

PLANNING_MODEL_CONFIG: ModelOptions = {
    **HIGH_MODEL_CONFIG,
    "model": "google/gemini-2.5-pro-preview"
}
