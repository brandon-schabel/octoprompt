import { DEFAULT_MODEL_CONFIGS } from 'shared';
import { promptsMap } from '../utils/prompts-map';
import { UnifiedProviderService } from './model-providers/providers/unified-provider-service';

export class PromptimizerService {
    private unifiedProviderService: UnifiedProviderService;

    constructor() {
        this.unifiedProviderService = new UnifiedProviderService();
    }

    /**
     * Takes the user's original context/intent/prompt and uses a model
     * to generate a refined (optimized) version of that prompt. This
     * example calls the `qwen/qwen-plus` model by default.
     */
    public async optimizePrompt(userContext: string): Promise<string> {
        // You might want to craft a special system prompt to instruct
        // the model on how to rework or improve the user prompt.
        const systemPrompt = `
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

        // The userMessage in this case is just the user's raw context or instructions:
        const userMessage = userContext.trim();

        // Return early if there's nothing to optimize
        if (!userMessage) {
            return '';
        }

        try {
            const cfg = DEFAULT_MODEL_CONFIGS['optimize-prompt']
            // Call the providerChatService to process the message
            const stream = await this.unifiedProviderService.processMessage({
                chatId: 'promptimizer-chat',
                userMessage,
                provider: 'openrouter', // or whichever default you prefer
                options: {
                    model: cfg.model,
                    max_tokens: 2048,
                    temperature: cfg.temperature,
                },
                systemMessage: systemPrompt,
            });

            // Accumulate the streamed text
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
            // Return the original user prompt as a fallback
            return userMessage;
        }
    }
}