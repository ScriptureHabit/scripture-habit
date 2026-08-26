import { vi } from 'vitest';
import { useLanguage } from '../../../hooks/use-language';
import { Group } from '../../../types/chat';
import { User } from 'firebase/auth';
import { useJoinGroup } from '../hooks/use-join-group';

export const mockNavigate = vi.fn();

const mockT = (key: string) => key;

export interface MockSetupOptions {
  user?: Partial<User> | null;
  groupIds?: string[];
  publicGroups?: Array<Partial<Group>>;
  loadingGroups?: boolean;
  error?: string;
  translatedNames?: Record<string, string>;
  translatedDescs?: Record<string, string>;
  joinGroupMock?: any;
}

// Centralized mock helper functions for JoinGroup test suite (vi.mock calls must be made in the individual test files)

export function setupCommonMocks(options: MockSetupOptions = {}) {
  vi.clearAllMocks();

  // 1. Language Hook Mock
  vi.mocked(useLanguage).mockReturnValue({
    t: mockT,
    language: 'ja',
    setLanguage: vi.fn(),
    tArray: vi.fn(() => []),
    isLoaded: true,
    translateBookName: vi.fn(n => n || ''),
    translateChapterField: vi.fn(n => n || ''),
    bookTranslations: {},
  });

  const defaultUser = options.user !== undefined ? options.user : ({
    uid: 'test-user',
    getIdToken: vi.fn(async () => 'mock-id-token')
  } as Partial<User>);

  const defaultGroupIds = options.groupIds ?? ['group-1'];
  const defaultUserData = options.user === null ? null : {
    groupIds: defaultGroupIds,
    uid: 'test-user'
  };

  const defaultGroups = options.publicGroups ?? [
    { id: 'group-1', name: 'Group 1', isPublic: true, members: ['test-user'] },
    { id: 'group-2', name: 'Group 2', isPublic: true, members: ['other-user'] }
  ];

  const filtered = defaultGroups.filter(g => {
    const userGroupIds = defaultUserData?.groupIds || [];
    return !userGroupIds.includes(g.id!);
  });

  const currentPage = 1;
  const groupsPerPage = 5;
  const currentGroups = filtered.slice(0, groupsPerPage);
  const totalPages = Math.ceil(filtered.length / groupsPerPage);

  const joinGroupMock = options.joinGroupMock || vi.fn();

  vi.mocked(useJoinGroup).mockReturnValue({
    user: defaultUser as User | null,
    userData: defaultUserData as any,
    publicGroups: defaultGroups as Group[],
    filteredGroups: filtered as Group[],
    currentGroups: currentGroups as Group[],
    loadingGroups: options.loadingGroups ?? false,
    error: options.error ?? '',
    setError: vi.fn(),
    currentPage,
    totalPages,
    handlePageChange: vi.fn(),
    joinGroup: joinGroupMock,
    translatedNames: options.translatedNames ?? {},
    translatedDescs: options.translatedDescs ?? {},
    translatingIds: new Set(),
    handleTranslateGroup: vi.fn()
  });

  return { mockFetch: vi.fn() };
}
