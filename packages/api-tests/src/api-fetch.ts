import { z } from 'zod';
import type { Endpoint } from './types/endpoint';

export async function apiFetch<Req, Res>(
    endpoint: Endpoint<Req, Res>,
    body?: Req,
    schema?: z.ZodType<Res>
): Promise<Res> {
    const response = await fetch(endpoint.url, {
        method: endpoint.options?.method,
        headers: {
            'Content-Type': 'application/json',
            ...endpoint.options?.headers,
        },
        body: body ? JSON.stringify(body) : undefined,
    });

    // Read response text first to avoid body consumption issues
    const responseText = await response.text();

    let data;
    try {
        data = JSON.parse(responseText);
    } catch (error) {
        console.error('Failed to parse JSON response. Raw response text:', responseText);
        const errorInfo = {
            url: endpoint.url,
            method: endpoint.options?.method || 'GET',
            status: response.status,
            responseText: responseText,
            body: body
        };
        console.error('API request failed (JSON parsing error):', errorInfo);
        throw new Error(`API request failed: ${response.status} - Failed to parse JSON. Response text: ${responseText}`);
    }

    // Check for API error responses
    if (!response.ok || (data && data.success === false)) {
        const errorInfo = {
            url: endpoint.url,
            method: endpoint.options?.method || 'GET',
            status: response.status,
            response: data,
            body: body
        };
        console.error('API request failed:', errorInfo);

        // For error responses, don't try to validate against success schema
        // Just throw an error with the response data
        throw new Error(`API request failed: ${response.status} - ${JSON.stringify(data)}`);
    }

    if (schema) {
        return schema.parse(data);
    }
    return data as Res;
}