import React from 'react';

const WIDTH = 100;
const HEIGHT = 100;
// Keeps a thick stroke from being clipped where the series touches its own extremes.
const INSET = 2;

interface SparklineProps {
  values: number[];
  className?: string;
  title?: string;
}

/**
 * A bare trend line, normalised to its own range so the shape is readable whatever the
 * units. Stroked in currentColor, so callers set the direction colour with a text class.
 */
const Sparkline: React.FC<SparklineProps> = ({ values, className, title }) => {
  if (values.length < 2) {
    return null;
  }

  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = max - min;

  const points = values
    .map((value, index) => {
      const x = (index / (values.length - 1)) * WIDTH;
      // A flat series has no range to normalise against, so it sits on the midline.
      const normalised = span === 0 ? 0.5 : (value - min) / span;
      const y = INSET + (1 - normalised) * (HEIGHT - INSET * 2);

      return `${Math.round(x * 100) / 100},${Math.round(y * 100) / 100}`;
    })
    .join(' ');

  return (
    <svg
      className={className}
      viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
      preserveAspectRatio="none"
      role="img"
      aria-label={title}
    >
      <polyline points={points} fill="none" stroke="currentColor" strokeWidth="2" vectorEffect="non-scaling-stroke" />
    </svg>
  );
};

export default Sparkline;
