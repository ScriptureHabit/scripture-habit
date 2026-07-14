import { Response } from 'express';
import { ApiErrorCode } from '../../src/types/errors.js';

export class AppError extends Error {
    public readonly statusCode: number;
    public readonly errorCode?: ApiErrorCode;

    constructor(message: string, statusCode: number = 500, errorCode?: ApiErrorCode) {
        super(message);
        this.statusCode = statusCode;
        this.errorCode = errorCode;
        this.name = this.constructor.name;
        Error.captureStackTrace(this, this.constructor);
    }
}

export class ValidationError extends AppError {
    constructor(message: string, errorCode: ApiErrorCode = 'VALIDATION_ERROR') {
        super(message, 400, errorCode);
    }
}

export class AuthenticationError extends AppError {
    constructor(message: string = 'Authentication required', errorCode: ApiErrorCode = 'UNAUTHENTICATED') {
        super(message, 401, errorCode);
    }
}

export class ForbiddenError extends AppError {
    constructor(message: string = 'Access denied', errorCode: ApiErrorCode = 'FORBIDDEN') {
        super(message, 403, errorCode);
    }
}

export class NotFoundError extends AppError {
    constructor(message: string = 'Resource not found', errorCode: ApiErrorCode = 'NOT_FOUND') {
        super(message, 404, errorCode);
    }
}

export class ConflictError extends AppError {
    constructor(message: string, errorCode: ApiErrorCode = 'CONFLICT') {
        super(message, 409, errorCode);
    }
}

export function sendErrorResponse(res: Response, err: unknown, fallbackMessage = 'Operation failed') {
    if (err instanceof AppError) {
        return res.status(err.statusCode).json({ error: err.message, code: err.errorCode });
    }
    const message = err instanceof Error ? err.message : fallbackMessage;
    return res.status(500).json({ error: message, code: 'INTERNAL_SERVER_ERROR' });
}
