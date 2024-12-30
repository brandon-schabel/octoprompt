import { ApiError } from 'shared';

export type AuthMode = 'cookie' | 'bearer';

export type APIInterfaceConfig = {
    baseUrl: string;
    authMode?: AuthMode;
};

export type RequestOptions = {
    method?: 'GET' | 'POST' | 'PATCH' | 'DELETE' | 'PUT';
    body?: object | string | Array<any> | FormData;
    headers?: Record<string, string>;
};

export class APIInterface {
    private baseUrl: string;

    constructor(config: APIInterfaceConfig | string) {
        if (typeof config === 'string') {
            this.baseUrl = config;
        } else {
            this.baseUrl = config.baseUrl;
        }

        this.baseUrl = this.baseUrl.replace(/\/$/, '');
    }

    async request(endpoint: string, options: RequestOptions = {}): Promise<Response> {
        const { method = 'GET', body, headers: customHeaders = {} } = options;
        const normalizedEndpoint = endpoint.startsWith('/') ? endpoint : `/${endpoint}`;
        const url = `${this.baseUrl}${normalizedEndpoint}`;

        // Always JSON unless FormData
        const headers: Record<string, string> = {
            ...(!(body instanceof FormData) && { 'Content-Type': 'application/json' }),
            ...customHeaders
        };

        const requestOptions: RequestInit = {
            method,
            headers,
            body: body instanceof FormData ? body : (body && JSON.stringify(body)),
        };

        const response = await fetch(url, requestOptions);

        if (!response.ok) {
            // Attempt to parse our BNK ErrorHandlingPlugin JSON shape
            let data: any;
            try {
                data = await response.json();
            } catch {
                // Fallback if JSON parse fails
                data = {
                    error: {
                        message: await response.text() || 'Unknown error',
                    }
                };
            }

            // The plugin typically returns { error: { message, code, status, details? } }
            const errorObj = data?.error || {};
            const message = errorObj.message || response.statusText || 'Unknown error';
            const code = errorObj.code || 'UNKNOWN_ERROR';
            const status = errorObj.status || response.status;
            const details = errorObj.details || null;

            // Throw a shared ApiError that React Query can catch
            throw new ApiError(message, status, code, details);
        }

        // Return the raw response (caller can .json() it if needed)
        return response;
    }

    async isAuthenticated(): Promise<boolean> {
        try {
            const response = await this.request('/api/auth/verify');
            return response.ok;
        } catch (error) {
            console.error('Authentication check failed:', error);
            return false;
        }
    }
}