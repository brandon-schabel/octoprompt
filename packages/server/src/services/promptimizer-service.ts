import { ProviderChatService } from './model-providers/chat/provider-chat-service';

import { promptsMap } from '../prompts/prompts-map';



export class PromptimizerService {
    private providerChatService: ProviderChatService;

    constructor() {
        this.providerChatService = new ProviderChatService();
    }

    /**
     * Takes the user's original context/intent/prompt and uses a model
     * to generate a refined (optimized) version of that prompt. This
     * example calls the `deepseek/deepseek-chat` model by default.
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
            // Call the providerChatService to process the message
            const stream = await this.providerChatService.processMessage({
                chatId: 'promptimizer-chat',
                userMessage,
                provider: 'openrouter', // or whichever default you prefer
                options: {
                    model: 'deepseek/deepseek-chat',
                    max_tokens: 512,
                    temperature: 0.2,
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