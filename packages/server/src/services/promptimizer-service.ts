// packages/server/src/services/promptimizer-service.ts
import { DEFAULT_MODEL_CONFIGS } from 'shared';
import { promptsMap } from '../utils/prompts-map';
// Import the refactored unified provider
import { unifiedProvider } from './model-providers/providers/unified-provider-service';
import { APIProviders } from 'shared'; // Import if needed

/**
 * Takes the user's original context/intent/prompt and uses a model
 * to generate a refined (optimized) version of that prompt.
 */
export async function optimizePrompt(userContext: string): Promise<string> {
    const systemMessage = `
<SystemPrompt>
You are the Promptimizer, a specialized assistant that refines or rewrites user queries into
more effective prompts. Given the user's context or goal, output ONLY the single optimized prompt.
No additional commentary, no extraneous text, no markdown formatting.
</SystemPrompt>

<Reasoning>
Follow the style guidelines and key requirements below:
${promptsMap.contemplativePrompt}
</Reasoning>
`; // Ensure promptsMap.contemplativePrompt is loaded

    const userMessage = userContext.trim();
    if (!userMessage) {
        return '';
    }

    try {
        // Get config for the prompt optimization task
        const cfg = DEFAULT_MODEL_CONFIGS['optimize-prompt']; // e.g., { provider: 'openai', model: 'gpt-4-turbo', temperature: 0.5 }
        const provider = cfg.provider as APIProviders || 'openai';
        const modelId = cfg.model;

        if (!modelId) {
            console.error("Model not configured for optimize-prompt task.");
            return userMessage; // Return original on config error
        }

        // Use generateSingleText for non-streaming prompt generation
        const optimizedPrompt = await unifiedProvider.generateSingleText({
            provider: provider,
            systemMessage: systemMessage,
            prompt: userMessage, // User context is the prompt here
            options: {
                model: modelId,
                // No explicit maxTokens needed here if we expect a relatively short prompt output?
                // Or set a reasonable limit like 2048 as before.
                maxTokens: 2048,
                temperature: cfg.temperature,
            }
        });

        return optimizedPrompt.trim();

    } catch (error) {
        console.error('[PromptimizerService] Failed to optimize prompt:', error);
        // Fallback to the original user message on error
        return userMessage;
    }
}