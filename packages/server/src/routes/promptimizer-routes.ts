import app from '@/server-router';
import { zValidator } from '@hono/zod-validator';
import { z } from 'zod';
import { optimizePrompt } from '@/services/promptimizer-service';

app.post('/api/prompt/optimize',
    zValidator('json', z.object({
        userContext: z.string().min(1),
    })),
    async (c) => {
        const { userContext } = await c.req.valid('json');
        try {
            const optimized = await optimizePrompt(userContext);
            return c.json({ success: true, optimizedPrompt: optimized });
        } catch (error) {
            console.error('Prompt optimize route error:', error);
            return c.json({ success: false, error: 'Failed to optimize prompt' }, 500);
        }
    }
);