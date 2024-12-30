import { UnifiedProviderService } from '@/services/model-providers/providers/unified-provider-service';
import { json } from '@bnk/router';
import { ApiError } from 'shared';
import { router } from "server-router";

import { files, projects, eq } from "shared";
import { db } from "shared/database";

const unifiedProviderService = new UnifiedProviderService();
const AI_BASE_PATH = '/api/ai';

router.post("/api/ai/gemini/file_search", {}, async (req) => {
    const contentType = req.headers.get('content-type') || '';
    let query: string | undefined;
    let projectId: string;

    if (contentType.includes('multipart/form-data')) {
        const formData = await req.formData();
        projectId = String(formData.get('projectId') || '');
        const providedQuery = formData.get('query');
        query = providedQuery ? String(providedQuery) : undefined;

        const audioFile = formData.get('audio');
        if (!query && audioFile instanceof File) {
            query = await unifiedProviderService.transcribeAudioFile(audioFile);
        }
    } else {
        const body = await req.json();
        projectId = body.projectId;
        query = body.query;
    }

    if (!projectId) {
        throw new ApiError("Project ID is required", 400, "BAD_REQUEST");
    }
    if (!query) {
        throw new ApiError("No query provided", 400, "BAD_REQUEST");
    }

    const [project] = await db.select().from(projects).where(eq(projects.id, projectId)).limit(1);
    if (!project) {
        throw new ApiError("Project not found", 404, "NOT_FOUND");
    }

    const projectFiles = await db.select().from(files).where(eq(files.projectId, projectId));
    const relevantFiles = projectFiles
        .filter(f => f.content?.toLowerCase().includes(query.toLowerCase()))
        .slice(0, 5);

    const contents = [
        {
            role: "system",
            parts: [{
                text: "You are an AI assistant that helps users find relevant information in their codebase."
            }]
        },
        {
            role: "user",
            parts: [{
                text: `The user asks: ${query}\nBased on the project files provided, please suggest relevant code snippets.`
            }]
        }
    ];

    for (const file of relevantFiles) {
        contents.push({
            role: "system",
            parts: [{
                text: `File: ${file.name}\nPath: ${file.path}\n\n${file.content?.slice(0, 5000)}`
            }]
        });
    }

    const apiKey = await (unifiedProviderService as any).getGeminiApiKey();
    const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:streamGenerateContent?alt=sse&key=${apiKey}`;

    const payload = {
        contents,
        generationConfig: {
            temperature: 0.7,
            maxOutputTokens: 1024,
            topP: 0.95,
            topK: 40,
        }
    };

    const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
    });

    if (!response.ok || !response.body) {
        throw new ApiError(`Gemini API error: ${response.statusText}`, 500, "GEMINI_API_ERROR");
    }

    const reader = response.body.getReader();
    const encoder = new TextEncoder();
    const sseHeaders = {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive'
    };

    const stream = new ReadableStream({
        async start(controller) {
            const decoder = new TextDecoder();
            let buffer = '';
            try {
                while (true) {
                    const { done, value } = await reader.read();
                    if (done) break;

                    const text = decoder.decode(value, { stream: true });
                    buffer += text;

                    const lines = buffer.split('\n');
                    buffer = lines.pop() || '';

                    for (const line of lines) {
                        const trimmed = line.trim();
                        if (!trimmed || trimmed.startsWith(':')) {
                            continue;
                        }

                        if (trimmed.startsWith('data:')) {
                            const jsonString = trimmed.replace(/^data:\s*/, '');
                            if (jsonString === '[DONE]') {
                                controller.close();
                                return;
                            }

                            try {
                                const parsed = JSON.parse(jsonString);
                                if (parsed.candidates && parsed.candidates[0]?.content?.parts) {
                                    const chunkText = parsed.candidates[0].content.parts
                                        .map((p: any) => p.text)
                                        .join('');
                                    if (chunkText) {
                                        controller.enqueue(encoder.encode(chunkText));
                                    }
                                }
                            } catch (e) {
                                console.error("Error parsing Gemini SSE JSON:", e);
                            }
                        }
                    }
                }
                controller.close();
            } catch (error) {
                console.error("Error in Gemini file search stream:", error);
                controller.error(error);
            }
        }
    });

    return new Response(stream, { headers: sseHeaders });
});

router.post(`${AI_BASE_PATH}/gemini/upload`, {}, async (req) => {
    if (!req.headers.get('content-type')?.includes('multipart/form-data')) {
        throw new ApiError("Content-Type must be multipart/form-data", 400, "BAD_REQUEST");
    }

    const formData = await req.formData();
    const file = formData.get('file');
    const mime_type = formData.get('mime_type')?.toString() || 'application/octet-stream';

    if (!(file instanceof File)) {
        throw new ApiError("file is required", 400, "BAD_REQUEST");
    }

    const fileUri = await unifiedProviderService.uploadFileForGemini(file, mime_type);
    return json({ file_uri: fileUri });
});