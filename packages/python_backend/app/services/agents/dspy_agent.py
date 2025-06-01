import asyncio
import dspy
from app.utils.octoprompt_client import OctoPromptClient, OctoPromptError

async def main():
    try:
        async with OctoPromptClient() as client:
            # Retrieve all keys
            keys = await client.keys.list_keys()
            
            # Find first OpenRouter key
            openrouter_keys = [key for key in keys if key.provider == "openrouter"]
            print(f"Found {len(openrouter_keys)} OpenRouter keys.")
            if not openrouter_keys:
                raise ValueError("No OpenRouter API keys found. Please add one in OctoPrompt UI.")
                
            api_key = openrouter_keys[0].key
            print(f"Using OpenRouter API key: {api_key[:4]}...{api_key[-4:]}")
            
            # Configure DSPy
            openrouter_lm = dspy.LM(
                "openrouter/google/gemini-2.5-flash-preview",
                api_key=api_key,
                api_base="https://openrouter.ai/api/v1"
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
            
    except OctoPromptError as e:
        print(f"API Error: {e}")
    except ValueError as e:
        print(f"Configuration Error: {e}")
    except Exception as e:
        print(f"Unexpected error: {e}")

if __name__ == "__main__":
    asyncio.run(main())
