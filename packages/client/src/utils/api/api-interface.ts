export type AuthMode = 'cookie' | 'bearer';

export type APIInterfaceConfig = {
    baseUrl: string;
    authMode?: AuthMode;
}

export type RequestOptions = {
    method?: 'GET' | 'POST' | 'PATCH' | 'DELETE' | 'PUT';
    body?: object | string | Array<any> | FormData;
    headers?: Record<string, string>;
}

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

        const headers: Record<string, string> = {
            ...(!(body instanceof FormData) && { 'Content-Type': 'application/json' }),
            ...customHeaders
        };

        const requestOptions: RequestInit = {
            method,
            headers,
            body: body instanceof FormData ? body : (body && JSON.stringify(body))
        };

        const response = await fetch(url, requestOptions);
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