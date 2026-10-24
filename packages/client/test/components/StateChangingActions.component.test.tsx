import React from 'react';

import { fireEvent, render, screen, waitFor } from '@testing-library/react';

import '@testing-library/jest-dom';

import BlogPost from '@utils/datatypes/BlogPost';
import CardPackageData from '@utils/datatypes/CardPackage';
import User from '@utils/datatypes/User';

import CardPackage from 'components/card/CardPackage';
import ConfirmActionModal from 'components/modals/ConfirmActionModal';
import DeleteBlogModal from 'components/modals/DeleteBlogModal';
import { CSRFContext } from 'contexts/CSRFContext';
import UserContext from 'contexts/UserContext';
import UserLayout from 'layouts/UserLayout';

jest.mock('components/Markdown', () => ({ SafeMarkdown: () => <div /> }));
jest.mock('components/card/CardGrid', () => () => <div />);

/*
 * These controls hit routes that change state, which the server now only accepts as POST. Each
 * must render as a POST form (or fetch with method POST), never as a link a GET could follow.
 */
const expectPostForm = (button: HTMLElement, action: string) => {
  const form = button.closest('form');
  expect(button).toHaveAttribute('type', 'submit');
  expect(form).toHaveAttribute('method', 'POST');
  expect(form).toHaveAttribute('action', action);
  expect(document.querySelector(`a[href="${action}"]`)).toBeNull();
};

const profileUser = { id: 'u2', username: 'other' } as User;

describe('ConfirmActionModal', () => {
  it('posts to its target when confirmed', () => {
    render(
      <ConfirmActionModal
        isOpen
        setOpen={jest.fn()}
        title="Report Cube"
        message="Are you sure?"
        target="/cube/report/c1"
        buttonText="Report Cube"
      />,
    );

    expectPostForm(screen.getByRole('button', { name: 'Report Cube' }), '/cube/report/c1');
  });
});

describe('DeleteBlogModal', () => {
  it('deletes the post with a POST form', () => {
    render(<DeleteBlogModal isOpen setOpen={jest.fn()} post={{ id: 'b1' } as BlogPost} />);

    expectPostForm(screen.getByRole('button', { name: 'Delete' }), '/cube/blog/remove/b1');
  });
});

describe('UserLayout', () => {
  const renderLayout = (following: boolean) =>
    render(
      <UserContext.Provider value={{ id: 'u1', username: 'me' } as User}>
        <UserLayout user={profileUser} followersCount={0} followingCount={0} following={following} activeLink="view" />
      </UserContext.Provider>,
    );

  it('follows with a POST form', () => {
    renderLayout(false);
    expectPostForm(screen.getByRole('button', { name: 'Follow' }), '/user/follow/u2');
  });

  it('unfollows with a POST form', () => {
    renderLayout(true);
    expectPostForm(screen.getByRole('button', { name: 'Unfollow' }), '/user/unfollow/u2');
  });
});

describe('CardPackage', () => {
  it('votes with a POST request', async () => {
    const csrfFetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ success: 'true', voters: ['u1'] }),
    });
    const cardPackage = {
      id: 'p1',
      title: 'Package',
      date: Date.now(),
      owner: profileUser,
      cards: [],
      keywords: [],
      voters: [],
      voteCount: 0,
    } as unknown as CardPackageData;

    render(
      <CSRFContext.Provider value={{ csrfToken: '', csrfFetch, callApi: jest.fn() }}>
        <UserContext.Provider value={{ id: 'u1', username: 'me', cubes: [] } as unknown as User}>
          <CardPackage cardPackage={cardPackage} />
        </UserContext.Provider>
      </CSRFContext.Provider>,
    );

    fireEvent.click(screen.getByRole('button', { name: '0' }));

    await waitFor(() => expect(csrfFetch).toHaveBeenCalledWith('/packages/upvote/p1', { method: 'POST' }));
  });
});
