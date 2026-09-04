import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import ChatHeader from '../chat-header';

let mockChatData = {
  groupData: null as any,
  unityPercentage: 0,
  isOwner: false,
  language: 'en',
  groupId: 'group-1',
  userGroups: [],
  userData: { uid: 'u1' } as any,
  messagesLoaded: false
};

vi.mock('../../hooks/use-chat-context', () => ({
  useChatData: () => mockChatData,
  useChatGroupActions: () => ({
    handleShowMembers: vi.fn(),
    handleShowUnityModal: vi.fn(),
    handleCopyInviteLink: vi.fn(),
    translatedGroupName: '',
    translatedGroupDesc: ''
  }),
  useChatUIActions: () => ({
    t: (k: string) => k,
    onBack: vi.fn(),
    onGroupSelect: vi.fn()
  })
}));

vi.mock('../../../../store/use-chat-store', () => ({
  useChatStore: () => ({
    showMobileMenu: false,
    setShowMobileMenu: vi.fn(),
    setShowInviteModal: vi.fn()
  })
}));

vi.mock('../../../../store/use-modal-store', () => ({
  useModalStore: () => ({
    setActiveModal: vi.fn(),
    setNewGroupName: vi.fn(),
    setNewGroupDescription: vi.fn(),
    setNewTranslatedName: vi.fn(),
    setNewTranslatedDesc: vi.fn()
  })
}));

describe('ChatHeader Component', () => {
  beforeEach(() => {
    mockChatData = {
      groupData: null,
      unityPercentage: 0,
      isOwner: false,
      language: 'en',
      groupId: 'group-1',
      userGroups: [],
      userData: { uid: 'u1' } as any,
      messagesLoaded: false
    };
  });

  it('renders title skeleton and unity skeleton during initial loading (!messagesLoaded, !groupData)', () => {
    render(<ChatHeader />);

    expect(screen.getByTestId('chat-header-title-skeleton')).toBeInTheDocument();
    expect(screen.getByTestId('chat-header-unity-skeleton')).toBeInTheDocument();
    expect(screen.queryByTestId('chat-header-unity')).not.toBeInTheDocument();
  });

  it('renders group name immediately and unity skeleton while messages are loading', () => {
    mockChatData.groupData = {
      id: 'group-1',
      name: 'Scripture Readers',
      members: ['u1', 'u2'],
      maxMembers: 5
    };
    mockChatData.messagesLoaded = false;

    render(<ChatHeader />);

    expect(screen.getByText('Scripture Readers')).toBeInTheDocument();
    expect(screen.queryByTestId('chat-header-title-skeleton')).not.toBeInTheDocument();
    expect(screen.getByTestId('chat-header-unity-skeleton')).toBeInTheDocument();
    expect(screen.queryByTestId('chat-header-unity')).not.toBeInTheDocument();
  });

  it('renders real unity score badge once messagesLoaded is true', () => {
    mockChatData.groupData = {
      id: 'group-1',
      name: 'Scripture Readers',
      members: ['u1', 'u2'],
      maxMembers: 5
    };
    mockChatData.messagesLoaded = true;
    mockChatData.unityPercentage = 75;

    render(<ChatHeader />);

    expect(screen.getByText('Scripture Readers')).toBeInTheDocument();
    expect(screen.queryByTestId('chat-header-unity-skeleton')).not.toBeInTheDocument();
    const unityBadge = screen.getByTestId('chat-header-unity');
    expect(unityBadge).toBeInTheDocument();
    expect(screen.getByText('75%')).toBeInTheDocument();
  });
});
