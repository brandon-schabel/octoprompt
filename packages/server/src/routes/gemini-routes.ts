import { json } from '@bnk/router';
import { router } from "server-router";

import { files, projects, eq } from "shared";
import { db } from "shared/database";
import { UnifiedChatProviderService } from '@/services/ai-providers/unified-chat-provider-service';

const chatAIService = new UnifiedChatProviderService();

const AI_BASE_PATH = '/api/ai';

// ---------------------------------------- //
//   FILE-BASED SEARCH (Gemini SSE usage)
// ---------------------------------------- //
router.post("/api/ai/gemini/file_search", {}, async (req) => {
    try {
        const contentType = req.headers.get('content-type') || '';
        let query: string | undefined;
        let projectId: string;

        // Parse request
        if (contentType.includes('multipart/form-data')) {
            const formData = await req.formData();
            projectId = String(formData.get('projectId') || '');
            const providedQuery = formData.get('query');
            query = providedQuery ? String(providedQuery) : undefined;

            const audioFile = formData.get('audio');
            if (!query && audioFile instanceof File) {
                /**
                 * We can call chatAIService.provider.transcribeAudioFile 
                 * to get text from an audio file.
                 */
                query = await chatAIService.provider.transcribeAudioFile(audioFile);
            }
        } else {
            const body = await req.json();
            projectId = body.projectId;
            query = body.query;
        }

        if (!projectId) {
            return json.error("Project ID is required", 400);
        }
        if (!query) {
            return json.error("No query provided", 400);
        }

        // Check project
        const [project] = await db.select().from(projects).where(eq(projects.id, projectId)).limit(1);
        if (!project) {
            return json.error("Project not found", 404);
        }

        // Fetch project files
        const projectFiles = await db.select().from(files).where(eq(files.projectId, projectId));
        // Simple filter example
        const relevantFiles = projectFiles
            .filter(f => f.content?.toLowerCase().includes(query.toLowerCase()))
            .slice(0, 5);

        // Prepare ephemeral content for Gemini
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

        // We'll do a direct fetch to Gemini’s SSE endpoint
        // using the internal method to retrieve the Gemini API key:
        // e.g. chatAIService.provider.getGeminiApiKey (you might expose it publicly or keep it private)
        const apiKey = await (chatAIService.provider as any).getGeminiApiKey();
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
            throw new Error(`Gemini API error: ${response.statusText}`);
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

    } catch (error) {
        console.error("Error in file search:", error);
        return json.error(error instanceof Error ? error.message : 'Unknown error', 500);
    }
});

// ---------------------------------------- //
//       GEMINI-SPECIFIC FILE UPLOAD
// ---------------------------------------- //
router.post(`${AI_BASE_PATH}/gemini/upload`, {}, async (req) => {
    try {
        if (!req.headers.get('content-type')?.includes('multipart/form-data')) {
            return json.error('Content-Type must be multipart/form-data', 400);
        }

        const formData = await req.formData();
        const file = formData.get('file');
        const mime_type = formData.get('mime_type')?.toString() || 'application/octet-stream';

        if (!(file instanceof File)) {
            return json.error('file is required', 400);
        }

        /** 
         * The uploadFileForGemini call is now in provider service, 
         * either accessed directly or via a pass-through in chatAIService.
         */
        const fileUri = await chatAIService.provider.uploadFileForGemini(file, mime_type);
        return json({ file_uri: fileUri });
    } catch (error) {
        console.error('Gemini file upload error:', error);
        return json.error('Failed to upload file for Gemini', 500);
    }
});
