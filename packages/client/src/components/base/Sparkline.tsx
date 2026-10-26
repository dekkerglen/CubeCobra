import React from 'react';

const WIDTH = 100;
const HEIGHT = 100;
// Keeps a thick stroke from being clipped where the series touches its own extremes.
const INSET = 2;

export interface SparkPoint {
  value: number;
  /** Epoch milliseconds. Points are expected in ascending order. */
  date: number;
}

interface SparklineProps {
  points: SparkPoint[];
  className?: string;
  title?: string;
  style?: React.CSSProperties;
}

/**
 * A bare trend line, normalised to its own range so the shape is readable whatever the
 * units, and positioned along the x axis by date so uneven sampling reads honestly.
 * Stroked in currentColor, so callers set the colour with a text class.
 */
const Sparkline: React.FC<SparklineProps> = ({ points, className, title, style }) => {
  if (points.length < 2) {
    return null;
  }

  const values = points.map((point) => point.value);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = max - min;

  const dates = points.map((point) => point.date);
  const start = Math.min(...dates);
  const elapsed = Math.max(...dates) - start;

  const plotted = points
    .map((point, index) => {
      // By date rather than position, so a sample taken a day after the one before it
      // draws a short segment instead of a full week's worth of slope. Even spacing is
      // the fallback when every point shares a timestamp, which has no elapsed time to
      // divide by.
      const progress = elapsed === 0 ? index / (points.length - 1) : (point.date - start) / elapsed;
      // A flat series has no range to normalise against, so it sits on the midline.
      const normalised = span === 0 ? 0.5 : (point.value - min) / span;

      const x = progress * WIDTH;
      const y = INSET + (1 - normalised) * (HEIGHT - INSET * 2);

      return `${Math.round(x * 100) / 100},${Math.round(y * 100) / 100}`;
    })
    .join(' ');

  return (
    <svg
      className={className}
      style={style}
      viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
      preserveAspectRatio="none"
      role="img"
      aria-label={title}
    >
      <polyline points={plotted} fill="none" stroke="currentColor" strokeWidth="2" vectorEffect="non-scaling-stroke" />
    </svg>
  );
};

export default Sparkline;
