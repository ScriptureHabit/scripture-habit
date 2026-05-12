import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import StreakCalendar from '../streak-calendar';

describe('StreakCalendar', () => {
  const mockT = (key: string) => key;

  it('renders the calendar and legend', () => {
    render(<StreakCalendar t={mockT} />);
    expect(screen.getByText(/dashboard.studied/i)).toBeDefined();
    expect(screen.getByText(/dashboard.notStudied/i)).toBeDefined();
    expect(screen.getByText(/dashboard.kickLimit/i)).toBeDefined();
  });

  it('marks the kick date cell with the correct class', () => {
    // We need to know which date is being rendered.
    // The calendar defaults to current month.
    const today = new Date();
    const kickDate = today.toLocaleDateString('sv-SE');
    
    const { container } = render(<StreakCalendar t={mockT} kickDate={kickDate} />);
    
    const kickCell = container.querySelector('.calendar-cell.kick-deadline');
    expect(kickCell).not.toBeNull();
    
    const kickIndicator = container.querySelector('.kick-indicator');
    expect(kickIndicator).not.toBeNull();
  });

  it('marks studied dates with the correct class', () => {
    const today = new Date();
    const studiedDate = today.toLocaleDateString('sv-SE');
    
    const { container } = render(<StreakCalendar t={mockT} studiedDates={[studiedDate]} />);
    
    const studiedCell = container.querySelector('.calendar-cell.studied');
    expect(studiedCell).not.toBeNull();
    
    const studiedIndicator = container.querySelector('.studied-indicator');
    expect(studiedIndicator).not.toBeNull();
  });
});
