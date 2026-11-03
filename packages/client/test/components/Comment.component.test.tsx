import React from 'react';

import { fireEvent, render, screen } from '@testing-library/react';

import '@testing-library/jest-dom';

import CommentData, { REPLY_COUNT_CAP } from '@utils/datatypes/Comment';

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

const mockUseComments = jest.fn(() => [[], jest.fn(), false, jest.fn(), null, jest.fn()]);

jest.mock('hooks/UseComments', () => ({
  __esModule: true,
  default: (...args: any[]) => (mockUseComments as any)(...args),
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

describe('Comment reply loading', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockUseComments.mockReturnValue([[], jest.fn(), false, jest.fn(), null, jest.fn()]);
  });

  const lastOptions = () => (mockUseComments as jest.Mock).mock.calls.at(-1)?.[2];

  it('does not request replies until they are expanded', () => {
    render(<Comment comment={buildComment({ replyCount: 3 })} index={0} editComment={jest.fn()} />);

    // Every rendered comment used to fetch its replies on mount purely to count them, so a
    // page of ten comments cost eleven requests.
    expect(lastOptions()).toEqual(expect.objectContaining({ enabled: false }));
  });

  it('requests replies once they are expanded', () => {
    render(<Comment comment={buildComment({ replyCount: 3 })} index={0} editComment={jest.fn()} />);

    fireEvent.click(screen.getByText(/View Replies/));

    expect(lastOptions()).toEqual(expect.objectContaining({ enabled: true }));
  });

  it('shows no reply link when replyCount is zero', () => {
    render(<Comment comment={buildComment({ replyCount: 0 })} index={0} editComment={jest.fn()} />);

    expect(screen.queryByText(/Replies/)).not.toBeInTheDocument();
  });

  it('shows no reply link and does not crash when replyCount is absent', () => {
    render(<Comment comment={buildComment()} index={0} editComment={jest.fn()} />);

    expect(screen.getByText('A comment body')).toBeInTheDocument();
    expect(screen.queryByText(/Replies/)).not.toBeInTheDocument();
    expect(screen.queryByText(/NaN|undefined/)).not.toBeInTheDocument();
  });

  it('labels the link with replyCount before replies are loaded', () => {
    render(<Comment comment={buildComment({ replyCount: 4 })} index={0} editComment={jest.fn()} />);

    expect(screen.getByText('View Replies (4)')).toBeInTheDocument();
  });

  it('renders 10+ when replyCount is at the cap', () => {
    render(<Comment comment={buildComment({ replyCount: REPLY_COUNT_CAP })} index={0} editComment={jest.fn()} />);

    expect(screen.getByText('View Replies (10+)')).toBeInTheDocument();
  });

  it('switches to the loaded count once replies arrive', () => {
    const replies = [buildComment({ id: 'r-1' }), buildComment({ id: 'r-2' })];
    mockUseComments.mockReturnValue([replies as any, jest.fn(), false, jest.fn(), null, jest.fn()]);

    render(<Comment comment={buildComment({ replyCount: REPLY_COUNT_CAP })} index={0} editComment={jest.fn()} />);
    fireEvent.click(screen.getByText(/View Replies/));

    // The server count is capped and may be stale; once the replies are in hand, count those.
    expect(screen.getByText('Hide Replies (2)')).toBeInTheDocument();
  });
});

describe('Comment reply keys', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('gives each reply its own React key', () => {
    // Every reply used to be keyed on the PARENT comment's id, so siblings collided. React
    // may then duplicate or drop rows, and per-comment state (the edit box, the reply box,
    // the expanded toggle) can attach to the wrong row.
    const replies = [buildComment({ id: 'r-1' }), buildComment({ id: 'r-2' }), buildComment({ id: 'r-3' })];
    mockUseComments.mockReturnValue([replies as any, jest.fn(), false, jest.fn(), null, jest.fn()]);
    const errors: string[] = [];
    const spy = jest.spyOn(console, 'error').mockImplementation((...args) => {
      errors.push(args.map(String).join(' '));
    });

    try {
      render(<Comment comment={buildComment({ id: 'parent-1', replyCount: 3 })} index={0} editComment={jest.fn()} />);
      fireEvent.click(screen.getByText(/View Replies/));
    } finally {
      spy.mockRestore();
    }

    expect(errors.filter((e) => /same key/i.test(e))).toEqual([]);
  });
});
