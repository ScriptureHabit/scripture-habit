export class AppError extends Error {
    public readonly statusCode: number;
    public readonly errorCode?: string;

    constructor(message: string, statusCode: number = 500, errorCode?: string) {
        super(message);
        this.statusCode = statusCode;
        this.errorCode = errorCode;
        this.name = this.constructor.name;
        Error.captureStackTrace(this, this.constructor);
    }
}

export class ValidationError extends AppError {
    constructor(message: string, errorCode: string = 'VALIDATION_ERROR') {
        super(message, 400, errorCode);
    }
}

export class AuthenticationError extends AppError {
    constructor(message: string = 'Authentication required', errorCode: string = 'UNAUTHENTICATED') {
        super(message, 401, errorCode);
    }
}

export class ForbiddenError extends AppError {
    constructor(message: string = 'Access denied', errorCode: string = 'FORBIDDEN') {
        super(message, 403, errorCode);
    }
}

export class NotFoundError extends AppError {
    constructor(message: string = 'Resource not found', errorCode: string = 'NOT_FOUND') {
        super(message, 404, errorCode);
    }
}

export class ConflictError extends AppError {
    constructor(message: string, errorCode: string = 'CONFLICT') {
        super(message, 409, errorCode);
    }
}
