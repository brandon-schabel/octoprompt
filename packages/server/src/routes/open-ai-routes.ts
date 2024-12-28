import { UnifiedProviderService } from '@/services/model-providers/providers/unified-provider-service';
import { json } from '@bnk/router';
import { router } from "server-router";

// const chatAIService = new UnifiedChatProviderService();
const unifiedProviderService = new UnifiedProviderService();


router.post('/api/ai/whisper-translate-stream', {}, async (req) => {
    try {
        if (!req.headers.get('content-type')?.includes('multipart/form-data')) {
            return json.error('Content-Type must be multipart/form-data', 400);
        }
        const formData = await req.formData();
        const file = formData.get('audio');
        if (!(file instanceof File)) {
            return json.error('audio file is required', 400);
        }
        const prompt = formData.get('prompt') ? String(formData.get('prompt')) : undefined;
        const translation = await unifiedProviderService.translateAudioFile(file, prompt);

        return new Response(JSON.stringify({ text: translation }), {
            headers: { 'Content-Type': 'application/json' }
        });
    } catch (error) {
        console.error('Whisper translation streaming error:', error);
        return json.error('Failed to process whisper translation', 500);
    }
});


// ---------------------------------------- //
//         AUDIO (WHISPER) ROUTES
// ---------------------------------------- //

// Whisper streaming endpoint
router.post('/api/ai/whisper-stream', {}, async (req) => {
    try {
        if (!req.headers.get('content-type')?.includes('multipart/form-data')) {
            return json.error('Content-Type must be multipart/form-data', 400);
        }
        const formData = await req.formData();
        const file = formData.get('audio');
        if (!(file instanceof File)) {
            return json.error('audio file is required', 400);
        }
        const prompt = formData.get('prompt') ? String(formData.get('prompt')) : undefined;
        /**
         * Transcription is done via chatAIService -> providerService -> OpenAI Whisper
         */
        const transcription = await unifiedProviderService.transcribeAudioFile(file, prompt);

        return new Response(JSON.stringify({ text: transcription }), {
            headers: { 'Content-Type': 'application/json' }
        });
    } catch (error) {
        console.error('Whisper streaming error:', error);
        return json.error('Failed to process whisper streaming', 500);
    }
});

