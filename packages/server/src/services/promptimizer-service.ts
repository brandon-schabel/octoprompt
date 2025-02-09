import { DEFAULT_MODEL_CONFIGS } from 'shared';
import { promptsMap } from '../utils/prompts-map';
import { openRouterProvider } from './model-providers/providers/open-router-provider';


/**
 * Takes the user's original context/intent/prompt and uses a model
 * to generate a refined (optimized) version of that prompt.
 */
export async function optimizePrompt(userContext: string): Promise<string> {
    const systemMessage = `
<SystemPrompt>
You are the Promptimizer, a specialized assistant that refines or rewrites user queries into 
more effective prompts. Given the user's context or goal, output a single optimized prompt. 
No additional commentary, no extraneous text. 
</SystemPrompt>


<Reasoning>
Follow the style guidelines and key requirements below:
${promptsMap.contemplativePrompt}
</Reasoning>
`;

    const userMessage = userContext.trim();
    if (!userMessage) {
        return '';
    }

    try {
        const cfg = DEFAULT_MODEL_CONFIGS['optimize-prompt'];
        const stream = await openRouterProvider.processMessage({
            chatId: 'promptimizer-chat',
            userMessage,
            provider: 'openrouter',
            options: {
                model: cfg.model,
                max_tokens: 2048,
                temperature: cfg.temperature,
            },
            systemMessage,
        });

        const reader = stream.getReader();
        const decoder = new TextDecoder();
        let optimizedPrompt = '';

        while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            optimizedPrompt += decoder.decode(value);
        }

        return optimizedPrompt.trim();
    } catch (error) {
        console.error('[PromptimizerService] Failed to optimize prompt:', error);
        return userMessage;
    }
}