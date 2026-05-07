import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import JoinGroup from '../join-group';
import { useLanguage } from '../../../hooks/use-language';
import { doc, collection, query, onSnapshot, getDocs, QuerySnapshot, DocumentData, QueryDocumentSnapshot } from 'firebase/firestore';
import { onAuthStateChanged } from 'firebase/auth';
import { MemoryRouter } from 'react-router-dom';
import { act } from 'react';

// Mock hooks and firebase
vi.mock('../../../hooks/use-language');
vi.mock('firebase/firestore');
vi.mock('firebase/auth');
vi.mock('firebase/app-check');
vi.mock('../../../firebase', () => ({
  auth: {},
  db: {},
  appCheck: {}
}));

// Mock useNavigate
const mockNavigate = vi.fn();
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});

// Mock doc and collection to return objects with path
// Mock doc and collection to return objects with path
vi.mocked(doc).mockImplementation((_db: unknown, ...pathSegments: string[]) => ({ path: pathSegments.join('/') }) as unknown as never);
vi.mocked(collection).mockImplementation((_db: unknown, path: string) => ({ path }) as unknown as never);
vi.mocked(query).mockImplementation((ref: unknown) => ref as never);

// Mock global fetch
const mockFetch = vi.fn();
global.fetch = mockFetch;

describe('JoinGroup Component Logic', () => {
  const mockT = (key: string) => key;
  
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(useLanguage).mockReturnValue({
      t: mockT,
      language: 'ja',
      setLanguage: vi.fn(),
      tArray: vi.fn(() => []),
      isLoaded: true,
      translateBookName: vi.fn(n => n),
      translateChapterName: vi.fn(n => n),
    } as unknown as never);

    // Mock auth state
    vi.mocked(onAuthStateChanged).mockImplementation(((...args: unknown[]) => {
      (args[1] as (user: unknown) => void)({ uid: 'test-user' });
      return () => {};
    }) as never);

    // Mock User Doc Snapshot
    vi.mocked(onSnapshot).mockImplementation(((ref: unknown, callback: unknown) => {
      const r = ref as { path: string };
      const cb = callback as (snap: unknown) => void;
      if (r && r.path === 'users/test-user') {
        cb({
          exists: () => true,
          data: () => ({ groupIds: ['group-1'] })
        });
      }
      return () => {};
    }) as never);

    // Default fetch mock (fails to trigger fallback)
    mockFetch.mockResolvedValue({
      ok: false,
      status: 404
    });

    // Default getDocs mock
    const mockSnapshot = {
      docs: [
        { id: 'group-1', data: () => ({ name: 'Group 1', isPublic: true, members: ['test-user'] }) },
        { id: 'group-2', data: () => ({ name: 'Group 2', isPublic: true, members: ['other-user'] }) }
      ],
      forEach(cb: (doc: QueryDocumentSnapshot<DocumentData, DocumentData>) => void) {
        mockSnapshot.docs.forEach(cb as any);
      }
    };
    vi.mocked(getDocs).mockResolvedValue(mockSnapshot as unknown as QuerySnapshot<DocumentData, DocumentData>);
  });

  it('filters out groups the user is already a member of', async () => {
    await act(async () => {
      render(
        <MemoryRouter>
          <JoinGroup />
        </MemoryRouter>
      );
    });

    // Group 1 should be filtered out because user is in groupIds ['group-1']
    // So only Group 2 should be visible
    expect(screen.queryByText('Group 1')).not.toBeInTheDocument();
    expect(screen.getByText('Group 2')).toBeInTheDocument();
  });

  it('shows skeleton loader when loading', async () => {
    // Make getDocs hang
    let resolveGetDocs: (value: QuerySnapshot<DocumentData, DocumentData>) => void;
    vi.mocked(getDocs).mockReturnValue(new Promise(resolve => { resolveGetDocs = resolve; }));

    render(
      <MemoryRouter>
        <JoinGroup />
      </MemoryRouter>
    );

    // Should show skeleton and loading text
    expect(screen.getByText('joinGroup.fetchingGroups')).toBeInTheDocument();
    const skeletonGrid = document.querySelector('.skeleton-grid');
    expect(skeletonGrid).toBeInTheDocument();

    // Clean up
    await act(async () => { resolveGetDocs({ forEach: () => {}, docs: [] } as unknown as never); });
  });

  it('shows empty message when no public groups remain after filtering', async () => {
    // Mock user in all available groups
    vi.mocked(onSnapshot).mockImplementation(((ref: unknown, callback: unknown) => {
      const r = ref as { path: string };
      const cb = callback as (snap: unknown) => void;
      if (r && r.path === 'users/test-user') {
        cb({
          exists: () => true,
          data: () => ({ groupIds: ['group-1', 'group-2'] })
        });
      }
      return () => {};
    }) as never);

    await act(async () => {
      render(
        <MemoryRouter>
          <JoinGroup />
        </MemoryRouter>
      );
    });

    // Both groups filtered out, should show no groups message
    expect(screen.getByText('joinGroup.noPublicGroups')).toBeInTheDocument();
    expect(screen.queryByText('Group 1')).not.toBeInTheDocument();
  });
});
