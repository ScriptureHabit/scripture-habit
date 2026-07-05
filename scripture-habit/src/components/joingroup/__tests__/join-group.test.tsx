import { render, screen, waitFor } from '@testing-library/react';
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
vi.mock('firebase/app-check', () => ({
  getToken: vi.fn().mockResolvedValue({ token: 'mock-app-check-token' })
}));
vi.mock('../../../firebase', () => ({
  auth: {},
  db: {},
  appCheck: {}
}));

vi.mock('../../../utils/api-client', () => {
  return {
    default: {
      get: vi.fn().mockImplementation(async (url, config) => {
        const resp = await global.fetch(url, config);
        if (!resp.ok) {
          throw {
            isAxiosError: true,
            response: { data: { code: 'ERROR', error: 'Axios Mocked Error' } }
          };
        }
        let data = {};
        if (resp.json) {
          data = await resp.json();
        } else if (resp.text) {
          const text = await resp.text();
          try { data = JSON.parse(text || '{}'); } catch { /* empty */ }
        }
        return { data };
      }),
      post: vi.fn().mockImplementation(async (url, body, config) => {
        const resp = await global.fetch(url, { ...config, method: 'POST', body: JSON.stringify(body) });
        if (!resp.ok) {
          const text = resp.text ? await resp.text() : 'Error';
          throw {
            isAxiosError: true,
            response: { data: { code: text || 'ERROR', error: text || 'Axios Mocked Error' } }
          };
        }
        let data = {};
        if (resp.json) {
          data = await resp.json();
        } else if (resp.text) {
          const text = await resp.text();
          try { data = JSON.parse(text || '{}'); } catch { /* empty */ }
        }
        return { data };
      })
    }
  };
});

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
    mockFetch.mockReset();
    vi.mocked(onSnapshot).mockReset();
    vi.mocked(onAuthStateChanged).mockReset();
    vi.mocked(getDocs).mockReset();
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
      (args[1] as (user: unknown) => void)({
        uid: 'test-user',
        getIdToken: vi.fn(async () => 'mock-id-token')
      });
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

    // Default fetch mock supporting dynamic routes
    mockFetch.mockImplementation(async (url) => {
      const urlStr = String(url);
      if (urlStr.includes('/api/groups/join-group')) {
        return {
          ok: true,
          status: 200,
          text: async () => 'OK'
        };
      }
      if (urlStr.includes('/api/ai/translate')) {
        return {
          ok: true,
          status: 200,
          json: async () => ({ translatedText: 'Translated Text' })
        };
      }
      if (urlStr.includes('/api/groups')) {
        return {
          ok: true,
          status: 200,
          json: async () => [
            { id: 'group-1', name: 'Group 1', isPublic: true, members: ['test-user'] },
            { id: 'group-2', name: 'Group 2', isPublic: true, members: ['other-user'] }
          ]
        };
      }
      return {
        ok: false,
        status: 404
      };
    });

    // Default getDocs mock
    const mockSnapshot = {
      docs: [
        { id: 'group-1', data: () => ({ name: 'Group 1', isPublic: true, members: ['test-user'] }) },
        { id: 'group-2', data: () => ({ name: 'Group 2', isPublic: true, members: ['other-user'] }) }
      ],
      forEach(cb: (doc: QueryDocumentSnapshot<DocumentData, DocumentData>) => void) {
        mockSnapshot.docs.forEach((d) => cb(d as unknown as QueryDocumentSnapshot<DocumentData, DocumentData>));
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

  it('successfully fetches public groups from backend API', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => [
        { id: 'group-api-1', name: 'API Group 1', isPublic: true, members: ['other-user'] }
      ]
    });

    await act(async () => {
      render(
        <MemoryRouter>
          <JoinGroup />
        </MemoryRouter>
      );
    });

    expect(screen.getByText('API Group 1')).toBeInTheDocument();
  });

  it('handles pagination for public groups list', async () => {
    vi.mocked(onSnapshot).mockImplementation(((ref: unknown, callback: unknown) => {
      const r = ref as { path: string };
      const cb = callback as (snap: unknown) => void;
      if (r && r.path === 'users/test-user') {
        cb({
          exists: () => true,
          data: () => ({ groupIds: [] })
        });
      }
      return () => {};
    }) as never);

    mockFetch.mockImplementation(async (url) => {
      const urlStr = String(url);
      if (urlStr.includes('/api/groups')) {
        return {
          ok: false,
          status: 500
        };
      }
      return { ok: false, status: 404 };
    });

    const mockSnapshot = {
      docs: Array.from({ length: 6 }, (_, i) => ({
        id: `group-${i + 1}`,
        data: () => ({ name: `Group ${i + 1}`, isPublic: true, members: ['other-user'] })
      })),
      forEach(cb: any) {
        this.docs.forEach(cb);
      }
    };
    vi.mocked(getDocs).mockResolvedValue(mockSnapshot as any);

    await act(async () => {
      render(
        <MemoryRouter>
          <JoinGroup />
        </MemoryRouter>
      );
    });

    expect(screen.getByText('Group 1')).toBeInTheDocument();
    expect(screen.getByText('Group 5')).toBeInTheDocument();
    expect(screen.queryByText('Group 6')).not.toBeInTheDocument();

    const nextBtn = screen.getByText('→');
    await act(async () => {
      nextBtn.click();
    });

    expect(screen.getByText('Group 6')).toBeInTheDocument();
    expect(screen.queryByText('Group 1')).not.toBeInTheDocument();

    const prevBtn = screen.getByText('←');
    await act(async () => {
      prevBtn.click();
    });
    expect(screen.getByText('Group 1')).toBeInTheDocument();
  });

  it('handles translation of group details', async () => {
    mockFetch.mockImplementation(async (url) => {
      const urlStr = String(url);
      if (urlStr.includes('/api/groups')) {
        return {
          ok: false,
          status: 500
        };
      }
      if (urlStr.includes('/api/ai/translate')) {
        return {
          ok: true,
          status: 200,
          json: async () => ({ translatedText: 'Translated Text' })
        };
      }
      return { ok: false, status: 404 };
    });

    const mockSnapshot = {
      docs: [
        {
          id: 'group-3',
          data: () => ({
            name: 'Original Name',
            description: 'Original Description',
            isPublic: true,
            members: ['other-user'],
            memberPreviews: [{ uid: 'm1', nickname: 'Member 1' }],
            createdAt: { seconds: 1716076800, nanoseconds: 0 }
          })
        }
      ],
      forEach(cb: any) {
        this.docs.forEach(cb);
      }
    };
    vi.mocked(getDocs).mockResolvedValue(mockSnapshot as any);

    await act(async () => {
      render(
        <MemoryRouter>
          <JoinGroup />
        </MemoryRouter>
      );
    });

    const detailsBtn = screen.getByRole('button', { name: 'groupCard.details' });
    await act(async () => {
      detailsBtn.click();
    });

    expect(screen.getAllByText('Translated Text')[0]).toBeInTheDocument();
    expect(screen.getByText('Member 1')).toBeInTheDocument();
    expect(screen.getByText(/joinGroup.createdAt/)).toBeInTheDocument();
  });

  it('handles manual translation in Firestore', async () => {
    mockFetch.mockImplementation(async (url) => {
      const urlStr = String(url);
      if (urlStr.includes('/api/groups')) {
        return {
          ok: false,
          status: 500
        };
      }
      return { ok: false, status: 404 };
    });

    const mockSnapshot = {
      docs: [
        {
          id: 'group-3',
          data: () => ({
            name: 'Original Name',
            description: 'Original Description',
            isPublic: true,
            members: ['other-user'],
            translations: {
              ja: { name: 'Manual JA Name', description: 'Manual JA Description' }
            }
          })
        }
      ],
      forEach(cb: any) {
        this.docs.forEach(cb);
      }
    };
    vi.mocked(getDocs).mockResolvedValue(mockSnapshot as any);

    await act(async () => {
      render(
        <MemoryRouter>
          <JoinGroup />
        </MemoryRouter>
      );
    });

    const detailsBtn = screen.getByRole('button', { name: 'groupCard.details' });
    await act(async () => {
      detailsBtn.click();
    });

    expect(screen.getAllByText('Manual JA Name')[0]).toBeInTheDocument();
    expect(screen.getByText('Manual JA Description')).toBeInTheDocument();
  });

  it('handles successful group join and navigates', async () => {
    await act(async () => {
      render(
        <MemoryRouter>
          <JoinGroup />
        </MemoryRouter>
      );
    });

    const detailsBtn = screen.getByRole('button', { name: 'groupCard.details' });
    await act(async () => {
      detailsBtn.click();
    });

    const confirmBtn = screen.getByRole('button', { name: 'joinGroup.confirmJoin' });
    await act(async () => {
      confirmBtn.click();
    });

    expect(mockFetch).toHaveBeenCalledWith(expect.stringContaining('/api/groups/join-group'), expect.any(Object));
    expect(mockNavigate).toHaveBeenCalledWith('/ja/dashboard', expect.any(Object));
  });

  it('handles cancelling group join modal', async () => {
    await act(async () => {
      render(
        <MemoryRouter>
          <JoinGroup />
        </MemoryRouter>
      );
    });

    const detailsBtn = screen.getByRole('button', { name: 'groupCard.details' });
    await act(async () => {
      detailsBtn.click();
    });

    expect(screen.getByText('joinGroup.joinConfirmMessage')).toBeInTheDocument();

    const cancelBtn = screen.getByRole('button', { name: 'joinGroup.cancelJoin' });
    await act(async () => {
      cancelBtn.click();
    });

    expect(screen.queryByText('joinGroup.joinConfirmMessage')).not.toBeInTheDocument();
  });

  it('handles clicking overlay to close modal', async () => {
    await act(async () => {
      render(
        <MemoryRouter>
          <JoinGroup />
        </MemoryRouter>
      );
    });

    const detailsBtn = screen.getByRole('button', { name: 'groupCard.details' });
    await act(async () => {
      detailsBtn.click();
    });

    expect(screen.getByText('joinGroup.joinConfirmMessage')).toBeInTheDocument();

    const overlay = screen.getByText('joinGroup.joinConfirmMessage').closest('.group-modal-overlay');
    expect(overlay).toBeInTheDocument();
    await act(async () => {
      overlay?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });

    expect(screen.queryByText('joinGroup.joinConfirmMessage')).not.toBeInTheDocument();
  });

  it('shows error when user is not logged in', async () => {
    vi.mocked(onAuthStateChanged).mockImplementation(((...args: unknown[]) => {
      (args[1] as (user: unknown) => void)(null);
      return () => {};
    }) as never);

    mockFetch.mockImplementation(async (url) => {
      const urlStr = String(url);
      if (urlStr.includes('/api/groups')) {
        return {
          ok: true,
          status: 200,
          json: async () => [
            { id: 'group-2', name: 'Group 2', isPublic: true, members: ['other-user'] }
          ]
        };
      }
      return { ok: false, status: 404 };
    });

    await act(async () => {
      render(
        <MemoryRouter>
          <JoinGroup />
        </MemoryRouter>
      );
    });

    const detailsBtn = screen.getByRole('button', { name: 'groupCard.details' });
    await act(async () => {
      detailsBtn.click();
    });

    const confirmBtn = screen.getByRole('button', { name: 'joinGroup.confirmJoin' });
    await act(async () => {
      confirmBtn.click();
    });

    expect(screen.getByText('joinGroup.errorLoggedIn')).toBeInTheDocument();
  });

  it('shows error when user reached max groups limit', async () => {
    vi.mocked(onSnapshot).mockImplementation(((ref: unknown, callback: unknown) => {
      const r = ref as { path: string };
      const cb = callback as (snap: unknown) => void;
      if (r && r.path === 'users/test-user') {
        cb({
          exists: () => true,
          data: () => ({ groupIds: ['g1', 'g2', 'g3', 'g4'] })
        });
      }
      return () => {};
    }) as never);

    mockFetch.mockImplementation(async (url) => {
      const urlStr = String(url);
      if (urlStr.includes('/api/groups')) {
        return {
          ok: true,
          status: 200,
          json: async () => [
            { id: 'group-2', name: 'Group 2', isPublic: true, members: ['other-user'] }
          ]
        };
      }
      return { ok: false, status: 404 };
    });

    await act(async () => {
      render(
        <MemoryRouter>
          <JoinGroup />
        </MemoryRouter>
      );
    });

    const detailsBtn = screen.getByRole('button', { name: 'groupCard.details' });
    await act(async () => {
      detailsBtn.click();
    });

    const confirmBtn = screen.getByRole('button', { name: 'joinGroup.confirmJoin' });
    await act(async () => {
      confirmBtn.click();
    });

    expect(screen.getByText('joinGroup.errorMaxGroups')).toBeInTheDocument();
  });

  it('shows error when group is full', async () => {
    mockFetch.mockImplementation(async (url) => {
      const urlStr = String(url);
      if (urlStr.includes('/api/groups')) {
        return {
          ok: false,
          status: 500
        };
      }
      return { ok: false, status: 404 };
    });

    const mockSnapshot = {
      docs: [
        {
          id: 'group-2',
          data: () => ({
            name: 'Group 2',
            isPublic: true,
            members: ['other-user'],
            membersCount: 5,
            maxMembers: 5
          })
        }
      ],
      forEach(cb: any) {
        this.docs.forEach(cb);
      }
    };
    vi.mocked(getDocs).mockResolvedValue(mockSnapshot as any);

    await act(async () => {
      render(
        <MemoryRouter>
          <JoinGroup />
        </MemoryRouter>
      );
    });

    const detailsBtn = screen.getByRole('button', { name: 'groupCard.details' });
    await act(async () => {
      detailsBtn.click();
    });

    const confirmBtn = screen.getByRole('button', { name: 'joinGroup.confirmJoin' });
    await act(async () => {
      confirmBtn.click();
    });

    expect(screen.getByText('joinGroup.errorFull')).toBeInTheDocument();
  });

  it('shows error when server join fails', async () => {
    mockFetch.mockImplementation(async (url) => {
      const urlStr = String(url);
      if (urlStr.includes('/api/groups/join-group')) {
        return {
          ok: false,
          status: 500,
          text: async () => 'Internal Server Error'
        };
      }
      if (urlStr.includes('/api/groups')) {
        return {
          ok: true,
          status: 200,
          json: async () => [
            { id: 'group-2', name: 'Group 2', isPublic: true, members: ['other-user'] }
          ]
        };
      }
      return { ok: false, status: 404 };
    });

    await act(async () => {
      render(
        <MemoryRouter>
          <JoinGroup />
        </MemoryRouter>
      );
    });

    const detailsBtn = screen.getByRole('button', { name: 'groupCard.details' });
    await act(async () => {
      detailsBtn.click();
    });

    const confirmBtn = screen.getByRole('button', { name: 'joinGroup.confirmJoin' });
    await act(async () => {
      confirmBtn.click();
    });

    expect(screen.getByText('Internal Server Error')).toBeInTheDocument();
  });

  it('allows opening group if user becomes a member while modal is open', async () => {
    let snapshotCallback: any;
    vi.mocked(onSnapshot).mockImplementation(((ref: unknown, callback: unknown) => {
      const r = ref as { path: string };
      const cb = callback as (snap: unknown) => void;
      if (r && r.path === 'users/test-user') {
        snapshotCallback = cb;
        cb({
          exists: () => true,
          data: () => ({ groupIds: ['group-1'] })
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

    const detailsBtn = screen.getByRole('button', { name: 'groupCard.details' });
    await act(async () => {
      detailsBtn.click();
    });

    await act(async () => {
      snapshotCallback({
        exists: () => true,
        data: () => ({ groupIds: ['group-1', 'group-2'] })
      });
    });

    const openBtn = screen.getByRole('button', { name: 'groupCard.open' });
    await act(async () => {
      openBtn.click();
    });

    expect(mockNavigate).toHaveBeenCalledWith('/ja/dashboard', expect.any(Object));
  });

  it('handles translation api failure gracefully', async () => {
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    
    mockFetch.mockImplementation(async (url) => {
      const urlStr = String(url);
      if (urlStr.includes('/api/ai/translate')) {
        return {
          ok: false,
          status: 500
        };
      }
      if (urlStr.includes('/api/groups')) {
        return {
          ok: true,
          status: 200,
          json: async () => [
            { id: 'group-2', name: 'Group 2', isPublic: true, members: ['other-user'] }
          ]
        };
      }
      return { ok: false, status: 404 };
    });

    await act(async () => {
      render(
        <MemoryRouter>
          <JoinGroup />
        </MemoryRouter>
      );
    });

    const detailsBtn = screen.getByRole('button', { name: 'groupCard.details' });
    await act(async () => {
      detailsBtn.click();
    });

    await waitFor(() => {
      expect(consoleSpy).toHaveBeenCalled();
    });
    consoleSpy.mockRestore();
  });

  it('shows error when network join fails with exception', async () => {
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    mockFetch.mockImplementation(async (url) => {
      const urlStr = String(url);
      if (urlStr.includes('/api/groups/join-group')) {
        throw new Error('Network Error');
      }
      if (urlStr.includes('/api/groups')) {
        return {
          ok: true,
          status: 200,
          json: async () => [
            { id: 'group-2', name: 'Group 2', isPublic: true, members: ['other-user'] }
          ]
        };
      }
      return { ok: false, status: 404 };
    });

    await act(async () => {
      render(
        <MemoryRouter>
          <JoinGroup />
        </MemoryRouter>
      );
    });

    const detailsBtn = screen.getByRole('button', { name: 'groupCard.details' });
    await act(async () => {
      detailsBtn.click();
    });

    const confirmBtn = screen.getByRole('button', { name: 'joinGroup.confirmJoin' });
    await act(async () => {
      confirmBtn.click();
    });

    expect(screen.getByText('Network Error')).toBeInTheDocument();
    expect(consoleSpy).toHaveBeenCalled();
    consoleSpy.mockRestore();
  });
  it('logs user data listener error when code is not permission-denied', async () => {
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.mocked(onSnapshot).mockImplementation(((_ref: unknown, _callback: unknown, errorCb: unknown) => {
      const errCb = errorCb as (err: any) => void;
      if (errCb) errCb({ code: 'unknown-error', message: 'test error' });
      return () => {};
    }) as never);

    await act(async () => {
      render(
        <MemoryRouter>
          <JoinGroup />
        </MemoryRouter>
      );
    });

    expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('[JoinGroup] User data listener error:'), expect.anything());
    consoleSpy.mockRestore();
  });

  it('logs warning when backend /groups fetch throws an error', async () => {
    const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    mockFetch.mockImplementation(async (url) => {
      if (String(url).includes('/api/groups')) {
        throw new Error('Network error on fetch');
      }
      return { ok: false, status: 404 };
    });

    await act(async () => {
      render(
        <MemoryRouter>
          <JoinGroup />
        </MemoryRouter>
      );
    });

    expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('Backend /groups fetch failed, falling back to client query:'), expect.anything());
    consoleSpy.mockRestore();
  });

  it('logs error when client fallback getDocs throws an error', async () => {
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    mockFetch.mockImplementation(async (url) => {
      if (String(url).includes('/api/groups')) {
        return { ok: false, status: 500 };
      }
      return { ok: false, status: 404 };
    });
    vi.mocked(getDocs).mockRejectedValue(new Error('Firestore error'));

    await act(async () => {
      render(
        <MemoryRouter>
          <JoinGroup />
        </MemoryRouter>
      );
    });

    expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('Error fetching public groups (client fallback):'), expect.anything());
    expect(screen.getByText('joinGroup.noPublicGroups')).toBeInTheDocument();
    consoleSpy.mockRestore();
  });

  it('shows error when joining a group where user is already in groupData.members', async () => {
    mockFetch.mockImplementation(async (url) => {
      if (String(url).includes('/api/groups')) {
        return {
          ok: true,
          status: 200,
          json: async () => [
            { id: 'group-2', name: 'Group 2', isPublic: true, members: ['test-user'] }
          ]
        };
      }
      return { ok: false, status: 404 };
    });

    await act(async () => {
      render(
        <MemoryRouter>
          <JoinGroup />
        </MemoryRouter>
      );
    });

    const openBtn = screen.getByRole('button', { name: 'groupCard.details' });
    await act(async () => {
      openBtn.click();
    });

    const confirmBtn = screen.getByRole('button', { name: 'joinGroup.confirmJoin' });
    await act(async () => {
      confirmBtn.click();
    });

    expect(screen.getByText('joinGroup.errorAlreadyMember')).toBeInTheDocument();
  });

  it('triggers onOpen when clicking open on GroupCard', async () => {
    mockFetch.mockImplementation(async (url) => {
      if (String(url).includes('/api/groups')) {
        return {
          ok: true,
          status: 200,
          json: async () => [
            { id: 'group-2', name: 'Group 2', isPublic: true, members: ['test-user'] }
          ]
        };
      }
      return { ok: false, status: 404 };
    });

    await act(async () => {
      render(
        <MemoryRouter>
          <JoinGroup />
        </MemoryRouter>
      );
    });

    const openBtn = screen.getByRole('button', { name: 'groupCard.details' });
    await act(async () => {
      openBtn.click();
    });

    expect(screen.getByText('joinGroup.joinConfirmMessage')).toBeInTheDocument();
  });

  it('shows error when joining a group user is already in (via currentGroupIds race condition)', async () => {
    let callTime = 0;
    const fakeGroupIds = {
      includes: () => {
        // Return false during render (before click), return true when clicked
        return callTime > 0;
      },
      length: 0
    };

    vi.mocked(onSnapshot).mockImplementation(((ref: unknown, callback: unknown) => {
      const r = ref as { path: string };
      const cb = callback as (snap: unknown) => void;
      if (r && r.path === 'users/test-user') {
        cb({
          exists: () => true,
          data: () => ({ groupIds: fakeGroupIds as any })
        });
      }
      return () => {};
    }) as never);
    
    mockFetch.mockImplementation(async (url) => {
      if (String(url).includes('/api/groups')) {
        return {
          ok: true,
          status: 200,
          json: async () => [
            { id: 'group-2', name: 'Group 2', isPublic: true, members: [] }
          ]
        };
      }
      return { ok: false, status: 404 };
    });

    await act(async () => {
      render(
        <MemoryRouter>
          <JoinGroup />
        </MemoryRouter>
      );
    });

    const detailsBtn = screen.getByRole('button', { name: 'groupCard.details' });
    await act(async () => {
      detailsBtn.click();
    });

    const confirmBtn = screen.getByRole('button', { name: 'joinGroup.confirmJoin' });
    
    // Set callTime so that inside joinGroup, includes() returns true
    callTime = 1;
    
    await act(async () => {
      confirmBtn.click();
    });

    expect(screen.getByText('joinGroup.errorAlreadyMember')).toBeInTheDocument();
  });
});
