import React from 'react';

import { render } from '@testing-library/react';

import '@testing-library/jest-dom';

import { DraftFormat } from '@utils/datatypes/Draft';

import CustomDraftCard from '../../src/components/CustomDraftCard';
import Podcast from '../../src/components/content/Podcast';

jest.mock('../../src/components/Markdown', () => ({ markdown }: { markdown: string }) => <div>{markdown}</div>);
jest.mock('components/comments/CommentsSection', () => () => <div>Comments</div>);
jest.mock('components/Username', () => () => <span>Owner</span>);

const XSS =
  '<p>Hello <b>there</b></p><img src="x" onerror="alert(1)"><script>alert(2)</script><a href="javascript:alert(3)">bad</a><a href="https://example.com">good</a>';

const expectSanitized = (container: HTMLElement) => {
  expect(container.querySelector('script')).toBeNull();
  expect(container.querySelector('img[onerror]')).toBeNull();
  expect(container.querySelector('[onerror]')).toBeNull();
  expect(container.querySelector('a[href^="javascript"]')).toBeNull();
  expect(container.querySelector('a[href="https://example.com"]')).not.toBeNull();
  expect(container.querySelector('b')?.textContent).toBe('there');
};

describe('CustomDraftCard legacy html', () => {
  const format: DraftFormat = {
    title: 'Legacy Format',
    packs: [{ slots: [{ filter: '*' }], steps: null }],
    multiples: false,
    defaultSeats: 8,
    html: XSS,
  };

  it('sanitizes a legacy html description', () => {
    const { container } = render(<CustomDraftCard format={format} defaultFormat={-1} formatIndex={0} />);
    const description = container.querySelector('.description-area') as HTMLElement;
    expect(description).not.toBeNull();
    expectSanitized(description);
  });

  it('prefers markdown and ignores html when markdown is present', () => {
    const { container } = render(
      <CustomDraftCard format={{ ...format, markdown: 'Some *markdown*' }} defaultFormat={-1} formatIndex={0} />,
    );
    expect(container.querySelector('.description-area')).toBeNull();
    expect(container.querySelector('script')).toBeNull();
  });
});

describe('Podcast description', () => {
  it('sanitizes the feed description', () => {
    const { container } = render(
      <Podcast
        podcast={{ id: 'p1', title: 'A Podcast', description: XSS, owner: { id: 'u1' } } as any}
        episodes={[]}
      />,
    );
    expectSanitized(container);
  });
});
