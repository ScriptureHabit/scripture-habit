import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import GroupChatMessageListContainer from '../group-chat-message-list-container';

vi.mock('../../hooks/use-chat-context', () => ({
  useChatData: () => ({
    messages: [],
    groupId: 'group-1',
    messagesLoaded: false
  }),
  useChatUIActions: () => ({
    containerRef: { current: document.createElement('div') },
    previousScrollHeightRef: { current: 0 },
    previousScrollTopRef: { current: 0 },
    loadMoreOlderMessages: vi.fn(),
    hasMoreOlder: false,
    isLoadingOlder: false,
    handleScroll: vi.fn()
  })
}));

vi.mock('../group-chat-message-list', () => ({
  default: () => <div data-testid="mock-message-list" />
}));

describe('GroupChatMessageListContainer Component', () => {
  it('renders chat message skeleton placeholder during loading', () => {
    render(<GroupChatMessageListContainer />);

    const skeleton = screen.getByTestId('chat-skeleton');
    expect(skeleton).toBeInTheDocument();
    expect(skeleton).not.toHaveClass('fade-out');
  });
});
