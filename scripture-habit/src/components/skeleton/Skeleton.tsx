import React from 'react';
import './Skeleton.css';

interface SkeletonProps extends React.HTMLAttributes<HTMLDivElement> {
    width?: string | number;
    height?: string | number;
    variant?: 'rectangle' | 'circle' | 'text';
    className?: string;
    style?: React.CSSProperties;
}

export const Skeleton: React.FC<SkeletonProps> = ({
    width,
    height,
    variant = 'rectangle',
    className = '',
    style,
    ...props
}) => {
    const combinedStyle: React.CSSProperties = {
        width: width,
        height: height,
        ...style
    };

    return (
        <div
            className={`skeleton skeleton-${variant} ${className}`}
            style={combinedStyle}
            {...props}
        />
    );
};

export const DashboardSkeleton: React.FC = () => {
    return (
        <div className="dashboard-skeleton" data-testid="dashboard-skeleton">
            <div className="skeleton-header">
                <div>
                    <Skeleton width="200px" height="32px" style={{ marginBottom: '10px' }} />
                    <Skeleton width="150px" height="20px" />
                </div>
                <Skeleton width="48px" height="48px" variant="circle" />
            </div>

            <div className="skeleton-stats">
                <Skeleton className="skeleton-card" />
                <Skeleton className="skeleton-card" />
            </div>

            <Skeleton className="skeleton-inspiration" />

            <div className="skeleton-section">
                <Skeleton width="120px" height="24px" style={{ marginBottom: '1rem' }} />
                <div className="skeleton-grid">
                    <Skeleton className="skeleton-note-card" />
                    <Skeleton className="skeleton-note-card" />
                    <Skeleton className="skeleton-note-card" />
                </div>
            </div>
        </div>
    );
};

export const OptionsSkeleton: React.FC = () => {
    return (
        <div className="options-skeleton" style={{ padding: '2rem', textAlign: 'center' }}>
            <Skeleton width="60%" height="40px" style={{ margin: '0 auto 2rem auto' }} />
            <div style={{ display: 'flex', gap: '2rem', justifyContent: 'center' }}>
                <Skeleton width="150px" height="200px" />
                <Skeleton width="150px" height="200px" />
            </div>
        </div>
    );
};

export const ChatSkeleton: React.FC = () => {
    return (
        <div className="chat-skeleton" style={{ padding: '1rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <div style={{ alignSelf: 'flex-start', display: 'flex', gap: '8px' }}>
                <Skeleton width="40px" height="40px" variant="circle" />
                <Skeleton width="180px" height="60px" style={{ borderRadius: '0 12px 12px 12px' }} />
            </div>
            <div style={{ alignSelf: 'flex-end' }}>
                <Skeleton width="150px" height="80px" style={{ borderRadius: '12px 12px 0 12px' }} />
            </div>
            <div style={{ alignSelf: 'flex-start', display: 'flex', gap: '8px' }}>
                <Skeleton width="40px" height="40px" variant="circle" />
                <Skeleton width="220px" height="40px" style={{ borderRadius: '0 12px 12px 12px' }} />
            </div>
            <div style={{ alignSelf: 'flex-end' }}>
                <Skeleton width="200px" height="50px" style={{ borderRadius: '12px 12px 0 12px' }} />
            </div>
        </div>
    );
};

export const NoteCardSkeleton: React.FC = () => {
    return (
        <div className="skeleton-note-card" style={{ padding: '1rem', background: '#fff', border: '1px solid #eee' }}>
            <Skeleton width="40px" height="40px" variant="circle" style={{ marginBottom: '1rem' }} />
            <Skeleton width="100%" height="1rem" style={{ marginBottom: '0.5rem' }} />
            <Skeleton width="100%" height="1rem" style={{ marginBottom: '0.5rem' }} />
            <Skeleton width="60%" height="1rem" />
        </div>
    );
};

export const NoteGridSkeleton: React.FC = () => {
    return (
        <div className="skeleton-grid" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))' }}>
            <NoteCardSkeleton />
            <NoteCardSkeleton />
            <NoteCardSkeleton />
            <NoteCardSkeleton />
            <NoteCardSkeleton />
            <NoteCardSkeleton />
        </div>
    );
};

export default Skeleton;
