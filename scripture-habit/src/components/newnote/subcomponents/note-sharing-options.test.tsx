import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import NoteSharingOptions from './note-sharing-options';
import { Group } from '../../../types/chat';

describe('NoteSharingOptions Component', () => {
    const mockT = (key: string) => {
        const translations: Record<string, string> = {
            'newNote.shareLabel': '共有範囲:',
            'newNote.shareToGroupShort': '共有する',
            'newNote.shareAllShort': 'すべて',
            'newNote.shareSpecificShort': '一部選択',
            'newNote.shareNoneShort': '非公開',
            'newNote.selectedGroupCount': '{count} / {total} グループ選択中',
            'newNote.unnamedGroup': '名称未設定グループ',
        };
        return translations[key] || key;
    };

    const singleGroup: Group[] = [
        { id: 'g1', name: 'Youth Group' } as Group
    ];

    const multiGroups: Group[] = [
        { id: 'g1', name: 'Youth Group' } as Group,
        { id: 'g2', name: 'Family Group' } as Group
    ];

    it('renders 2 options when user has only 1 group', () => {
        const setShareOption = vi.fn();
        const handleGroupSelection = vi.fn();

        render(
            <NoteSharingOptions
                userGroups={singleGroup}
                shareOption="all"
                setShareOption={setShareOption}
                selectedShareGroups={[]}
                handleGroupSelection={handleGroupSelection}
                t={mockT}
            />
        );

        expect(screen.getByTestId('share-option-all')).toBeInTheDocument();
        expect(screen.getByTestId('share-option-none')).toBeInTheDocument();
        expect(screen.queryByTestId('share-option-specific')).not.toBeInTheDocument();
        expect(screen.getByText('共有する')).toBeInTheDocument();
        expect(screen.getByText('非公開')).toBeInTheDocument();
    });

    it('renders 3 options when user has multiple groups', () => {
        const setShareOption = vi.fn();
        const handleGroupSelection = vi.fn();

        render(
            <NoteSharingOptions
                userGroups={multiGroups}
                shareOption="all"
                setShareOption={setShareOption}
                selectedShareGroups={[]}
                handleGroupSelection={handleGroupSelection}
                t={mockT}
            />
        );

        expect(screen.getByTestId('share-option-all')).toBeInTheDocument();
        expect(screen.getByTestId('share-option-specific')).toBeInTheDocument();
        expect(screen.getByTestId('share-option-none')).toBeInTheDocument();
        expect(screen.getByText('すべて')).toBeInTheDocument();
        expect(screen.getByText('一部選択')).toBeInTheDocument();
        expect(screen.getByText('非公開')).toBeInTheDocument();
    });

    it('triggers setShareOption when clicking a segment button', () => {
        const setShareOption = vi.fn();
        const handleGroupSelection = vi.fn();

        render(
            <NoteSharingOptions
                userGroups={multiGroups}
                shareOption="all"
                setShareOption={setShareOption}
                selectedShareGroups={[]}
                handleGroupSelection={handleGroupSelection}
                t={mockT}
            />
        );

        fireEvent.click(screen.getByTestId('share-option-none'));
        expect(setShareOption).toHaveBeenCalledWith('none');
    });

    it('shows group selection list and badge when shareOption is specific', () => {
        const setShareOption = vi.fn();
        const handleGroupSelection = vi.fn();

        render(
            <NoteSharingOptions
                userGroups={multiGroups}
                shareOption="specific"
                setShareOption={setShareOption}
                selectedShareGroups={['g1']}
                handleGroupSelection={handleGroupSelection}
                t={mockT}
            />
        );

        expect(screen.getByText('1 / 2 グループ選択中')).toBeInTheDocument();
        expect(screen.getByText('Youth Group')).toBeInTheDocument();
        expect(screen.getByText('Family Group')).toBeInTheDocument();

        fireEvent.click(screen.getByText('Family Group'));
        expect(handleGroupSelection).toHaveBeenCalledWith('g2');
    });
});
