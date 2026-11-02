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

describe('card images in table cells', () => {
  const cellWrapper = (markdown: string) =>
    renderMarkdown(markdown).querySelector('td .markdown-card-image') as HTMLElement;

  it('renders inline-block at a fixed width so the cell alignment applies', () => {
    const wrapper = cellWrapper('| A |\n| :-: |\n| [[!Hexdrinker]] |\n');
    expect(wrapper).toHaveClass('inline-block', 'w-44', 'max-w-full');
    expect(wrapper).not.toHaveClass('w-1/2');
    expect(wrapper).not.toHaveClass('lg:w-1/4');
  });

  it.each([
    ['center', '| A |\n| :-: |\n| [[!Hexdrinker]] |\n'],
    ['right', '| A |\n| --: |\n| [[!Hexdrinker]] |\n'],
    ['left', '| A |\n| :-- |\n| [[!Hexdrinker]] |\n'],
  ])('is alignment-agnostic for a %s-aligned column', (align, markdown) => {
    const wrapper = cellWrapper(markdown);
    expect(wrapper).toHaveClass('inline-block');
    expect(wrapper.closest('td')!.style.textAlign).toBe(align);
  });

  it('applies inside a cardrow nested in a cell', () => {
    const wrapper = cellWrapper('| A |\n| :-: |\n| <<[[!Hexdrinker]][[!Lotus Cobra]]>> |\n');
    expect(wrapper).toHaveClass('inline-block');
  });

  it('applies to a double-faced card image after prefix stripping', () => {
    const wrapper = cellWrapper('| A |\n| :-: |\n| [[!//Delver of Secrets]] |\n');
    expect(wrapper).toHaveClass('inline-block');
    expect(wrapper.querySelector('a')).toHaveAttribute('href', '/tool/card/Delver%20of%20Secrets');
  });

  it('flows several images in one cell', () => {
    const container = renderMarkdown('| A |\n| :-: |\n| [[!Hexdrinker]] [[!Lotus Cobra]] |\n');
    const wrappers = container.querySelectorAll('td .markdown-card-image');
    expect(wrappers).toHaveLength(2);
    wrappers.forEach((w) => expect(w).toHaveClass('inline-block'));
  });

  it('keeps an image and text in the same cell', () => {
    const cell = renderMarkdown('| A |\n| :-: |\n| before [[!Hexdrinker]] after |\n').querySelector('td')!;
    expect(cell).toHaveTextContent('before');
    expect(cell).toHaveTextContent('after');
    expect(cell.querySelector('.markdown-card-image')).toBeInTheDocument();
  });

  it('leaves a card link in a cell alone', () => {
    const cell = renderMarkdown('| A |\n| :-: |\n| [[Sol Ring]] |\n').querySelector('td')!;
    expect(cell.querySelector('.markdown-card-image')).not.toBeInTheDocument();
    expect(cell.querySelector('a')).toHaveTextContent('Sol Ring');
  });
});

/* Characterisation tests: these pin behaviour that must SURVIVE the removal of the inert `limited`
 * mode and the dead heading-autolink branch, so they are green before and after by design. Heading ids
 * come from generateHeadingId in the heading renderers, not from the rehype-slug plugin that was
 * removed long ago - conflating the two would silently break every wiki table of contents.
 */
describe('heading anchors and links survive', () => {
  it('still gives headings slugged ids for the table of contents', () => {
    const container = renderMarkdown('# Basic Formatting\n\n## Linking Cards\n');
    expect(container.querySelector('#basic-formatting')).toBeInTheDocument();
    expect(container.querySelector('#linking-cards')).toBeInTheDocument();
  });

  it('renders ordinary internal and external links unchanged', () => {
    const internal = renderMarkdown('[a cube](/cube/list/abc)\n').querySelector('a');
    expect(internal).toHaveAttribute('href', '/cube/list/abc');
    const external = renderMarkdown('[out](https://example.com/x)\n').querySelector('a');
    expect(external).toHaveAttribute('href', '/leave?url=https%3A%2F%2Fexample.com%2Fx');
  });
});
