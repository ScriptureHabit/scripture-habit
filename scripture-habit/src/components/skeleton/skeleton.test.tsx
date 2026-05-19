import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import Skeleton, {
    DashboardSkeleton,
    OptionsSkeleton,
    ChatSkeleton,
    NoteCardSkeleton,
    NoteGridSkeleton,
    PublicGroupsSkeleton,
} from './skeleton';

describe('skeleton components', () => {
    it('renders the base Skeleton with styles, variant, and className', () => {
        render(
            <Skeleton
                width="100px"
                height="20px"
                variant="circle"
                className="extra-skeleton"
                style={{ marginTop: '10px' }}
                data-testid="base-skeleton"
            />
        );

        const skeleton = screen.getByTestId('base-skeleton');
        expect(skeleton).toHaveClass('skeleton', 'skeleton-circle', 'extra-skeleton');
        expect(skeleton).toHaveStyle({ width: '100px', height: '20px', marginTop: '10px' });
    });

    it('renders DashboardSkeleton with its expected layout', () => {
        const { container } = render(<DashboardSkeleton />);

        expect(screen.getByTestId('dashboard-skeleton')).toBeInTheDocument();
        expect(container.querySelectorAll('.skeleton-header').length).toBe(1);
        expect(container.querySelectorAll('.skeleton-stats .skeleton-card').length).toBe(2);
        expect(container.querySelectorAll('.skeleton-note-card').length).toBe(3);
    });

    it('renders OptionsSkeleton with two option cards', () => {
        const { container } = render(<OptionsSkeleton />);

        expect(container.querySelector('.options-skeleton')).toBeInTheDocument();
        expect(container.querySelectorAll('.options-skeleton .skeleton').length).toBe(3);
    });

    it('renders ChatSkeleton with circle skeletons for avatars', () => {
        const { container } = render(<ChatSkeleton />);

        expect(container.querySelectorAll('.chat-skeleton').length).toBe(1);
        expect(container.querySelectorAll('.skeleton-circle').length).toBe(2);
    });

    it('renders NoteCardSkeleton with a note-style skeleton card', () => {
        const { container } = render(<NoteCardSkeleton />);

        expect(container.querySelector('.skeleton-note-card')).toBeInTheDocument();
        expect(container.querySelectorAll('.skeleton-note-card .skeleton').length).toBe(4);
    });

    it('renders NoteGridSkeleton with six note cards', () => {
        const { container } = render(<NoteGridSkeleton />);

        expect(container.querySelectorAll('.skeleton-note-card').length).toBe(6);
        expect(container.querySelectorAll('.skeleton-grid').length).toBe(1);
    });

    it('renders PublicGroupsSkeleton with six skeleton cards', () => {
        const { container } = render(<PublicGroupsSkeleton />);

        expect(container.querySelectorAll('.skeleton-card').length).toBe(6);
        expect(container.querySelectorAll('.skeleton-grid').length).toBe(1);
    });
});
