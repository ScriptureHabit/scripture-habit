import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import FamilyStudyNoteCard from '../family-study-note-card';

describe('FamilyStudyNoteCard Component', () => {
  const mockT = (key: string, replacements?: Record<string, string | number>) => {
    if (key === 'familyTheme.themes.charity') return '慈愛';
    if (key === 'familyTheme.familyStudyNoteTitle') return '家族学習ノート';
    if (key === 'familyTheme.familyStudyNoteTheme') return `本日のテーマ：${replacements?.theme}`;
    if (key === 'familyTheme.familyStudyNoteBody') return `家族と一緒に「${replacements?.theme}」について話し合い、聖典を学びました。`;
    return key;
  };

  it('renders correctly with themeId and theme label without emojis', () => {
    render(
      <FamilyStudyNoteCard
        themeId="charity"
        isSent={false}
        t={mockT}
      />
    );

    expect(screen.getByText('家族学習ノート')).toBeInTheDocument();
    expect(screen.getByText('本日のテーマ：慈愛')).toBeInTheDocument();
    expect(
      screen.getByText('家族と一緒に「慈愛」について話し合い、聖典を学びました。')
    ).toBeInTheDocument();
  });

  it('applies is-sent class when isSent is true', () => {
    const { container } = render(
      <FamilyStudyNoteCard
        themeId="charity"
        isSent={true}
        t={mockT}
      />
    );

    expect(container.querySelector('.family-study-note-card.is-sent')).toBeInTheDocument();
  });
});
