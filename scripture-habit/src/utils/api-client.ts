import axios from 'axios';
import * as Sentry from '@sentry/react';
import { auth, appCheck } from '../firebase';
import { getToken } from 'firebase/app-check';
import { Capacitor } from '@capacitor/core';

/**
 * Base URL configuration.
 * On native platforms (iOS/Android), we must point to the production server.
 * On web, we use relative paths which work with the Vite proxy in development
 * and same-origin in production.
 */
const API_BASE = (Capacitor.isNativePlatform() && !window.location.hostname.includes('localhost')) ? 'https://scripturehabit.app' : '';

/**
 * Common Axios instance for internal API calls.
 * Automatically handles:
 * 1. Base URL configuration
 * 2. Firebase ID Token injection (Authorization header)
 * 3. Firebase App Check Token injection (X-Firebase-AppCheck header)
 */
const apiClient = axios.create({
    baseURL: API_BASE,
    timeout: 15000, // 15 seconds timeout to prevent infinite hangs
    headers: {
        'Content-Type': 'application/json',
    },
});

// Request Interceptor: Inject Auth and App Check tokens
apiClient.interceptors.request.use(
    async (config) => {
        try {
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
            if (appCheck) {
                const appCheckTokenResponse = await getToken(appCheck, false);
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
                Sentry.withScope((scope) => {
                    scope.setTag('api_url', config?.url || 'unknown');
                    scope.setTag('status_code', status.toString());
                    scope.setExtra('response_data', error.response?.data);
                    Sentry.captureException(error);
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
