import { setupCommonMocks, mockNavigate } from './join-group-test-helpers';
import { render, screen } from '@testing-library/react';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import JoinGroup from '../join-group';
import { MemoryRouter } from 'react-router-dom';

vi.mock('../hooks/use-join-group');
vi.mock('../../../hooks/use-language');
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});

describe('JoinGroup Component Basic Logic', () => {
  beforeEach(() => {
    setupCommonMocks();
  });

  it('filters out groups the user is already a member of', async () => {
    render(
      <MemoryRouter>
        <JoinGroup />
      </MemoryRouter>
    );

    // Group 1 should be filtered out, only Group 2 should be visible.
    expect(await screen.findByText('Group 2')).toBeInTheDocument();
    expect(screen.queryByText('Group 1')).not.toBeInTheDocument();
  });

  it('shows skeleton loader when loading', async () => {
    setupCommonMocks({ loadingGroups: true });

    render(
      <MemoryRouter>
        <JoinGroup />
      </MemoryRouter>
    );

    expect(screen.getByText('joinGroup.fetchingGroups')).toBeInTheDocument();
    const skeletonGrid = screen.getByTestId('skeleton-loader');
    expect(skeletonGrid).toBeInTheDocument();
  });

  it('shows empty message when no public groups remain after filtering', async () => {
    setupCommonMocks({
      groupIds: ['group-1', 'group-2']
    });

    render(
      <MemoryRouter>
        <JoinGroup />
      </MemoryRouter>
    );

    expect(await screen.findByText('joinGroup.noPublicGroups')).toBeInTheDocument();
    expect(screen.queryByText('Group 1')).not.toBeInTheDocument();
  });

  it('successfully fetches public groups from backend API', async () => {
    setupCommonMocks({
      publicGroups: [
        { id: 'group-api-1', name: 'API Group 1', isPublic: true, members: ['other-user'] }
      ]
    });

    render(
      <MemoryRouter>
        <JoinGroup />
      </MemoryRouter>
    );

    expect(await screen.findByText('API Group 1')).toBeInTheDocument();
  });
});
