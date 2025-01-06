// packages/server/src/routes/prompt-routes.ts

import { router } from 'server-router';
import { PromptimizerService } from '@/services/promptimizer-service';
import { json } from '@bnk/router';
import { z } from 'zod';

const promptimizerService = new PromptimizerService();

router.post('/api/prompt/optimize', {
    validation: {
        // Example: user must provide a "userContext" string
        body: z.object({
            userContext: z.string().min(1),
        }),
    },
}, async (_, { body }) => {
    const { userContext } = body;
    try {
        const optimized = await promptimizerService.optimizePrompt(userContext);
        return json({ success: true, optimizedPrompt: optimized });
    } catch (error) {
        console.error('Prompt optimize route error:', error);
        return json({ success: false, error: 'Failed to optimize prompt' }, { status: 500 });
    }
});