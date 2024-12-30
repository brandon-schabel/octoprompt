import { UnifiedProviderService } from '@/services/model-providers/providers/unified-provider-service';
import { ApiError } from 'shared';

import { router } from "server-router";

const unifiedProviderService = new UnifiedProviderService();

router.post('/api/ai/whisper-translate-stream', {}, async (req) => {
    if (!req.headers.get('content-type')?.includes('multipart/form-data')) {
        throw new ApiError("Content-Type must be multipart/form-data", 400, "BAD_REQUEST");
    }

    const formData = await req.formData();
    const file = formData.get('audio');
    if (!(file instanceof File)) {
        throw new ApiError("audio file is required", 400, "BAD_REQUEST");
    }
    const prompt = formData.get('prompt') ? String(formData.get('prompt')) : undefined;
    const translation = await unifiedProviderService.translateAudioFile(file, prompt);

    return new Response(JSON.stringify({ text: translation }), {
        headers: { 'Content-Type': 'application/json' }
    });
});

router.post('/api/ai/whisper-stream', {}, async (req) => {
    if (!req.headers.get('content-type')?.includes('multipart/form-data')) {
        throw new ApiError("Content-Type must be multipart/form-data", 400, "BAD_REQUEST");
    }

    const formData = await req.formData();
    const file = formData.get('audio');
    if (!(file instanceof File)) {
        throw new ApiError("audio file is required", 400, "BAD_REQUEST");
    }
    const prompt = formData.get('prompt') ? String(formData.get('prompt')) : undefined;
    const transcription = await unifiedProviderService.transcribeAudioFile(file, prompt);

    return new Response(JSON.stringify({ text: transcription }), {
        headers: { 'Content-Type': 'application/json' }
    });
});