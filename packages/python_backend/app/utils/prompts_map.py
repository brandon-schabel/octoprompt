# packages/python_backend/app/utils/prompts_map.py
# - Converted from TypeScript version
# - Uses pathlib for path manipulation
# - Assumes a similar PROD_ENV or environment variable for path logic
# - Reads .md files as text
# - Exports a dictionary similar to promptsMap

import os
from pathlib import Path

# Determine if running in a production-like environment
# This can be set via an environment variable, e.g., APP_ENV=production
IS_PROD_ENV = os.getenv("APP_ENV") == "production"

# In prod, paths are relative to a potential build output; in dev, relative to this file.
# Adjust the dev path to go up to the workspace root and then into 'prompts'.
PROMPTS_DIR_DEV = Path(__file__).resolve().parent.parent.parent.parent / "prompts"
PROMPTS_DIR_PROD = Path("./prompts") # Assuming it's relative to where the main script runs in prod

PROMPTS_DIR = PROMPTS_DIR_PROD if IS_PROD_ENV else PROMPTS_DIR_DEV

def read_prompt_file(filename: str) -> str:
    """Reads a prompt file and returns its content as a string."""
    file_path = PROMPTS_DIR / filename
    try:
        with open(file_path, "r", encoding="utf-8") as f:
            return f.read()
    except FileNotFoundError:
        # Log this error or handle it as appropriate for your application
        print(f"Warning: Prompt file not found: {file_path}")
        return "" # Or raise an exception
    except Exception as e:
        print(f"Error reading prompt file {file_path}: {e}")
        return ""


contemplative_prompt = read_prompt_file("contemplative-prompt.md")
summarization_steps = read_prompt_file("summarization-prompt.md")
octoprompt_planning_meta_prompt = read_prompt_file("octoprompt-planning-meta-prompt.md")

prompts_map = {
    "contemplativePrompt": contemplative_prompt,
    "summarizationSteps": summarization_steps,
    "octopromptPlanningMetaPrompt": octoprompt_planning_meta_prompt,
}

# Example usage (optional, for testing):
# if __name__ == "__main__":
#     print(f"Contemplative Prompt Path: {PROMPTS_DIR / 'contemplative-prompt.md'}")
#     print(f"Summarization Steps Path: {PROMPTS_DIR / 'summarization-prompt.md'}")
#     print(f"Octoprompt Planning Meta Prompt Path: {PROMPTS_DIR / 'octoprompt-planning-meta-prompt.md'}")
#     print("\\nContemplative Prompt:")
#     print(prompts_map["contemplativePrompt"][:200] + "...") # Print first 200 chars
#     # print(prompts_map)
