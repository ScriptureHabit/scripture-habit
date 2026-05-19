import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';
import crypto from 'crypto';

// Setup mock implementations
const mockVerifyIdToken = vi.fn();
const mockVerifyToken = vi.fn();

vi.mock('./firebase-admin.js', () => {
    return {
        auth: {
            verifyIdToken: (...args: any[]) => mockVerifyIdToken(...args)
        },
        appCheck: {
            verifyToken: (...args: any[]) => mockVerifyToken(...args)
        },
        db: null,
        admin: null
    };
});

import { authenticate, verifyAppCheck, requireEmailVerified, aiLimiterKeyGenerator } from './middleware';
import { AppError } from './errors';
import { Request, Response } from 'express';

describe('middleware - express middlewares', () => {
    let req: any;
    let res: any;
    let next: any;

    beforeEach(() => {
        vi.restoreAllMocks();
        req = {
            header: vi.fn(),
            ip: '127.0.0.1',
            headers: {},
            socket: {}
        };
        res = {
            status: vi.fn().mockReturnThis(),
            json: vi.fn().mockReturnThis()
        };
        next = vi.fn();
    });

    describe('aiLimiter keyGenerator', () => {
        it('should generate key based on Authorization header if present', () => {
            req.header.mockReturnValue('Bearer test-token');
            const expectedHash = crypto.createHash('sha256').update('Bearer test-token').digest('hex');
            const key = aiLimiterKeyGenerator(req as Request);
            expect(key).toBe(expectedHash);
        });

        it('should fallback to req.ip', () => {
            req.header.mockReturnValue(null);
            req.ip = '10.0.0.1';
            const expectedHash = crypto.createHash('sha256').update('10.0.0.1').digest('hex');
            const key = aiLimiterKeyGenerator(req as Request);
            expect(key).toBe(expectedHash);
        });

        it('should fallback to x-forwarded-for header', () => {
            req.header.mockReturnValue(null);
            req.ip = undefined;
            req.headers['x-forwarded-for'] = '192.168.1.1';
            const expectedHash = crypto.createHash('sha256').update('192.168.1.1').digest('hex');
            const key = aiLimiterKeyGenerator(req as Request);
            expect(key).toBe(expectedHash);
        });

        it('should fallback to socket.remoteAddress', () => {
            req.header.mockReturnValue(null);
            req.ip = undefined;
            req.socket.remoteAddress = '172.16.0.1';
            const expectedHash = crypto.createHash('sha256').update('172.16.0.1').digest('hex');
            const key = aiLimiterKeyGenerator(req as Request);
            expect(key).toBe(expectedHash);
        });

        it('should fallback to unknown when all fields are missing', () => {
            req.header.mockReturnValue(null);
            req.ip = undefined;
            req.socket.remoteAddress = undefined;
            const expectedHash = crypto.createHash('sha256').update('unknown').digest('hex');
            const key = aiLimiterKeyGenerator(req as Request);
            expect(key).toBe(expectedHash);
        });
    });

    describe('verifyAppCheck', () => {
        const originalEnv = process.env;

        beforeEach(() => {
            process.env = { ...originalEnv };
        });

        afterEach(() => {
            process.env = originalEnv;
        });

        it('should skip verification in dev if SKIP_APP_CHECK is true', async () => {
            process.env.NODE_ENV = 'development';
            process.env.SKIP_APP_CHECK = 'true';
            await verifyAppCheck(req as Request, res as Response, next);
            expect(next).toHaveBeenCalledWith();
        });

        it('should block and return 401 in production even if SKIP_APP_CHECK is true', async () => {
            process.env.NODE_ENV = 'production';
            process.env.SKIP_APP_CHECK = 'true';
            await verifyAppCheck(req as Request, res as Response, next);
            expect(res.status).toHaveBeenCalledWith(401);
            expect(res.json).toHaveBeenCalledWith({ error: 'Unauthorized: Security check required' });
        });

        it('should throw AppError if X-Firebase-AppCheck header is missing', async () => {
            process.env.SKIP_APP_CHECK = 'false';
            req.header.mockReturnValue(null);
            await verifyAppCheck(req as Request, res as Response, next);
            expect(next).toHaveBeenCalledWith(expect.any(AppError));
            const error = next.mock.calls[0][0];
            expect(error.statusCode).toBe(401);
            expect(error.errorCode).toBe('APP_CHECK_MISSING');
        });

        it('should call next() if token is successfully verified', async () => {
            process.env.SKIP_APP_CHECK = 'false';
            req.header.mockReturnValue('valid-app-check-token');
            mockVerifyToken.mockResolvedValue({});
            
            await verifyAppCheck(req as Request, res as Response, next);
            expect(mockVerifyToken).toHaveBeenCalledWith('valid-app-check-token');
            expect(next).toHaveBeenCalledWith();
        });

        it('should call next(AppError) with 503 if verification service throws unavailable', async () => {
            process.env.SKIP_APP_CHECK = 'false';
            req.header.mockReturnValue('token');
            mockVerifyToken.mockRejectedValue(new Error('service is unavailable right now'));
            
            await verifyAppCheck(req as Request, res as Response, next);
            expect(next).toHaveBeenCalledWith(expect.any(AppError));
            const error = next.mock.calls[0][0];
            expect(error.statusCode).toBe(503);
            expect(error.errorCode).toBe('APP_CHECK_FAILED');
        });

        it('should call next(AppError) with 401 on standard verification failure', async () => {
            process.env.SKIP_APP_CHECK = 'false';
            req.header.mockReturnValue('token');
            mockVerifyToken.mockRejectedValue(new Error('invalid token'));
            
            await verifyAppCheck(req as Request, res as Response, next);
            expect(next).toHaveBeenCalledWith(expect.any(AppError));
            const error = next.mock.calls[0][0];
            expect(error.statusCode).toBe(401);
            expect(error.errorCode).toBe('APP_CHECK_FAILED');
        });
    });

    describe('authenticate', () => {
        it('should pass AppError if Authorization header is missing', async () => {
            req.header.mockReturnValue(null);
            await authenticate(req, res, next);
            expect(next).toHaveBeenCalledWith(expect.any(AppError));
            const error = next.mock.calls[0][0];
            expect(error.statusCode).toBe(401);
            expect(error.errorCode).toBe('UNAUTHENTICATED');
        });

        it('should pass AppError if Authorization is not Bearer', async () => {
            req.header.mockReturnValue('Basic credentials');
            await authenticate(req, res, next);
            expect(next).toHaveBeenCalledWith(expect.any(AppError));
        });

        it('should call next() and populate req.user if verification succeeds', async () => {
            req.header.mockReturnValue('Bearer valid-jwt');
            const decodedToken = { uid: 'user123', email: 'user@example.com' };
            mockVerifyIdToken.mockResolvedValue(decodedToken);

            await authenticate(req, res, next);
            expect(mockVerifyIdToken).toHaveBeenCalledWith('valid-jwt');
            expect(req.user).toBe(decodedToken);
            expect(next).toHaveBeenCalledWith();
        });

        it('should pass 503 AppError if auth service is unavailable', async () => {
            req.header.mockReturnValue('Bearer valid-jwt');
            mockVerifyIdToken.mockRejectedValue(new Error('service is unavailable'));

            await authenticate(req, res, next);
            expect(next).toHaveBeenCalledWith(expect.any(AppError));
            const error = next.mock.calls[0][0];
            expect(error.statusCode).toBe(503);
            expect(error.errorCode).toBe('INVALID_TOKEN');
        });

        it('should pass 401 AppError if token is invalid or expired', async () => {
            req.header.mockReturnValue('Bearer invalid-jwt');
            mockVerifyIdToken.mockRejectedValue(new Error('token is expired'));

            await authenticate(req, res, next);
            expect(next).toHaveBeenCalledWith(expect.any(AppError));
            const error = next.mock.calls[0][0];
            expect(error.statusCode).toBe(401);
            expect(error.errorCode).toBe('INVALID_TOKEN');
        });
    });

    describe('requireEmailVerified', () => {
        it('should return 401 if req.user is missing', () => {
            req.user = undefined;
            requireEmailVerified(req, res, next);
            expect(res.status).toHaveBeenCalledWith(401);
            expect(res.json).toHaveBeenCalledWith({ error: 'Unauthorized: Not authenticated' });
        });

        it('should skip email check for test accounts', () => {
            req.user = { email: 'test@example.com', firebase: { sign_in_provider: 'password' } };
            requireEmailVerified(req, res, next);
            expect(next).toHaveBeenCalledWith();

            req.user = { email: 'user@test.local', firebase: { sign_in_provider: 'password' } };
            requireEmailVerified(req, res, next);
            expect(next).toHaveBeenCalledWith();
        });

        it('should skip email check for non-password provider', () => {
            req.user = { email: 'user@gmail.com', firebase: { sign_in_provider: 'google.com' }, email_verified: false };
            requireEmailVerified(req, res, next);
            expect(next).toHaveBeenCalledWith();
        });

        it('should skip email check for password provider if email is verified', () => {
            req.user = { email: 'user@gmail.com', firebase: { sign_in_provider: 'password' }, email_verified: true };
            requireEmailVerified(req, res, next);
            expect(next).toHaveBeenCalledWith();
        });

        it('should throw AppError if password login and email is not verified', () => {
            req.user = { email: 'user@gmail.com', firebase: { sign_in_provider: 'password' }, email_verified: false };
            requireEmailVerified(req, res, next);
            expect(next).toHaveBeenCalledWith(expect.any(AppError));
            const error = next.mock.calls[0][0];
            expect(error.statusCode).toBe(403);
            expect(error.errorCode).toBe('auth/email-not-verified');
        });
    });

    describe('when firebase-admin services are not initialized (appCheck/auth are null)', () => {
        beforeEach(() => {
            vi.resetModules();
        });

        it('should throw AppError with 503 if appCheck is null (line 77)', async () => {
            vi.doMock('./firebase-admin.js', () => {
                return {
                    auth: null,
                    appCheck: null,
                    db: null,
                    admin: null
                };
            });

            // Dynamically import the middleware after re-mocking
            const { verifyAppCheck: verifyAppCheckDynamic } = await import('./middleware.js');

            const mockReq = {
                header: vi.fn().mockReturnValue('dummy-appcheck-token'),
                ip: '127.0.0.1'
            } as any;
            const mockRes = {} as any;
            const mockNext = vi.fn();

            await verifyAppCheckDynamic(mockReq, mockRes, mockNext);

            expect(mockNext).toHaveBeenCalledWith(expect.any(Error));
            const error = mockNext.mock.calls[0][0];
            expect(error.statusCode).toBe(503);
            expect(error.errorCode).toBe('APP_CHECK_FAILED');
            expect(error.message).toContain('Security check failed');
        });

        it('should throw AppError with 503 if auth is null (line 100)', async () => {
            vi.doMock('./firebase-admin.js', () => {
                return {
                    auth: null,
                    appCheck: null,
                    db: null,
                    admin: null
                };
            });

            const { authenticate: authenticateDynamic } = await import('./middleware.js');

            const mockReq = {
                header: vi.fn().mockReturnValue('Bearer dummy-jwt'),
                ip: '127.0.0.1'
            } as any;
            const mockRes = {} as any;
            const mockNext = vi.fn();

            await authenticateDynamic(mockReq, mockRes, mockNext);

            expect(mockNext).toHaveBeenCalledWith(expect.any(Error));
            const error = mockNext.mock.calls[0][0];
            expect(error.statusCode).toBe(503);
            expect(error.errorCode).toBe('INVALID_TOKEN');
            expect(error.message).toContain('Invalid or expired token');
        });
    });
});
