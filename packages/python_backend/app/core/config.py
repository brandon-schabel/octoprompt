OLLAMA_BASE_URL = "http://localhost:11434"
LMSTUDIO_BASE_URL = "http://localhost:1234"

# Recent changes:
# - Initial migration of model default configurations from TypeScript.
# - Represented configurations as Python dictionaries.
# - Kept provider names as strings.

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
    "model": "google/gemini-2.5-flash-preview" # Updated model
}

MEDIUM_MODEL_CONFIG: ModelOptions = {
    "frequencyPenalty": 0,
    "presencePenalty": 0,
    "maxTokens": 25000,
    "temperature": 0.7,
    "topP": 0,
    "topK": 0,
    "provider": "openrouter",
    "model": "google/gemini-2.5-flash-preview" # Updated model
}

HIGH_MODEL_CONFIG: ModelOptions = {
    "frequencyPenalty": 0,
    "presencePenalty": 0,
    "maxTokens": 50000,
    "temperature": 0.7,
    "topP": 0,
    "topK": 0,
    "provider": "openrouter",
    "model": "google/gemini-2.5-pro-preview" # Updated model
}

# PLANNING_MODEL_CONFIG uses a more capable model, diverging from HIGH_MODEL_CONFIG's model
PLANNING_MODEL_CONFIG: ModelOptions = {
    **HIGH_MODEL_CONFIG, # Spread operator equivalent
    "model": "google/gemini-2.5-pro-preview" # Explicitly set for planning, even if same as HIGH for now
}
