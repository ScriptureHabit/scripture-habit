import axios from 'axios';
import { renderHook, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { useNoteSubmission, NoteToEdit } from './use-note-submission';
import apiClient from '../../../utils/api-client';
import { writeBatch } from 'firebase/firestore';
import { toast } from 'react-toastify';
import confetti from 'canvas-confetti';
import { UserData } from '../../../types/user';
import { Message } from '../../../types/chat';

// Mock dependencies
vi.mock('../../../utils/api-client', () => ({
    default: {
        post: vi.fn(),
    },
}));

vi.mock('../../../firebase', () => ({
    db: {},
}));

vi.mock('firebase/firestore', () => ({
    doc: vi.fn(),
    writeBatch: vi.fn(() => ({
        update: vi.fn(),
        commit: vi.fn().mockResolvedValue(undefined),
    })),
    serverTimestamp: vi.fn(() => 'mock-timestamp'),
}));

vi.mock('react-toastify', () => ({
    toast: {
        success: vi.fn(),
        error: vi.fn(),
    },
}));

vi.mock('canvas-confetti', () => ({
    default: vi.fn(),
}));

vi.mock('../../../utils/audio-feedback', () => ({
    playNoteSubmitSound: vi.fn(),
    isSoundEnabled: vi.fn(() => true),
    setSoundEnabled: vi.fn(),
}));

describe('use-note-submission', () => {
    const mockUserData: UserData = { 
        uid: 'user1', 
        groupId: 'group1',
        email: 'test@example.com',
        nickname: 'Test User',
        createdAt: new Date().toISOString()
    };
    const mockT = (key: string) => key;

    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('should fail validation if scripture or chapter is missing', async () => {
        const { result } = renderHook(() => useNoteSubmission(mockUserData, 'en', mockT));
        
        await act(async () => {
            await result.current.handleSubmit(
                null, '', '', 'Comment', 'all', [], null, null, vi.fn()
            );
        });

        expect(toast.error).toHaveBeenCalledWith('newNote.errorMissingFields');
    });

    it('should call backend API for NEW note submission', async () => {
        vi.mocked(apiClient.post).mockResolvedValue({ data: { success: true } });
        const onSuccess = vi.fn();

        const { result } = renderHook(() => useNoteSubmission(mockUserData, 'en', mockT));
        
        await act(async () => {
            await result.current.handleSubmit(
                null, 'Book of Mormon', '1 Nephi 1', 'Faith', 'all', [], null, null, onSuccess
            );
        });

        expect(apiClient.post).toHaveBeenCalledWith('/api/groups/post-note', expect.objectContaining({
            scripture: 'Book of Mormon',
            chapter: '1 Nephi 1',
            comment: 'Faith',
        }));
        expect(confetti).toHaveBeenCalled();
        expect(toast.success).toHaveBeenCalledWith('newNote.successPost');
        expect(onSuccess).toHaveBeenCalled();
    });

    it('should update Firestore via batch for EDITING an existing note', async () => {
        const mockNote: Message = { 
            id: 'note123', 
            isNote: true, 
            text: 'Test note',
            senderId: 'user1',
            senderNickname: 'Test User',
            createdAt: Date.now(),
            messageType: 'studyNote'
        };
        const mockBatch = {
            update: vi.fn(),
            commit: vi.fn().mockResolvedValue(true),
        };
        vi.mocked(writeBatch).mockReturnValue(mockBatch as unknown as ReturnType<typeof writeBatch>);
        const onSuccess = vi.fn();

        const { result } = renderHook(() => useNoteSubmission(mockUserData, 'en', mockT));
        
        await act(async () => {
            await result.current.handleSubmit(
                mockNote, 'Book of Mormon', '1 Nephi 2', 'Edit comment', 'all', [], 'group1', null, onSuccess
            );
        });

        expect(writeBatch).toHaveBeenCalled();
        expect(mockBatch.update).toHaveBeenCalled();
        expect(mockBatch.commit).toHaveBeenCalled();
        expect(toast.success).toHaveBeenCalledWith('newNote.successUpdate');
        expect(onSuccess).toHaveBeenCalled();
    });

    it('should update standalone personal note via batch when noteToEdit is not a message', async () => {
        const mockNote: Partial<NoteToEdit> = {
            id: 'personal-note-123'
        };
        const mockBatch = {
            update: vi.fn(),
            commit: vi.fn().mockResolvedValue(true),
        };
        vi.mocked(writeBatch).mockReturnValue(mockBatch as unknown as ReturnType<typeof writeBatch>);
        const onSuccess = vi.fn();

        const { result } = renderHook(() => useNoteSubmission(mockUserData, 'en', mockT));

        await act(async () => {
            await result.current.handleSubmit(
                mockNote as NoteToEdit, 'Book of Mormon', '1 Nephi 2', 'Edited comment', 'all', [], 'group1', null, onSuccess
            );
        });

        expect(writeBatch).toHaveBeenCalled();
        expect(mockBatch.update).toHaveBeenCalledTimes(1);
        expect(mockBatch.commit).toHaveBeenCalled();
        expect(toast.success).toHaveBeenCalledWith('newNote.successUpdate');
        expect(onSuccess).toHaveBeenCalled();
    });

    it('should handle axios server errors with proper toast prefix', async () => {
        vi.mocked(apiClient.post).mockRejectedValue({
            response: { data: { error: 'Server says no' } },
            isAxiosError: true,
            message: 'Request failed'
        });

        vi.spyOn(axios, 'isAxiosError').mockImplementation((err: unknown): err is any => !!err);

        const { result } = renderHook(() => useNoteSubmission(mockUserData, 'en', mockT));

        await act(async () => {
            await result.current.handleSubmit(
                null, 'Book of Mormon', '1 Nephi 1', 'Test', 'all', [], null, null, vi.fn()
            );
        });

        expect(toast.error).toHaveBeenCalledWith('errors.prefix: Server says no');
    });

    it('should handle validation errors without hitting backend', async () => {
        const { result } = renderHook(() => useNoteSubmission(mockUserData, 'en', mockT));

        await act(async () => {
            await result.current.handleSubmit(
                null, '', '', 'Test', 'all', [], null, null, vi.fn()
            );
        });

        expect(apiClient.post).not.toHaveBeenCalled();
        expect(toast.error).toHaveBeenCalledWith('newNote.errorMissingFields');
    });

    it('should update group message and sync back to personal note when originalNoteId is present', async () => {
        const mockNote: Partial<NoteToEdit> = {
            id: 'message-123',
            isMessage: true,
            originalNoteId: 'original-note-321',
            groupId: 'group1'
        };
        const mockBatch = {
            update: vi.fn(),
            commit: vi.fn().mockResolvedValue(true),
        };
        vi.mocked(writeBatch).mockReturnValue(mockBatch as unknown as ReturnType<typeof writeBatch>);
        const onSuccess = vi.fn();

        const { result } = renderHook(() => useNoteSubmission(mockUserData, 'en', mockT));

        await act(async () => {
            await result.current.handleSubmit(
                mockNote as NoteToEdit, 'Book of Mormon', '1 Nephi 3', 'Sync comment', 'all', [], 'group1', null, onSuccess
            );
        });

        expect(writeBatch).toHaveBeenCalled();
        expect(mockBatch.update).toHaveBeenCalledTimes(2);
        expect(mockBatch.commit).toHaveBeenCalled();
        expect(toast.success).toHaveBeenCalledWith('newNote.successUpdate');
        expect(onSuccess).toHaveBeenCalled();
    });

    it('should handle API errors of auth/network-request-failed differently', async () => {
        vi.mocked(apiClient.post).mockRejectedValue({
            response: { data: { error: 'auth/network-request-failed' } },
            isAxiosError: true,
            message: 'auth/network-request-failed'
        });
        vi.spyOn(axios, 'isAxiosError').mockImplementation((err: unknown): err is any => !!err);

        const { result } = renderHook(() => useNoteSubmission(mockUserData, 'en', mockT));

        await act(async () => {
            await result.current.handleSubmit(
                null, 'Book of Mormon', '1 Nephi 1', 'Test', 'all', [], null, null, vi.fn()
            );
        });

        expect(toast.error).toHaveBeenCalledWith('errors.prefix: errors.networkError');
    });

    it('should open milestone modal when reaching a milestone day', async () => {
        const { useMilestoneStore } = await import('../../../store/use-milestone-store');
        const openMilestoneSpy = vi.spyOn(useMilestoneStore.getState(), 'openMilestone');

        vi.mocked(apiClient.post).mockResolvedValue({ 
            data: { success: true, streakUpdated: true } 
        });
        const onSuccess = vi.fn();

        const userWith9Days: UserData = {
            ...mockUserData,
            daysStudiedCount: 9
        };

        const { result } = renderHook(() => useNoteSubmission(userWith9Days, 'en', mockT));

        await act(async () => {
            await result.current.handleSubmit(
                null, 'Book of Mormon', '1 Nephi 1', 'Test', 'all', [], null, null, onSuccess
            );
        });

        expect(openMilestoneSpy).toHaveBeenCalledWith(expect.objectContaining({
            days: 10
        }));
    });
});
