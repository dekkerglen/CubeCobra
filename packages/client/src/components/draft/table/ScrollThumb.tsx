import React, { useEffect } from 'react';

import { motion, MotionValue, useMotionValue } from 'framer-motion';

interface ScrollThumbProps {
  scroll: MotionValue<number>;
  max: number;
  // Track position and length, in stage pixels.
  left: number;
  top: number;
  height: number;
}

/** A thin scrollbar showing where a scrolling region of the stage is scrolled to. */
const ScrollThumb: React.FC<ScrollThumbProps> = ({ scroll, max, left, top, height }) => {
  const thumbHeight = max > 0 ? Math.max(28, (height * height) / (height + max)) : 0;
  const thumbY = useMotionValue(0);
  useEffect(() => {
    if (max <= 0) return undefined;
    const update = (value: number) => thumbY.set((value / max) * (height - thumbHeight));
    update(scroll.get());
    return scroll.on('change', update);
  }, [scroll, max, height, thumbHeight, thumbY]);

  if (max <= 0) return null;
  return (
    <div className="absolute w-1.5 rounded-full bg-border/70 pointer-events-none" style={{ left, top, height }}>
      <motion.div
        className="absolute inset-x-0 top-0 rounded-full bg-text-secondary/70"
        style={{ height: thumbHeight, y: thumbY }}
      />
    </div>
  );
};

export default ScrollThumb;
