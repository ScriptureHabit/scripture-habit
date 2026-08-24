import axios from 'axios';
import axiosRetry from 'axios-retry';
import { setupCache } from 'axios-cache-interceptor';
import { decode } from '@msgpack/msgpack';
import { auth, appCheck, initAppCheck } from '../firebase';
import { getToken } from 'firebase/app-check';
import { requestCanceler } from './request-canceler';

/**
 * Base URL configuration.
 * Relative paths which work with the Vite proxy in development
 * and same-origin in production.
 */
const API_BASE = import.meta.env.VITE_API_BASE_URL || '';

const isTestEnv = import.meta.env.MODE === 'test' || process.env.NODE_ENV === 'test';

/**
 * Common Axios instance for internal API calls.
 * Automatically handles:
 * 1. Base URL configuration
 * 2. Firebase ID Token injection (Authorization header)
 * 3. Firebase App Check Token injection (X-Firebase-AppCheck header)
 * 4. Automatic retry on network drops and 5xx errors
 * 5. In-memory GET caching (2 min TTL)
 * 6. Automatic GET cancellation on route changes
 * 7. Transparent MessagePack binary encoding/decoding
 */
const rawApiClient = axios.create({
    baseURL: API_BASE,
    timeout: 15000, // 15 seconds timeout to prevent infinite hangs
    headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/x-msgpack, application/json;q=0.9',
    },
    responseType: isTestEnv ? 'json' : 'arraybuffer',
    transformResponse: [
        (data, headers) => {
            const contentType = (headers?.['content-type'] || headers?.['Content-Type'] || '') as string;
            if (typeof contentType === 'string' && contentType.includes('application/x-msgpack')) {
                try {
                    if (data instanceof ArrayBuffer) {
                        return decode(new Uint8Array(data));
                    } else if (ArrayBuffer.isView(data)) {
                        return decode(new Uint8Array(data.buffer, data.byteOffset, data.byteLength));
                    }
                } catch (err) {
                    console.warn('[apiClient] Failed to decode MessagePack response:', err);
                }
            }
            if (data instanceof ArrayBuffer) {
                try {
                    const text = new TextDecoder('utf-8').decode(data);
                    return JSON.parse(text);
                } catch {
                    return data;
                }
            }
            if (typeof data === 'string') {
                try {
                    return JSON.parse(data);
                } catch {
                    return data;
                }
            }
            return data;
        },
    ],
});
axiosRetry(rawApiClient, {
    retries: isTestEnv ? 0 : 3,
    retryDelay: axiosRetry.exponentialDelay,
    retryCondition: (error) => {
        return axiosRetry.isNetworkOrIdempotentRequestError(error) ||
               Boolean(error.response && error.response.status >= 500 && error.response.status <= 599);
    },
    shouldResetTimeout: true,
});

// Configure 2-minute in-memory caching for GET requests (bypassed in unit tests)
const apiClient = isTestEnv
    ? rawApiClient
    : setupCache(rawApiClient, {
        ttl: 1000 * 60 * 2, // 2 minutes
        interpretHeader: true,
        methods: ['get'],
    });

// Request Interceptor: Inject Auth, App Check tokens, and route cancellation signals
apiClient.interceptors.request.use(
    async (config) => {
        try {
            // Attach abort signal for cancelable GET requests on route transitions
            if (config.method?.toLowerCase() === 'get' && !config.signal) {
                config.signal = requestCanceler.getSignal();
            }

            if (config.url && config.url.includes('/api/')) {
                const [path, query] = config.url.split('?');
                if (path.length > 1 && path.endsWith('/')) {
                    config.url = path.slice(0, -1) + (query ? '?' + query : '');
                }
            }

            // 1. Inject Firebase ID Token
            const user = auth?.currentUser;
            if (user) {
                const idToken = await user.getIdToken();
                config.headers.Authorization = `Bearer ${idToken}`;
            }

            // 2. Inject Firebase App Check Token
            // set forceRefresh to false to use cached token if available
            const activeAppCheck = appCheck || (typeof window !== 'undefined' ? initAppCheck() : null);
            if (activeAppCheck) {
                const appCheckTokenResponse = await getToken(activeAppCheck, false);
                if (appCheckTokenResponse.token) {
                    config.headers['X-Firebase-AppCheck'] = appCheckTokenResponse.token;
                }
            }
        } catch (error) {
            // Log warning but don't block the request (backend will decide if it's mandatory)
            console.warn('[apiClient] Token injection failed:', error);
        }
        
        return config;
    },
    (error) => {
        return Promise.reject(error);
    }
);

// Response Interceptor: Handle global errors (e.g. 401, 403, 500+)
apiClient.interceptors.response.use(
    (response) => response,
    (error) => {
        if (error.response) {
            const { status, config } = error.response;
            if (status === 401) {
                console.error('[apiClient] Unauthorized - redirecting or showing login modal may be needed.');
            }
            
            // Log server errors to Sentry for observability
            // Filter out gateway/infrastructure issues (like 502/503/504) to reduce noise
            if (status === 500) {
                const sentry = (window as typeof window & {
                    Sentry?: { captureException?: (value: unknown, context?: unknown) => void }
                }).Sentry;
                sentry?.captureException?.(error, {
                    tags: { api_url: config?.url || 'unknown', status_code: status.toString() },
                    extra: { response_data: error.response?.data }
                });
                console.error(`[apiClient] Server Error (${status}) at ${config?.url}`);
            }
        } else if (error.request) {
            // No response was received (Network error)
            console.error('[apiClient] Network error - no response received');
        }
        
        return Promise.reject(error);
    }
);

export default apiClient;
