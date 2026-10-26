import React from 'react';

import { render } from '@testing-library/react';

import '@testing-library/jest-dom';

import Sparkline from 'components/base/Sparkline';

const DAY = 24 * 60 * 60 * 1000;

const pointsOf = (container: HTMLElement) => container.querySelector('polyline')?.getAttribute('points');

/** Evenly spaced a week apart, as the weekly history rows are. */
const weekly = (values: number[]) => values.map((value, index) => ({ value, date: index * 7 * DAY }));

describe('Sparkline', () => {
  it('spreads values across the width and puts the largest at the top', () => {
    const { container } = render(<Sparkline points={weekly([0, 5, 10])} />);

    // y is inset by 2 at each edge so a thick stroke is not clipped at the extremes.
    expect(pointsOf(container)).toBe('0,98 50,50 100,2');
  });

  it('is unaffected by the absolute size of the values', () => {
    const { container } = render(<Sparkline points={weekly([1200, 1205, 1210])} />);

    expect(pointsOf(container)).toBe('0,98 50,50 100,2');
  });

  it('places points by date, so a sample taken sooner draws a shorter segment', () => {
    const points = [
      { value: 0, date: 0 },
      { value: 5, date: DAY },
      { value: 10, date: 10 * DAY },
    ];

    const { container } = render(<Sparkline points={points} />);

    // The middle point is a tenth of the way through the elapsed time, not halfway
    // along the list.
    expect(pointsOf(container)).toBe('0,98 10,50 100,2');
  });

  it('falls back to even spacing when every point shares a timestamp', () => {
    const points = [0, 5, 10].map((value) => ({ value, date: 1000 }));

    const { container } = render(<Sparkline points={points} />);

    expect(pointsOf(container)).toBe('0,98 50,50 100,2');
  });

  it('draws a line through the middle when every value is identical', () => {
    const { container } = render(<Sparkline points={weekly([5, 5, 5])} />);

    expect(pointsOf(container)).toBe('0,50 50,50 100,50');
  });

  it('renders nothing when there is less than a line to draw', () => {
    const { container: empty } = render(<Sparkline points={[]} />);
    const { container: single } = render(<Sparkline points={weekly([7])} />);

    expect(empty.querySelector('svg')).not.toBeInTheDocument();
    expect(single.querySelector('svg')).not.toBeInTheDocument();
  });
});
