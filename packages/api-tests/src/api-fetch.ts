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

    const data = await response.json();

    // Check for API error responses
    // @ts-ignore
    if (!response.ok || (data && data.success === false)) {
        const errorInfo = {
            url: endpoint.url,
            method: endpoint.options?.method || 'GET',
            status: response.status,
            response: data,
            body: body
        };
        console.error('API request failed:', errorInfo);

        // If we have a schema, let Zod validation handle it
        // This will provide detailed validation errors
        if (schema) {
            return schema.parse(data);
        }

        // Otherwise throw a descriptive error
        throw new Error(`API request failed: ${response.status} - ${JSON.stringify(data)}`);
    }

    if (schema) {
        return schema.parse(data);
    }
    return data as Res;
}