import React from 'react';

import { render, screen } from '@testing-library/react';

import '@testing-library/jest-dom';

import User from '@utils/datatypes/User';

import { CSRFContext } from 'contexts/CSRFContext';

import CubeFollowersPage from '../../src/pages/CubeFollowersPage';

jest.mock('components/RenderToRoot', () => ({ __esModule: true, default: (Component: any) => Component }));
jest.mock('layouts/MainLayout', () => ({
  __esModule: true,
  default: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));
jest.mock('layouts/CubeLayout', () => ({
  __esModule: true,
  default: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));
jest.mock('components/DynamicFlash', () => ({ __esModule: true, default: () => null }));
jest.mock('components/UserPreview', () => ({
  __esModule: true,
  default: ({ user }: any) => <div>{user.username}</div>,
}));

const makeFollowers = (count: number): User[] =>
  Array.from({ length: count }, (_, index) => ({ id: `u${index + 1}`, username: `User ${index + 1}` }) as User);

const renderPage = (followers: User[], lastKey: any = null, likeCount?: number) =>
  render(
    <CSRFContext.Provider value={{ csrfToken: 'token', csrfFetch: jest.fn(), callApi: jest.fn() } as any}>
      <CubeFollowersPage
        cube={{ id: 'cube-1', likeCount } as any}
        cards={{} as any}
        followers={followers}
        lastKey={lastKey}
      />
    </CSRFContext.Provider>,
  );

describe('CubeFollowersPage', () => {
  it('shows no pager for a cube with no likes', () => {
    renderPage([]);

    expect(screen.queryByText(/Page/)).not.toBeInTheDocument();
    expect(screen.getByText('No likes yet.')).toBeInTheDocument();
  });

  // The divider strip is visible chrome; before it tracked the pager's own visibility rule it drew
  // as an empty bordered band under every cube whose likes fit on one page.
  it('draws no empty bordered divider when every like fits on one page', () => {
    const { container } = renderPage(makeFollowers(3), null, 3);

    expect(screen.queryByText(/Page/)).not.toBeInTheDocument();
    expect(container.querySelector('.border-t')).toBeNull();
    expect(screen.getByText('User 1')).toBeInTheDocument();
  });

  it('draws no empty bordered divider when there are no likes at all', () => {
    const { container } = renderPage([]);

    expect(container.querySelector('.border-t')).toBeNull();
  });

  it('draws the bordered divider once there is a pager to put in it', () => {
    const { container } = renderPage(makeFollowers(3), { id: 'cursor' }, 3);

    expect(screen.getAllByText('Page 1').length).toBeGreaterThan(0);
    expect(container.querySelector('.border-t')).not.toBeNull();
  });

  it('keeps the server-provided like total in the header', () => {
    renderPage(makeFollowers(3), { id: 'cursor' }, 412);

    // Unlike a loaded-record count, this is a real total the server knows, so it stays.
    expect(screen.getByText('Likes (412)')).toBeInTheDocument();
  });
});
