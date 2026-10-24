import React from 'react';

import { render } from '@testing-library/react';

import '@testing-library/jest-dom';

import { renderImage as MarkdownImage, safeImageSrc } from 'components/Markdown';

// The Markdown pipeline's dependencies ship as ESM that jest doesn't transform; the image
// renderer doesn't use them, so stub them out.
jest.mock('github-slugger', () => ({ slug: (s: string) => s }));
jest.mock('react-markdown', () => ({ __esModule: true, default: () => null }));
jest.mock('react-syntax-highlighter', () => ({ __esModule: true, default: () => null }));
jest.mock('react-syntax-highlighter/dist/cjs/styles/hljs', () => ({ a11yDark: {}, a11yLight: {} }));
jest.mock('markdown/parser', () => ({
  ALL_PLUGINS: [],
  ALL_REHYPE_PLUGINS: [],
  LIMITED_REHYPE_PLUGINS: [],
  NO_CONTAINER_PLUGINS: [],
}));

// jsdom serves the page from http://localhost, so "same-site" below means localhost.
const renderImage = (src: string | undefined, alt?: string) => {
  const { container } = render(<MarkdownImage src={src} alt={alt} />);
  return { container, images: Array.from(container.querySelectorAll('img')) };
};

describe('Markdown images', () => {
  it('renders external http(s) images', () => {
    const { images } = renderImage('https://i.imgur.com/goblin.png', 'a goblin');
    expect(images).toHaveLength(1);
    expect(images[0]).toHaveAttribute('src', 'https://i.imgur.com/goblin.png');
    expect(images[0]).toHaveAttribute('alt', 'a goblin');
  });

  it.each([
    ['relative path', '/patreon/unlink'],
    ['relative path without slash', 'user/logout'],
    ['protocol-relative URL', '//localhost/user/logout'],
    ['same-origin absolute URL', 'http://localhost/cube/feature/abc'],
    ['subdomain of the page host', 'https://www.localhost/user/follow/abc'],
    ['javascript: URL', 'javascript:alert(1)'],
    ['data: URL', 'data:image/svg+xml,<svg></svg>'],
  ])('does not load a %s, and shows the alt text instead', (_label, src) => {
    const { container, images } = renderImage(src, 'blocked image');
    expect(images).toHaveLength(0);
    expect(container).toHaveTextContent('blocked image');
  });

  it('shows a placeholder when a blocked image has no alt text', () => {
    const { container, images } = renderImage('/patreon/unlink');
    expect(images).toHaveLength(0);
    expect(container).toHaveTextContent('Image not shown');
  });
});

describe('safeImageSrc', () => {
  it('accepts only absolute http(s) URLs on other sites', () => {
    expect(safeImageSrc('https://cards.scryfall.io/normal/front/a.jpg')).toBe(
      'https://cards.scryfall.io/normal/front/a.jpg',
    );
    expect(safeImageSrc('http://example.com/x.png')).toBe('http://example.com/x.png');
    expect(safeImageSrc('/tool/cardimage/abc')).toBeNull();
    expect(safeImageSrc('http://LOCALHOST/x.png')).toBeNull();
    expect(safeImageSrc('ftp://example.com/x.png')).toBeNull();
    expect(safeImageSrc(undefined)).toBeNull();
  });
});
