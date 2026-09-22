import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import RecapModal from '../recap-modal';

// Mock dependencies
vi.mock('../../common/lazy-markdown', () => ({
    default: ({ children }: { children: React.ReactNode }) => <div data-testid="lazy-markdown">{children}</div>
}));

vi.mock('../../../hooks/use-language', () => ({
    useLanguage: () => ({
        t: (key: string) => {
            const translations: Record<string, string> = {
                'recapModal.title': 'Your Reflection Letter',
                'recapModal.subtitle': 'A reflection on your recent spiritual journey.',
                'recapModal.savedToLetterBox': 'Saved in Letter Box',
                'recapModal.close': 'Close'
            };
            return translations[key] || key;
        }
    })
}));

describe('RecapModal Accessibility & Behavior', () => {
    it('does not render when isOpen is false', () => {
        const { container } = render(
            <RecapModal isOpen={false} onClose={vi.fn()} recapText="Test Recap" />
        );
        expect(container.firstChild).toBeNull();
    });

    it('renders dialog with proper WCAG a11y attributes when isOpen is true', () => {
        render(
            <RecapModal isOpen={true} onClose={vi.fn()} recapText="Test Recap" title="Weekly Review" />
        );

        // Dialog role & aria-modal
        const dialog = screen.getByRole('dialog');
        expect(dialog).toBeInTheDocument();
        expect(dialog).toHaveAttribute('aria-modal', 'true');
        expect(dialog).toHaveAttribute('aria-labelledby', 'recap-modal-title');

        // Heading labelledby matches
        const heading = screen.getByRole('heading', { name: 'Your Reflection Letter' });
        expect(heading).toHaveAttribute('id', 'recap-modal-title');

        // Status badge
        expect(screen.getByRole('status')).toBeInTheDocument();

        // Scrollable region
        expect(screen.getByRole('region', { name: 'Reflection content' })).toBeInTheDocument();
    });

    it('calls onClose when Escape key is pressed', () => {
        const onClose = vi.fn();
        render(<RecapModal isOpen={true} onClose={onClose} recapText="Test Recap" />);

        fireEvent.keyDown(window, { key: 'Escape' });
        expect(onClose).toHaveBeenCalledTimes(1);
    });

    it('calls onClose when close button or overlay is clicked', () => {
        const onClose = vi.fn();
        render(<RecapModal isOpen={true} onClose={onClose} recapText="Test Recap" />);

        // Click close icon button
        const closeBtn = screen.getByRole('button', { name: 'Close modal' });
        fireEvent.click(closeBtn);
        expect(onClose).toHaveBeenCalledTimes(1);

        // Click overlay
        const overlay = document.querySelector('.RecapModalOverlay')!;
        fireEvent.click(overlay);
        expect(onClose).toHaveBeenCalledTimes(2);
    });
});
