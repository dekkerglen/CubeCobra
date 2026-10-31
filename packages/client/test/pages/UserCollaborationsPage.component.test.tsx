import React from 'react';

import { fireEvent, render, screen, waitFor } from '@testing-library/react';

import '@testing-library/jest-dom';

import Cube from '@utils/datatypes/Cube';

import { CSRFContext } from '../../src/contexts/CSRFContext';
import UserContext from '../../src/contexts/UserContext';
import { UserCollaborationsPage } from '../../src/pages/UserCollaborationsPage';

jest.mock('components/RenderToRoot', () => ({ __esModule: true, default: (Component: any) => Component }));
jest.mock('layouts/MainLayout', () => ({
  __esModule: true,
  default: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));
jest.mock('layouts/UserLayout', () => ({
  __esModule: true,
  default: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));
jest.mock('components/DynamicFlash', () => ({ __esModule: true, default: () => null }));
// Stand in for the cube tile: the real one dereferences image and owner, which these name-only
// fixtures deliberately omit.
jest.mock('components/cube/CubePreview', () => ({
  __esModule: true,
  default: ({ cube }: { cube: Cube }) => <div>{cube.name}</div>,
}));

const owner = { id: 'owner-1', username: 'owner' } as any;
const shared = { id: 'c9', shortId: 'c9', name: 'Shared Cube' } as any;

const renderPage = (props: any = {}, viewer: any = owner, csrfFetch: any = jest.fn()) =>
  render(
    <CSRFContext.Provider value={{ csrfFetch, csrfToken: 'token' } as any}>
      <UserContext.Provider value={viewer}>
        <UserCollaborationsPage
          owner={owner}
          followersCount={0}
          followingCount={0}
          following={false}
          cubes={[]}
          nextOffset={0}
          hasMore={false}
          {...props}
        />
      </UserContext.Provider>
    </CSRFContext.Provider>,
  );

describe('UserCollaborationsPage', () => {
  it('lists the cubes the user collaborates on', () => {
    renderPage({ cubes: [shared], nextOffset: 36 });

    expect(screen.getByText('Collaborations (1)')).toBeInTheDocument();
    expect(screen.getByText('Shared Cube')).toBeInTheDocument();
  });

  it('marks the count as partial while more pages remain', () => {
    renderPage({ cubes: [shared], nextOffset: 36, hasMore: true });

    expect(screen.getByText('Collaborations (1+)')).toBeInTheDocument();
  });

  it('tells the owner they have no collaborations yet', () => {
    renderPage({ cubes: [] });

    expect(screen.getByText('You are not a collaborator on any cubes yet.')).toBeInTheDocument();
  });

  it('phrases the empty state in the third person for a visitor', () => {
    renderPage({ cubes: [] }, { id: 'someone-else' });

    expect(screen.getByText('This user is not a collaborator on any cubes yet.')).toBeInTheDocument();
  });

  // Pagination renders icon-only buttons whose octicons are aria-hidden, so there is no accessible
  // name to query by; the arrow-right glyph is the only stable handle on the next-page control.
  const clickNextPage = () => {
    const next = document.querySelector('.octicon-arrow-right')?.closest('button');
    expect(next).toBeEnabled();
    fireEvent.click(next!);
  };

  it('asks the server for the next page from the offset it was given', async () => {
    const csrfFetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ success: 'true', cubes: [], nextOffset: 72, hasMore: false }),
    });

    renderPage({ cubes: [shared], nextOffset: 36, hasMore: true }, owner, csrfFetch);
    clickNextPage();

    await waitFor(() => expect(csrfFetch).toHaveBeenCalled());
    const [url, init] = csrfFetch.mock.calls[0];
    expect(url).toBe('/user/getmorecollaborations');
    expect(JSON.parse(init.body)).toEqual({ owner: 'owner-1', offset: 36 });
  });

  it('appends the next page rather than replacing the current one', async () => {
    // A full first page, so advancing lands on a page the fetched cube actually occupies.
    const firstPage = Array.from({ length: 36 }, (_, i) => ({ id: `p${i}`, shortId: `p${i}`, name: `Cube ${i}` }));
    const csrfFetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        success: 'true',
        cubes: [{ id: 'c10', shortId: 'c10', name: 'Later Cube' }],
        nextOffset: 72,
        hasMore: false,
      }),
    });

    renderPage({ cubes: firstPage, nextOffset: 36, hasMore: true }, owner, csrfFetch);
    expect(screen.getByText('Cube 0')).toBeInTheDocument();

    clickNextPage();

    await waitFor(() => expect(screen.getByText('Collaborations (37)')).toBeInTheDocument());
    expect(screen.getByText('Later Cube')).toBeInTheDocument();
    // The first page is retained in state, not discarded - it is simply on the previous page now.
    expect(screen.queryByText('Cube 0')).not.toBeInTheDocument();
  });
});
