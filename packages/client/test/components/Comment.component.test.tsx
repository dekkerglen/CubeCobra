import React from 'react';

import { render, screen } from '@testing-library/react';

import '@testing-library/jest-dom';

import CommentData from '@utils/datatypes/Comment';

import Comment from 'components/comments/Comment';

// Comment pulls in markdown rendering, modals and the comment-fetching hook. None of that is
// relevant to the owner-fallback behaviour under test, so stub it out.
jest.mock('components/Markdown', () => ({
  __esModule: true,
  default: ({ markdown }: { markdown: string }) => <div>{markdown}</div>,
}));

jest.mock('components/comments/CommentEntry', () => ({
  __esModule: true,
  default: () => <div />,
}));

jest.mock('components/modals/ReportCommentModal', () => ({
  __esModule: true,
  default: () => <div />,
}));

jest.mock('components/modals/ShareCommentModal', () => ({
  __esModule: true,
  default: () => <div />,
}));

jest.mock('hooks/UseComments', () => ({
  __esModule: true,
  default: () => [[], jest.fn(), false, jest.fn(), jest.fn()],
}));

const buildComment = (overrides: Partial<CommentData> = {}): CommentData =>
  ({
    id: 'comment-1',
    date: 1700000000000,
    body: 'A comment body',
    owner: {
      id: 'user-1',
      username: 'somebody',
    },
    ...overrides,
  }) as CommentData;

describe('Comment owner fallback', () => {
  it('renders the owner username when present', () => {
    render(<Comment comment={buildComment()} index={0} editComment={jest.fn()} />);

    expect(screen.getByText('somebody')).toBeInTheDocument();
  });

  it('does not mutate the comment prop when the owner is missing', () => {
    const comment = buildComment({ owner: undefined });

    render(<Comment comment={comment} index={0} editComment={jest.fn()} />);

    // The component used to assign a placeholder onto `comment.owner` during render, mutating
    // an object its parent still owned.
    expect(comment.owner).toBeUndefined();
  });

  it('renders an anonymous comment without crashing when the owner is missing', () => {
    const comment = buildComment({ owner: undefined });

    render(<Comment comment={comment} index={0} editComment={jest.fn()} />);

    expect(screen.getByText('A comment body')).toBeInTheDocument();
    expect(screen.queryByText('somebody')).not.toBeInTheDocument();
  });
});
