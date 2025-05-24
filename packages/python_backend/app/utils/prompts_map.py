import os
from pathlib import Path

IS_PROD_ENV = os.getenv("APP_ENV") == "production"
PROMPTS_DIR_DEV = Path(__file__).resolve().parent.parent.parent.parent / "prompts"
PROMPTS_DIR_PROD = Path("./prompts")
PROMPTS_DIR = PROMPTS_DIR_PROD if IS_PROD_ENV else PROMPTS_DIR_DEV

def read_prompt_file(filename: str) -> str:
    file_path = PROMPTS_DIR / filename
    try:
        with open(file_path, "r", encoding="utf-8") as f:
            return f.read()
    except (FileNotFoundError, Exception):
        return ""

contemplative_prompt = read_prompt_file("contemplative-prompt.md")
summarization_steps = read_prompt_file("summarization-prompt.md")
octoprompt_planning_meta_prompt = read_prompt_file("octoprompt-planning-meta-prompt.md")

prompts_map = {
    "contemplativePrompt": contemplative_prompt,
    "summarizationSteps": summarization_steps,
    "octopromptPlanningMetaPrompt": octoprompt_planning_meta_prompt,
}