import { setupCommonMocks } from './join-group-test-helpers';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import JoinGroup from '../join-group';
import { MemoryRouter } from 'react-router-dom';
import { useJoinGroup } from '../hooks/use-join-group';

describe('JoinGroup Component - Pagination and Translation UI', () => {
  beforeEach(() => {
    setupCommonMocks();
  });

  it('renders pagination buttons and triggers handlePageChange on click', async () => {
    const user = userEvent.setup();
    const handlePageChangeMock = vi.fn();

    // Configure mock to simulate multiple pages
    setupCommonMocks({
      publicGroups: Array.from({ length: 6 }, (_, i) => ({
        id: `group-${i + 1}`,
        name: `Group ${i + 1}`,
        isPublic: true,
        members: ['other-user']
      }))
    });

    // We can directly mock specific fields of useJoinGroup for granular control
    const originalHookReturn = vi.mocked(useJoinGroup)();
    vi.mocked(useJoinGroup).mockReturnValue({
      ...originalHookReturn,
      totalPages: 2,
      handlePageChange: handlePageChangeMock
    });

    render(
      <MemoryRouter>
        <JoinGroup />
      </MemoryRouter>
    );

    const nextBtn = screen.getByText('→');
    expect(nextBtn).toBeInTheDocument();
    await user.click(nextBtn);

    expect(handlePageChangeMock).toHaveBeenCalledWith(2);
  });

  it('renders translated group details when they are provided by the hook', async () => {
    const user = userEvent.setup();

    setupCommonMocks({
      publicGroups: [
        {
          id: 'group-3',
          name: 'Original Name',
          description: 'Original Description',
          isPublic: true,
          members: ['other-user'],
          memberPreviews: [{ uid: 'm1', nickname: 'Member 1' }]
        }
      ],
      translatedNames: { 'group-3': 'Translated Name' },
      translatedDescs: { 'group-3': 'Translated Description' }
    });

    render(
      <MemoryRouter>
        <JoinGroup />
      </MemoryRouter>
    );

    const detailsBtn = await screen.findByRole('button', { name: 'groupCard.details' });
    await user.click(detailsBtn);

    expect(screen.getByText('Translated Name')).toBeInTheDocument();
    expect(screen.getByText('Translated Description')).toBeInTheDocument();
    expect(screen.getByText('Member 1')).toBeInTheDocument();
  });
});
