import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import Mascot from '../mascot';
import { useLanguage } from '../../../hooks/use-language';
import { UserData } from '../../../types/user';

vi.mock('../../../hooks/use-language', () => ({
  useLanguage: vi.fn(),
}));

describe('Mascot Component', () => {
  const mockT = vi.fn((key: string, options?: any) => {
    if (options) {
      return `${key}:${JSON.stringify(options)}`;
    }
    return key;
  });

  const mockLanguageContext = {
    language: 'en' as const,
    setLanguage: vi.fn(),
    t: mockT,
    tArray: () => [],
    isLoaded: true,
    translateBookName: (b?: string | null) => b || '',
    translateChapterField: (c?: string | null) => c || '',
    bookTranslations: {},
  };

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(useLanguage).mockReturnValue(mockLanguageContext);
  });

  it('renders customMessage when provided', () => {
    render(<Mascot customMessage="Hello from Mascot!" />);
    expect(screen.getByText('Hello from Mascot!')).toBeDefined();
  });

  it('renders promptToday when userData is absent', () => {
    render(<Mascot />);
    expect(screen.getByText('mascot.promptToday')).toBeDefined();
  });

  it('renders promptToday when userData has no lastPostDate', () => {
    const userData: Partial<UserData> = {
      uid: 'user1',
      nickname: 'Tester',
      lastPostDate: undefined,
    };
    render(<Mascot userData={userData as UserData} />);
    expect(screen.getByText('mascot.promptToday')).toBeDefined();
  });

  it('handles invalid timezone fallback to UTC in isDoneToday check', () => {
    const todayStr = new Date().toLocaleDateString('sv-SE', { timeZone: 'UTC' });
    const userData: Partial<UserData> = {
      uid: 'user1',
      nickname: 'Tester',
      lastPostDate: todayStr,
      timeZone: 'INVALID_ZONE', // triggers fallback to UTC
    };

    render(<Mascot userData={userData as UserData} />);
    expect(screen.getByText('mascot.doneToday')).toBeDefined();
  });

  it('returns false for isDoneToday if lastPostDate is an invalid string', () => {
    const userData: Partial<UserData> = {
      uid: 'user1',
      nickname: 'Tester',
      lastPostDate: 'not-a-date',
    };

    render(<Mascot userData={userData as UserData} />);
    expect(screen.getByText('mascot.promptToday')).toBeDefined();
  });

  it('returns false for isDoneToday if lastPostDate is non-string and invalid (NaN)', () => {
    const userData: Partial<UserData> = {
      uid: 'user1',
      nickname: 'Tester',
      lastPostDate: NaN as any, // non-string invalid epoch timestamp
      timeZone: 'UTC',
    };

    render(<Mascot userData={userData as UserData} />);
    expect(screen.getByText('mascot.promptToday')).toBeDefined();
  });

  it('handles lastPostDate as a string matching today', () => {
    const todayStr = new Date().toLocaleDateString('sv-SE', { timeZone: 'UTC' });
    const userData: Partial<UserData> = {
      uid: 'user1',
      nickname: 'Tester',
      lastPostDate: todayStr,
      timeZone: 'UTC',
    };

    render(<Mascot userData={userData as UserData} />);
    expect(screen.getByText('mascot.doneToday')).toBeDefined();
  });

  it('handles lastPostDate as a string NOT matching today', () => {
    const userData: Partial<UserData> = {
      uid: 'user1',
      nickname: 'Tester',
      lastPostDate: '2020-01-01',
      timeZone: 'UTC',
    };

    render(<Mascot userData={userData as UserData} />);
    expect(screen.getByText('mascot.promptToday')).toBeDefined();
  });

  it('handles lastPostDate as a Firestore Timestamp-like object matching today', () => {
    const now = new Date();
    const userData: Partial<UserData> = {
      uid: 'user1',
      nickname: 'Tester',
      lastPostDate: {
        toDate: () => now,
      } as any,
      timeZone: 'UTC',
    };

    render(<Mascot userData={userData as UserData} />);
    expect(screen.getByText('mascot.doneToday')).toBeDefined();
  });

  it('handles lastPostDate as a legacy Date instance / timestamp matching today', () => {
    const now = new Date();
    const userData: Partial<UserData> = {
      uid: 'user1',
      nickname: 'Tester',
      lastPostDate: now.getTime() as any, // legacy epoch timestamp
      timeZone: 'UTC',
    };

    render(<Mascot userData={userData as UserData} />);
    expect(screen.getByText('mascot.doneToday')).toBeDefined();
  });

  it('handles lastPostDate as a direct Date object matching today', () => {
    const now = new Date();
    const userData: Partial<UserData> = {
      uid: 'user1',
      nickname: 'Tester',
      lastPostDate: now as any, // direct Date object
      timeZone: 'UTC',
    };

    render(<Mascot userData={userData as UserData} />);
    expect(screen.getByText('mascot.doneToday')).toBeDefined();
  });

  it('handles lastPostDate when toDate exists but is not a function', () => {
    const userData: Partial<UserData> = {
      uid: 'user1',
      nickname: 'Tester',
      lastPostDate: { toDate: 'not-a-function' } as any,
      timeZone: 'UTC',
    };

    render(<Mascot userData={userData as UserData} />);
    expect(screen.getByText('mascot.promptToday')).toBeDefined();
  });

  it('displays streakCelebration when isDoneToday is true and streak >= 7', () => {
    const todayStr = new Date().toLocaleDateString('sv-SE', { timeZone: 'UTC' });
    const userData: Partial<UserData> = {
      uid: 'user1',
      nickname: 'Tester',
      lastPostDate: todayStr,
      timeZone: 'UTC',
      streakCount: 10,
      daysStudiedCount: 10,
    };

    render(<Mascot userData={userData as UserData} />);
    expect(screen.getByText(/mascot.streakCelebration/)).toBeDefined();
    expect(mockT).toHaveBeenCalledWith('mascot.streakCelebration', { streak: '10' });
  });

  it('calls onClick when clicked', () => {
    const onClick = vi.fn();
    render(<Mascot onClick={onClick} />);

    const container = screen.getByRole('img').closest('.mascot-container');
    expect(container).not.toBeNull();
    if (container) {
      fireEvent.click(container);
      expect(onClick).toHaveBeenCalled();
    }
  });

  it('applies reversed and is-done classes correctly', () => {
    const todayStr = new Date().toLocaleDateString('sv-SE', { timeZone: 'UTC' });
    const userData: Partial<UserData> = {
      uid: 'user1',
      nickname: 'Tester',
      lastPostDate: todayStr,
    };

    const { container } = render(<Mascot userData={userData as UserData} reversed={true} />);
    const div = container.querySelector('.mascot-container');
    expect(div?.className).toContain('reversed');
    expect(div?.className).toContain('is-done');
  });
});
