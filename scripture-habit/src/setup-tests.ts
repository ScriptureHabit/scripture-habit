import '@testing-library/jest-dom/vitest';
import { beforeAll, afterEach, afterAll, vi } from 'vitest';
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
