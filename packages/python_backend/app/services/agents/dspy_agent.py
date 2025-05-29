import os
import dspy

openrouter_lm = dspy.LM(
    "openrouter/google/gemini-2.5-flash-preview",                        # prefix model name with "openai/"
    # "openrouter/anthropic/claude-sonnet-4",
    api_key="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",
    api_base="https://openrouter.ai/api/v1" # OpenRouter endpoint
)


# Optional: attribution for leaderboards
openrouter_lm.extra_headers = {
    "HTTP-Referer": "https://octoprompt.com ",
    "X-Title": "OctoPrompt"
}

# Configure DSPy to use the OpenRouter LM
dspy.configure(lm=openrouter_lm)

# Example usage with a simple DSPy module
class BasicQA(dspy.Signature):
    """Answer questions with short fact-based answers."""
    question = dspy.InputField()
    answer = dspy.OutputField(desc="Often a single word or phrase.")

# Define a simple predictor
generate_answer = dspy.Predict(BasicQA)

# Run the predictor
pred = generate_answer(question="What is the capital of France?")

print(pred.answer)
