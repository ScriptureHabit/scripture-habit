import { describe, it, expect } from 'vitest';
import { isStudyMilestone, getNextMilestone } from '../milestone';

describe('Milestone Property & Range-based Comprehensive Testing', () => {
  it('strictly satisfies invariant: getNextMilestone(d) is always strictly greater than d', () => {
    for (let d = 0; d <= 1000; d++) {
      const next = getNextMilestone(d);
      expect(next).toBeGreaterThan(d);
    }
  });

  it('strictly satisfies invariant: getNextMilestone(d) is always a valid study milestone', () => {
    for (let d = 0; d <= 1000; d++) {
      const next = getNextMilestone(d);
      expect(isStudyMilestone(next)).toBe(true);
    }
  });

  it('always sets 10 as the first milestone for all days from 0 to 9', () => {
    for (let d = 0; d < 10; d++) {
      expect(getNextMilestone(d)).toBe(10);
    }
  });

  it('always sets 25 as the second milestone for all days from 10 to 24', () => {
    for (let d = 10; d < 25; d++) {
      expect(getNextMilestone(d)).toBe(25);
    }
  });

  it('correctly transitions through milestone intervals (50, 75, 100, 125, ...)', () => {
    const milestones = [10, 25, 50, 75, 100, 125, 150, 175, 200, 250, 500, 1000];

    for (const m of milestones) {
      expect(isStudyMilestone(m)).toBe(true);
      // Day before milestone should target this milestone
      if (m > 10) {
        expect(getNextMilestone(m - 1)).toBe(m);
      }
      // On milestone day, target should advance to the next milestone
      const next = getNextMilestone(m);
      expect(next).toBeGreaterThan(m);
    }
  });

  it('handles negative or invalid day numbers safely without crashing', () => {
    expect(getNextMilestone(-1)).toBe(10);
    expect(getNextMilestone(-100)).toBe(10);
    expect(isStudyMilestone(-5)).toBe(false);
    expect(isStudyMilestone(0)).toBe(false);
  });
});
