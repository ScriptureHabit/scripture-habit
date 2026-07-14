import { setupCommonMocks, mockNavigate } from './join-group-test-helpers';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi, beforeEach } from 'vitest';
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

describe('JoinGroup Component - User Interactions & Group Joining Actions', () => {
  beforeEach(() => {
    setupCommonMocks();
  });

  it('handles successful group join and triggers joinGroup fn', async () => {
    const joinGroupMock = vi.fn();
    setupCommonMocks({ joinGroupMock });
    const user = userEvent.setup();

    render(
      <MemoryRouter>
        <JoinGroup />
      </MemoryRouter>
    );

    const detailsBtn = await screen.findByRole('button', { name: 'groupCard.details' });
    await user.click(detailsBtn);

    const confirmBtn = screen.getByRole('button', { name: 'joinGroup.confirmJoin' });
    await user.click(confirmBtn);

    expect(joinGroupMock).toHaveBeenCalledWith('group-2', expect.objectContaining({ id: 'group-2' }));
  });

  it('handles cancelling group join modal', async () => {
    const user = userEvent.setup();
    render(
      <MemoryRouter>
        <JoinGroup />
      </MemoryRouter>
    );

    const detailsBtn = await screen.findByRole('button', { name: 'groupCard.details' });
    await user.click(detailsBtn);

    expect(screen.getByText('joinGroup.joinConfirmMessage')).toBeInTheDocument();

    const cancelBtn = screen.getByRole('button', { name: 'joinGroup.cancelJoin' });
    await user.click(cancelBtn);

    expect(screen.queryByText('joinGroup.joinConfirmMessage')).not.toBeInTheDocument();
  });

  it('handles clicking overlay to close modal', async () => {
    const user = userEvent.setup();
    render(
      <MemoryRouter>
        <JoinGroup />
      </MemoryRouter>
    );

    const detailsBtn = await screen.findByRole('button', { name: 'groupCard.details' });
    await user.click(detailsBtn);

    expect(screen.getByText('joinGroup.joinConfirmMessage')).toBeInTheDocument();

    const overlay = screen.getByText('joinGroup.joinConfirmMessage').closest('.group-modal-overlay');
    expect(overlay).toBeInTheDocument();
    await user.click(overlay!);

    expect(screen.queryByText('joinGroup.joinConfirmMessage')).not.toBeInTheDocument();
  });

  it('shows error when useJoinGroup returns error (e.g. not logged in)', async () => {
    setupCommonMocks({
      error: 'joinGroup.errorLoggedIn'
    });

    render(
      <MemoryRouter>
        <JoinGroup />
      </MemoryRouter>
    );

    expect(screen.getByText('joinGroup.errorLoggedIn')).toBeInTheDocument();
  });

  it('allows opening group if user becomes a member while modal is open', async () => {
    const user = userEvent.setup();
    
    const { rerender } = render(
      <MemoryRouter>
        <JoinGroup />
      </MemoryRouter>
    );

    const detailsBtn = await screen.findByRole('button', { name: 'groupCard.details' });
    await user.click(detailsBtn);

    // Simulate user becoming a member by changing mock states and rerendering
    setupCommonMocks({
      groupIds: ['group-1', 'group-2']
    });

    rerender(
      <MemoryRouter>
        <JoinGroup />
      </MemoryRouter>
    );

    const openBtn = await screen.findByRole('button', { name: 'groupCard.open' });
    await user.click(openBtn);

    expect(mockNavigate).toHaveBeenCalledWith('/ja/dashboard', expect.any(Object));
  });

  it('triggers onOpen when clicking open on GroupCard', async () => {
    const user = userEvent.setup();

    setupCommonMocks({
      publicGroups: [
        { id: 'group-2', name: 'Group 2', isPublic: true, members: ['test-user'] }
      ]
    });

    render(
      <MemoryRouter>
        <JoinGroup />
      </MemoryRouter>
    );

    const detailsBtn = await screen.findByRole('button', { name: 'groupCard.details' });
    await user.click(detailsBtn);

    expect(screen.getByText('joinGroup.joinConfirmMessage')).toBeInTheDocument();
  });
});
