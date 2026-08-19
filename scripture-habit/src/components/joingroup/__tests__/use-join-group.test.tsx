import { renderHook, act, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { useJoinGroup } from '../hooks/use-join-group';
import { onSnapshot, getDocs } from 'firebase/firestore';
import { onAuthStateChanged } from 'firebase/auth';
import apiClient from '../../../utils/api-client';
import { MemoryRouter } from 'react-router-dom';
import React from 'react';
import { http, HttpResponse } from 'msw';
import { server } from '../../../mocks/server';

const mockNavigate = vi.fn();
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});

vi.mock('../../../hooks/use-language', () => ({
  useLanguage: () => ({
    t: (key: string) => key,
    language: 'ja',
    tArray: () => []
  })
}));

vi.mock('firebase/firestore');
vi.mock('firebase/auth');
vi.mock('../../../firebase', () => ({
  auth: {},
  db: {},
  appCheck: null
}));

describe('useJoinGroup Custom Hook', () => {
  let getSpy: any;
  let postSpy: any;

  beforeEach(() => {
    vi.clearAllMocks();
    getSpy = vi.spyOn(apiClient, 'get');
    postSpy = vi.spyOn(apiClient, 'post');
  });

  const wrapper = ({ children }: { children: React.ReactNode }) => (
    <MemoryRouter>{children}</MemoryRouter>
  );

  it('subscribes to auth state and user document on mount', async () => {
    let authCallback: any = null;
    vi.mocked(onAuthStateChanged).mockImplementation(((_auth: any, callback: any) => {
      authCallback = callback;
      return () => {};
    }) as any);

    let snapshotCallback: any = null;
    vi.mocked(onSnapshot).mockImplementation(((_ref: any, callback: any) => {
      snapshotCallback = callback;
      return () => {};
    }) as any);

    const { result } = renderHook(() => useJoinGroup(), { wrapper });

    // Trigger auth state change
    act(() => {
      authCallback({ uid: 'user123' });
    });

    expect(result.current.user).toEqual({ uid: 'user123' });
    expect(onSnapshot).toHaveBeenCalled();

    // Trigger document snapshot update
    act(() => {
      snapshotCallback({
        exists: () => true,
        data: () => ({ groupIds: ['g1'] })
      });
    });

    expect(result.current.userData).toEqual({ groupIds: ['g1'] });
  });

  it('falls back to firestore getDocs if API fetch fails', async () => {
    server.use(
      http.get('/api/groups', () => {
        return new HttpResponse(null, { status: 500 });
      })
    );
    
    const mockSnapshot = {
      docs: [
        { id: 'g2', data: () => ({ name: 'Firestore Group', isPublic: true }) }
      ],
      forEach(cb: any) {
        this.docs.forEach(cb);
      }
    };
    vi.mocked(getDocs).mockResolvedValue(mockSnapshot as any);

    const { result } = renderHook(() => useJoinGroup(), { wrapper });

    await waitFor(() => {
      expect(result.current.publicGroups).toEqual([
        { id: 'g2', name: 'Firestore Group', isPublic: true }
      ]);
    });

    expect(getSpy).toHaveBeenCalled();
    expect(getDocs).toHaveBeenCalled();
  });

  it('processes AI translation API correctly', async () => {
    let authCallback: any = null;
    vi.mocked(onAuthStateChanged).mockImplementation(((_auth: any, callback: any) => {
      authCallback = callback;
      return () => {};
    }) as any);

    const { result } = renderHook(() => useJoinGroup(), { wrapper });

    act(() => {
      authCallback({ uid: 'user123' });
    });

    await act(async () => {
      await result.current.handleTranslateGroup('g1', 'Original Name', 'Original Desc');
    });

    expect(postSpy).toHaveBeenCalledWith('/api/ai/translate-batch', expect.objectContaining({
      messages: expect.arrayContaining([
        expect.objectContaining({ text: 'Original Name' }),
        expect.objectContaining({ text: 'Original Desc' })
      ]),
      targetLanguage: 'ja'
    }));
    expect(result.current.translatedNames['g1']).toBe('Translated Text');
  });
});
