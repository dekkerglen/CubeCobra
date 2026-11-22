import React from 'react';

import { render, screen } from '@testing-library/react';

import '@testing-library/jest-dom';

import BlogPostData from '@utils/datatypes/BlogPost';
import Card from '@utils/datatypes/Card';

import BlogPost from 'components/blog/BlogPost';

jest.mock('components/blog/ChangelogCardView', () => ({
  __esModule: true,
  default: () => <div>cards-view</div>,
}));

jest.mock('components/blog/BlogPostChangelog', () => ({
  __esModule: true,
  default: () => <div>text-changelog</div>,
}));

jest.mock('components/Markdown', () => ({
  __esModule: true,
  default: ({ markdown }: { markdown: string }) => <div>{markdown}</div>,
}));

jest.mock('components/comments/CommentsSection', () => ({
  __esModule: true,
  default: () => <div />,
}));

const buildPost = (overrides: Partial<BlogPostData> = {}): BlogPostData =>
  ({
    id: 'post-1',
    title: 'A post',
    body: 'Body text',
    owner: { id: 'owner-1', username: 'owner' },
    date: 1700000000000,
    cube: 'cube-1',
    cubeName: 'Cube',
    changelist: 'changelog-1',
    Changelog: { mainboard: { adds: [{ cardID: 'A' } as Card] } },
    ...overrides,
  }) as BlogPostData;

describe('BlogPost', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('feeds render the text changelog with no toggle', () => {
    render(<BlogPost post={buildPost()} />);

    expect(screen.getByText('text-changelog')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Cards' })).not.toBeInTheDocument();
  });

  it('cards view shows the body before the cards', () => {
    render(<BlogPost post={buildPost()} changelogViewToggle />);

    const body = screen.getByText('Body text');
    const cards = screen.getByText('cards-view');
    expect(body.compareDocumentPosition(cards) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(screen.queryByText('text-changelog')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Cards' })).toHaveAttribute('aria-pressed', 'true');
  });

  it('text view keeps the two-column layout', () => {
    localStorage.setItem('changelogView', '"text"');
    render(<BlogPost post={buildPost()} changelogViewToggle />);

    expect(screen.getByText('text-changelog')).toBeInTheDocument();
    expect(screen.getByText('Body text')).toBeInTheDocument();
    expect(screen.queryByText('cards-view')).not.toBeInTheDocument();
  });

  it('posts without a changelog show no toggle', () => {
    render(<BlogPost post={buildPost({ Changelog: undefined })} changelogViewToggle />);

    expect(screen.queryByRole('button', { name: 'Cards' })).not.toBeInTheDocument();
  });
});
