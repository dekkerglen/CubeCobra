import React from 'react';

import { render } from '@testing-library/react';

import '@testing-library/jest-dom';

// `components/Markdown` pulls in react-syntax-highlighter for code blocks, which depends on the
// ESM-only refractor. That is unrelated to Markdown parsing, so it is the one thing we stub; every
// other plugin in the pipeline runs for real.
jest.mock('react-syntax-highlighter', () => ({ __esModule: true, default: () => null }));
jest.mock('react-syntax-highlighter/dist/cjs/styles/hljs', () => ({ a11yDark: {}, a11yLight: {} }));

import Markdown from 'components/Markdown';

const renderMarkdown = (markdown: string) => render(<Markdown markdown={markdown} />).container;

describe('the real Markdown pipeline', () => {
  it('renders each custom extension', () => {
    const container = renderMarkdown('{W} @bob [[Sol Ring]] [[!Hexdrinker]]\n\n>>> centered <<<\n');
    expect(container.querySelector('img[alt="w"]')).toBeInTheDocument();
    expect(container.querySelector('a[href="/user/view/bob"]')).toBeInTheDocument();
    expect(container.querySelector('a[href="/tool/card/Sol%20Ring"]')).toBeInTheDocument();
    expect(container.querySelector('.markdown-card-image')).toBeInTheDocument();
    expect(container.querySelector('.text-center')).toHaveTextContent('centered');
  });

  it('renders gfm tables with column alignment on cells', () => {
    const container = renderMarkdown('| A | B |\n| :-: | --: |\n| one | two |\n');
    const cells = Array.from(container.querySelectorAll('tbody td'));
    expect(cells.map((c) => (c as HTMLElement).style.textAlign)).toEqual(['center', 'right']);
  });

  it('renders a card image outside a table as a half/quarter-width block', () => {
    const wrapper = renderMarkdown('[[!Hexdrinker]]\n').querySelector('.markdown-card-image');
    expect(wrapper).toHaveClass('w-1/2', 'lg:w-1/4');
  });
});
