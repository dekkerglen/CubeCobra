import React from 'react';

import { render } from '@testing-library/react';

import '@testing-library/jest-dom';

import Sparkline from 'components/base/Sparkline';

const pointsOf = (container: HTMLElement) => container.querySelector('polyline')?.getAttribute('points');

describe('Sparkline', () => {
  it('spreads values across the width and puts the largest at the top', () => {
    const { container } = render(<Sparkline values={[0, 5, 10]} />);

    // y is inset by 2 at each edge so a thick stroke is not clipped at the extremes.
    expect(pointsOf(container)).toBe('0,98 50,50 100,2');
  });

  it('is unaffected by the absolute size of the values', () => {
    const { container } = render(<Sparkline values={[1200, 1205, 1210]} />);

    expect(pointsOf(container)).toBe('0,98 50,50 100,2');
  });

  it('draws a line through the middle when every value is identical', () => {
    const { container } = render(<Sparkline values={[5, 5, 5]} />);

    expect(pointsOf(container)).toBe('0,50 50,50 100,50');
  });

  it('renders nothing when there is less than a line to draw', () => {
    const { container: empty } = render(<Sparkline values={[]} />);
    const { container: single } = render(<Sparkline values={[7]} />);

    expect(empty.querySelector('svg')).not.toBeInTheDocument();
    expect(single.querySelector('svg')).not.toBeInTheDocument();
  });
});
