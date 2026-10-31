import React from 'react';

import { render, screen } from '@testing-library/react';

import '@testing-library/jest-dom';

import Cube from '@utils/datatypes/Cube';

import { CSRFContext } from '../../src/contexts/CSRFContext';
import UserContext from '../../src/contexts/UserContext';
import { UserCubePage } from '../../src/pages/UserCubePage';

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
const cube = { id: 'c1', shortId: 'c1', name: 'Owned Cube' } as any;

const renderPage = (props: any, viewer: any) =>
  render(
    <CSRFContext.Provider value={{ csrfFetch: jest.fn(), csrfToken: 'token' } as any}>
      <UserContext.Provider value={viewer}>
        <UserCubePage owner={owner} followersCount={0} followingCount={0} following={false} cubes={[]} {...props} />
      </UserContext.Provider>
    </CSRFContext.Provider>,
  );

describe('UserCubePage', () => {
  it('offers the owner a way to create a cube', () => {
    renderPage({ cubes: [cube] }, owner);

    // Cube creation is a CSRF POST, not a navigation — there is no /cube/create page.
    expect(screen.getByRole('button', { name: /create new/i }).closest('form')).toHaveAttribute(
      'action',
      '/cube/quickadd',
    );
  });

  it('leaves liked cubes to the profile card rather than repeating it', () => {
    renderPage({ cubes: [cube] }, owner);

    // `UserLayout` already renders a counted "Liked Cubes" link in the profile card above, on this
    // and every other user page, so a button here would be a second route to one destination.
    expect(screen.queryByRole('link', { name: /liked cubes/i })).not.toBeInTheDocument();
  });

  it('still offers them when the owner has no cubes yet', () => {
    renderPage({ cubes: [] }, owner);

    expect(screen.getByText('Cubes (0)')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /create new/i })).toBeInTheDocument();
  });

  it('offers it to nobody else', () => {
    renderPage({ cubes: [cube] }, { id: 'someone-else' });

    expect(screen.queryByRole('button', { name: /create new/i })).not.toBeInTheDocument();
    expect(screen.getByText('Owned Cube')).toBeInTheDocument();
  });

  it('leaves collaborations to their own tab', () => {
    renderPage({ cubes: [cube] }, owner);

    expect(screen.queryByText(/collaborat/i)).not.toBeInTheDocument();
  });
});
