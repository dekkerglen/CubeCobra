import React from 'react';

import { render, screen } from '@testing-library/react';

import '@testing-library/jest-dom';

import User from '@utils/datatypes/User';

import UserLayout from 'layouts/UserLayout';

jest.mock('components/Markdown', () => ({ SafeMarkdown: () => <div /> }));
jest.mock('components/modals/ConfirmActionModal', () => () => <div />);

const renderLayout = (overrides: Partial<User> = {}) =>
  render(
    <UserLayout
      user={
        {
          id: 'u1',
          username: 'demo',
          image: { uri: 'http://img/a.jpg', artist: 'Janet Aulisio' },
          ...overrides,
        } as unknown as User
      }
      followersCount={12}
      followingCount={8}
      following={false}
      activeLink="view"
    />,
  );

describe('UserLayout profile avatar', () => {
  it('bounds the avatar below lg and restores the full-width square at lg', () => {
    renderLayout();
    const img = screen.getByAltText('Art by Janet Aulisio');
    expect(img).toHaveClass('w-28', 'h-28', 'sm:w-52', 'sm:h-52');
    expect(img).toHaveClass('lg:w-full', 'lg:aspect-square');
    expect(img.className).not.toMatch(/(^|\s)w-full(\s|$)/);
    expect(img.className).not.toMatch(/(^|\s)aspect-square(\s|$)/);
  });

  it('places the image and the username in the same row container', () => {
    renderLayout();
    const img = screen.getByAltText('Art by Janet Aulisio');
    const row = img.closest('div.grid')!;
    expect(row).toHaveClass('lg:block');
    expect(row).toHaveTextContent('demo');
  });

  it('keeps the artist credit visible and adds it as a tooltip', () => {
    renderLayout();
    expect(screen.getByText(/Janet Aulisio/)).toBeInTheDocument();
    expect(screen.getByAltText('Art by Janet Aulisio')).toHaveAttribute('title', 'Art by Janet Aulisio');
  });
});
