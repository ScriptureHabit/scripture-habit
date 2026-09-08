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
                'groupOptions.backToDashboard': 'ダッシュボードに戻る',
                'familyTheme.groupOptionToggle': '家族モード',
                'familyTheme.modeFamilyTitle': '家族モード（ON）',
                'familyTheme.modeFamilyDesc': '家族で同じ時間に集まって聖典学習をするグループに最適です。',
                'familyTheme.modeIndividualTitle': '個人モード（OFF）',
                'familyTheme.modeIndividualDesc': '各自のペースで学習したい方に最適です。',
                'familyTheme.alreadyEnabledInOtherGroup': '家族モードはすでに別のグループで有効になっています',
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

    it('renders the mode selection section with Family and Personal mode explanations', () => {
        render(<GroupForm />);

        expect(screen.getByText('学習グループを作成')).toBeInTheDocument();
        expect(screen.getByTestId('group-mode-selection-card')).toBeInTheDocument();
        expect(screen.getByText('家族モード')).toBeInTheDocument();

        // Check both mode titles & descriptions are visible
        expect(screen.getByText('家族モード（ON）')).toBeInTheDocument();
        expect(screen.getByText('家族で同じ時間に集まって聖典学習をするグループに最適です。')).toBeInTheDocument();
        expect(screen.getByText('個人モード（OFF）')).toBeInTheDocument();
        expect(screen.getByText('各自のペースで学習したい方に最適です。')).toBeInTheDocument();
    });

    it('defaults to Personal Mode (OFF) and allows switching to Family Mode', () => {
        render(<GroupForm />);

        const familyCard = screen.getByTestId('mode-card-family');
        const individualCard = screen.getByTestId('mode-card-individual');

        // Initially personal mode is selected
        expect(individualCard).toHaveClass('selected-individual');
        expect(familyCard).not.toHaveClass('selected-family');

        // Click Family Mode card
        fireEvent.click(familyCard);

        expect(familyCard).toHaveClass('selected-family');
        expect(individualCard).not.toHaveClass('selected-individual');

        // Click Personal Mode card
        fireEvent.click(individualCard);
        expect(individualCard).toHaveClass('selected-individual');
        expect(familyCard).not.toHaveClass('selected-family');
    });

    it('submits form with isFamilySyncEnabled: true when Family Mode is selected', async () => {
        (apiClient.post as any).mockResolvedValueOnce({
            data: { groupId: 'new-group-family-123' }
        });

        render(<GroupForm />);

        // Fill in group name
        const nameInput = screen.getByTestId('group-name-input');
        fireEvent.change(nameInput, { target: { value: 'My Family Scripture Group' } });

        // Select Family Mode
        const familyCard = screen.getByTestId('mode-card-family');
        fireEvent.click(familyCard);

        // Submit form
        const submitBtn = screen.getByTestId('create-group-submit');
        fireEvent.click(submitBtn);

        await waitFor(() => {
            expect(apiClient.post).toHaveBeenCalledWith('/api/groups/create-group', expect.objectContaining({
                name: 'My Family Scripture Group',
                isFamilySyncEnabled: true
            }));
        });
    });

    it('displays warning and prevents enabling Family Mode if user already has a family group', () => {
        vi.spyOn(GroupService, 'subscribeUserGroups').mockImplementation((_uid, onUpdate) => {
            onUpdate([{ id: 'existing-family-grp', name: 'Existing', isFamilySyncEnabled: true } as any]);
            return vi.fn();
        });

        render(<GroupForm />);

        expect(screen.getByTestId('already-enabled-warning')).toBeInTheDocument();
        expect(screen.getByText('⚠️ 家族モードはすでに別のグループで有効になっています')).toBeInTheDocument();

        const toggle = screen.getByTestId('family-mode-toggle');
        expect(toggle).toBeDisabled();
    });
});
