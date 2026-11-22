import React from 'react';

import { fireEvent, render, screen } from '@testing-library/react';

import '@testing-library/jest-dom';

import BlogPostData from '@utils/datatypes/BlogPost';
import User from '@utils/datatypes/User';

import BlogPost from 'components/blog/BlogPost';
import { CSRFContext } from 'contexts/CSRFContext';
import UserContext from 'contexts/UserContext';

jest.mock('components/blog/BlogPostChangelog', () => ({
  __esModule: true,
  default: () => <div>changelog</div>,
}));

// Markdown pulls react-syntax-highlighter -> refractor, which is ESM that this Jest config
// cannot transform. Mocking it is what makes a BlogPost component test possible at all, and is
// almost certainly why the actions in this component have never had one.
jest.mock('components/Markdown', () => ({
  __esModule: true,
  default: ({ markdown }: { markdown: string }) => <div>{markdown}</div>,
}));

jest.mock('components/comments/CommentsSection', () => ({
  __esModule: true,
  default: () => <div>comments</div>,
}));

const post = (overrides: Partial<BlogPostData> = {}): BlogPostData =>
  ({
    id: 'b1',
    title: 'A post',
    body: 'words',
    date: 1700000000000,
    cube: 'cube-1',
    cubeName: 'Demo Cube',
    owner: { id: 'owner-1', username: 'owner' },
    ...overrides,
  }) as BlogPostData;

const renderPost = (postData: BlogPostData, viewerId: string | null) =>
  render(
    <CSRFContext.Provider value={{ csrfToken: 't', csrfFetch: jest.fn(), callApi: jest.fn() } as any}>
      <UserContext.Provider value={viewerId ? ({ id: viewerId } as User) : null}>
        <BlogPost post={postData} />
      </UserContext.Provider>
    </CSRFContext.Provider>,
  );

const openMenu = () => {
  const trigger = screen.getByRole('button', { name: 'Post actions' });
  // The trigger carries no onClick of its own — Dropdown wraps it in the element that toggles —
  // so the click has to bubble through React's synthetic handler rather than be dispatched raw.
  fireEvent.click(trigger);
  return trigger;
};

describe('BlogPost actions', () => {
  it('renders no actions trigger when the reader can do nothing', () => {
    // A post with no changelist, viewed by someone who cannot edit it, has an empty action list.
    // A menu that opens onto nothing is worse than no menu, so the trigger itself is absent.
    renderPost(post(), 'someone-else');

    expect(screen.queryByRole('button', { name: 'Post actions' })).not.toBeInTheDocument();
  });

  it('offers only the changelog view to a reader who does not own the post', () => {
    renderPost(post({ changelist: 'cl-1' }), 'someone-else');
    openMenu();

    expect(screen.getByText('View cube at this point in time')).toBeInTheDocument();
    expect(screen.queryByText('Edit post')).not.toBeInTheDocument();
    expect(screen.queryByText('Delete post')).not.toBeInTheDocument();
  });

  it('offers edit and delete to the owner, with delete last', () => {
    renderPost(post({ changelist: 'cl-1' }), 'owner-1');
    openMenu();

    const view = screen.getByText('View cube at this point in time');
    const edit = screen.getByText('Edit post');
    const remove = screen.getByText('Delete post');

    // Order is load-bearing: delete sits last so it is never adjacent to the action a reader
    // reaches for most, the same reasoning the record overview's menu already uses. Asserted on
    // real document order rather than a query result, because the modal-wrapped items do not
    // expose a link role and a role-scoped query silently sees only the changelog entry.
    expect(view.compareDocumentPosition(edit) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(edit.compareDocumentPosition(remove) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it('offers the owner their actions even on a post with no changelist', () => {
    renderPost(post(), 'owner-1');
    openMenu();

    expect(screen.queryByText('View cube at this point in time')).not.toBeInTheDocument();
    expect(screen.getByText('Edit post')).toBeInTheDocument();
    expect(screen.getByText('Delete post')).toBeInTheDocument();
  });
});
