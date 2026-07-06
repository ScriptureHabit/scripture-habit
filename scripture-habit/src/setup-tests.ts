import { vi } from 'vitest';

// Inject mock Firebase environment variables BEFORE importing firebase configs or store components
vi.stubEnv('VITE_FIREBASE_API_KEY', 'demo-api-key');
vi.stubEnv('VITE_FIREBASE_AUTH_DOMAIN', 'demo-project.firebaseapp.com');
vi.stubEnv('VITE_FIREBASE_PROJECT_ID', 'scripture-habit-auth');
vi.stubEnv('VITE_FIREBASE_APP_ID', '1:123456789:web:abcdef');
vi.stubEnv('VITE_USE_FIREBASE_EMULATOR', 'true');

import '@testing-library/jest-dom/vitest';
import { beforeAll, afterEach, afterAll } from 'vitest';
import { server } from './mocks/server';
import { useChatStore } from './store/use-chat-store';
import { useModalStore } from './store/use-modal-store';

// Globally mock Sentry to avoid uncaught exceptions/crashes in interceptors
vi.mock('@sentry/react', () => ({
  init: vi.fn(),
  captureException: vi.fn(),
  withScope: vi.fn((cb) => cb({ setTag: vi.fn(), setExtra: vi.fn() })),
}));


beforeAll(() => server.listen({ onUnhandledRequest: 'bypass' }));
afterEach(() => {
  server.resetHandlers();
  useChatStore.getState().resetChatUI();
  useModalStore.getState().resetModalState();
  vi.restoreAllMocks();
});
afterAll(() => server.close());
