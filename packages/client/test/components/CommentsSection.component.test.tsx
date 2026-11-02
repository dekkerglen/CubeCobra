import React from 'react';

import { fireEvent, render, screen } from '@testing-library/react';

import '@testing-library/jest-dom';

import CommentType from '@utils/datatypes/Comment';

import CommentsSection from 'components/comments/CommentsSection';
import UserContext from 'contexts/UserContext';

// The section's job is which comments appear and which control loads more. Comment internals,
// the entry form's behaviour and markdown rendering are all tested elsewhere.
jest.mock('components/comments/Comment', () => ({
  __esModule: true,
  default: ({ comment }: { comment: CommentType }) => <div data-testid="comment">{comment.body}</div>,
}));

jest.mock('components/comments/CommentEntry', () => ({
  __esModule: true,
  default: () => <div data-testid="comment-entry" />,
}));

const mockGetMore = jest.fn();

let mockHookValue: any[] = [];

jest.mock('hooks/UseComments', () => ({
  __esModule: true,
  default: () => mockHookValue,
}));

const buildComments = (count: number): CommentType[] =>
  Array.from(
    { length: count },
    (_, i) => ({ id: `comment-${i}`, body: `Body ${i}`, date: 1700000000000 + i }) as CommentType,
  );

const setHook = ({ comments = [], lastKey = null }: { comments?: CommentType[]; lastKey?: string | null }) => {
  mockHookValue = [comments, jest.fn(), false, jest.fn(), lastKey, mockGetMore];
};

const renderSection = () =>
  render(
    <UserContext.Provider value={{ id: 'user-1', username: 'someone' } as any}>
      <CommentsSection parent="parent-1" parentType="blog" />
    </UserContext.Provider>,
  );

describe('CommentsSection', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    setHook({});
  });

  it('renders every loaded comment rather than only the first ten', () => {
    setHook({ comments: buildComments(25) });

    renderSection();

    expect(screen.getAllByTestId('comment')).toHaveLength(25);
    expect(screen.getByText('Body 24')).toBeInTheDocument();
  });

  it('shows no pagination control at any comment count', () => {
    setHook({ comments: buildComments(25) });

    renderSection();

    // The old client-side pager rendered "Page 1 of 3" above and below the list.
    expect(screen.queryByText(/Page \d+ of \d+/)).not.toBeInTheDocument();
  });

  it('shows Show More while the cursor reports more', () => {
    setHook({ comments: buildComments(10), lastKey: 'cursor-1' });

    renderSection();

    expect(screen.getByRole('button', { name: /show more/i })).toBeInTheDocument();
  });

  it('hides Show More when the cursor is exhausted', () => {
    setHook({ comments: buildComments(10), lastKey: null });

    renderSection();

    expect(screen.queryByRole('button', { name: /show more/i })).not.toBeInTheDocument();
  });

  it('shows Show More even when the page is shorter than ten', () => {
    // The old pager keyed off loaded count, so a short page hid the control entirely.
    setHook({ comments: buildComments(4), lastKey: 'cursor-1' });

    renderSection();

    expect(screen.getByRole('button', { name: /show more/i })).toBeInTheDocument();
  });

  it('calls getMore when Show More is clicked', () => {
    setHook({ comments: buildComments(10), lastKey: 'cursor-1' });

    renderSection();
    fireEvent.click(screen.getByRole('button', { name: /show more/i }));

    expect(mockGetMore).toHaveBeenCalled();
  });

  it('keeps the Show More button inside its container', () => {
    setHook({ comments: buildComments(10), lastKey: 'cursor-1' });

    renderSection();

    // w-full plus a horizontal margin is wider than the container by definition.
    const className = screen.getByRole('button', { name: /show more/i }).className;
    expect(className).not.toMatch(/\bw-full\b/);
    expect(className).not.toMatch(/\bm-\d|\bmx-\d/);
  });

  it('renders the entry form before the comment list', () => {
    setHook({ comments: buildComments(3) });

    const { container } = renderSection();

    const nodes = Array.from(container.querySelectorAll('[data-testid]'));
    expect(nodes.findIndex((n) => n.getAttribute('data-testid') === 'comment-entry')).toBeLessThan(
      nodes.findIndex((n) => n.getAttribute('data-testid') === 'comment'),
    );
  });
});
