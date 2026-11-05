import React from 'react';

import { fireEvent, render, screen } from '@testing-library/react';

import '@testing-library/jest-dom';

import CardOrientationFrame from 'components/card/CardOrientationFrame';

describe('CardOrientationFrame', () => {
  it('renders children untouched when portrait', () => {
    const { container } = render(
      <CardOrientationFrame orientation="portrait">
        <img alt="card" src="a.jpg" />
      </CardOrientationFrame>,
    );
    expect(screen.getByAltText('card')).toBeInTheDocument();
    expect(container.querySelector('[style*="rotate"]')).toBeNull();
  });

  it('gives the root a landscape box and rotates the inner box when landscape', () => {
    const { container } = render(
      <CardOrientationFrame orientation="landscape">
        <img alt="card" src="a.jpg" />
      </CardOrientationFrame>,
    );
    const root = container.firstElementChild as HTMLElement;
    expect(root).toHaveStyle({ aspectRatio: '680 / 488' });
    const inner = root.firstElementChild as HTMLElement;
    expect(inner).toHaveStyle({ aspectRatio: '488 / 680' });
    expect(inner.className + (inner.getAttribute('style') ?? '')).toMatch(/rotate-90|rotate\(90deg\)/);
  });

  it('applies the requested width', () => {
    const { container } = render(
      <CardOrientationFrame orientation="landscape" width="20.9016rem">
        <img alt="card" src="a.jpg" />
      </CardOrientationFrame>,
    );
    expect(container.firstElementChild).toHaveStyle({ width: '20.9016rem' });
  });

  it('forwards className and DOM handlers to the root', () => {
    const onMouseEnter = jest.fn();
    const { container } = render(
      <CardOrientationFrame orientation="landscape" className="mine" onMouseEnter={onMouseEnter}>
        <img alt="card" src="a.jpg" />
      </CardOrientationFrame>,
    );
    const root = container.firstElementChild as HTMLElement;
    expect(root).toHaveClass('mine');
    fireEvent.mouseEnter(root);
    expect(onMouseEnter).toHaveBeenCalled();
  });
});
