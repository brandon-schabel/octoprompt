import { useState, useRef, useCallback } from 'react'
import { useApi } from '../use-api';
import { RequestOptions } from '@/utils/api/api-interface';

type GeminiFileSearchOptions = {
    projectId: string;
    query?: string;
    audioFile?: File; 
}

type GeminiFileSearchStatus = 'idle' | 'connecting' | 'streaming' | 'error' | 'done';

type UseGeminiFileSearchReturn = {
    status: GeminiFileSearchStatus;
    result: string;
    error: string | null;
    search: (options: GeminiFileSearchOptions) => Promise<void>;
    reset: () => void;
};

/**
 * React hook to interface with the Gemini file search API. It can handle both text queries and audio queries.
 * 
 * Usage:
 * const { status, result, error, search, reset } = useGeminiFileSearch();
 * 
 * // To run a search:
 * await search({ projectId: 'your-project-id', query: 'search term' });
 * 
 * // If you want to handle audio:
 * await search({ projectId: 'your-project-id', audioFile: selectedAudioFile });
 */
export function useGeminiFileSearch(): UseGeminiFileSearchReturn {
    const [status, setStatus] = useState<GeminiFileSearchStatus>('idle');
    const [result, setResult] = useState('');
    const [error, setError] = useState<string | null>(null);
    const eventSourceRef = useRef<EventSource | null>(null);
    const { api } = useApi();

    const reset = useCallback(() => {
        setStatus('idle');
        setResult('');
        setError(null);
        eventSourceRef.current?.close();
        eventSourceRef.current = null;
    }, []);

    const search = useCallback(async (options: GeminiFileSearchOptions) => {
        reset();
        setStatus('connecting');
        setError(null);

        const { projectId, query, audioFile } = options;

        // We support two request modes:
        // 1. JSON body (if query is provided without audio)
        // 2. FormData (if audioFile is provided or user wants to use multipart form)
        let requestUrl = '/api/ai/gemini/file_search';
        let fetchInit: RequestOptions;

        if (audioFile) {
            // multipart/form-data approach
            const formData = new FormData();
            formData.append('projectId', projectId);
            if (query) formData.append('query', query);
            formData.append('audio', audioFile);

            fetchInit = {
                method: 'POST',
                body: formData
            };
        } else {
            // JSON approach
            const body = {
                projectId,
                query
            };
            fetchInit = {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: body
            };
        }

        // First, we do a fetch to get a response. The response will be a text/event-stream
        // We'll use EventSource logic. However, we must return an SSE connection.
        // The server route returns SSE with text content.
        // We can do a "hack": since we know it's SSE, we won't fetch directly. We'll open an EventSource.
        // But EventSource doesn't allow custom headers or POST by default. 
        // Our route expects POST. In that case, we must handle SSE by using `fetch` + ReadableStream or `fetchEventSource` from a library.
        // If we must use fetch, we can do so and manually read the stream.
        // We'll do a manual SSE read from `fetch` since POST is required.

        try {
            const response = await api.request(requestUrl, fetchInit);

            if (!response.ok || !response.body) {
                throw new Error(`Gemini file search request failed: ${response.statusText}`);
            }

            setStatus('streaming');

            const reader = response.body.getReader();
            const decoder = new TextDecoder();
            let buffer = '';

            while (true) {
                const { done, value } = await reader.read();
                if (done) break;

                const text = decoder.decode(value, { stream: true });
                buffer += text;

                // Since the endpoint returns chunks of text as they come, we just append them to the result
                // If there's any special delimiter or SSE format, we might need to parse it.
                // According to the code in server, it sends raw text chunks. We'll assume raw text chunks.
                // If the server sends SSE "data:" lines, parse them here:
                const lines = buffer.split('\n');
                buffer = lines.pop() || '';
                for (const line of lines) {
                    const trimmed = line.trim();
                    if (!trimmed) continue;
                    // If server sends "data: ..." lines, strip the prefix:
                    if (trimmed.startsWith('data:')) {
                        const dataText = trimmed.slice('data:'.length).trim();
                        if (dataText === '[DONE]') {
                            // End of stream
                            break;
                        } else {
                            setResult((prev) => prev + dataText);
                        }
                    } else {
                        // If no SSE prefix is provided and it's just raw text:
                        setResult((prev) => prev + trimmed + '\n');
                    }
                }
            }

            setStatus('done');
        } catch (err: any) {
            console.error('Gemini file search error:', err);
            setError(err instanceof Error ? err.message : 'Unknown error');
            setStatus('error');
        }
    }, [reset]);

    return {
        status,
        result,
        error,
        search,
        reset
    }
}