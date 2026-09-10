import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import GroupForm from '../group-form';
import apiClient from '../../../utils/api-client';
import { GroupService } from '../../../services/group-service';

vi.mock('../../../utils/api-client', () => ({
    default: {
        post: vi.fn(),
        get: vi.fn(),
    }
}));

const mockNavigate = vi.fn();
vi.mock('react-router-dom', () => ({
    useNavigate: () => mockNavigate,
    Link: ({ children, to }: { children: React.ReactNode; to: string }) => <a href={to}>{children}</a>
}));

vi.mock('../../mascot/mascot', () => ({
    default: () => <div data-testid="mock-mascot">Mascot</div>
}));

vi.mock('../../../utils/api-warmup', () => ({
    useApiWarmupOnMount: () => {}
}));

vi.mock('../../../firebase', () => ({
    auth: {
        currentUser: { uid: 'test-user-123' }
    },
    db: {}
}));

vi.mock('firebase/auth', () => ({
    onAuthStateChanged: (_auth: any, callback: (user: any) => void) => {
        callback({ uid: 'test-user-123' });
        return vi.fn();
    }
}));

vi.mock('../../../hooks/use-language', () => ({
    useLanguage: () => ({
        t: (key: string) => {
            const translations: Record<string, string> = {
                'groupForm.title': '学習グループを作成',
                'groupForm.groupNameLabel': 'グループ名',
                'groupForm.groupNamePlaceholder': 'グループ名を入力',
                'groupForm.descriptionLabel': '説明 (任意)',
                'groupForm.createButton': 'グループを作成',
                'groupForm.successCreated': 'グループが作成されました！',
                'groupForm.invitePreviewTitle': '招待リンクのプレビュー',
                'groupForm.invitePreviewDesc': 'リンクを共有して招待',
                'groupOptions.backToDashboard': 'ダッシュボードに戻る'
            };

            return translations[key] || key;
        },
        language: 'ja'
    })
}));

describe('GroupForm', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        vi.spyOn(GroupService, 'subscribeUserGroups').mockImplementation((_uid, onUpdate) => {
            onUpdate([]);
            return vi.fn();
        });
    });

    it('renders the group form elements correctly', () => {
        render(<GroupForm />);

        expect(screen.getByText('学習グループを作成')).toBeInTheDocument();
        expect(screen.getByTestId('group-name-input')).toBeInTheDocument();
        expect(screen.getByTestId('create-group-submit')).toBeInTheDocument();
        expect(screen.getByText(/招待リンクのプレビュー/)).toBeInTheDocument();
    });

    it('submits form with name and description', async () => {
        (apiClient.post as any).mockResolvedValueOnce({
            data: { groupId: 'new-group-123' }
        });

        render(<GroupForm />);

        const nameInput = screen.getByTestId('group-name-input');
        fireEvent.change(nameInput, { target: { value: 'My Scripture Study Group' } });

        const submitBtn = screen.getByTestId('create-group-submit');
        fireEvent.click(submitBtn);

        await waitFor(() => {
            expect(apiClient.post).toHaveBeenCalledWith('/api/groups/create-group', expect.objectContaining({
                name: 'My Scripture Study Group',
            }));
        });
    });
});
