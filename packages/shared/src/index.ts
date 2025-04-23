// Add ApiError class for centralized error handling
export class ApiError extends Error {
    public readonly status: number;
    public readonly code?: string;
    public readonly details?: any;

    constructor(status: number, message: string, code?: string, details?: any) {
        super(message);
        this.status = status;
        this.code = code;
        this.details = details;
        // Maintains proper stack trace
        if (Error.captureStackTrace) {
            Error.captureStackTrace(this, ApiError);
        }
        // Set prototype for instanceof checks
        Object.setPrototypeOf(this, ApiError.prototype);
    }
} 