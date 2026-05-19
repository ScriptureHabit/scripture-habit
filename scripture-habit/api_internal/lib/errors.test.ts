import { describe, it, expect } from 'vitest';
import { 
    AppError, 
    ValidationError, 
    AuthenticationError, 
    ForbiddenError, 
    NotFoundError, 
    ConflictError 
} from './errors';

describe('errors - custom AppError classes', () => {
    describe('AppError', () => {
        it('should correctly capture message, statusCode, and errorCode', () => {
            const err = new AppError('Something went wrong', 503, 'SERVICE_UNAVAILABLE');
            expect(err.message).toBe('Something went wrong');
            expect(err.statusCode).toBe(503);
            expect(err.errorCode).toBe('SERVICE_UNAVAILABLE');
            expect(err.name).toBe('AppError');
            expect(err.stack).toBeDefined();
        });

        it('should default statusCode to 500 and errorCode to undefined', () => {
            const err = new AppError('Default error');
            expect(err.statusCode).toBe(500);
            expect(err.errorCode).toBeUndefined();
        });
    });

    describe('ValidationError', () => {
        it('should default to status code 400 and code VALIDATION_ERROR', () => {
            const err = new ValidationError('Invalid name');
            expect(err.statusCode).toBe(400);
            expect(err.errorCode).toBe('VALIDATION_ERROR');
            expect(err.message).toBe('Invalid name');
            expect(err.name).toBe('ValidationError');
        });
    });

    describe('AuthenticationError', () => {
        it('should default to status code 401 and code UNAUTHENTICATED', () => {
            const err = new AuthenticationError();
            expect(err.statusCode).toBe(401);
            expect(err.errorCode).toBe('UNAUTHENTICATED');
            expect(err.message).toBe('Authentication required');
            expect(err.name).toBe('AuthenticationError');
        });
    });

    describe('ForbiddenError', () => {
        it('should default to status code 403 and code FORBIDDEN', () => {
            const err = new ForbiddenError();
            expect(err.statusCode).toBe(403);
            expect(err.errorCode).toBe('FORBIDDEN');
            expect(err.message).toBe('Access denied');
            expect(err.name).toBe('ForbiddenError');
        });
    });

    describe('NotFoundError', () => {
        it('should default to status code 404 and code NOT_FOUND', () => {
            const err = new NotFoundError();
            expect(err.statusCode).toBe(404);
            expect(err.errorCode).toBe('NOT_FOUND');
            expect(err.message).toBe('Resource not found');
            expect(err.name).toBe('NotFoundError');
        });
    });

    describe('ConflictError', () => {
        it('should default to status code 409 and code CONFLICT', () => {
            const err = new ConflictError('User already exists');
            expect(err.statusCode).toBe(409);
            expect(err.errorCode).toBe('CONFLICT');
            expect(err.message).toBe('User already exists');
            expect(err.name).toBe('ConflictError');
        });
    });
});
