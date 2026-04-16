import { renderHook, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { useNoteSubmission } from './use-note-submission';
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

        expect(apiClient.post).toHaveBeenCalledWith('/api/post-note', expect.objectContaining({
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

    it('should handle API errors gracefully', async () => {
        vi.mocked(apiClient.post).mockRejectedValue(new Error('Network error'));
        
        const { result } = renderHook(() => useNoteSubmission(mockUserData, 'en', mockT));
        
        await act(async () => {
            await result.current.handleSubmit(
                null, 'Book of Mormon', '1 Nephi 1', 'Test', 'all', [], null, null, vi.fn()
            );
        });

        expect(toast.error).toHaveBeenCalledWith(expect.stringContaining('Network error'));
    });
});
