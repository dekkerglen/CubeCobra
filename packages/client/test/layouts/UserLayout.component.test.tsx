import React from 'react';

import { render, screen } from '@testing-library/react';

import '@testing-library/jest-dom';

import User, { UserRoles } from '@utils/datatypes/User';

import UserContext from 'contexts/UserContext';
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

const renderWithUser = (overrides: Partial<User> = {}) =>
  render(
    <UserContext.Provider value={{ id: 'u1' } as unknown as User}>
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
      />
    </UserContext.Provider>,
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

describe('UserLayout narrow column', () => {
  it('reserves a column for the avatar when the user has one', () => {
    renderLayout();
    expect(screen.getByText('demo').closest('div.grid')).toHaveClass('grid-cols-[auto_1fr]');
  });

  it('fills the row when the user has no image', () => {
    renderLayout({ image: undefined });
    expect(screen.queryByRole('img')).not.toBeInTheDocument();
    const row = screen.getByText('demo').closest('div.grid')!;
    expect(row).toHaveClass('grid-cols-1');
    expect(row).not.toHaveClass('grid-cols-[auto_1fr]');
  });

  it('keeps the artist credit anchored to the image, not the stretched grid cell', () => {
    renderLayout();
    const wrapper = screen.getByAltText('Art by Janet Aulisio').parentElement!;
    expect(wrapper).toHaveClass('relative', 'self-start');
  });

  it('wraps a long username instead of overflowing the column', () => {
    const long = 'a'.repeat(60);
    renderLayout({ username: long });
    expect(screen.getByText(long)).toHaveClass('break-words');
  });

  it('wraps the badge row', () => {
    renderLayout({ roles: [UserRoles.ADMIN] });
    expect(screen.getByText('Admin').closest('div.flex')).toHaveClass('flex-wrap');
  });

  it('puts the follow buttons in a cell that spans the whole row below sm', () => {
    renderLayout();
    const cell = screen.getByText('Follow').closest('div.col-span-full')!;
    expect(cell).toHaveClass('sm:col-start-2');
  });

  it('puts Edit Profile in the same cell the follow buttons use', () => {
    renderWithUser();
    const cell = screen.getByText('Edit Profile').closest('div.col-span-full')!;
    expect(cell).toHaveClass('sm:col-start-2');
  });

  it('keeps the button cell inside the single column when there is no image', () => {
    renderLayout({ image: undefined });
    const cell = screen.getByText('Follow').closest('div.col-span-full')!;
    expect(cell).not.toHaveClass('sm:col-start-2');
  });
});
