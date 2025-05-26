export interface Endpoint<Req, Res> {
    url: string;
    options?: {
        method?: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH';
        headers?: Record<string, string>;
    };
    // Schemas for request and response can be added here if needed
    // reqSchema?: ZodSchema<Req>;
    // resSchema?: ZodSchema<Res>;
}
